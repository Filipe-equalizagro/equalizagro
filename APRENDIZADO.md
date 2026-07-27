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

