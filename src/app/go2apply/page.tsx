'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Brain, Calculator, Droplet, Users, ShieldCheck,
  Home, LogOut, ChevronRight, Menu, X, MoveHorizontal, Settings, MessageCircle,
} from 'lucide-react';

const SUPPORT_WHATSAPP_URL = 'https://api.whatsapp.com/send/?phone=555533432606&text=Ol%C3%A1!+Preciso+de+ajuda+com+o+go2apply.&type=phone_number&app_absent=0';
import { verifySession, logout } from '@/lib/auth';
import SubscriptionModal from '@/components/SubscriptionModal/SubscriptionModal';
import PlanosSection from '@/components/PlanosSection/PlanosSection';
import './dashboard.css';

interface SubscriptionInfo {
  status: string;
  planName: string;
  billingInterval: 'month' | 'year';
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

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
    href: '/pulverizacao',
    accent: '#c9a420',
    accentBg: 'rgba(212, 175, 55, 0.12)',
    tag: 'Pulverização',
    adminOnly: false,
  },
  {
    id: 'consultorKow',
    title: 'pH e Kow',
    shortTitle: 'pH e Kow',
    description: 'O que você precisa para posicionar adjuvantes e faixa de pH de calda para cada princípio ativo.',
    icon: Droplet,
    href: '/consultor-kow',
    accent: '#2ba198',
    accentBg: 'rgba(43, 161, 152, 0.12)',
    tag: 'pH e Kow',
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

  const [userId, setUserId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  // null enquanto carrega — evita bloquear/liberar precipitadamente antes da resposta
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isExempt, setIsExempt] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  // Verdadeiro só logo após voltar da Stripe com pagamento aprovado, enquanto
  // aguardamos o webhook liberar o acesso no banco — nunca mostra a tela de
  // planos nesse meio-tempo (pareceria "voltar pro pagamento" pro cliente).
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  // Fica true assim que detectamos a volta de um pagamento aprovado, e nunca
  // volta a false nesta carga de página — usado só para garantir que, mesmo
  // se o webhook atrasar além do esperado, NUNCA mostramos a tela de planos
  // de novo (o que pareceria pedir pra pagar outra vez).
  const [paymentJustSucceeded, setPaymentJustSucceeded] = useState(false);

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
      if (result.userId) setUserId(result.userId);
      setIsLoading(false);
      const saved = parseInt(localStorage.getItem('db-sidebar-width') || '');
      if (!isNaN(saved) && saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) {
        setSidebarWidth(saved);
        widthRef.current = saved;
      }
    };
    checkSession();
  }, []);

  // Busca o status da assinatura assim que o userId estiver disponível
  useEffect(() => {
    if (!userId) return;

    const checkAccessOnce = async (): Promise<boolean> => {
      const res = await fetch(`/api/subscriptions/my-subscription?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setSubscription(data.subscription);
        setHasAccess(data.hasAccess !== false);
        setIsExempt(data.isExempt === true);
        return data.hasAccess !== false;
      }
      // Checagem de acesso é uma fronteira de segurança — falha aqui
      // bloqueia (fail-closed), nunca libera acesso de graça.
      setHasAccess(false);
      return false;
    };

    const stripSubscriptionParam = () => {
      const params = new URLSearchParams(window.location.search);
      params.delete('subscription');
      const cleanUrl = window.location.pathname + (params.toString() ? `?${params}` : '');
      window.history.replaceState({}, '', cleanUrl);
    };

    const fetchSubscription = async () => {
      setSubscriptionLoading(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const subscriptionParam = params.get('subscription');

        // Se o usuário acabou de voltar do Checkout da Stripe pelo cancel_url
        // (cancelou ou apertou "voltar"), limpa a assinatura "incomplete"
        // pendente ANTES de checar o acesso — sem isso, essa linha travada
        // bloqueava qualquer nova tentativa de assinatura por até 24h.
        if (subscriptionParam === 'cancelled') {
          await fetch('/api/subscriptions/cancel-pending', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          }).catch(() => {});
          stripSubscriptionParam();
        }

        // Pagamento aprovado: o webhook da Stripe ainda pode levar alguns
        // segundos para liberar o acesso no banco. Uma checagem só, na hora,
        // pode vir "sem acesso" e mostrar a tela de planos de novo — parecendo
        // que "voltou pro pagamento". Em vez disso, insiste por até ~20s.
        if (subscriptionParam === 'success') {
          setPaymentJustSucceeded(true);
          setConfirmingPayment(true);
          const started = Date.now();
          let liberado = false;
          while (Date.now() - started < 20000) {
            liberado = await checkAccessOnce();
            if (liberado) break;
            await new Promise(r => setTimeout(r, 1500));
          }
          stripSubscriptionParam();
          setConfirmingPayment(false);
          if (liberado) return;
          // Mesmo sem confirmar a tempo, faz uma última checagem normal
          // abaixo — mas NUNCA mostra a tela de planos logo após um
          // pagamento aprovado; ver o branch de renderização mais abaixo.
        }

        await checkAccessOnce();
      } finally {
        setSubscriptionLoading(false);
      }
    };
    fetchSubscription();
  }, [userId]);

  const handleManageSubscription = async () => {
    if (!userId) return;
    setPortalLoading(true);
    try {
      const res = await fetch('/api/subscriptions/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success && data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    } finally {
      setPortalLoading(false);
    }
  };

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

  // Pagamento acabou de ser aprovado — o webhook da Stripe ainda pode estar
  // liberando o acesso no banco. Mostra "confirmando", nunca a tela de
  // planos, enquanto isso.
  if (confirmingPayment) {
    return (
      <div className="db-loading">
        <div className="db-loading__spinner" />
        <p>Confirmando seu pagamento...</p>
      </div>
    );
  }

  // Aguarda a checagem de acesso antes de decidir entre painel e bloqueio —
  // evita um flash do dashboard completo para quem vai ser bloqueado.
  if (subscriptionLoading) {
    return (
      <div className="db-loading">
        <div className="db-loading__spinner" />
        <p>Carregando painel...</p>
      </div>
    );
  }

  // Caso raríssimo: o pagamento foi aprovado, mas mesmo depois de ~20s
  // insistindo o acesso ainda não apareceu liberado no banco (webhook
  // atrasado). NUNCA mostra a tela de planos aqui — pareceria pedir pra
  // pagar de novo. Em vez disso, pede pra atualizar em instantes.
  if (hasAccess === false && paymentJustSucceeded) {
    return (
      <div className="db-loading">
        <p>
          Seu pagamento foi aprovado e estamos liberando seu acesso — isso pode levar mais alguns instantes.
          <br />
          Atualize a página em breve. Se persistir, fale com o suporte.
        </p>
      </div>
    );
  }

  // Sem crédito e sem assinatura/isenção — bloqueia toda a plataforma e
  // mostra a tela de planos no lugar do dashboard (sem opção de "pular").
  if (hasAccess === false && userId) {
    return (
      <div className="db-blocked">
        <PlanosSection userId={userId} />
        <button className="db-blocked__logout" onClick={handleLogout}>
          Sair da conta
        </button>
      </div>
    );
  }

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
            <img src="/images/logo-gota-go2apply.jpg" alt="go2apply" className="db-sidebar__logo-gota" />
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

          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="db-sidebar__item db-sidebar__item--muted"
            title="Falar com o suporte no WhatsApp"
          >
            <span className="db-sidebar__item-icon">
              <MessageCircle size={17} />
            </span>
            <span className="db-sidebar__item-label">Suporte</span>
          </a>

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
              <div className="db-welcome__status">
                <span className="db-welcome__status-dot"></span>
                Todos os serviços online
              </div>
            </div>
            <span className="db-welcome__badge">
              {isAdmin ? 'Equalizagro Admin' : 'Equalizagro Pro'}
            </span>
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

          {/* Assinatura — CTA para quem não tem, status para quem tem, nada para isentos */}
          {!subscriptionLoading && (
            subscription ? (
              <div className="db-sub-card db-sub-card--active">
                <div className="db-sub-card__text">
                  <h3>
                    Assinatura {subscription.planName}
                    {subscription.status === 'trialing' && ' — período grátis'}
                  </h3>
                  <p>
                    {subscription.status === 'trialing' && subscription.trialEnd
                      ? `Seu trial termina em ${new Date(subscription.trialEnd).toLocaleDateString('pt-BR')}. `
                      : subscription.currentPeriodEnd
                      ? `Próxima cobrança em ${new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}. `
                      : ''}
                    {subscription.cancelAtPeriodEnd && 'Cancelamento agendado — acesso continua até o fim do período. '}
                    Acesso ilimitado ao Consultor.IA e às ferramentas.
                  </p>
                </div>
                <button
                  className="db-sub-card__manage"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                >
                  <Settings size={15} />
                  {portalLoading ? 'Abrindo...' : 'Gerenciar assinatura'}
                </button>
              </div>
            ) : isExempt ? (
              <div className="db-sub-card db-sub-card--active">
                <div className="db-sub-card__text">
                  <h3>Acesso liberado — Equipe Equalizagro</h3>
                  <p>Acesso ilimitado ao Consultor.IA e a todas as ferramentas, sem custo.</p>
                </div>
              </div>
            ) : (
              <div className="db-sub-card db-sub-card--cta">
                <div className="db-sub-card__text">
                  <h3>Desbloqueie acesso ilimitado</h3>
                  <p>Consultor.IA, Pulverização e Consultor Kow, sem limites. 7 dias grátis.</p>
                </div>
                <button className="db-sub-card__manage" onClick={() => setShowSubscriptionModal(true)}>
                  Ver planos
                </button>
              </div>
            )
          )}
        </div>

        <footer className="db-footer">
          <p>© Equalizagro 2026</p>
        </footer>
      </div>

      {userId && (
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          userId={userId}
        />
      )}
    </div>
  );
}
