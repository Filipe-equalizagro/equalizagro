'use client';

import { useState } from 'react';
import { X, Mail, Lock, User, Phone, AlertCircle, Briefcase, MapPin } from 'lucide-react';
import { loginWithCredentials, registerUser, verifyEmailToken } from '@/lib/auth';
import './UserPanel.css';

type PanelView = 'login' | 'register' | 'verify-email';

interface FormData {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  confirmPassword?: string;
  cargo?: string;
  regiao?: string;
  interesse?: string;
  comoConheceu?: string;
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

const EMPTY_FORM: FormData = {
  email: '',
  password: '',
  name: '',
  phone: '',
  confirmPassword: '',
  cargo: '',
  regiao: '',
  interesse: '',
  comoConheceu: '',
};

export default function UserPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<PanelView>('login');
  const [formData, setFormData] = useState<FormData>({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [devToken, setDevToken] = useState('');

  const handleClose = () => {
    setIsOpen(false);
    setErrors({});
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
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
    setFormData(prev => ({ ...prev, phone: formatted }));
    if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
  };

  const validateLoginForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter no mínimo 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRegisterForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) newErrors.name = 'Nome é obrigatório';

    if (!formData.email) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.phone || formData.phone.replace(/\D/g, '').length < 10) {
      newErrors.phone = 'Telefone inválido (mínimo 10 dígitos)';
    }

    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter no mínimo 6 caracteres';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirmação de senha é obrigatória';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Senhas não conferem';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginForm()) return;

    setIsLoading(true);
    try {
      const response = await loginWithCredentials({
        email: formData.email,
        password: formData.password,
      });

      if (response.success) {
        window.location.href = '/dashboard';
      } else {
        setErrors({ submit: response.message });
      }
    } catch {
      setErrors({ submit: 'Erro ao fazer login. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegisterForm()) return;

    setIsLoading(true);
    try {
      const response = await registerUser({
        name: formData.name!,
        email: formData.email,
        phone: formData.phone!.replace(/\D/g, ''),
        password: formData.password,
        cargo: formData.cargo || undefined,
        regiao: formData.regiao || undefined,
        interesse: formData.interesse || undefined,
        comoConheceu: formData.comoConheceu || undefined,
      });

      if (response.success) {
        setVerificationEmail(formData.email);
        setDevToken(response.verificationToken || '');
        setVerificationToken(response.verificationToken || '');
        setView('verify-email');
      } else {
        setErrors({ submit: response.message });
      }
    } catch {
      setErrors({ submit: 'Erro ao cadastrar. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationToken) {
      setErrors({ verifyEmail: 'Token de verificação é obrigatório' });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await verifyEmailToken(verificationToken);

      if (response.success) {
        setEmailVerified(true);
      } else {
        setErrors({ verifyEmail: response.message });
      }
    } catch {
      setErrors({ verifyEmail: 'Erro ao verificar email. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleView = () => {
    setView(view === 'login' ? 'register' : 'login');
    setErrors({});
    setFormData(EMPTY_FORM);
    setDevToken('');
  };

  return (
    <>
      {/* Botão para abrir o painel */}
      <button
        onClick={() => setIsOpen(true)}
        className="user-panel__trigger"
        aria-label="Abrir painel do usuário"
      >
        <User size={20} />
        <span>Painel do Usuário</span>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="user-panel__overlay"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Painel */}
      <div className={`user-panel ${isOpen ? 'user-panel--open' : ''}`}>
        <div className="user-panel__header">
          <h2 className="user-panel__title">
            {view === 'verify-email'
              ? 'Verificar Email'
              : view === 'login'
              ? 'Fazer Login'
              : 'Criar Conta'}
          </h2>
          <button
            onClick={handleClose}
            className="user-panel__close"
            aria-label="Fechar painel"
          >
            <X size={24} />
          </button>
        </div>

        <div className="user-panel__content">
          {view === 'verify-email' ? (
            <>
              <div className="user-panel__verify-info">
                Enviamos um código para <strong>{verificationEmail || 'seu email'}</strong>.
              </div>

              {devToken && (
                <div className="user-panel__dev-token">
                  <span className="user-panel__dev-token-label">🔧 Token (desenvolvimento)</span>
                  <code className="user-panel__dev-token-value">{devToken}</code>
                </div>
              )}

              <form className="user-panel__form user-panel__form--visible" onSubmit={handleVerifyEmail}>
                <div className="user-panel__form-group">
                  <label htmlFor="verify-email-token" className="user-panel__label">
                    Código de verificação
                  </label>
                  <div className="user-panel__input-wrapper">
                    <Mail size={18} className="user-panel__input-icon" />
                    <input
                      id="verify-email-token"
                      type="text"
                      name="verificationToken"
                      value={verificationToken}
                      onChange={(e) => setVerificationToken(e.target.value)}
                      placeholder="Cole o código recebido"
                      className={`user-panel__input ${errors.verifyEmail ? 'user-panel__input--error' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.verifyEmail && (
                    <p className="user-panel__error">
                      <AlertCircle size={16} />
                      {errors.verifyEmail}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="user-panel__button"
                  disabled={isLoading}
                >
                  {isLoading ? 'Verificando...' : 'Verificar Email'}
                </button>
              </form>

              {emailVerified && (
                <div className="user-panel__success-message">
                  <p>✅ Email verificado com sucesso! Faça login para acessar a plataforma.</p>
                  <button
                    type="button"
                    className="user-panel__button"
                    onClick={() => { setView('login'); setEmailVerified(false); setDevToken(''); }}
                  >
                    Ir para login
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ── Login ── */}
              <form
                className={`user-panel__form ${view === 'login' ? 'user-panel__form--visible' : ''}`}
                onSubmit={handleLogin}
              >
                <div className="user-panel__form-group">
                  <label htmlFor="login-email" className="user-panel__label">Email</label>
                  <div className="user-panel__input-wrapper">
                    <Mail size={18} className="user-panel__input-icon" />
                    <input
                      id="login-email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="seu@email.com"
                      className={`user-panel__input ${errors.email ? 'user-panel__input--error' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && (
                    <p className="user-panel__error">
                      <AlertCircle size={16} />{errors.email}
                    </p>
                  )}
                </div>

                <div className="user-panel__form-group">
                  <label htmlFor="login-password" className="user-panel__label">Senha</label>
                  <div className="user-panel__input-wrapper">
                    <Lock size={18} className="user-panel__input-icon" />
                    <input
                      id="login-password"
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Sua senha"
                      className={`user-panel__input ${errors.password ? 'user-panel__input--error' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.password && (
                    <p className="user-panel__error">
                      <AlertCircle size={16} />{errors.password}
                    </p>
                  )}
                </div>

                {errors.submit && (
                  <div className="user-panel__error-message">
                    <AlertCircle size={16} />{errors.submit}
                  </div>
                )}

                <button type="submit" className="user-panel__button" disabled={isLoading}>
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </button>

                <div className="user-panel__divider">ou</div>

                <button
                  type="button"
                  onClick={toggleView}
                  className="user-panel__link-button"
                  disabled={isLoading}
                >
                  Não tem conta? Cadastre-se
                </button>
              </form>

              {/* ── Registro ── */}
              <form
                className={`user-panel__form ${view === 'register' ? 'user-panel__form--visible' : ''}`}
                onSubmit={handleRegister}
              >
                {/* Dados pessoais */}
                <div className="user-panel__form-group">
                  <label htmlFor="register-name" className="user-panel__label">Nome Completo</label>
                  <div className="user-panel__input-wrapper">
                    <User size={18} className="user-panel__input-icon" />
                    <input
                      id="register-name"
                      type="text"
                      name="name"
                      value={formData.name || ''}
                      onChange={handleInputChange}
                      placeholder="Seu nome completo"
                      className={`user-panel__input ${errors.name ? 'user-panel__input--error' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.name && (
                    <p className="user-panel__error"><AlertCircle size={16} />{errors.name}</p>
                  )}
                </div>

                <div className="user-panel__form-group">
                  <label htmlFor="register-email" className="user-panel__label">Email</label>
                  <div className="user-panel__input-wrapper">
                    <Mail size={18} className="user-panel__input-icon" />
                    <input
                      id="register-email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="seu@email.com"
                      className={`user-panel__input ${errors.email ? 'user-panel__input--error' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && (
                    <p className="user-panel__error"><AlertCircle size={16} />{errors.email}</p>
                  )}
                </div>

                <div className="user-panel__form-group">
                  <label htmlFor="register-phone" className="user-panel__label">Telefone / WhatsApp</label>
                  <div className="user-panel__input-wrapper">
                    <Phone size={18} className="user-panel__input-icon" />
                    <input
                      id="register-phone"
                      type="tel"
                      name="phone"
                      value={formData.phone || ''}
                      onChange={handlePhoneChange}
                      placeholder="(11) 99999-9999"
                      className={`user-panel__input ${errors.phone ? 'user-panel__input--error' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.phone && (
                    <p className="user-panel__error"><AlertCircle size={16} />{errors.phone}</p>
                  )}
                </div>

                <div className="user-panel__form-group">
                  <label htmlFor="register-password" className="user-panel__label">Senha</label>
                  <div className="user-panel__input-wrapper">
                    <Lock size={18} className="user-panel__input-icon" />
                    <input
                      id="register-password"
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Mínimo 6 caracteres"
                      className={`user-panel__input ${errors.password ? 'user-panel__input--error' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.password && (
                    <p className="user-panel__error"><AlertCircle size={16} />{errors.password}</p>
                  )}
                </div>

                <div className="user-panel__form-group">
                  <label htmlFor="register-confirm-password" className="user-panel__label">Confirmar Senha</label>
                  <div className="user-panel__input-wrapper">
                    <Lock size={18} className="user-panel__input-icon" />
                    <input
                      id="register-confirm-password"
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword || ''}
                      onChange={handleInputChange}
                      placeholder="Confirme sua senha"
                      className={`user-panel__input ${errors.confirmPassword ? 'user-panel__input--error' : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="user-panel__error"><AlertCircle size={16} />{errors.confirmPassword}</p>
                  )}
                </div>

                {/* Perfil profissional (opcional) */}
                <div className="user-panel__section-label">
                  <Briefcase size={13} />
                  Perfil profissional <span className="user-panel__optional">(opcional)</span>
                </div>

                <div className="user-panel__form-group">
                  <label htmlFor="register-cargo" className="user-panel__label">Cargo / Função</label>
                  <div className="user-panel__select-wrapper">
                    <Briefcase size={16} className="user-panel__select-icon" />
                    <select
                      id="register-cargo"
                      name="cargo"
                      value={formData.cargo || ''}
                      onChange={handleInputChange}
                      className="user-panel__select"
                      disabled={isLoading}
                    >
                      <option value="">Selecione (opcional)</option>
                      {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="user-panel__form-group">
                  <label htmlFor="register-regiao" className="user-panel__label">Região de atuação</label>
                  <div className="user-panel__select-wrapper">
                    <MapPin size={16} className="user-panel__select-icon" />
                    <select
                      id="register-regiao"
                      name="regiao"
                      value={formData.regiao || ''}
                      onChange={handleInputChange}
                      className="user-panel__select"
                      disabled={isLoading}
                    >
                      <option value="">Selecione (opcional)</option>
                      {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div className="user-panel__form-group">
                  <label htmlFor="register-interesse" className="user-panel__label">Principal interesse</label>
                  <select
                    id="register-interesse"
                    name="interesse"
                    value={formData.interesse || ''}
                    onChange={handleInputChange}
                    className="user-panel__select user-panel__select--plain"
                    disabled={isLoading}
                  >
                    <option value="">Selecione (opcional)</option>
                    {INTERESSES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>

                <div className="user-panel__form-group">
                  <label htmlFor="register-como" className="user-panel__label">Como conheceu a Equalizagro?</label>
                  <select
                    id="register-como"
                    name="comoConheceu"
                    value={formData.comoConheceu || ''}
                    onChange={handleInputChange}
                    className="user-panel__select user-panel__select--plain"
                    disabled={isLoading}
                  >
                    <option value="">Selecione (opcional)</option>
                    {COMO_CONHECEU.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {errors.submit && (
                  <div className="user-panel__error-message">
                    <AlertCircle size={16} />{errors.submit}
                  </div>
                )}

                <button type="submit" className="user-panel__button" disabled={isLoading}>
                  {isLoading ? 'Cadastrando...' : 'Criar Conta'}
                </button>

                <div className="user-panel__divider">ou</div>

                <button
                  type="button"
                  onClick={toggleView}
                  className="user-panel__link-button"
                  disabled={isLoading}
                >
                  Já tem conta? Faça login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
