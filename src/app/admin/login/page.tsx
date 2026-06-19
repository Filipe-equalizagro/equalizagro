'use client';

import { useState, useEffect } from 'react';
import { Mail, Lock, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { loginWithCredentials, verifySession } from '@/lib/auth';
import './admin-login.css';

export default function AdminLoginPage() {
  const [checking, setChecking]   = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');

  useEffect(() => {
    verifySession().then(r => {
      if (r.valid && r.role === 'admin') window.location.href = '/admin';
      else setChecking(false);
    });
  }, []);

  if (checking) return <div className="adm-lp-checking"><div className="adm-lp-spinner" /></div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Preencha todos os campos.'); return; }

    setIsLoading(true);
    setError('');

    try {
      const res = await loginWithCredentials({ email, password });
      if (!res.success) { setError(res.message || 'Credenciais inválidas.'); return; }

      // Verifica role após login
      const session = await verifySession();
      if (!session.valid) { setError('Erro ao verificar sessão. Tente novamente.'); return; }
      if (session.role !== 'admin') {
        // Não é admin — desloga e manda para home
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInitial');
        localStorage.removeItem('userName');
        window.location.href = '/';
        return;
      }

      window.location.href = '/admin';
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="adm-lp-root">
      <div className="adm-lp-card">
        <div className="adm-lp-logo">
          <img src="/images/EQUALIZAGRO ok.png" alt="Equalizagro" />
        </div>

        <div className="adm-lp-badge">
          <ShieldCheck size={15} />
          <span>Acesso Administrativo</span>
        </div>

        <h1 className="adm-lp-title">Painel Admin</h1>
        <p className="adm-lp-subtitle">Restrito a administradores autorizados.</p>

        <form onSubmit={handleSubmit} className="adm-lp-form">
          <div className="adm-lp-field">
            <label>Email</label>
            <div className="adm-lp-input-wrap">
              <Mail size={16} className="adm-lp-icon" />
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                className="adm-lp-input"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="adm-lp-field">
            <label>Senha</label>
            <div className="adm-lp-input-wrap">
              <Lock size={16} className="adm-lp-icon" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="adm-lp-input adm-lp-input--pass"
                autoComplete="current-password"
              />
              <button type="button" className="adm-lp-eye" onClick={() => setShowPass(v => !v)}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="adm-lp-error">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="adm-lp-submit" disabled={isLoading}>
            {isLoading ? <div className="adm-lp-spinner adm-lp-spinner--sm" /> : 'Entrar'}
          </button>
        </form>

        <a href="/" className="adm-lp-back">← Voltar ao site</a>
      </div>
    </div>
  );
}
