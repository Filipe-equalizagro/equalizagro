# Aprendizado — Equalizagro / go2apply

Este documento é só para você. A cada mudança de código, antes de executar, vou explicar aqui o que estou fazendo, por quê, e o conceito técnico por trás — pra você conseguir ler o código e entender sozinho no futuro.

Formato de cada entrada: **conceito** → o que é, por que importa, onde aparece no nosso código, e o trecho relevante.

---

## 2026-07-27 — Header vs. Body: onde colocar um token numa requisição HTTP

**O que é.** Toda requisição HTTP tem três lugares onde dá pra colocar informação: a **URL**, os **headers** (cabeçalhos — metadados sobre a requisição) e o **body** (corpo — os dados em si, ex.: o JSON que você envia num POST). Tecnicamente, um token funciona em qualquer um dos três. A diferença é *convenção* e *tratamento por ferramentas*:

- O header `Authorization: Bearer <token>` é o lugar padrão da web inteira pra credenciais. Proxies, logs de servidor, ferramentas de monitoramento (APM) e até o próprio navegador tratam esse header com mais cuidado — muitos sistemas de log mascaram ou nem gravam esse header por padrão.
- O **body** é tratado como "dado comum da aplicação". Ferramentas de log, sistemas de observabilidade e o próprio DevTools do navegador mostram o body inteiro, sem filtro nenhum — é o primeiro lugar que qualquer ferramenta de debug exibe.

Ou seja: colocar um token no body não é "inseguro" no sentido de criptografia (HTTPS protege os dois igual, em trânsito), mas é uma pegadinha operacional — aumenta muito a chance desse valor acabar aparecendo em algum log, screenshot de suporte, ou ferramenta de terceiro sem querer.

**Por que apareceu aqui.** No `ConsultorIA.tsx`, a chamada pro nosso próprio backend (`/api/consultor/chat`) mandava o token de sessão do usuário dentro do JSON do body:

```ts
// ANTES — token viaja junto com os dados, aparece no "Payload" do DevTools
body: JSON.stringify({
  message: combinedMessage,
  token: getAuthToken(),   // ❌ token junto com dado comum
  ...
})
```

O mesmo padrão se repetia em `calculadora-bicos.html` (2 lugares) e no `consultor-kow.html` que acabei de criar.

**A correção.** Mover o token pro header `Authorization`, e tirar ele do body:

```ts
// DEPOIS
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`,   // ✅ token isolado no header
},
body: JSON.stringify({
  message: combinedMessage,
  // sem token aqui
  ...
})
```

Do lado do servidor (`route.ts`), a leitura já sabia procurar no header como alternativa — só precisei inverter a ordem de prioridade pra ele checar o header **primeiro**, e só usar o body como plano B (compatibilidade, caso algum lugar antigo ainda mande do jeito velho):

```ts
// ANTES: body tinha prioridade
const authToken = token || request.headers.get('authorization')?.replace('Bearer ', '');

// DEPOIS: header tem prioridade
const authToken = request.headers.get('authorization')?.replace('Bearer ', '') || token;
```

**Onde isso vale sempre.** Qualquer valor que sirva pra **autenticar** a requisição (token de sessão, chave de API, senha) vai no header. Valores que são **o conteúdo da ação em si** (a mensagem do chat, o email digitado num formulário de recuperação de senha, o código de 6 dígitos do 2FA) continuam no body normalmente — esses não são "credenciais reutilizáveis", são a própria informação que a pessoa está enviando naquela ação específica.

**Arquivos tocados nesta correção:**
- `src/components/ConsultorIA/ConsultorIA.tsx`
- `public/ferramentas/calculadora-bicos.html`
- `public/ferramentas/consultor-kow.html`
- `src/app/api/consultor/chat/route.ts`
- `src/app/api/kow/perguntar/route.ts`
- `src/app/api/tools/track-usage/route.ts` (esse nem sabia ler o header ainda — adicionei o suporte)

---

## 2026-07-27 — Nosso backend como "proxy": o servidor no meio de duas conversas

**O que é.** Um proxy, aqui, é o nosso servidor Next.js fazendo o papel de intermediário entre o navegador do cliente e um serviço externo (o n8n) — o navegador nunca fala direto com o n8n, ele fala com a gente, e a gente repassa pro n8n. Duas conversas separadas:

```
Navegador  ──POST /api/kow/perguntar──▶  Nosso servidor  ──POST webhook──▶  n8n
           (token de sessão no header)                    (X-Aton-Key no header)
```

**Por que isso importa pra segurança.** O navegador do cliente **nunca vê** o `KOW_ATON_KEY` — essa chave só existe nas variáveis de ambiente do servidor (`process.env.KOW_ATON_KEY`) e é usada dentro da função que roda no servidor, nunca enviada como resposta pro navegador. Mesmo abrindo o DevTools e olhando a aba Network, o cliente só vê a chamada dele pro **nosso** `/api/kow/perguntar` — a segunda chamada (nosso servidor → n8n) acontece inteiramente do lado de fora, invisível pra qualquer ferramenta do navegador.

**Por que o Consultor Kow mudou de arquitetura.** Antes eu tinha feito o servidor chamar a API da Anthropic direto, com a gente montando o prompt e lendo a planilha. Agora toda essa lógica de negócio (base de produtos, faixas de Kow, IA) passou a viver dentro do workflow do n8n — nosso servidor só repassa `{ pergunta, sessionId }` com o header certo e devolve pro navegador o que o n8n respondeu:

```ts
// src/app/api/kow/perguntar/route.ts
const r = await fetch(KOW_N8N_WEBHOOK, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Aton-Key': KOW_ATON_KEY,   // nunca no body, nunca visível ao cliente
  },
  body: JSON.stringify({ pergunta, sessionId }),
});
```

**`sessionId`: por que uma conversa precisa de identificador.** O n8n workflow guarda contexto entre mensagens (ex.: perguntou "você quis dizer MSMA ou DSMA?" e precisa lembrar disso quando a pessoa responder só "1"). Como o HTTP é *stateless* (cada requisição chega "do zero", sem memória da anterior), a única forma do n8n saber "essas 3 mensagens são da mesma conversa" é a gente mandar sempre o mesmo `sessionId` enquanto durar aquele papo — e gerar um novo quando o usuário começar uma conversa nova.

**"Zero regra de negócio no front" — UI dirigida pelo servidor.** Antes, o `consultor-kow.html` tinha busca de produto, calculadora de faixa de Kow e uma barra visual — tudo decidindo, no navegador, o que mostrar. Na nova versão, o front não decide nada: ele manda `{ pergunta, sessionId }` e recebe de volta `{ resposta, tipo, opcoes }`. O campo `tipo` é quem manda na interface — se vier `"ambiguo"`, a gente desenha botões com as `opcoes`; qualquer outro valor, só mostra o texto. Isso significa que amanhã, se o n8n passar a devolver um novo `tipo`, o comportamento muda **sem eu tocar em uma linha de código do front** — toda a inteligência fica de um lado só (o n8n), o front só exibe.

```js
// public/ferramentas/consultor-kow.html
addMessage(data.resposta, 'bot');
if (data.tipo === 'ambiguo' && Array.isArray(data.opcoes) && data.opcoes.length){
  addOpcoes(data.opcoes);   // desenha um botão por opção
}
```

**Duas chaves diferentes, dois nomes de variável diferentes.** O Consultor.IA usa `ATON_KEY` pro webhook dele; o Consultor Kow usa `KOW_ATON_KEY` pro webhook dele — são segredos diferentes, então usei nomes diferentes. Se algum dia os dois usassem o mesmo valor, ainda faria sentido ter variáveis separadas: cada integração externa deveria poder trocar sua própria chave sem afetar a outra.

---

## 2026-07-27 — Uma função só decide o acesso (e por que isso facilita mudar de ideia)

**O que é.** `checkAccess(userId)`, em `src/lib/subscriptions.ts`, é a **única** função que decide se alguém pode usar Consultor.IA ou Consultor Kow. Tanto `chat/route.ts` quanto `kow/perguntar/route.ts` chamam essa mesma função — nenhum dos dois tem sua própria lógica de "quem pode entrar".

**Por que isso importa.** Você me disse que crédito avulso não existe mais como forma de acesso — só assinatura (mensal/anual) ou isenção da equipe. Como só existe **um lugar** decidindo isso, a correção inteira foi trocar essas poucas linhas:

```ts
// ANTES — três caminhos de acesso
if (billing_exempt) return { allowed: true, unlimited: true, exempt: true };
const subscribed = await hasActiveSubscription(userId);
if (subscribed) return { allowed: true, unlimited: true, exempt: false };
const hasCredits = Number(credits_balance || 0) > 0;
return { allowed: hasCredits, unlimited: false, exempt: false };   // ❌ crédito avulso também liberava

// DEPOIS — só dois caminhos
if (billing_exempt) return { allowed: true, unlimited: true, exempt: true };
const subscribed = await hasActiveSubscription(userId);
if (subscribed) return { allowed: true, unlimited: true, exempt: false };
return { allowed: false, unlimited: false, exempt: false };        // ✅ mais nada libera
```

Se essa regra estivesse duplicada em vários arquivos (cada rota com sua própria checagem), eu teria que caçar e trocar em cada um — e corria o risco de esquecer algum lugar, deixando uma porta aberta sem querer. Centralizar a regra de negócio numa função só é o que torna uma mudança de política (como essa) segura de fazer rápido.

**Efeito cascata.** Como `hasAccess` no dashboard (`go2apply/page.tsx`) e o bloqueio de cada ferramenta vêm todos dessa mesma função, a correção valeu pros dois lugares automaticamente — não precisei mexer na tela do dashboard.

---

## 2026-07-27 — Consentimento como dado, não só como tela

**O que é.** Marcar um checkbox de "li e concordo" é fácil de fazer só na tela (esconder um botão até marcar). O ponto que exige mais cuidado é: **isso precisa virar um registro no banco**, não só um estado passageiro do formulário — porque se algum dia a empresa precisar provar que um usuário específico aceitou os Termos (uma disputa, uma auditoria), a única prova válida é algo gravado, com data, não a lembrança de que "a tela pedia pra marcar".

**Como ficou.** Duas colunas novas na tabela `users`:

```sql
ALTER TABLE equalizagro.users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE equalizagro.users ADD COLUMN IF NOT EXISTS terms_version TEXT;
```

`terms_accepted_at` é o **quando** (data/hora exata do aceite). `terms_version` é o **qual versão** — guardo a data de "Última atualização" que está escrita nos próprios PDFs (`2026-07-24`). Por que guardar a versão? Porque os Termos podem mudar no futuro; se isso acontecer, dá pra saber exatamente quais usuários aceitaram a versão antiga e ainda não confirmaram a nova — sem essa coluna, seria impossível diferenciar.

**Backend rejeita antes de gravar qualquer coisa.** Em `src/app/api/auth/register/route.ts`, se `termsAccepted !== true`, a conta nem chega a ser criada:

```ts
if (role !== 'team' && termsAccepted !== true) {
  throw new ApiError(400, 'É necessário aceitar os Termos de Uso e a Política de Privacidade para se cadastrar');
}
```

Isso é proposital: validar só no front (esconder o botão) não impede alguém de chamar a API diretamente pulando a tela. A regra real mora no servidor; o checkbox no front é conveniência de UX, não a proteção em si.

---

## 2026-07-27 — Estado do React some fácil; sessionStorage sobrevive a um recarregamento

**O problema.** Na tela "Verifique seu email", quando o polling detecta que o email foi confirmado (em outro dispositivo), o código tentava logar automaticamente usando `form.password` — a senha guardada em memória, num `useState` do React. O problema: **estado do React vive só enquanto o componente está montado**. Ele some se a pessoa recarregar a página, fechar e reabrir a aba, ou (no ambiente de desenvolvimento) se eu editar um arquivo e o Next.js remontar o componente via hot-reload. Foi exatamente isso que testei e reproduzi: recarreguei a aba "Verifique seu email" de propósito, e a senha desaparecia — o login automático falhava e caía na tela genérica em vez de ir para os planos.

**A diferença entre os tipos de armazenamento no navegador:**
- **Estado do React (`useState`)** — vive na memória da aba, morre a qualquer recarregamento ou fechamento.
- **`sessionStorage`** — sobrevive a recarregamentos da mesma aba, mas some se a aba fechar ou for pra outro navegador/dispositivo.
- **`localStorage`** — sobrevive a tudo isso, só some se a pessoa limpar manualmente (é onde guardamos o `authToken` de sessão de login, por exemplo).

Cada um serve para um propósito diferente: dado que só faz sentido durante ESTA visita a ESTA tela vai em `sessionStorage`; dado que precisa persistir entre sessões (login) vai em `localStorage`; dado que só serve enquanto o componente está na tela vai em `useState`.

**A correção.** Ao cadastrar, salvo email+senha no `sessionStorage`:
```ts
sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email: form.email, password: form.password }));
```
E, ao carregar a página (sem token na URL), restauro isso e retomo a etapa "verify" — inclusive o polling, que só roda quando `step === 'verify'`:
```ts
const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY));
if (pending?.email) {
  setVerifyEmail(pending.email);
  setForm(p => ({ ...p, email: pending.email, password: pending.password || '' }));
  setStep('verify');
}
```
Limpo o `sessionStorage` assim que o login automático acontece (ou cai no fallback), pra não deixar a senha guardada além do necessário.

**Por que não usar `localStorage` pra isso?** Guardar uma senha em texto puro por mais tempo do que o estritamente necessário aumenta o risco (qualquer script na página, ou uma extensão do navegador, poderia ler). `sessionStorage` limita a janela de exposição a "só durante essa aba, só até confirmar o email" — o menor prazo que ainda resolve o problema.

---

## 2026-07-27 — Um estado "pendente" precisa de prazo de validade

**O bug.** Sua conta ficou travada com "Usuário já possui uma assinatura em andamento" mesmo sem nunca ter concluído nenhuma assinatura. A causa: quando você abre o checkout da Stripe e fecha sem pagar, o sistema cria uma linha `status = 'incomplete'` — e essa linha só vira `canceled` quando um evento de webhook (`checkout.session.expired`) chega da Stripe avisando que a sessão expirou. O código só tratava esse evento pro boleto anual; pra assinatura recorrente normal (cartão), o evento chegava e era **ignorado**. A linha ficava `incomplete` pra sempre, e a trava de "não deixar duas assinaturas ao mesmo tempo" bloqueava qualquer nova tentativa, sem prazo.

**A correção tem duas camadas** (defesa em profundidade — se uma falhar, a outra ainda protege):

1. **Corrigi o evento em si** para tratar qualquer checkout expirado, não só o boleto anual (`src/app/api/payments/webhook/route.ts`).
2. **Adicionei um prazo de validade na própria checagem de duplicidade** (`create-checkout/route.ts`): uma linha `incomplete` com mais de 24 horas passa a ser ignorada, mesmo que o webhook nunca tenha chegado:
```sql
status IN ('trialing', 'active', 'past_due')
OR (status = 'incomplete' AND created_at > NOW() - INTERVAL '24 hours')
```
Por quê 24h? É o mesmo prazo que a própria Stripe usa como padrão pra expirar uma sessão de checkout — depois disso, o link nem funciona mais na Stripe, então não faz sentido nosso lado continuar bloqueando.

**A lição geral:** todo "status pendente/em andamento" que depende de um evento externo pra ser resolvido (webhook, callback, confirmação) precisa de uma segunda via de saída baseada em tempo — nunca confie 100% em um único evento chegar. Sem isso, qualquer falha de entrega (rede, retry esgotado, um caso não tratado) trava a pessoa permanentemente, sem ela ter feito nada de errado.

---

## 2026-07-28 — Esconder elemento vs. desabilitar elemento

**O que é.** Quando uma opção não se aplica ao estado atual (ex.: Boleto não existe para o plano Mensal), tem duas formas de tratar isso na interface:

1. **Esconder** o elemento inteiro (`{condição && <botão/>}`) — some da tela.
2. **Desabilitar** o elemento (`disabled={!condição}`) — continua visível, mas cinza e não clicável.

A diferença importa pra quem usa: esconder muda o *layout* — outros elementos pulam de posição, e a pessoa pode achar que a opção nunca existiu ou que é bug. Desabilitar mantém o layout estável e comunica "essa opção existe, mas não pra essa escolha agora" — o que é mais claro quando as opções fazem parte do mesmo grupo (ex.: forma de pagamento).

**Por que apareceu aqui.** Em [PlanosSection.tsx](src/components/PlanosSection/PlanosSection.tsx) e [SubscriptionModal.tsx](src/components/SubscriptionModal/SubscriptionModal.tsx), a seção "Forma de pagamento" inteira só aparecia quando o plano Anual estava selecionado:

```tsx
// ANTES — a seção inteira some ao escolher Mensal
{isAnualSelected && (
  <div className="planos-choice__payment-method">
    ...botões Cartão de crédito / Boleto...
  </div>
)}
```

Isso deixava confuso: ao trocar de Anual pra Mensal, a seção de pagamento sumia por completo — parecia que o site tinha "perdido" a opção de cartão, não só a de boleto (que é a única realmente indisponível no Mensal).

```tsx
// DEPOIS — a seção fica sempre visível, só o botão Boleto fica desabilitado
<div className="planos-choice__payment-method">
  <button onClick={() => setPaymentMethod('card')}>Cartão de crédito</button>
  <button
    disabled={!isAnualSelected}
    title={!isAnualSelected ? 'Boleto disponível apenas no plano Anual' : undefined}
    className={`...${!isAnualSelected ? ' planos-choice__payment-option--disabled' : ''}`}
    onClick={() => { if (isAnualSelected) setPaymentMethod('boleto'); }}
  >
    Boleto
  </button>
</div>
```

O CSS `--disabled` (cinza, `cursor: not-allowed`) faz o botão *parecer* clicável só o suficiente pra dar a entender "existe, mas não agora", sem enganar ninguém.

---

## 2026-07-28 — `cancel_url` da Stripe não dispara webhook nenhum

**O que é.** Todo Checkout Session da Stripe tem um `success_url` e um `cancel_url`. Muita gente assume que "cancelar o checkout" é um evento que a Stripe nos avisa, igual a um pagamento aprovado. Não é: o `cancel_url` é só um redirecionamento feito pelo **navegador do próprio cliente** quando ele aperta "voltar" na página de pagamento — a Stripe não manda nada pro nosso servidor nesse momento. O único jeito da Stripe nos avisar que aquele checkout morreu é o evento `checkout.session.expired`, que só chega **~24h depois**, quando a sessão expira sozinha por inatividade.

**Por que isso causava o bug.** Ao criar o checkout, gravamos uma linha `status='incomplete'` no banco pra depois o webhook promover pra `trialing`/`active`. A checagem de "assinatura duplicada" (em [create-checkout/route.ts](src/app/api/subscriptions/create-checkout/route.ts:90)) bloqueia novo checkout enquanto existir uma linha `incomplete` das últimas 24h. Resultado: cliente cancela o pagamento, volta pro site, tenta assinar de novo — e recebe "usuário já possui uma assinatura em andamento", porque a única coisa que limparia aquela linha (o webhook `checkout.session.expired`) simplesmente não chega antes de 24h no caso de cancelamento manual.

**A correção.** Como o `cancel_url` já é uma volta pro nosso próprio front (`/go2apply?subscription=cancelled`), criamos um endpoint dedicado — [cancel-pending/route.ts](src/app/api/subscriptions/cancel-pending/route.ts) — que o [go2apply/page.tsx](src/app/go2apply/page.tsx) chama assim que detecta esse parâmetro na URL, **antes** de checar o acesso:

```ts
const params = new URLSearchParams(window.location.search);
if (params.get('subscription') === 'cancelled') {
  await fetch('/api/subscriptions/cancel-pending', { method: 'POST', ... });
  // remove o parâmetro da URL pra não repetir a limpeza a cada reload
}
```

**A lição geral:** um redirect de "voltar/cancelar" do lado do cliente não é o mesmo que um evento confiável do servidor. Se algo TEM que ser limpo quando o usuário desiste de um fluxo, e o único sinal disso é o navegador voltando pra uma URL nossa, o lugar certo pra fazer essa limpeza é justamente quando essa URL carrega — não esperar um webhook que talvez nunca chegue nesse cenário específico.

---

## 2026-07-28 — Fail-open vs. fail-closed numa checagem de acesso

**O que é.** Quando uma verificação pode falhar (erro de rede, servidor fora do ar, resposta inesperada), existem duas filosofias de tratamento do erro:

- **Fail-open ("falha libera"):** se não deu pra confirmar, assume que está tudo bem e libera.
- **Fail-closed ("falha bloqueia"):** se não deu pra confirmar, assume o pior e bloqueia.

Fail-open é ótimo pra coisas onde um bloqueio incorreto é pior que um acesso incorreto (ex.: um spinner de carregamento que trava a página). Mas pra uma fronteira de **segurança/cobrança** — "essa pessoa pagou ou não?" — é o oposto: um bloqueio incorreto só incomoda (a pessoa recarrega a página e funciona), enquanto uma liberação incorreta dá acesso de graça à plataforma inteira.

**Por que apareceu aqui.** Em [go2apply/page.tsx](src/app/go2apply/page.tsx), a checagem de assinatura tinha exatamente esse problema:

```tsx
// ANTES — qualquer erro de rede ou resposta inesperada libera o acesso
} catch {
  setHasAccess(true);  // ❌ fail-open numa fronteira de cobrança
}
```

Trocamos para `setHasAccess(false)` tanto no `catch` quanto no caso de `data.success` vir `false`. Isso é consistente com a regra de negócio que você já deixou clara antes: sem assinatura ativa (ou isenção), sem acesso — sempre, sem exceção por falha técnica.

---

## 2026-07-28 — Token assinado em fragmento de URL (auth entre dois domínios diferentes)

**O que é.** O Consultor Kow virou um app completamente separado, hospedado no próprio domínio dele (`kow.equalizagro.com`), com base de dados e IA próprias. Isso trocou a arquitetura de novo: antes era um proxy nosso pro n8n; agora é um iframe apontando pra outro servidor inteiro.

**O problema que isso cria.** Login e cookie de sessão só valem no domínio onde foram criados. O `www.equalizagro.com` sabe quem pagou; o `kow.equalizagro.com` não tem como enxergar esse cookie — são servidores diferentes. Sem nada a mais, qualquer pessoa que descobrisse a URL da ferramenta (e ela não é secreta: aparece no `src` do iframe e nos registros públicos de Certificate Transparency de qualquer certificado HTTPS emitido) teria acesso livre, para sempre, sem nunca ter pago.

**A solução: token assinado, de vida curta.** Nosso servidor (que sabe quem pagou) assina um token com um segredo que só ele e o app do Kow conhecem (`KOW_AUTH_SECRET`, cadastrado nos dois lados). O Kow confere a assinatura antes de responder qualquer coisa:

```ts
// src/app/api/kow-token/route.ts
function gerarTokenKow(userId: string): string {
  const payload = JSON.stringify({ sub: userId, exp: Math.floor(Date.now()/1000) + 1800 }); // 30 min
  const corpo = Buffer.from(payload).toString('base64url');
  const assinatura = crypto.createHmac('sha256', KOW_AUTH_SECRET!).update(corpo).digest('hex');
  return `${corpo}.${assinatura}`;
}
```

Só emitimos esse token **depois** de conferir sessão + `checkAccess()` — a mesma regra de acesso do resto da plataforma.

**Por que o token vai depois do `#`, não do `?`.** `?t=TOKEN` é query string — todo proxy, log de acesso e cabeçalho `Referer` no caminho registra o valor. `#t=TOKEN` é fragmento: o navegador nunca envia o que vem depois do `#` para nenhum servidor. O token existe só no lado do cliente, e o app do Kow o lê, guarda em memória (nunca em `localStorage`) e apaga da barra de endereço.

```tsx
// src/app/consultor-kow/page.tsx
setIframeSrc(`${KOW_APP_URL}/#t=${encodeURIComponent(data.token)}`);
```

**Por que expira em 30 minutos.** Um token vazado (print de tela, aba compartilhada, extensão maliciosa) morre sozinho. É o mesmo raciocínio do link de boleto/checkout: curta duração troca "impossível de vazar" (que não existe) por "o vazamento tem prazo de validade".

**Falha fechada.** Se `KOW_AUTH_SECRET` não estiver configurado no servidor, a rota devolve 503 — nunca libera acesso por omissão. Mesmo princípio do fail-closed que já vimos no `go2apply/page.tsx`.

**O que isso NÃO resolve:** um cliente pagante legítimo pode copiar, na tela, o que ele tem direito de ver — nenhum token impede isso. O que o token resolve é *quem* entra e, combinado com auditoria do lado do Kow, *quem* consultou o quê.

---

## 2026-07-28 — Voltamos atrás: Kow dentro do mesmo site (menos peças, mesma proteção)

**O que mudou.** Depois de montar toda a infraestrutura de token entre domínios (item anterior), você perguntou: por que não simplesmente colocar tudo no mesmo repositório? Resposta curta: **fazia sentido**. A separação em outro domínio era uma camada extra de isolamento (se o site principal tivesse uma falha, a base do Kow ficaria protegida em outro lugar), mas o custo — outro repositório, outro projeto Vercel pago, outro DNS, a dança de token — não compensava neste estágio.

**O que se manteve igual, só que local:**
- A base (`base_produtos.json`, 435 ativos) virou [`src/lib/kow/base-produtos.json`](src/lib/kow/base-produtos.json) — só é importada por código que roda no servidor (rotas `/api/kow/*`), nunca por nada que vá pro navegador.
- **Nenhuma rota devolve a base inteira.** [`/api/kow/sugestoes`](src/app/api/kow/sugestoes/route.ts) só devolve nomes (máx. 8, mín. 2 caracteres). [`/api/kow/produto`](src/app/api/kow/produto/route.ts) devolve um produto por vez.
- **A IA nunca recebe a base inteira** — só os produtos que a própria pergunta cita (no máximo 3), calculado em [`produtosRelevantes()`](src/lib/kow/catalog.ts). O que não vai no prompt não pode ser extraído, nem com a pergunta mais engenhosa do mundo:
```ts
// src/lib/kow/catalog.ts
export function produtosRelevantes(pergunta: string): Produto[] {
  // pontua produtos citados no texto da pergunta (nome exato, prefixo, erro de digitação)
  // ...
  return pontuados.slice(0, MAX_PRODUTOS_NO_PROMPT).map((x) => x.p); // no máx. 3
}
```
- Limite de 40 consultas/minuto por usuário (em memória) e auditoria (`console.log` de quem consultou o quê) — [`src/lib/kow/access.ts`](src/lib/kow/access.ts).

**O que ficou mais simples por estar no mesmo domínio:**
- **Sem token HMAC nenhum.** As três rotas reaproveitam a mesma checagem de sessão (`Authorization: Bearer <token>` + `checkAccess()`) que o resto do site já usa — porque agora é tudo o mesmo domínio, o "problema" que o token resolvia (cookie de um domínio não vale no outro) simplesmente não existe.
- **Sem iframe.** [`ConsultorKow.tsx`](src/components/ConsultorKow/ConsultorKow.tsx) é a página em si, não uma tela embutindo outro site.
- **Sem `KOW_AUTH_SECRET`, sem `kow.equalizagro.com`, sem o repositório separado** — o `go2apply-kow` no GitHub fica só como referência histórica, sem uso.

**A lição:** isolar um dado sensível em outro serviço é uma defesa a mais, não a única forma de proteger algo. Quando o custo operacional de manter esse isolamento (dois deploys, dois domínios, autenticação cruzada) supera o risco que ele mitiga, trazer tudo pro mesmo lugar — mantendo as mesmas regras de "nunca devolver a base inteira" e "a IA só vê o recorte da pergunta" — entrega a mesma proteção prática com uma fração da complexidade.

