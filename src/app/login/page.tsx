'use client';

import { useState, useEffect } from 'react';
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { loginWithCredentials, verifySession } from '@/lib/auth';
import './login.css';

export default function LoginPage() {
  const [checking, setChecking]   = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');

  useEffect(() => {
    verifySession().then(r => {
      if (r.valid) window.location.href = '/dashboard';
      else setChecking(false);
    });
  }, []);

  if (checking) return <div className="lp-checking"><div className="lp-spinner" /></div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!email)    errs.email    = 'Email obrigatório';
    if (!password) errs.password = 'Senha obrigatória';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    try {
      const r = await loginWithCredentials({ email, password });
      if (r.success) window.location.href = '/dashboard';
      else setErrors({ submit: r.message });
    } catch {
      setErrors({ submit: 'Erro ao fazer login. Tente novamente.' });
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

          <div className="lp-header">
            <h1 className="lp-title">Entrar na plataforma</h1>
            <p className="lp-sub">Acesse seu painel go2apply</p>
          </div>

          <form onSubmit={handleSubmit} className="lp-form">
            <div className="lp-field">
              <label>Email</label>
              <div className="lp-input-wrap">
                <Mail size={17} className="lp-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
                  placeholder="seu@email.com"
                  className={errors.email ? 'lp-input lp-input--err' : 'lp-input'}
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="lp-err"><AlertCircle size={14} />{errors.email}</p>}
            </div>

            <div className="lp-field">
              <label>Senha</label>
              <div className="lp-input-wrap">
                <Lock size={17} className="lp-icon" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                  placeholder="Sua senha"
                  className={errors.password ? 'lp-input lp-input--err' : 'lp-input'}
                  style={{ paddingRight: '2.8rem' }}
                  autoComplete="current-password"
                />
                <button type="button" className="lp-eye" onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="lp-err"><AlertCircle size={14} />{errors.password}</p>}
            </div>

            {errors.submit && (
              <div className="lp-alert"><AlertCircle size={16} />{errors.submit}</div>
            )}

            <button type="submit" className="lp-btn" disabled={isLoading}>
              {isLoading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="lp-forgot"><a href="/recuperar-senha">Esqueci minha senha</a></p>

          <div className="lp-register-notice">
            <p>Não tem cadastro? Entre em contato com a Equalizagro:</p>
            <a href="https://api.whatsapp.com/send/?phone=555533432606&text=Ol%C3%A1!+Gostaria+de+criar+meu+acesso+na+plataforma+go2apply." target="_blank" rel="noopener noreferrer">
              (55) 3343-2606
            </a>
          </div>

          <p className="lp-footer-link"><a href="/">← Voltar ao site</a></p>
        </div>
      </div>

    </div>
  );
}
