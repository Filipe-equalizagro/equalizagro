'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import './recuperar-senha.css';

function RecuperarSenhaContent() {
  const params = useSearchParams();
  const token     = params.get('token');
  const sessionId = params.get('sid');
  const isReset   = !!(token && sessionId);

  // ── Estado: solicitar link ──
  const [email, setEmail]           = useState('');
  const [sent, setSent]             = useState(false);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError]     = useState('');

  // ── Estado: nova senha ──
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [resetDone, setResetDone]       = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]     = useState('');

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setReqError('Email obrigatório.'); return; }
    setReqLoading(true); setReqError('');
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setReqError('Erro de conexão. Tente novamente.');
    } finally { setReqLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setResetError('Mínimo 6 caracteres.'); return; }
    if (password !== confirm) { setResetError('As senhas não coincidem.'); return; }
    setResetLoading(true); setResetError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sessionId, password }),
      });
      const data = await res.json();
      if (data.success) setResetDone(true);
      else setResetError(data.message || 'Erro ao redefinir senha.');
    } catch {
      setResetError('Erro de conexão. Tente novamente.');
    } finally { setResetLoading(false); }
  };

  return (
    <div className="rsp-root">
      <div className="rsp-card">
        <a href="/" className="rsp-logo">
          <img src="/images/EQUALIZAGRO ok.png" alt="Equalizagro" />
        </a>

        {/* ── Solicitar link ── */}
        {!isReset && !sent && (
          <>
            <h1 className="rsp-title">Recuperar senha</h1>
            <p className="rsp-subtitle">Digite seu email e enviaremos um link para redefinir sua senha.</p>
            <form onSubmit={handleRequest} className="rsp-form">
              <div className="rsp-field">
                <label>Email</label>
                <div className="rsp-input-wrap">
                  <Mail size={16} className="rsp-icon" />
                  <input
                    type="email" placeholder="seu@email.com"
                    value={email} onChange={e => { setEmail(e.target.value); setReqError(''); }}
                    className="rsp-input"
                  />
                </div>
              </div>
              {reqError && <div className="rsp-error"><AlertCircle size={15}/><span>{reqError}</span></div>}
              <button type="submit" className="rsp-btn" disabled={reqLoading}>
                {reqLoading ? <div className="rsp-spinner" /> : 'Enviar link'}
              </button>
            </form>
          </>
        )}

        {/* ── Email enviado ── */}
        {!isReset && sent && (
          <div className="rsp-success">
            <Mail size={40} className="rsp-success-icon" />
            <h2>Email enviado!</h2>
            <p>Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha em instantes.</p>
          </div>
        )}

        {/* ── Nova senha ── */}
        {isReset && !resetDone && (
          <>
            <h1 className="rsp-title">Nova senha</h1>
            <p className="rsp-subtitle">Escolha uma nova senha para sua conta.</p>
            <form onSubmit={handleReset} className="rsp-form">
              <div className="rsp-field">
                <label>Nova senha</label>
                <div className="rsp-input-wrap">
                  <Lock size={16} className="rsp-icon" />
                  <input
                    type={showPass ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                    value={password} onChange={e => { setPassword(e.target.value); setResetError(''); }}
                    className="rsp-input rsp-input--pass"
                  />
                  <button type="button" className="rsp-eye" onClick={() => setShowPass(v => !v)}>
                    {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
              <div className="rsp-field">
                <label>Confirmar senha</label>
                <div className="rsp-input-wrap">
                  <Lock size={16} className="rsp-icon" />
                  <input
                    type={showPass ? 'text' : 'password'} placeholder="Repita a senha"
                    value={confirm} onChange={e => { setConfirm(e.target.value); setResetError(''); }}
                    className="rsp-input"
                  />
                </div>
              </div>
              {resetError && <div className="rsp-error"><AlertCircle size={15}/><span>{resetError}</span></div>}
              <button type="submit" className="rsp-btn" disabled={resetLoading}>
                {resetLoading ? <div className="rsp-spinner" /> : 'Redefinir senha'}
              </button>
            </form>
          </>
        )}

        {/* ── Senha redefinida ── */}
        {isReset && resetDone && (
          <div className="rsp-success">
            <CheckCircle size={40} className="rsp-success-icon rsp-success-icon--green" />
            <h2>Senha redefinida!</h2>
            <p>Sua senha foi atualizada com sucesso.</p>
            <a href="/login" className="rsp-btn" style={{ textDecoration: 'none', textAlign: 'center' }}>
              Ir para o login
            </a>
          </div>
        )}

        <a href="/login" className="rsp-back">← Voltar ao login</a>
      </div>
    </div>
  );
}

export default function RecuperarSenhaPage() {
  return (
    <Suspense fallback={<div className="rsp-root"><div className="rsp-spinner" /></div>}>
      <RecuperarSenhaContent />
    </Suspense>
  );
}
