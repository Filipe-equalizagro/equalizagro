'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, LogOut, RefreshCw, Search,
  CheckCircle, XCircle, ShieldCheck, ChevronDown,
  AlertCircle, Eye, EyeOff, Trash2, KeyRound, BarChart2,
} from 'lucide-react';
import { verifySession, logout, getAuthToken } from '@/lib/auth';
import './admin.css';

interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  auth_status: string;
  email_verified: boolean;
  credits_balance: number;
  created_at: string;
  last_login: string | null;
  company_name: string | null;
}

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', support: 'Equipe', client: 'Cliente' };
const STATUS_LABELS: Record<string, string> = { verified: 'Verificado', pending: 'Pendente', suspended: 'Suspenso', inactive: 'Inativo' };

export default function AdminPage() {
  const [checking, setChecking]   = useState(true);
  const [tab, setTab]             = useState<'users' | 'create' | 'metrics'>('users');
  const [metrics, setMetrics]     = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricYear, setMetricYear]   = useState('');
  const [metricMonth, setMetricMonth] = useState('');
  const [users, setUsers]         = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch]       = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [saving, setSaving]       = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [resetPassUser, setResetPassUser] = useState<User | null>(null);
  const [newPassword, setNewPassword]     = useState('');
  const [showNewPass, setShowNewPass]     = useState(false);
  const [resetPassError, setResetPassError] = useState('');
  const [resetPassLoading, setResetPassLoading] = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSuccess, setFormSuccess] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: 'client', company_name: '',
  });

  const token = typeof window !== 'undefined' ? getAuthToken() : null;

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = '/admin/login'; return; }

    verifySession().then(r => {
      if (!r.valid) window.location.href = '/admin/login';
      else if (r.role !== 'admin') window.location.href = '/';
      else {
        setChecking(false);
        loadUsers();
      }
    });
  }, []);

  const loadMetrics = useCallback(async (year?: string, month?: string) => {
    setMetricsLoading(true);
    try {
      const params = new URLSearchParams();
      if (year)  params.set('year',  year);
      if (month) params.set('month', month);
      const r = await fetch(`/api/admin/metrics?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const d = await r.json();
      if (d.success) setMetrics(d);
    } catch { /* ignorar */ }
    finally { setMetricsLoading(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const r = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const d = await r.json();
      if (d.success) setUsers(d.users);
    } catch { /* ignorar */ }
    finally { setLoadingUsers(false); }
  }, []);

  const updateUser = async (userId: string, patch: Record<string, string>) => {
    setSaving(userId);
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, ...patch }),
      });
      await loadUsers();
    } finally { setSaving(null); }
  };

  const deleteUser = async (userId: string) => {
    setSaving(userId);
    try {
      await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      await loadUsers();
    } finally { setSaving(null); setConfirmDelete(null); }
  };

  const handleResetPassword = async () => {
    if (!resetPassUser) return;
    if (!newPassword || newPassword.length < 6) {
      setResetPassError('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    setResetPassLoading(true);
    setResetPassError('');
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: resetPassUser.id, password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setResetPassUser(null);
        setNewPassword('');
      } else {
        setResetPassError(data.message || 'Erro ao alterar senha');
      }
    } catch {
      setResetPassError('Erro de conexão. Tente novamente.');
    } finally {
      setResetPassLoading(false);
    }
  };

  const setField = (k: string, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setFormErrors(p => ({ ...p, [k]: '' }));
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name)    errs.name    = 'Nome obrigatório';
    if (!form.email)   errs.email   = 'Email obrigatório';
    if (!form.phone || form.phone.replace(/\D/g,'').length < 10) errs.phone = 'Telefone inválido';
    if (!form.password || form.password.length < 6) errs.password = 'Mínimo 6 caracteres';
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    setFormLoading(true);
    setFormSuccess('');
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, phone: form.phone.replace(/\D/g,'') }),
      });
      const d = await r.json();
      if (d.success) {
        setFormSuccess(`Usuário "${form.name}" criado com sucesso!`);
        setForm({ name:'', email:'', phone:'', password:'', role:'client', company_name:'' });
        loadUsers();
      } else {
        setFormErrors({ submit: d.message || 'Erro ao criar usuário' });
      }
    } catch {
      setFormErrors({ submit: 'Erro de conexão. Tente novamente.' });
    } finally { setFormLoading(false); }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole   = !filterRole   || u.role === filterRole;
    const matchStatus = !filterStatus || u.auth_status === filterStatus;
    return matchQ && matchRole && matchStatus;
  });

  if (checking) return (
    <div className="adm-checking"><div className="adm-spinner" /></div>
  );

  return (
    <div className="adm-root">
      {/* Topbar */}
      <header className="adm-topbar">
        <a href="/dashboard" className="adm-logo">
          <img src="/images/EQUALIZAGRO ok.png" alt="Equalizagro" />
        </a>
        <div className="adm-topbar-center">
          <ShieldCheck size={16} />
          <span>Painel Administrativo</span>
        </div>
        <button className="adm-logout" onClick={() => { logout(); window.location.href = '/'; }}>
          <LogOut size={16} />
          <span>Sair</span>
        </button>
      </header>

      <div className="adm-body">
        {/* Tabs */}
        <div className="adm-tabs">
          <button className={`adm-tab ${tab === 'users'  ? 'adm-tab--active' : ''}`} onClick={() => setTab('users')}>
            <Users size={16} />
            <span>Usuários</span>
            <span className="adm-tab-count">{users.length}</span>
          </button>

          <button className={`adm-tab ${tab === 'create' ? 'adm-tab--active' : ''}`} onClick={() => setTab('create')}>
            <UserPlus size={16} />
            <span>Cadastrar</span>
          </button>

          <button className={`adm-tab ${tab === 'metrics' ? 'adm-tab--active' : ''}`} onClick={() => { setTab('metrics'); if (!metrics) loadMetrics(metricYear, metricMonth); }}>
            <BarChart2 size={16} />
            <span>Métricas</span>
          </button>
        </div>

        {/* ── Tab: Usuários ── */}
        {tab === 'users' && (
          <div className="adm-panel">
            {/* Filtros */}
            <div className="adm-filters">
              <div className="adm-search-wrap">
                <Search size={16} className="adm-search-icon" />
                <input
                  className="adm-search"
                  placeholder="Buscar por nome ou email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select className="adm-filter-select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                <option value="">Todos os roles</option>
                <option value="admin">Admin</option>
                <option value="support">Equipe</option>
                <option value="client">Cliente</option>
              </select>
              <select className="adm-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Todos os status</option>
                <option value="verified">Verificado</option>
                <option value="pending">Pendente</option>
                <option value="suspended">Suspenso</option>
                <option value="inactive">Inativo</option>
              </select>
              <button className="adm-refresh" onClick={loadUsers} disabled={loadingUsers}>
                <RefreshCw size={15} className={loadingUsers ? 'adm-spin' : ''} />
              </button>
            </div>

            {/* Tabela */}
            <div className="adm-table-wrap">
              {loadingUsers ? (
                <div className="adm-loading"><div className="adm-spinner" /></div>
              ) : filtered.length === 0 ? (
                <div className="adm-empty">Nenhum usuário encontrado</div>
              ) : (
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Empresa</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Créditos</th>
                      <th>Cadastro</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div className="adm-user-cell">
                            <div className="adm-avatar">{u.full_name.charAt(0).toUpperCase()}</div>
                            <span>{u.full_name}</span>
                          </div>
                        </td>
                        <td className="adm-email">{u.email}</td>
                        <td className="adm-small">{u.company_name || '—'}</td>
                        <td>
                          <div className="adm-select-wrap">
                            <select
                              className={`adm-role-select adm-role--${u.role}`}
                              value={u.role}
                              onChange={e => updateUser(u.id, { role: e.target.value })}
                              disabled={saving === u.id}
                            >
                              <option value="client">Cliente</option>
                              <option value="support">Equipe</option>
                              <option value="admin">Admin</option>
                            </select>
                            <ChevronDown size={12} className="adm-select-arrow" />
                          </div>
                        </td>
                        <td>
                          <div className="adm-select-wrap">
                            <select
                              className={`adm-status-select adm-status--${u.auth_status}`}
                              value={u.auth_status}
                              onChange={e => updateUser(u.id, { auth_status: e.target.value })}
                              disabled={saving === u.id}
                            >
                                <option value="verified">Verificado</option>
                              <option value="pending">Pendente</option>
                              <option value="suspended">Suspenso</option>
                              <option value="inactive">Inativo</option>
                            </select>
                            <ChevronDown size={12} className="adm-select-arrow" />
                          </div>
                        </td>
                        <td className="adm-credits">{(u.credits_balance ?? 0).toLocaleString('pt-BR')}</td>
                        <td className="adm-small">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            {saving === u.id
                              ? <div className="adm-spinner adm-spinner--sm" />
                              : <>
                                  {u.auth_status === 'suspended' || u.auth_status === 'inactive'
                                    ? <button className="adm-action adm-action--ok" title="Ativar"
                                        onClick={() => updateUser(u.id, { auth_status: 'verified' })}>
                                        <CheckCircle size={15} />
                                      </button>
                                    : <button className="adm-action adm-action--danger" title="Suspender"
                                        onClick={() => updateUser(u.id, { auth_status: 'suspended' })}>
                                        <XCircle size={15} />
                                      </button>
                                  }
                                  <button className="adm-action adm-action--key" title="Alterar senha"
                                    onClick={() => { setResetPassUser(u); setNewPassword(''); setResetPassError(''); setShowNewPass(false); }}>
                                    <KeyRound size={15} />
                                  </button>
                                  <button className="adm-action adm-action--delete" title="Excluir acesso"
                                    onClick={() => setConfirmDelete(u)}>
                                    <Trash2 size={15} />
                                  </button>
                                </>
                            }
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Métricas ── */}
        {tab === 'metrics' && (
          <div className="adm-panel">
            <div className="adm-metrics-header">
              <h2 className="adm-metrics-heading">Métricas de uso</h2>
              <div className="adm-metrics-filters">
                <span className="adm-period-label">Filtrar por:</span>
                <select className="adm-period-select" value={metricYear} onChange={e => { setMetricYear(e.target.value); setMetricMonth(''); }}>
                  <option value="">Todos os anos</option>
                  {Array.from(
                    { length: new Date().getFullYear() - 2025 },
                    (_, i) => 2026 + i
                  ).map(y => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
                <select className="adm-period-select" value={metricMonth} onChange={e => setMetricMonth(e.target.value)} disabled={!metricYear}>
                  <option value="">Todos os meses</option>
                  {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                    <option key={i+1} value={String(i+1)}>{m}</option>
                  ))}
                </select>
                <button className="adm-refresh" onClick={() => loadMetrics(metricYear, metricMonth)} disabled={metricsLoading} title="Atualizar">
                  <RefreshCw size={15} className={metricsLoading ? 'adm-spin' : ''} />
                </button>
              </div>
            </div>

            {metricsLoading ? (
              <div className="adm-loading"><div className="adm-spinner" /></div>
            ) : !metrics ? (
              <div className="adm-empty">Clique em atualizar para carregar as métricas</div>
            ) : (
              <div className="adm-metrics-body">
                {/* ── Consultor.IA ── */}
                <div className="adm-metrics-section">
                  <div className="adm-metrics-title">
                    <img src="/images/go2apply-logo-colorido.png" alt="go2apply" style={{ height: 18, width: 'auto' }} />
                    <span>Consultor.IA</span>
                  </div>

                  <div className="adm-metrics-cards">
                    {[
                      { label: 'Conversas',       value: metrics.consultor.chat.totals.total_conversas },
                      { label: 'Mensagens',        value: metrics.consultor.chat.totals.total_mensagens },
                      { label: 'Usuários ativos',  value: metrics.consultor.chat.totals.chat_users },
                    ].map(c => (
                      <div key={c.label} className="adm-metric-card">
                        <div className="adm-metric-card-inner">
                          <span className="adm-metric-value">{Number(c.value || 0).toLocaleString('pt-BR')}</span>
                          <span className="adm-metric-label">{c.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {metrics.consultor.chat.perUser.length > 0 && (
                    <div className="adm-table-wrap" style={{ marginTop: '1rem' }}>
                      <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: 600 }}>Conversas por usuário</p>
                      <table className="adm-table">
                        <thead><tr>
                          <th>Usuário</th>
                          <th>Email</th>
                          <th>Conversas</th>
                          <th>Mensagens</th>
                          <th>Último uso</th>
                        </tr></thead>
                        <tbody>
                          {metrics.consultor.chat.perUser.map((u: any) => (
                            <tr key={u.email}>
                              <td><div className="adm-user-cell"><div className="adm-avatar">{u.full_name.charAt(0).toUpperCase()}</div><span>{u.full_name}</span></div></td>
                              <td className="adm-email">{u.email}</td>
                              <td className="adm-small">{u.conversas}</td>
                              <td className="adm-small">{u.mensagens}</td>
                              <td className="adm-small">{u.last_active ? new Date(u.last_active).toLocaleDateString('pt-BR') : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── Calculadora ── */}
                <div className="adm-metrics-section" style={{ marginTop: '2rem' }}>
                  <div className="adm-metrics-title">
                    <img src="/images/EQUALIZAGRO ok.png" alt="Equalizagro" style={{ height: 18, width: 'auto' }} />
                    <span>Pulverização — uso por ferramenta</span>
                  </div>

                  {metrics.calculator.byTab.length === 0 ? (
                    <div className="adm-empty" style={{ marginTop: '0.75rem' }}>Nenhum uso registrado ainda</div>
                  ) : (
                    <>
                      <div className="adm-metrics-bars" style={{ marginTop: '0.75rem' }}>
                        {(() => {
                          const max = Math.max(...metrics.calculator.byTab.map((t: any) => Number(t.total)));
                          return metrics.calculator.byTab.map((t: any) => (
                            <div key={t.tab_id} className="adm-bar-row">
                              <span className="adm-bar-label">{t.tab_label}</span>
                              <div className="adm-bar-track">
                                <div className="adm-bar-fill" style={{ width: `${Math.round((Number(t.total) / max) * 100)}%` }} />
                              </div>
                              <span className="adm-bar-count">{Number(t.total).toLocaleString('pt-BR')}</span>
                            </div>
                          ));
                        })()}
                      </div>

                      {metrics.calculator.byUser.length > 0 && (
                        <div className="adm-table-wrap" style={{ marginTop: '1.25rem' }}>
                          <table className="adm-table">
                            <thead><tr>
                              <th>Usuário</th>
                              <th>Email</th>
                              <th>Acessos</th>
                              <th>Último uso</th>
                            </tr></thead>
                            <tbody>
                              {metrics.calculator.byUser.map((u: any) => (
                                <tr key={u.email}>
                                  <td><div className="adm-user-cell"><div className="adm-avatar">{u.full_name.charAt(0).toUpperCase()}</div><span>{u.full_name}</span></div></td>
                                  <td className="adm-email">{u.email}</td>
                                  <td className="adm-small">{u.total_uses}</td>
                                  <td className="adm-small">{u.last_use ? new Date(u.last_use).toLocaleDateString('pt-BR') : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Cadastrar ── */}
        {tab === 'create' && (
          <div className="adm-panel adm-panel--form">
            <div className="adm-form-header">
              <h2>Cadastrar novo usuário</h2>
              <p>Conta criada pelo admin é ativada imediatamente, sem verificação de email.</p>
            </div>

            {formSuccess && (
              <div className="adm-form-success"><CheckCircle size={16}/>{formSuccess}</div>
            )}

            <form onSubmit={handleCreate} className="adm-form">
              <div className="adm-form-grid">
                {[
                  { k:'name',  label:'Nome Completo', type:'text',  placeholder:'Nome completo' },
                  { k:'email', label:'Email',          type:'email', placeholder:'email@exemplo.com' },
                ].map(({ k, label, type, placeholder }) => (
                  <div key={k} className="adm-field">
                    <label>{label}</label>
                    <input type={type} value={(form as any)[k]} placeholder={placeholder}
                      onChange={e => setField(k, e.target.value)}
                      className={formErrors[k] ? 'adm-input adm-input--err' : 'adm-input'} />
                    {formErrors[k] && <p className="adm-field-err"><AlertCircle size={13}/>{formErrors[k]}</p>}
                  </div>
                ))}

                <div className="adm-field">
                  <label>Telefone</label>
                  <input type="tel" value={form.phone} placeholder="(11) 99999-9999"
                    onChange={e => setField('phone', formatPhone(e.target.value))}
                    className={formErrors.phone ? 'adm-input adm-input--err' : 'adm-input'} />
                  {formErrors.phone && <p className="adm-field-err"><AlertCircle size={13}/>{formErrors.phone}</p>}
                </div>

                <div className="adm-field">
                  <label>Senha</label>
                  <div className="adm-pass-wrap">
                    <input type={showPass ? 'text' : 'password'} value={form.password}
                      placeholder="Mínimo 6 caracteres"
                      onChange={e => setField('password', e.target.value)}
                      className={formErrors.password ? 'adm-input adm-input--err' : 'adm-input'} />
                    <button type="button" className="adm-eye" onClick={() => setShowPass(v => !v)}>
                      {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                  {formErrors.password && <p className="adm-field-err"><AlertCircle size={13}/>{formErrors.password}</p>}
                </div>

                <div className="adm-field">
                  <label>Role</label>
                  <select value={form.role} onChange={e => setField('role', e.target.value)} className="adm-input adm-select">
                    <option value="client">Cliente</option>
                    <option value="support">Equipe</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="adm-field">
                  <label>Empresa <span className="adm-optional">(opcional)</span></label>
                  <input type="text" value={form.company_name} placeholder="Nome da empresa"
                    onChange={e => setField('company_name', e.target.value)}
                    className="adm-input" />
                </div>
              </div>

              {formErrors.submit && (
                <div className="adm-alert"><AlertCircle size={15}/>{formErrors.submit}</div>
              )}

              <button type="submit" className="adm-submit" disabled={formLoading}>
                {formLoading ? 'Cadastrando…' : <><UserPlus size={16}/>Cadastrar Usuário</>}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Modal de alteração de senha ── */}
      {resetPassUser && (
        <div className="adm-modal-overlay" onClick={() => setResetPassUser(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-icon" style={{ color: '#1a5f3a' }}><KeyRound size={28} /></div>
            <h3>Alterar senha</h3>
            <p>Nova senha para <strong>{resetPassUser.full_name}</strong></p>
            <div style={{ width: '100%', marginBottom: '0.75rem', position: 'relative' }}>
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setResetPassError(''); }}
                placeholder="Nova senha (mín. 6 caracteres)"
                style={{
                  width: '100%', padding: '0.7rem 2.5rem 0.7rem 0.9rem',
                  border: `1.5px solid ${resetPassError ? '#ef4444' : '#e5e7eb'}`,
                  borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'inherit',
                  background: '#f9fafb', boxSizing: 'border-box',
                }}
              />
              <button type="button" onClick={() => setShowNewPass(v => !v)}
                style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}>
                {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {resetPassError && (
              <p style={{ color: '#ef4444', fontSize: '0.82rem', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertCircle size={13} />{resetPassError}
              </p>
            )}
            <div className="adm-modal-actions">
              <button className="adm-modal-cancel" onClick={() => setResetPassUser(null)}>Cancelar</button>
              <button className="adm-modal-confirm adm-modal-confirm--green"
                disabled={resetPassLoading} onClick={handleResetPassword}>
                {resetPassLoading ? <div className="adm-spinner adm-spinner--sm" /> : <><KeyRound size={15} /> Salvar senha</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de confirmação de exclusão ── */}
      {confirmDelete && (
        <div className="adm-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-icon"><Trash2 size={28} /></div>
            <h3>Excluir acesso?</h3>
            <p>
              O usuário <strong>{confirmDelete.full_name}</strong> será removido da lista.<br />
              Esta ação pode ser revertida pelo banco de dados.
            </p>
            <div className="adm-modal-actions">
              <button className="adm-modal-cancel" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button
                className="adm-modal-confirm"
                disabled={saving === confirmDelete.id}
                onClick={() => deleteUser(confirmDelete.id)}
              >
                {saving === confirmDelete.id
                  ? <div className="adm-spinner adm-spinner--sm" />
                  : <><Trash2 size={15} /> Excluir</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
