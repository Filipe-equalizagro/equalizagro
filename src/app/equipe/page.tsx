'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, CheckCircle, Eye, EyeOff, Mail } from 'lucide-react';
import { verifySession, registerUser, verifyEmailToken } from '@/lib/auth';
import './equipe.css';

type PageStep = 'form' | 'verify' | 'success';

interface FormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  cargo: string;
  regiao: string;
  interesse: string;
  comoConheceu: string;
}

const CARGOS = [
  'Engenheiro(a) Agrônomo(a)',
  'Técnico(a) Agrícola',
  'Consultor(a) Agronômico(a)',
  'Gerente de Fazenda',
  'Representante Técnico(a)',
  'Pesquisador(a)',
  'Estudante de Agronomia',
  'Outro',
];

const REGIOES = [
  'Norte',
  'Nordeste',
  'Centro-Oeste',
  'Sudeste',
  'Sul',
];

const INTERESSES = [
  'Aplicação de defensivos',
  'Calibração de pulverizadores',
  'Cálculo de caldas',
  'Manejo integrado de pragas',
  'Nutrição de plantas',
  'Todos os acima',
];

const COMO_CONHECEU = [
  'Indicação de colega',
  'Redes sociais',
  'Evento ou feira agro',
  'Pesquisa no Google',
  'WhatsApp / Grupo',
  'Outro',
];

export default function EquipePage() {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [step, setStep] = useState<PageStep>('form');

  // Form state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData & { general: string }>>({});

  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    cargo: '',
    regiao: '',
    interesse: '',
    comoConheceu: '',
  });

  // Verify step state
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Success step state
  const [successName, setSuccessName] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const result = await verifySession();
      if (!result.valid) {
        // Não autenticado → vai para home
        window.location.href = '/';
        return;
      }
      if (!result.isAdmin) {
        // Autenticado mas não é admin → volta ao painel silenciosamente
        window.location.href = '/go2apply';
        return;
      }
      setIsAuthenticated(true);
      setIsAuthChecking(false);
    };
    checkSession();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setForm(prev => ({ ...prev, phone: formatted }));
    if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<FormData & { general: string }> = {};

    if (!form.name || form.name.trim().length < 3)
      newErrors.name = 'Nome deve ter no mínimo 3 caracteres';
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = 'Email inválido';
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10)
      newErrors.phone = 'Telefone inválido (mínimo 10 dígitos)';
    if (!form.password || form.password.length < 8)
      newErrors.password = 'Senha deve ter no mínimo 8 caracteres';
    else if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(form.password))
      newErrors.password = 'Senha deve conter maiúscula, minúscula, número e caractere especial';
    if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = 'As senhas não coincidem';
    if (!form.cargo) newErrors.cargo = 'Selecione seu cargo';
    if (!form.regiao) newErrors.regiao = 'Selecione sua região';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await registerUser({
        name: form.name.trim(),
        email: form.email.toLowerCase().trim(),
        phone: form.phone.replace(/\D/g, ''),
        password: form.password,
        cargo: form.cargo,
        regiao: form.regiao,
        interesse: form.interesse || undefined,
        comoConheceu: form.comoConheceu || undefined,
        role: 'team',
      });

      if (result.success) {
        setPendingEmail(form.email.toLowerCase().trim());
        setPendingToken(result.verificationToken || '');
        setSuccessName(form.name.trim().split(' ')[0]);
        setStep('verify');
      } else {
        setErrors({ general: result.message });
      }
    } catch {
      setErrors({ general: 'Erro inesperado. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setVerifyError('Insira o código de verificação');
      return;
    }
    setIsVerifying(true);
    setVerifyError('');
    try {
      const result = await verifyEmailToken(tokenInput.trim());
      if (result.success) {
        setStep('success');
      } else {
        setVerifyError(result.message || 'Código inválido ou expirado. Tente novamente.');
      }
    } catch {
      setVerifyError('Erro ao verificar. Tente novamente.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(pendingToken).catch(() => {});
    setTokenInput(pendingToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  if (isAuthChecking) {
    return (
      <div className="equipe-loading">
        <div className="equipe-loading__spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  const backHref = isAuthenticated ? '/go2apply' : '/';
  const backLabel = isAuthenticated ? 'Voltar ao painel' : 'Voltar ao site';

  /* ── Verify step ── */
  if (step === 'verify') {
    return (
      <main className="equipe-page">
        <header className="equipe-page__header">
          <button className="equipe-page__back" onClick={() => setStep('form')}>
            <ArrowLeft size={20} />
            <span>Voltar ao formulário</span>
          </button>
        </header>

        <div className="equipe-page__container">
          <div className="equipe-page__verify">
            <div className="equipe-page__verify-icon">
              <Mail size={40} />
            </div>
            <h2 className="equipe-page__verify-title">Verifique sua conta</h2>
            <p className="equipe-page__verify-desc">
              Cadastro realizado com sucesso! Insira o código de verificação enviado
              para <strong>{pendingEmail}</strong> para ativar seu acesso à plataforma.
            </p>

            {pendingToken && (
              <div className="equipe-page__dev-token">
                <span className="equipe-page__dev-token-label">🔧 Token (ambiente de desenvolvimento)</span>
                <code className="equipe-page__dev-token-value">{pendingToken}</code>
                <button
                  type="button"
                  className="equipe-page__dev-token-copy"
                  onClick={handleCopyToken}
                >
                  {tokenCopied ? '✓ Copiado!' : 'Copiar e usar'}
                </button>
              </div>
            )}

            <form className="equipe-page__form" onSubmit={handleVerifyToken} noValidate>
              <div className="equipe-page__field">
                <label htmlFor="token-input">Código de verificação *</label>
                <input
                  id="token-input"
                  type="text"
                  value={tokenInput}
                  onChange={e => { setTokenInput(e.target.value); setVerifyError(''); }}
                  placeholder="Cole o código aqui"
                  className={verifyError ? 'equipe-page__input--error' : ''}
                  autoComplete="off"
                />
                {verifyError && <span className="equipe-page__error">{verifyError}</span>}
              </div>

              <div className="equipe-page__actions">
                <button
                  type="submit"
                  className="equipe-page__btn equipe-page__btn--primary"
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <>
                      <span className="equipe-page__btn-spinner" />
                      Verificando...
                    </>
                  ) : 'Ativar minha conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    );
  }

  /* ── Success step ── */
  if (step === 'success') {
    return (
      <main className="equipe-page">
        <header className="equipe-page__header">
          <Link href={backHref} className="equipe-page__back">
            <ArrowLeft size={20} />
            <span>{backLabel}</span>
          </Link>
        </header>
        <div className="equipe-page__success">
          <div className="equipe-page__success-icon">
            <CheckCircle size={56} />
          </div>
          <h1>Bem-vindo(a), {successName}!</h1>
          <p>
            Sua conta foi verificada e está pronta para uso.
          </p>
          <p className="equipe-page__success-sub">
            Agora você tem acesso ao go2apply, à Calculadora de Bicos e todas as
            ferramentas da plataforma Equalizagro.
          </p>
          <Link href="/" className="equipe-page__btn equipe-page__btn--primary">
            Fazer login agora
          </Link>
        </div>
      </main>
    );
  }

  /* ── Form step (default) ── */
  return (
    <main className="equipe-page">
      <header className="equipe-page__header">
        <Link href={backHref} className="equipe-page__back">
          <ArrowLeft size={20} />
          <span>{backLabel}</span>
        </Link>
      </header>

      <div className="equipe-page__container">
        <div className="equipe-page__intro">
          <div className="equipe-page__intro-icon">
            <Users size={40} />
          </div>
          <h1 className="equipe-page__title">Equipe Equalizagro</h1>
          <p className="equipe-page__subtitle">
            Cadastre-se para acessar a plataforma go2apply.
          </p>
        </div>

        <form className="equipe-page__form" onSubmit={handleSubmit} noValidate>
          <h2 className="equipe-page__form-title">Dados de acesso</h2>

          <div className="equipe-page__field">
            <label htmlFor="name">Nome completo *</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Seu nome completo"
              className={errors.name ? 'equipe-page__input--error' : ''}
            />
            {errors.name && <span className="equipe-page__error">{errors.name}</span>}
          </div>

          <div className="equipe-page__field">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="seu@email.com"
              className={errors.email ? 'equipe-page__input--error' : ''}
            />
            {errors.email && <span className="equipe-page__error">{errors.email}</span>}
          </div>

          <div className="equipe-page__field">
            <label htmlFor="phone">Telefone / WhatsApp *</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={handlePhoneChange}
              placeholder="(11) 99999-9999"
              className={errors.phone ? 'equipe-page__input--error' : ''}
            />
            {errors.phone && <span className="equipe-page__error">{errors.phone}</span>}
          </div>

          <div className="equipe-page__field">
            <label htmlFor="password">Senha *</label>
            <div className="equipe-page__input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                placeholder="Mínimo 8 caracteres"
                className={errors.password ? 'equipe-page__input--error' : ''}
              />
              <button
                type="button"
                className="equipe-page__eye-btn"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span className="equipe-page__error">{errors.password}</span>}
          </div>

          <div className="equipe-page__field">
            <label htmlFor="confirmPassword">Confirmar senha *</label>
            <div className="equipe-page__input-wrap">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Repita sua senha"
                className={errors.confirmPassword ? 'equipe-page__input--error' : ''}
              />
              <button
                type="button"
                className="equipe-page__eye-btn"
                onClick={() => setShowConfirmPassword(v => !v)}
                aria-label={showConfirmPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="equipe-page__error">{errors.confirmPassword}</span>
            )}
          </div>

          <h2 className="equipe-page__form-title equipe-page__form-title--mt">Perfil profissional</h2>

          <div className="equipe-page__field">
            <label htmlFor="cargo">Cargo / Função *</label>
            <select
              id="cargo"
              name="cargo"
              value={form.cargo}
              onChange={handleChange}
              className={errors.cargo ? 'equipe-page__input--error' : ''}
            >
              <option value="">Selecione seu cargo</option>
              {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.cargo && <span className="equipe-page__error">{errors.cargo}</span>}
          </div>

          <div className="equipe-page__field">
            <label htmlFor="regiao">Região de atuação *</label>
            <select
              id="regiao"
              name="regiao"
              value={form.regiao}
              onChange={handleChange}
              className={errors.regiao ? 'equipe-page__input--error' : ''}
            >
              <option value="">Selecione sua região</option>
              {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.regiao && <span className="equipe-page__error">{errors.regiao}</span>}
          </div>

          <div className="equipe-page__field">
            <label htmlFor="interesse">Principal interesse</label>
            <select
              id="interesse"
              name="interesse"
              value={form.interesse}
              onChange={handleChange}
            >
              <option value="">Selecione (opcional)</option>
              {INTERESSES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <div className="equipe-page__field">
            <label htmlFor="comoConheceu">Como conheceu a Equalizagro?</label>
            <select
              id="comoConheceu"
              name="comoConheceu"
              value={form.comoConheceu}
              onChange={handleChange}
            >
              <option value="">Selecione (opcional)</option>
              {COMO_CONHECEU.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {errors.general && (
            <div className="equipe-page__alert equipe-page__alert--error">
              {errors.general}
            </div>
          )}

          <div className="equipe-page__actions">
            <button
              type="submit"
              className="equipe-page__btn equipe-page__btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="equipe-page__btn-spinner" />
                  Cadastrando...
                </>
              ) : (
                'Criar minha conta'
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
