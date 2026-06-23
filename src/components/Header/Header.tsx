'use client';

import { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, Facebook, Instagram, Linkedin, LayoutDashboard, Brain, X, Menu, User } from 'lucide-react';
import { verifySession } from '@/lib/auth';
import './Header.css';

interface SessionInfo {
  initial: string;
  fullName: string;
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [session, setSession]           = useState<SessionInfo | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // ── Passo 1: leitura síncrona do cache (sem rede) ──────────────────
    const token = localStorage.getItem('authToken');

    if (!token) {
      // Sem token → sabe-se imediatamente que não está logado
      setSessionChecked(true);
      return;
    }

    const cachedInitial  = localStorage.getItem('userInitial');
    const cachedFullName = localStorage.getItem('userName');

    if (cachedInitial && cachedFullName) {
      // Mostra o avatar imediatamente com dados em cache
      setSession({ initial: cachedInitial, fullName: cachedFullName });
      setSessionChecked(true);
      // Continua para o Passo 2 em background (não bloqueia o render)
    }
    // Se não há cache ainda, mantém sessionChecked=false → mostra skeleton

    // ── Passo 2: verificação real em background ────────────────────────
    const verify = async () => {
      try {
        const result = await verifySession();
        if (result.valid && result.fullName) {
          const initial = result.fullName.trim().charAt(0).toUpperCase();
          setSession({ initial, fullName: result.fullName });
          // Atualiza/cria cache para próximos carregamentos
          localStorage.setItem('userInitial', initial);
          localStorage.setItem('userName', result.fullName);
        } else {
          // Token expirado ou inválido — limpa tudo
          localStorage.removeItem('userInitial');
          localStorage.removeItem('userName');
          setSession(null);
        }
      } catch {
        setSession(null);
      } finally {
        setSessionChecked(true);
      }
    };

    verify();
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const SessionCTA = () => {
    // Logado (confirmado) → avatar + botão Dashboard
    if (session) {
      return (
        <div className="header__user-session">
          <div className="header__user-avatar" title={session.fullName}>
            <span>{session.initial}</span>
          </div>
          <a href="/dashboard" className="header__dashboard-btn">
            <LayoutDashboard size={15} />
            <span>Dashboard</span>
          </a>
        </div>
      );
    }
    // Não logado → botão go2apply
    return (
      <div className="header__cta-group">
        <a href="/login" className="header__login-btn header__login-btn--logo">
          <img src="/images/go2apply-logo-branco.png" alt="go2apply" className="header__go2apply-logo" />
        </a>
      </div>
    );
  };

  return (
    <header className={`header ${isScrolled ? 'header--scrolled' : ''}`}>
      <div className="header__top-bar">
        <div className="header__top-bar-content">
          <div className="header__contact-info">
            <div className="header__contact-item">
              <Phone className="header__contact-icon" size={16} />
              <a href="https://api.whatsapp.com/send/?phone=555533432606&text=Ol%C3%A1!+Vim+atrav%C3%A9s+do+site+da+Equalizagro%2C+gostaria+de+mais+informa%C3%A7%C3%B5es+sobre+seus+servi%C3%A7os.&type=phone_number&app_absent=0" className="header__contact-link">
                (55) 3343-2606
              </a>
            </div>
            <div className="header__contact-item">
              <Mail className="header__contact-icon" size={16} />
              <a href="mailto:contato@equalizagro.com" className="header__contact-link">
                contato@equalizagro.com
              </a>
            </div>
            <div className="header__contact-item">
              <MapPin className="header__contact-icon" size={16} />
              <a 
                href="https://www.google.com/maps?q=Cart%C3%B3rio%20de%20Registro%20de%20Im%C3%B3veis%20de%20Cruz%20Alta%2C%20R.%20Volunt%C3%A1rios%20da%20P%C3%A1tria%2C%20192%20-%20Centro%2C%20Cruz%20Alta%20-%20RS%2C%2098005-104" 
                target="_blank" 
                rel="noopener noreferrer"
                className="header__contact-link"
              >
                Cruz Alta - RS
              </a>
            </div>
          </div>
          <div className="header__social-links">
            <a href="https://www.facebook.com/share/1C5Nu4yTc6/" className="header__social-link">
              <Facebook size={16} />
            </a>
            <a href="https://www.instagram.com/equalizagro/?igsh=aDNqdHRsZnQ4MWNm#" className="header__social-link">
              <Instagram size={16} />
            </a>
            <a href="https://www.linkedin.com/company/equalizagro/" className="header__social-link">
              <Linkedin size={16} />
            </a>
          </div>
        </div>
      </div>

      <div className="header__main">
        <div className="header__container">
          <a href="#top" className="header__logo">
            <img 
              src="/images/EQUALIZAGRO ok.png" 
              alt="Equalizagro Logo" 
              className="header__logo-image" 
            />
          </a>

          <nav className="header__nav">
            <ul className="header__nav-list">
              <li className="header__nav-item">
                <a href="#home" className="header__nav-link header__nav-link--active">Início</a>
              </li>
              <li className="header__nav-item">
                <a href="#services" className="header__nav-link">Serviços</a>
              </li>
              <li className="header__nav-item">
                <a href="#about" className="header__nav-link">Sobre</a>
              </li>
              <li className="header__nav-item">
                <a href="#contact" className="header__nav-link">Contato</a>
              </li>
            </ul>
          </nav>

          <div className="header__cta">
            <SessionCTA />
          </div>

          {/* OPÇÃO 2: Apenas Ícone com Tooltip */}
          {/* <a href="/ia" className="header__ia-icon-only" title="ConsultorIA - Assistente Inteligente">
            <Brain size={20} />
          </a> */}

          {/* OPÇÃO 3: Estilo New/Novo */}
          {/* <a href="/ia" className="header__ia-new-tag">
            <span className="header__ia-badge">NOVO</span>
            <Brain size={14} />
            <span>go2apply</span>
          </a> */}

          {/* OPÇÃO 4: Botão Ghost */}
          {/* <a href="/ia" className="header__ia-ghost-button">
            <Brain size={16} />
            <span>go2apply</span>
          </a> */}

          {/* OPÇÃO 5: Integrado ao Menu (dentro do nav acima) */}
          {/* Adicione dentro do <ul className="header__nav-list">:
          <li className="header__nav-item">
            <a href="/ia" className="header__nav-link header__ia-menu-item">
              <Brain size={14} />
              <span>go2apply</span>
            </a>
          </li> */}

          {/* OPÇÃO 6: Floating Button */}
          {/* <a href="/ia" className="header__ia-floating">
            <Brain size={18} />
            <span>IA</span>
          </a> */}

          {/* OPÇÃO 7: Dropdown Style */}
          {/* <a href="/ia" className="header__ia-dropdown">
            <Brain size={16} />
            <span>go2apply</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 8L2 4h8z" />
            </svg>
          </a> */}

          {/* Botão go2apply visível diretamente no mobile */}
          <div className="header__mobile-go2apply">
            <SessionCTA />
          </div>

          <button
            className="header__mobile-toggle"
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <div className={`header__mobile-menu ${isMobileMenuOpen ? 'header__mobile-menu--active' : ''}`}>
        <div className="header__mobile-nav">
          <ul className="header__mobile-nav-list">
            <li className="header__mobile-nav-item">
              <a href="#home" className="header__mobile-nav-link">Início</a>
            </li>
            <li className="header__mobile-nav-item">
              <a href="#services" className="header__mobile-nav-link">Serviços</a>
            </li>
            <li className="header__mobile-nav-item">
              <a href="#about" className="header__mobile-nav-link">Sobre</a>
            </li>
            <li className="header__mobile-nav-item">
              <a href="#contact" className="header__mobile-nav-link">Contato</a>
            </li>
          </ul>
          <div className="header__mobile-cta">
            <SessionCTA />
          </div>
        </div>
      </div>
    </header>
  );
}
