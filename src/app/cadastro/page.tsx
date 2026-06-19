'use client';

import { useState, useEffect } from 'react';
import {
  Mail, Lock, User, Phone, AlertCircle,
  Briefcase, MapPin, CheckCircle,
} from 'lucide-react';
import { registerUser, verifyEmailToken, verifySession } from '@/lib/auth';
import '../login/login.css';

type Step = 'form' | 'verify' | 'done';

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

export default function CadastroPage() {
  // Cadastro público desativado — equipe cadastra via painel admin
  if (typeof window !== 'undefined') window.location.replace('/');

  const [checking, setChecking]       = useState(true);
  const [step, setStep]               = useState<Step>('form');
  const [isLoading, setIsLoading]     = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [devToken, setDevToken]       = useState('');

  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    password: '', confirmPassword: '',
    cargo: '', regiao: '', interesse: '',
  });

  useEffect(() => {
    verifySession().then(r => {
      if (r.valid) window.location.href = '/dashboard';
      else setChecking(false);
    });
  }, []);

  if (checking) return <div className="lp-checking"><div className="lp-spinner" /></div>;

  const set = (k: string, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: '' }));
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
    if (!form.password || form.password.length < 6)
      errs.password = 'Mínimo 6 caracteres';
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = 'Senhas não conferem';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    try {
      const r = await registerUser({
        name: form.name, email: form.email,
        phone: form.phone.replace(/\D/g, ''),
        password: form.password,
        cargo: form.cargo || undefined,
        regiao: form.regiao || undefined,
        interesse: form.interesse || undefined,
      });
      if (r.success) {
        setVerifyEmail(form.email);
        setVerifyToken(r.verificationToken || '');
        setDevToken(r.verificationToken || '');
        setStep('verify');
      } else {
        setErrors({ submit: r.message });
      }
    } catch {
      setErrors({ submit: 'Erro ao cadastrar. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyToken) { setErrors({ verify: 'Código obrigatório' }); return; }
    setIsLoading(true);
    try {
      const r = await verifyEmailToken(verifyToken);
      if (r.success) setStep('done');
      else setErrors({ verify: r.message });
    } catch {
      setErrors({ verify: 'Erro ao verificar. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="lp-root">

      {/* ── Painel esquerdo — imagem ── */}
      <div className="lp-image-panel">
        <div className="lp-image-inner">
          <img src="/images/campo-consultoria.jpeg" alt="Campo agrícola Equalizagro" />
        </div>
      </div>

      {/* ── Painel direito — formulário ── */}
      <div className="lp-form-panel">
        <div className="lp-card">

          <a href="/" className="lp-logo">
            <img src="/images/EQUALIZAGRO ok.png" alt="Equalizagro" />
          </a>

          {/* ── Verificação de email ── */}
          {step === 'verify' && (
            <>
              <div className="lp-header">
                <h1 className="lp-title">Verifique seu email</h1>
                <p className="lp-sub">Enviamos um código para <strong>{verifyEmail}</strong></p>
              </div>

              {devToken && (
                <div className="lp-dev-token">
                  <span>🔧 Token (dev)</span>
                  <code>{devToken}</code>
                </div>
              )}

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
