'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Brain, Calculator, Users, ShieldCheck,
  Home, LogOut, ChevronRight, Menu, X, MoveHorizontal,
} from 'lucide-react';
import { verifySession, logout } from '@/lib/auth';
import './dashboard.css';

const SIDEBAR_MIN     = 68;
const SIDEBAR_MAX     = 340;
const SIDEBAR_DEFAULT = 258;
const COMPACT_BREAK   = 100; // abaixo disto → modo compacto (só ícones)

const ALL_TOOLS = [
  {
    id: 'consultor',
    title: 'Consultor.IA',
    shortTitle: 'Consultor.IA',
    description: 'O elo entre nosso banco de dados e seu manejo, que começa pela calda.',
    icon: Brain,
    href: '/ConsultorIA',
    accent: '#1a5f3a',
    accentBg: 'rgba(26, 95, 58, 0.1)',
    tag: 'Consultor.IA',
    adminOnly: false,
  },
  {
    id: 'go2Apply',
    title: 'Pulverização',
    shortTitle: 'Pulverização',
    description: 'Ferramentas de calibração, aferição, dimensionamento e avaliação de espectro de gotas.',
    icon: Calculator,
    href: '/pulverizacao/go2apply',
    accent: '#c9a420',
    accentBg: 'rgba(212, 175, 55, 0.12)',
    tag: 'Pulverização',
    adminOnly: false,
  },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [isResizing, setIsResizing]     = useState(false);
  const [isMobile, setIsMobile]         = useState(false);
  const widthRef = useRef(SIDEBAR_DEFAULT);

  useEffect(() => {
    const checkSession = async () => {
      const result = await verifySession();
      // Exige sessão válida E dados reais do usuário (bloqueia fail-open sem fullName)
      if (!result.valid || !result.fullName) {
        // Limpar qualquer dado de sessão inválida
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userInitial');
        localStorage.removeItem('userName');
        window.location.href = '/';
        return;
      }
      setIsAuthenticated(true);
      setIsAdmin(result.isAdmin === true);
      if (result.fullName) {
        setUserName(result.fullName.split(' ')[0] || '');
        // Cache para o Header detectar sessão instantaneamente
        const initial = result.fullName.trim().charAt(0).toUpperCase();
        localStorage.setItem('userInitial', initial);
        localStorage.setItem('userName', result.fullName);
      }
      setIsLoading(false);
      const saved = parseInt(localStorage.getItem('db-sidebar-width') || '');
      if (!isNaN(saved) && saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) {
        setSidebarWidth(saved);
        widthRef.current = saved;
      }
    };
    checkSession();
  }, []);

  /* ── Detecta mobile (< 1024px) ── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* ── Drag-to-resize ── */
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      widthRef.current = w;
      setSidebarWidth(w);
    };
    const onUp = () => {
      setIsResizing(false);
      localStorage.setItem('db-sidebar-width', String(widthRef.current));
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  /* Bloqueia seleção de texto durante o drag */
  useEffect(() => {
    document.body.style.userSelect = isResizing ? 'none' : '';
    document.body.style.cursor     = isResizing ? 'col-resize' : '';
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
    };
  }, [isResizing]);

  const isCompact = sidebarWidth <= COMPACT_BREAK;

  const handleLogout = () => {
    // Limpa cache de sessão antes de deslogar
    localStorage.removeItem('userInitial');
    localStorage.removeItem('userName');
    logout();
    window.location.href = '/';
  };

  const userInitial = userName ? userName[0].toUpperCase() : 'U';

  // Ferramentas visíveis conforme role
  const tools = ALL_TOOLS.filter(t => !t.adminOnly || isAdmin);


  if (isLoading) {
    return (
      <div className="db-loading">
        <div className="db-loading__spinner" />
        <p>Carregando painel...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="db-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="db-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        style={{ width: sidebarWidth }}
        className={`db-sidebar${isCompact ? ' db-sidebar--compact' : ''}${sidebarOpen ? ' db-sidebar--open' : ''}`}
      >
        <div className="db-sidebar__logo">
          <Link href="/" onClick={() => setSidebarOpen(false)}>
            <img src="/images/go2apply-logo-branco.png" alt="go2apply" className="db-sidebar__logo-full" />
            <img src="/images/go2apply-logo-branco.png" alt="go2apply" className="db-sidebar__logo-gota" />
          </Link>
          <button
            className="db-sidebar__close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="db-sidebar__nav" aria-label="Ferramentas">
          <span className="db-sidebar__section-label">Ferramentas</span>

          {tools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              className="db-sidebar__item"
              onClick={() => setSidebarOpen(false)}
              title={tool.title}
            >
              <span
                className="db-sidebar__item-icon"
                style={{ color: tool.accent, background: tool.accentBg }}
              >
                <tool.icon size={17} />
              </span>
              <span className="db-sidebar__item-label">{tool.title}</span>
              <ChevronRight size={13} className="db-sidebar__item-arrow" />
            </Link>
          ))}
        </nav>

        <div className="db-sidebar__bottom">
          <Link href="/" className="db-sidebar__item db-sidebar__item--muted" title="Site Equalizagro">
            <span className="db-sidebar__item-icon">
              <Home size={17} />
            </span>
            <span className="db-sidebar__item-label">Site Equalizagro</span>
          </Link>

          <div className="db-sidebar__divider" />

          <Link href="/perfil" className="db-sidebar__user db-sidebar__user--link" title="Editar perfil" onClick={() => setSidebarOpen(false)}>
            <div className="db-sidebar__avatar">{userInitial}</div>
            <div className="db-sidebar__user-info">
              <span className="db-sidebar__user-name">{userName || 'Usuário'}</span>
              <span className="db-sidebar__user-role">
                {isAdmin ? 'Administrador' : 'Consultor'}
              </span>
            </div>
          </Link>

          <button className="db-sidebar__item db-sidebar__item--logout" onClick={handleLogout} title="Sair da conta">
            <span className="db-sidebar__item-icon">
              <LogOut size={17} />
            </span>
            <span className="db-sidebar__item-label">Sair da conta</span>
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      {/* ── Drag handle — borda direita da sidebar ── */}
      <div
        className={`db-sidebar__resize-handle${isResizing ? ' db-sidebar__resize-handle--active' : ''}`}
        style={{ left: sidebarWidth - 5, display: isMobile ? 'none' : undefined }}
        onMouseDown={handleResizeStart}
      >
        <div className="db-sidebar__resize-grip">
          <MoveHorizontal size={13} />
        </div>
      </div>

      <div className="db-main" style={{ marginLeft: isMobile ? 0 : sidebarWidth }}>
        {/* Top bar (mobile/tablet) */}
        <header className="db-topbar">
          <button
            className="db-topbar__menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
          <div className="db-topbar__logo">
            <img src="/images/go2apply-logo-branco.png" alt="go2apply" />
          </div>
          <button
            className="db-topbar__avatar"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menu do usuário"
          >
            {userInitial}
          </button>
        </header>

        {/* Page content */}
        <div className="db-content">
          {/* Welcome banner */}
          <div className="db-welcome">
            <div className="db-welcome__text">
              <div className="db-welcome__platform-tag">
                <img src="/images/go2apply-logo-branco.png" alt="go2apply" style={{ height: '14px', width: 'auto', display: 'block' }} />
              </div>
              <h1 className="db-welcome__greeting">
                {getGreeting()}, {userName || 'seja bem-vindo'}!
              </h1>
              <p className="db-welcome__subtitle">
                Ferramentas de pulverização disponíveis para teste, bom proveito!
              </p>
              <div className="db-welcome__status">
                <span className="db-welcome__status-dot"></span>
                Todos os serviços online
              </div>
            </div>
            <span className="db-welcome__badge">
              {isAdmin ? 'Equalizagro Admin' : 'Equalizagro Pro'}
            </span>
          </div>

          {/* Section header */}
          <div className="db-section-header">
            <h2 className="db-section-title">
              <img src="/images/go2apply-logo-branco.png" alt="go2apply" style={{ height: '22px', width: 'auto', display: 'block', filter: 'invert(1) brightness(0)' }} />
            </h2>
          </div>

          {/* Tool cards */}
          <div className="db-cards">
            {tools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                className="db-card"
                style={{ '--card-accent': tool.accent } as React.CSSProperties}
              >
                <div className="db-card__header">
                  <div
                    className="db-card__icon"
                    style={{ color: tool.accent, background: tool.accentBg }}
                  >
                    <tool.icon size={26} />
                  </div>
                  <span
                    className="db-card__tag"
                    style={{ color: tool.accent, background: tool.accentBg }}
                  >
                    {tool.tag}
                  </span>
                </div>
                <div className="db-card__body">
                  <p className="db-card__desc">{tool.description}</p>
                </div>
                <div className="db-card__footer">
                  <span className="db-card__action" style={{ color: tool.accent }}>
                    Acessar <ChevronRight size={15} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <footer className="db-footer">
          <p>© Equalizagro 2026</p>
        </footer>
      </div>
    </div>
  );
}
