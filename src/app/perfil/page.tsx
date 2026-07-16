'use client';

import { useState, useEffect } from 'react';
import { User, Mail, AlertCircle, CheckCircle, ArrowLeft, Lock } from 'lucide-react';
import { verifySession } from '@/lib/auth';
import './perfil.css';

export default function PerfilPage() {
  const [checking, setChecking] = useState(true);
  const [token, setToken]       = useState('');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [role, setRole]         = useState('');
  const [createdAt, setCreatedAt] = useState('');

  const [nameInput, setNameInput]   = useState('');
  const [emailInput, setEmailInput] = useState('');

  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [success, setSuccess] = useState('');
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken') || '';
    setToken(storedToken);

    verifySession().then(r => {
      if (!r.valid) { window.location.href = '/login'; return; }
      // Load full profile from API
      fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setName(data.user.full_name);
            setEmail(data.user.email);
            setRole(data.user.role);
            setCreatedAt(data.user.created_at);
            setNameInput(data.user.full_name);
            setEmailInput(data.user.email);
          }
          setChecking(false);
        })
        .catch(() => setChecking(false));
    });
  }, []);

  if (checking) return <div className="pf-checking"><div className="pf-spinner" /></div>;

  const userInitial = (name || 'U')[0].toUpperCase();

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    support: 'Equipe',
    client: 'Consultor',
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!nameInput.trim() || nameInput.trim().length < 2) errs.name = 'Nome deve ter ao menos 2 caracteres';
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) errs.email = 'Email inválido';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const hasChanges = nameInput.trim() !== name || emailInput.toLowerCase() !== email.toLowerCase();
    if (!hasChanges) { setSuccess('Nenhuma alteração detectada.'); return; }

    setSaving(true);
    setApiError('');
    setSuccess('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: nameInput.trim(), email: emailInput }),
      });
      const data = await res.json();
      if (data.success) {
        setName(data.user.full_name);
        setEmail(data.user.email);
        setSuccess('Perfil atualizado com sucesso!');
      } else {
        setApiError(data.message || 'Erro ao atualizar perfil.');
      }
    } catch {
      setApiError('Erro de conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pf-root">
      <div className="pf-card">

        <a href="/go2apply" className="pf-back">
          <ArrowLeft size={15} /> Voltar ao dashboard
        </a>

        <div className="pf-header">
          <div className="pf-avatar">{userInitial}</div>
          <h1 className="pf-title">Meu perfil</h1>
          <p className="pf-sub">Gerencie suas informações de conta</p>
        </div>

        {/* Informações de leitura */}
        <p className="pf-section">Conta</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div className="pf-info-row">
            <span className="pf-info-label">Perfil de acesso</span>
            <span className="pf-info-value">{ROLE_LABELS[role] || role}</span>
          </div>
          {createdAt && (
            <div className="pf-info-row">
              <span className="pf-info-label">Membro desde</span>
              <span className="pf-info-value">{formatDate(createdAt)}</span>
            </div>
          )}
        </div>

        {/* Formulário de edição */}
        <p className="pf-section">Editar dados</p>
        <form onSubmit={handleSave} className="pf-form">
          <div className="pf-field">
            <label htmlFor="pf-name">Nome completo</label>
            <div className="pf-input-wrap">
              <User size={17} className="pf-icon" />
              <input
                id="pf-name"
                type="text"
                value={nameInput}
                onChange={e => { setNameInput(e.target.value); setErrors(p => ({ ...p, name: '' })); setSuccess(''); }}
                className={errors.name ? 'pf-input pf-input--err' : 'pf-input'}
                autoComplete="name"
              />
            </div>
            {errors.name && <p className="pf-err"><AlertCircle size={14} />{errors.name}</p>}
          </div>

          <div className="pf-field">
            <label htmlFor="pf-email">Email</label>
            <div className="pf-input-wrap">
              <Mail size={17} className="pf-icon" />
              <input
                id="pf-email"
                type="email"
                value={emailInput}
                onChange={e => { setEmailInput(e.target.value); setErrors(p => ({ ...p, email: '' })); setSuccess(''); }}
                className={errors.email ? 'pf-input pf-input--err' : 'pf-input'}
                autoComplete="email"
              />
            </div>
            {errors.email && <p className="pf-err"><AlertCircle size={14} />{errors.email}</p>}
          </div>

          {apiError && (
            <div className="pf-alert pf-alert--error"><AlertCircle size={16} />{apiError}</div>
          )}
          {success && (
            <div className="pf-alert pf-alert--success"><CheckCircle size={16} />{success}</div>
          )}

          <button type="submit" className="pf-btn" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </form>

        {/* Senha (futuro) */}
        <p className="pf-section">Segurança</p>
        <div className="pf-info-row" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
          <Lock size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />
          <div>
            <span className="pf-info-label" style={{ display: 'block' }}>Senha</span>
            <span className="pf-info-value" style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Alteração de senha em breve
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
