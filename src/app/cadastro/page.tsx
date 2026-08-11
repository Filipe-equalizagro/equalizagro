'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Mail, Lock, User, Phone, AlertCircle,
  Briefcase, MapPin, CheckCircle, IdCard,
} from 'lucide-react';
import { registerUser, verifyEmailToken, verifySession, loginWithCredentials } from '@/lib/auth';
import { validateCPF, formatCPF } from '@/lib/validators';
import PlanosSection from '@/components/PlanosSection/PlanosSection';
import '../login/login.css';

type Step = 'form' | 'verify' | 'plan' | 'done';

// Slides do painel de imagem — mesmo carrossel usado na tela de login.
const CADASTRO_SLIDES = [
  { src: '/images/laptop_consultoria_taskbar_clean_880x727.png', alt: 'Formação de Caldas — go2apply' },
  { src: '/images/laptop_dmv_taskbar_clean_880x727.png', alt: 'DMV — go2apply' },
];

const SLIDE_INTERVAL_MS = 6000;

const CARGOS = [
  'Engenheiro(a) Agrônomo(a)', 'Técnico(a) Agrícola',
  'Consultor(a) Agronômico(a)', 'Gerente de Fazenda',
  'Representante Técnico(a)', 'Pesquisador(a)',
  'Estudante de Agronomia', 'Outro',
];
const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
const INTERESSES = [
  'Aplicação de defensivos', 'Calibração de pulverizadores',
  'Cálculo de caldas', 'Manejo integrado de pragas',
  'Nutrição de plantas', 'Todos os acima',
];

// Guarda email/senha temporariamente durante a etapa "verifique seu email" —
// só nesta aba (sessionStorage), só até o login automático acontecer. Sem
// isso, um recarregamento da página (ou o hot-reload em desenvolvimento)
// perde a senha da memória do React e o login automático pós-confirmação
// falha, mesmo com o polling funcionando normalmente.
const PENDING_KEY = 'cadastro_pending_verification';

export default function CadastroPage() {
  const [checking, setChecking]       = useState(true);
  const [step, setStep]               = useState<Step>('form');
  const [isLoading, setIsLoading]     = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [newUserId, setNewUserId]     = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', cpf: '',
    password: '', confirmPassword: '',
    cargo: '', regiao: '', interesse: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    verifySession().then(r => {
      if (r.valid) window.location.href = '/go2apply';
      else setChecking(false);
    });
  }, []);

  // Loop automático do carrossel de imagens (mesmo comportamento do login)
  useEffect(() => {
    slideTimerRef.current = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % CADASTRO_SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, []);

  // Clique no link do email (/cadastro?token=...) — verifica automaticamente.
  // Precisa ficar antes do "if (checking) return" abaixo: hooks não podem
  // ser chamados condicionalmente / depois de um retorno antecipado.
  useEffect(() => {
    if (checking) return;
    const params = new URLSearchParams(window.location.search);
    const tokenFromLink = params.get('token');
    if (tokenFromLink) {
      setVerifyToken(tokenFromLink);
      setStep('verify');
      runVerification(tokenFromLink);
      return;
    }

    // Sem token na URL — restaura uma verificação pendente desta mesma aba
    // (ex.: página recarregada, ou hot-reload em dev) para retomar o polling
    // e manter a senha disponível para o login automático.
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) {
        const pending = JSON.parse(raw);
        if (pending?.email) {
          setVerifyEmail(pending.email);
          setForm(p => ({ ...p, email: pending.email, password: pending.password || '' }));
          setStep('verify');
        }
      }
    } catch { /* ignorar */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  // Polling: detecta que o email foi confirmado em OUTRA aba (ex.: a pessoa
  // clicou "Confirmar email" no Gmail, que abriu numa aba separada) e avança
  // esta tela automaticamente, sem precisar recarregar ou colar código.
  useEffect(() => {
    if (step !== 'verify' || !verifyEmail) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/verification-status?email=${encodeURIComponent(verifyEmail)}`);
        const data = await res.json();
        if (data.success && data.verified) {
          clearInterval(interval);
          await proceedAfterVerified();
        }
      } catch {
        // Silencioso — tenta de novo no próximo ciclo
      }
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, verifyEmail]);

  if (checking) return <div className="lp-checking"><div className="lp-spinner" /></div>;

  // Tela de planos ocupa a página inteira — não usa o layout de dois painéis
  // do formulário de cadastro/login.
  if (step === 'plan' && newUserId) {
    return (
      <PlanosSection
        userId={newUserId}
        onSkip={() => { window.location.href = '/go2apply'; }}
      />
    );
  }

  const set = (k: string, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
  };

  // Seleção manual do carrossel — reinicia o timer para não trocar logo em seguida
  const goToSlide = (index: number) => {
    setActiveSlide(index);
    if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    slideTimerRef.current = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % CADASTRO_SLIDES.length);
    }, SLIDE_INTERVAL_MS);
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name)    errs.name    = 'Nome obrigatório';
    if (!form.email)   errs.email   = 'Email obrigatório';
    if (!form.phone || form.phone.replace(/\D/g, '').length < 10)
      errs.phone = 'Telefone inválido';
    if (!form.cpf || !validateCPF(form.cpf))
      errs.cpf = 'CPF inválido';
    if (!form.password || form.password.length < 6)
      errs.password = 'Mínimo 6 caracteres';
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = 'Senhas não conferem';
    if (!termsAccepted)
      errs.terms = 'É necessário aceitar os Termos de Uso e a Política de Privacidade';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    try {
      const r = await registerUser({
        name: form.name, email: form.email,
        phone: form.phone.replace(/\D/g, ''),
        cpf: form.cpf.replace(/\D/g, ''),
        password: form.password,
        termsAccepted: true,
        cargo: form.cargo || undefined,
        regiao: form.regiao || undefined,
        interesse: form.interesse || undefined,
      });
      if (r.success) {
        setVerifyEmail(form.email);
        setStep('verify');
        try {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email: form.email, password: form.password }));
        } catch { /* ignorar — pior caso, cai no fallback de login manual */ }
      } else {
        setErrors({ submit: r.message });
      }
    } catch {
      setErrors({ submit: 'Erro ao cadastrar. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Avança depois que o email foi confirmado (por token ou detectado via
  // polling). Login automático só é possível se a senha ainda estiver
  // disponível (em memória, ou restaurada do sessionStorage desta aba) — se
  // a pessoa confirmou por outro dispositivo E esta aba perdeu a senha
  // (ex.: sessionStorage limpo pelo navegador), cai no fallback de login manual.
  const proceedAfterVerified = async () => {
    if (form.password) {
      const loginResult = await loginWithCredentials({ email: form.email, password: form.password });
      if (loginResult.success && loginResult.userId) {
        try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignorar */ }
        setNewUserId(loginResult.userId);
        setStep('plan');
        return;
      }
    }
    try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignorar */ }
    setStep('done');
  };

  // Reutilizável: chamado tanto pelo botão "Verificar email" quanto
  // automaticamente quando a pessoa clica no link recebido por email.
  const runVerification = async (tokenToVerify: string) => {
    if (!tokenToVerify) { setErrors({ verify: 'Código obrigatório' }); return; }
    setIsLoading(true);
    try {
      const r = await verifyEmailToken(tokenToVerify);
      if (!r.success) {
        setErrors({ verify: r.message });
        return;
      }
      await proceedAfterVerified();
    } catch {
      setErrors({ verify: 'Erro ao verificar. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    await runVerification(verifyToken);
  };

  return (
    <div className="lp-root">

      {/* ── Painel esquerdo — imagem (carrossel) ── */}
      <div className="lp-image-panel">
        <div className="lp-image-inner">
          {CADASTRO_SLIDES.map((slide, index) => (
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              className={`lp-image-slide${index === activeSlide ? ' lp-image-slide--active' : ''}`}
            />
          ))}
          <div className="lp-image-dots">
            {CADASTRO_SLIDES.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                className={`lp-image-dot${index === activeSlide ? ' lp-image-dot--active' : ''}`}
                aria-label={`Mostrar imagem: ${slide.alt}`}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Painel direito — formulário ── */}
      <div className="lp-form-panel">
        <div className="lp-card">

          <a href="/" className="lp-logo">
            <img src="/images/go2apply-logo-colorido.png" alt="Go2apply" />
          </a>

          {/* ── Verificação de email ── */}
          {step === 'verify' && (
            <>
              <div className="lp-header">
                <h1 className="lp-title">Verifique seu email</h1>
                <p className="lp-sub">
                  {verifyEmail
                    ? <>Enviamos um link de confirmação para <strong>{verifyEmail}</strong></>
                    : 'Confirmando seu email...'}
                </p>
                {verifyEmail && (
                  <p className="lp-sub" style={{ fontSize: '0.8rem', marginTop: '-0.5rem' }}>
                    Assim que você clicar no link recebido, esta página avança automaticamente.
                  </p>
                )}
              </div>

              <form onSubmit={handleVerify} className="lp-form">
                <div className="lp-field">
                  <label>Código de verificação</label>
                  <div className="lp-input-wrap">
                    <Mail size={17} className="lp-icon" />
                    <input
                      type="text"
                      value={verifyToken}
                      onChange={e => { setVerifyToken(e.target.value); setErrors({}); }}
                      placeholder="Cole o código recebido"
                      className={errors.verify ? 'lp-input lp-input--err' : 'lp-input'}
                    />
                  </div>
                  {errors.verify && <p className="lp-err"><AlertCircle size={14} />{errors.verify}</p>}
                </div>
                <button type="submit" className="lp-btn" disabled={isLoading}>
                  {isLoading ? 'Verificando…' : 'Verificar email'}
                </button>
              </form>
            </>
          )}

          {/* ── Conta criada ── */}
          {step === 'done' && (
            <>
              <div className="lp-header">
                <h1 className="lp-title">Conta criada! 🎉</h1>
                <p className="lp-sub">Seu cadastro foi verificado com sucesso.</p>
              </div>
              <div className="lp-done">
                <CheckCircle size={52} className="lp-done__icon" />
                <p>Agora você já pode acessar a plataforma Equalizagro.</p>
                <a href="/login" className="lp-btn" style={{ textDecoration: 'none', textAlign: 'center' }}>
                  Fazer login
                </a>
              </div>
            </>
          )}

          {/* ── Formulário de cadastro ── */}
          {step === 'form' && (
            <>
              <div className="lp-header">
                <h1 className="lp-title">Criar conta</h1>
                <p className="lp-sub">Preencha seus dados para se cadastrar</p>
              </div>

              <form onSubmit={handleRegister} className="lp-form">

                <div className="lp-field">
                  <label>Nome completo</label>
                  <div className="lp-input-wrap">
                    <User size={17} className="lp-icon" />
                    <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                      placeholder="Seu nome completo"
                      className={errors.name ? 'lp-input lp-input--err' : 'lp-input'}
                      autoComplete="name" />
                  </div>
                  {errors.name && <p className="lp-err"><AlertCircle size={14} />{errors.name}</p>}
                </div>

                <div className="lp-field">
                  <label>Email</label>
                  <div className="lp-input-wrap">
                    <Mail size={17} className="lp-icon" />
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="seu@email.com"
                      className={errors.email ? 'lp-input lp-input--err' : 'lp-input'}
                      autoComplete="email" />
                  </div>
                  {errors.email && <p className="lp-err"><AlertCircle size={14} />{errors.email}</p>}
                </div>

                <div className="lp-field">
                  <label>Telefone / WhatsApp</label>
                  <div className="lp-input-wrap">
                    <Phone size={17} className="lp-icon" />
                    <input type="tel" value={form.phone}
                      onChange={e => set('phone', formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      className={errors.phone ? 'lp-input lp-input--err' : 'lp-input'}
                      autoComplete="tel" />
                  </div>
                  {errors.phone && <p className="lp-err"><AlertCircle size={14} />{errors.phone}</p>}
                </div>

                <div className="lp-field">
                  <label>CPF</label>
                  <div className="lp-input-wrap">
                    <IdCard size={17} className="lp-icon" />
                    <input type="text" value={form.cpf}
                      onChange={e => set('cpf', formatCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      className={errors.cpf ? 'lp-input lp-input--err' : 'lp-input'}
                      autoComplete="off" />
                  </div>
                  {errors.cpf && <p className="lp-err"><AlertCircle size={14} />{errors.cpf}</p>}
                </div>

                <div className="lp-field">
                  <label>Senha</label>
                  <div className="lp-input-wrap">
                    <Lock size={17} className="lp-icon" />
                    <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className={errors.password ? 'lp-input lp-input--err' : 'lp-input'}
                      autoComplete="new-password" />
                  </div>
                  {errors.password && <p className="lp-err"><AlertCircle size={14} />{errors.password}</p>}
                </div>

                <div className="lp-field">
                  <label>Confirmar senha</label>
                  <div className="lp-input-wrap">
                    <Lock size={17} className="lp-icon" />
                    <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                      placeholder="Repita a senha"
                      className={errors.confirmPassword ? 'lp-input lp-input--err' : 'lp-input'}
                      autoComplete="new-password" />
                  </div>
                  {errors.confirmPassword && <p className="lp-err"><AlertCircle size={14} />{errors.confirmPassword}</p>}
                </div>

                <div className="lp-section-label">
                  <span>Perfil profissional</span>
                  <span className="lp-optional">opcional</span>
                </div>

                <div className="lp-field">
                  <label>Cargo / Função</label>
                  <div className="lp-input-wrap">
                    <Briefcase size={17} className="lp-icon" />
                    <select value={form.cargo} onChange={e => set('cargo', e.target.value)}
                      className="lp-input lp-select">
                      <option value="">Selecione</option>
                      {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="lp-field">
                  <label>Região de atuação</label>
                  <div className="lp-input-wrap">
                    <MapPin size={17} className="lp-icon" />
                    <select value={form.regiao} onChange={e => set('regiao', e.target.value)}
                      className="lp-input lp-select">
                      <option value="">Selecione</option>
                      {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div className="lp-field">
                  <label>Principal interesse</label>
                  <select value={form.interesse} onChange={e => set('interesse', e.target.value)}
                    className="lp-input lp-select" style={{ paddingLeft: '1rem' }}>
                    <option value="">Selecione</option>
                    {INTERESSES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>

                <div className="lp-field lp-terms">
                  <label className="lp-terms__label">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={e => { setTermsAccepted(e.target.checked); setErrors(p => ({ ...p, terms: '' })); }}
                    />
                    <span>
                      Li e concordo com os{' '}
                      <a href="/docs/termos-de-uso.pdf" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
                      {' '}e a{' '}
                      <a href="/docs/politica-de-privacidade.pdf" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>
                      {' '}do go2apply.
                    </span>
                  </label>
                  {errors.terms && <p className="lp-err"><AlertCircle size={14} />{errors.terms}</p>}
                </div>

                {errors.submit && (
                  <div className="lp-alert"><AlertCircle size={16} />{errors.submit}</div>
                )}

                <button type="submit" className="lp-btn" disabled={isLoading}>
                  {isLoading ? 'Cadastrando…' : 'Criar conta'}
                </button>
              </form>

              <div className="lp-divider"><span>Já tem conta?</span></div>

              <a href="/login" className="lp-btn-outline lp-btn-outline--link">
                Fazer login
              </a>
            </>
          )}

          <p className="lp-footer-link"><a href="/">← Voltar ao site</a></p>
        </div>
      </div>
    </div>
  );
}
