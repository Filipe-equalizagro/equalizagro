'use client';

import { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, Facebook, Instagram, Linkedin, Menu, X } from 'lucide-react';
import './Header.css';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className={`header ${isScrolled ? 'header--scrolled' : ''}`}>
      <div className="header__top-bar">
        <div className="header__top-bar-content">
          <div className="header__contact-info">
            <div className="header__contact-item">
              <Phone className="header__contact-icon" size={16} />
              <a href="tel:+55(55) 3343-2606" className="header__contact-link">
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
          <a href="#" className="header__logo">
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
                <a href="#results" className="header__nav-link">Resultados</a>
              </li>
              <li className="header__nav-item">
                <a href="#contact" className="header__nav-link">Contato</a>
              </li>
            </ul>
          </nav>

          <div className="header__cta">
            <a href="https://api.whatsapp.com/send/?phone=555533432606&text=Ol%C3%A1!+Vim+atrav%C3%A9s+do+site+da+Equalizagro%2C+gostaria+de+mais+informa%C3%A7%C3%B5es+sobre+seus+servi%C3%A7os.&type=phone_number&app_absent=0" className="btn btn--primary header__cta-button">
              Solicitar Orçamento
            </a>
          </div>

          <button 
            className={`header__mobile-toggle ${isMobileMenuOpen ? 'header__mobile-toggle--active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <span className="header__mobile-line"></span>
            <span className="header__mobile-line"></span>
            <span className="header__mobile-line"></span>
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
              <a href="#results" className="header__mobile-nav-link">Resultados</a>
            </li>
            <li className="header__mobile-nav-item">
              <a href="#contact" className="header__mobile-nav-link">Contato</a>
            </li>
          </ul>
          <div className="header__mobile-cta">
            <a href="#contact" className="btn btn--primary">
              Solicitar Orçamento
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
