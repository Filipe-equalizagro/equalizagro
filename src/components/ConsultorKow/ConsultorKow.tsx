'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { getAuthToken, verifySession } from '@/lib/auth';
import './ConsultorKow.css';

interface PhBand {
  min: number;
  max: number;
  label: string;
}

interface Produto {
  produto: string;
  kowTexto: string;
  kow: number | null;
  tend: string;
  faixa: number | null;
  phHidro: PhBand | 'estavel' | null;
  phLipo: PhBand | 'estavel' | null;
}

const FORMULACOES = [
  { codigo: 'GW', categoria: 'Soluções' }, { codigo: 'LS', categoria: 'Soluções' },
  { codigo: 'SG', categoria: 'Soluções' }, { codigo: 'SL', categoria: 'Soluções' },
  { codigo: 'SP', categoria: 'Soluções' }, { codigo: 'SS', categoria: 'Soluções' },
  { codigo: 'ST', categoria: 'Soluções' },
  { codigo: 'EC', categoria: 'Emulsões' }, { codigo: 'EG', categoria: 'Emulsões' },
  { codigo: 'EO', categoria: 'Emulsões' }, { codigo: 'EP', categoria: 'Emulsões' },
  { codigo: 'ES', categoria: 'Emulsões' }, { codigo: 'EW', categoria: 'Emulsões' },
  { codigo: 'GL', categoria: 'Emulsões' }, { codigo: 'ME', categoria: 'Emulsões' },
  { codigo: 'CF', categoria: 'Suspensões' }, { codigo: 'CS', categoria: 'Suspensões' },
  { codigo: 'DC', categoria: 'Suspensões' }, { codigo: 'FS', categoria: 'Suspensões' },
  { codigo: 'OD', categoria: 'Suspensões' }, { codigo: 'OF', categoria: 'Suspensões' },
  { codigo: 'OP', categoria: 'Suspensões' }, { codigo: 'PC', categoria: 'Suspensões' },
  { codigo: 'SC', categoria: 'Suspensões' }, { codigo: 'SD', categoria: 'Suspensões' },
  { codigo: 'SE', categoria: 'Suspensões' }, { codigo: 'SU', categoria: 'Suspensões' },
  { codigo: 'WG', categoria: 'Suspensões' }, { codigo: 'WP', categoria: 'Suspensões' },
  { codigo: 'WS', categoria: 'Suspensões' }, { codigo: 'WT', categoria: 'Suspensões' },
  { codigo: 'ZC', categoria: 'Suspensões' },
] as const;

const FAIXAS = [
  { i: 0, tend: 'Tensoativo' },
  { i: 1, tend: 'Óleo emulsionável em baixa concentração + tensoativo' },
  { i: 2, tend: 'Óleo emulsionável em concentração moderada + tensoativo' },
  { i: 3, tend: 'Óleo emulsionável em alta concentração, considerando adição de tensoativo' },
  { i: 4, tend: 'Óleo emulsionável em alta concentração' },
];
function faixaDoKow(k: number) { if (k < 1) return FAIXAS[0]; if (k < 250) return FAIXAS[1]; if (k < 500) return FAIXAS[2]; if (k < 1000) return FAIXAS[3]; return FAIXAS[4]; }
function faixaDeTend(tend: string, kow: number | null) {
  const n = String(tend).trim().toLowerCase();
  const i = FAIXAS.findIndex((f) => f.tend.toLowerCase() === n);
  return i >= 0 ? FAIXAS[i] : faixaDoKow(kow || 0);
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function PhRow({ label, band, color }: { label: string; band: PhBand | 'estavel' | null; color: string }) {
  if (band === 'estavel') {
    return <div className="kow-tool__ph-row"><div className="kow-tool__ph-row-label">{label}</div><p className="kow-tool__ph-estavel">Estável / não-ionizável em toda a faixa avaliada.</p></div>;
  }
  if (band == null) {
    return <div className="kow-tool__ph-row"><div className="kow-tool__ph-row-label">{label}</div><p className="kow-tool__ph-estavel">Sem dado de pH disponível para este ativo.</p></div>;
  }
  const left = ((band.min - 3) / 5 * 100).toFixed(1);
  const width = ((band.max - band.min) / 5 * 100).toFixed(1);
  return (
    <div className="kow-tool__ph-row">
      <div className="kow-tool__ph-row-label">{label}</div>
      <div className="kow-tool__ph-track"><div className="kow-tool__ph-fill" style={{ left: `${left}%`, width: `${width}%`, background: color }} /></div>
    </div>
  );
}

export default function ConsultorKow() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [qValue, setQValue] = useState('');
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [sugActive, setSugActive] = useState(-1);
  const [showSug, setShowSug] = useState(false);
  const sugSeqRef = useRef(0);
  const sugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [produto, setProduto] = useState<Produto | null>(null);
  const [formulacao, setFormulacao] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiError, setAiError] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const result = await verifySession();
      if (!result.valid) {
        window.location.href = '/';
        return;
      }
      setIsAuthenticated(true);
      setIsLoading(false);
    };
    check();
  }, []);

  async function kowFetch(rota: string, opts: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any }> {
    const token = getAuthToken();
    const headers = { ...(opts.headers || {}), Authorization: `Bearer ${token}` };
    const resp = await fetch(rota, { ...opts, headers });
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 401 || resp.status === 503) {
      setAccessMessage('Sua sessão expirou. Recarregue a página e faça login novamente.');
    } else if (resp.status === 402) {
      setAccessMessage(data.erro || 'Assine um plano para continuar usando o Consultor Kow.');
    } else if (resp.status === 429) {
      setAccessMessage('Muitas consultas em pouco tempo. Aguarde um instante e tente de novo.');
    }
    return { ok: resp.ok, status: resp.status, data };
  }

  function popularFormulacaoDefault() {
    setFormulacao('');
  }

  function showProduct(p: Produto) {
    setProduto(p);
    popularFormulacaoDefault();
    setAiAnswer(null);
  }

  async function buscarProduto(texto: string): Promise<Produto | null> {
    const { ok, data } = await kowFetch('/api/kow/produto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    });
    return ok ? (data.produto || null) : null;
  }

  function hideSuggest() {
    setShowSug(false); setSugestoes([]); setSugActive(-1);
  }

  function scheduleSuggest(value: string) {
    if (sugTimerRef.current) clearTimeout(sugTimerRef.current);
    // Debounce curto: só evita disparar uma chamada por tecla digitada rápido
    // demais — a sugestão precisa parecer instantânea, já na 1ª letra.
    sugTimerRef.current = setTimeout(() => buscarSugestoes(value), 80);
  }

  async function buscarSugestoes(value: string) {
    const query = value.trim();
    setSugActive(-1);
    if (query.length < 1) { hideSuggest(); return; }
    const seq = ++sugSeqRef.current;
    const { ok, data } = await kowFetch(`/api/kow/sugestoes?q=${encodeURIComponent(query)}`);
    if (seq !== sugSeqRef.current) return;
    const nomes: string[] = ok ? (data.nomes || []) : [];
    setSugestoes(nomes);
    setShowSug(nomes.length > 0);
  }

  async function pickSuggest(nome: string) {
    setQValue(nome);
    hideSuggest();
    setAiAnswer(null);
    const p = await buscarProduto(nome);
    if (p) showProduct(p);
  }

  async function ask() {
    const q = qValue.trim();
    if (!q) return;
    const alvo = await buscarProduto(q);
    if (alvo) { showProduct(alvo); return; }

    setIsAsking(true);
    setAiAnswer('__loading__');
    setAiError(false);
    const { ok, data } = await kowFetch('/api/kow/perguntar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta: q }),
    });
    if (ok) {
      setAiAnswer(data.resposta || 'Não consegui gerar uma resposta. Reformule a pergunta.');
      setAiError(false);
    } else {
      setAiAnswer(data.erro || 'Não foi possível consultar agora. Tente novamente em instantes.');
      setAiError(true);
    }
    setIsAsking(false);
  }

  const faixaIndex = useMemo(() => {
    if (!produto) return null;
    if (typeof produto.faixa === 'number') return produto.faixa;
    if (produto.kow != null) return faixaDeTend(produto.tend, produto.kow).i;
    return null;
  }, [produto]);

  const formulacaoAtual = FORMULACOES.find((f) => f.codigo === formulacao);
  const temPh = produto ? (produto.phHidro != null || produto.phLipo != null) : false;

  if (isLoading) {
    return (
      <div className="kow-tool__loading">
        <div className="kow-tool__loading-spinner" />
        <img src="/images/go2apply-logo-colorido.png" alt="go2apply" className="kow-tool__logo" />
        <p className="kow-tool__muted">Carregando…</p>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="kow-tool">
      <div className="kow-tool__topbar">
        <a href="/go2apply" className="kow-tool__back-link">← Voltar ao Dashboard</a>
      </div>
      <div className="kow-tool__scroll">
        <div className="kow-tool__wrap">
          <header>
            <img src="/images/go2apply-logo-colorido.png" alt="go2apply" className="kow-tool__logo" />
            <p className="kow-tool__lede">Consulte o Kow (coeficiente de partição octanol-água), a tendência de resposta com adjuvantes e pH de calda para cada ingrediente ativo. Pergunte em texto livre ou clique em um produto.</p>
          </header>

          {accessMessage && (
            <div className="kow-tool__card">
              <p className="kow-tool__err">{accessMessage}</p>
            </div>
          )}

          <div className="kow-tool__card">
            <h2>Pergunte</h2>
            <p className="kow-tool__hint">Comece a digitar o nome de um produto para ver sugestões, ou faça uma pergunta em texto livre. Ex.: &quot;Qual o Kow de iodosulfuron?&quot; · &quot;O que é Kow?&quot;</p>
            <div className="kow-tool__ask-row">
              <input
                type="text"
                placeholder="Digite um produto ou uma pergunta…"
                autoComplete="off"
                role="combobox"
                aria-expanded={showSug}
                value={qValue}
                onChange={(e) => { setQValue(e.target.value); scheduleSuggest(e.target.value); }}
                onFocus={() => scheduleSuggest(qValue)}
                onBlur={() => setTimeout(hideSuggest, 120)}
                onKeyDown={(e) => {
                  if (showSug && sugestoes.length) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSugActive((i) => (i + 1 + sugestoes.length) % sugestoes.length); return; }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setSugActive((i) => (i - 1 + sugestoes.length) % sugestoes.length); return; }
                    if (e.key === 'Enter') { e.preventDefault(); pickSuggest(sugestoes[sugActive >= 0 ? sugActive : 0]); return; }
                    if (e.key === 'Escape') { hideSuggest(); return; }
                  }
                  if (e.key === 'Enter') ask();
                }}
              />
              <button className="kow-tool__btn" disabled={isAsking || !qValue.trim()} onClick={() => ask()}>
                {isAsking ? 'Consultando…' : 'Perguntar'}
              </button>
            </div>
            {showSug && sugestoes.length > 0 && (
              <div className="kow-tool__suggest">
                {sugestoes.map((nome, idx) => (
                  <button
                    key={nome}
                    type="button"
                    className={`kow-tool__sug-item${idx === sugActive ? ' kow-tool__sug-item--active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggest(nome)}
                  >
                    {nome}
                  </button>
                ))}
              </div>
            )}
            {aiAnswer !== null && (
              <div className="kow-tool__ai-answer">
                <span className={`kow-tool__ai-tag${aiError ? ' kow-tool__ai-tag--err' : ''}`}>{aiError ? 'Erro' : 'Resposta'}</span>
                {aiAnswer === '__loading__'
                  ? <span className="kow-tool__muted">Processando sua pergunta…</span>
                  : <span dangerouslySetInnerHTML={{ __html: esc(aiAnswer).replace(/\n/g, '<br>') }} />}
              </div>
            )}
          </div>

          {produto && (
            <div className="kow-tool__card">
              <p className="kow-tool__res-prod">{produto.produto}</p>
              <div className="kow-tool__field-label">Kow</div>
              <p className="kow-tool__kow-val">{produto.kowTexto}</p>
              <div className="kow-tool__field-label">Tendência de adjuvante</div>
              <div className="kow-tool__tend-box"><p className="kow-tool__tend-text">{produto.tend}</p></div>
              {faixaIndex != null && (
                <div className="kow-tool__spectrum">
                  <div className="kow-tool__spec-track">
                    <div className="kow-tool__spec-bar"><div className="kow-tool__marker" style={{ left: `${faixaIndex * 20 + 10}%` }} /></div>
                  </div>
                  <div className="kow-tool__spec-ends"><span>Hidrofílico · tensoativo</span><span>Lipofílico · óleo emulsionável</span></div>
                </div>
              )}
              {temPh && (
                <div className="kow-tool__ph-section">
                  <div className="kow-tool__field-label">Tendência de melhor faixa para pH em calda</div>
                  <div className="kow-tool__form-select-row">
                    <label htmlFor="formulacaoSelect">Formulação</label>
                    <select id="formulacaoSelect" value={formulacao} onChange={(e) => setFormulacao(e.target.value)}>
                      <option value="">Todas as formulações</option>
                      {['Soluções', 'Emulsões', 'Suspensões'].map((cat) => (
                        <optgroup key={cat} label={cat}>
                          {FORMULACOES.filter((f) => f.categoria === cat).map((f) => (
                            <option key={f.codigo} value={f.codigo}>{f.codigo}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  {!formulacaoAtual ? (
                    <p className="kow-tool__ph-estavel">Selecione uma formulação para ver a tendência de melhor faixa para pH em calda.</p>
                  ) : (
                    <>
                      <PhRow
                        label={formulacaoAtual.codigo}
                        band={formulacaoAtual.categoria === 'Emulsões' ? produto.phLipo : produto.phHidro}
                        color={formulacaoAtual.categoria === 'Emulsões' ? 'var(--kow-oil)' : 'var(--kow-water)'}
                      />
                      <div className="kow-tool__ph-axis"><span>pH 3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>pH 8</span></div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="kow-tool__note">
            <p>*Não se trata de recomendação agronômica e, sim, tendência de resposta, para subsidiar a construção de recomendações de adjuvantes, compatibilidade e pH de calda.</p>
            <p>**A recomendação deve ser feita por técnico capacitado, avaliando formulação, objetivo e cultura.</p>
            <p>***O Kow pode variar com o pH e outros fatores, o pH alvo com a mistura e cultura, além da formulação, por isso devem ser vistos sempre como tendência e não como números absolutos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
