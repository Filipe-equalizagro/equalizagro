'use client';

import { 
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Heart
} from 'lucide-react';
import './Footer.css';

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="footer">
      <div className="footer__background"></div>
      
      <div className="footer__container">
        {/* Main Footer */}
        <div className="footer__main">
          <div className="footer__content">
            {/* Company Info */}
            <div className="footer__company">
              <a href="#" className="footer__logo">
                <img 
                  src="/images/EQUALIZAGRO ok.png" 
                  alt="Equalizagro Logo" 
                  className="footer__logo-image" 
                />
              </a>
              <p className="footer__description">
                Convertendo pulverizações em aplicações desde 2016,
                através da transformação de dados em posicionamentos.
              </p>
              <div className="footer__social">
                <a href="https://www.facebook.com/share/1C5Nu4yTc6/" className="footer__social-link">
                  <Facebook size={20} />
                </a>
                <a 
                  href="https://www.instagram.com/equalizagro?igsh=aDNqdHRsZnQ4MWNm" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="footer__social-link"
                >
                  <Instagram size={20} />
                  </a>
                <a href="https://www.linkedin.com/company/equalizagro/" className="footer__social-link">
                  <Linkedin size={20} />
                </a>
                <a href="#" className="footer__social-link">
                  <Youtube size={20} />
                </a>
              </div>
            </div>

            {/* Services */}
            <div className="footer__section">
              <h4 className="footer__section-title">Serviços</h4>
              <ul className="footer__section-list">
                <li>
                  <a href="#services" className="footer__section-link">
                    <ArrowRight className="footer__section-link-icon" size={16} />
                    Consultoria Especializada
                  </a>
                </li>
                <li>
                  <a href="#services" className="footer__section-link">
                    <ArrowRight className="footer__section-link-icon" size={16} />
                    Monitoramento de resultados
                  </a>
                </li>
                <li>
                  <a href="#services" className="footer__section-link">
                    <ArrowRight className="footer__section-link-icon" size={16} />
                    Pesquisa
                  </a>
                </li>
                <li>
                  <a href="#services" className="footer__section-link">
                    <ArrowRight className="footer__section-link-icon" size={16} />
                    Treinamentos práticos
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div className="footer__section">
              <h4 className="footer__section-title">Empresa</h4>
              <ul className="footer__section-list">
                <li>
                  <a href="#about" className="footer__section-link">
                    <ArrowRight className="footer__section-link-icon" size={16} />
                    Sobre Nós
                  </a>
                </li>
                <li>
                  <a href="#results" className="footer__section-link">
                    <ArrowRight className="footer__section-link-icon" size={16} />
                    Resultados
                  </a>
                </li>
                <li>
                  <a href="#contact" className="footer__section-link">
                    <ArrowRight className="footer__section-link-icon" size={16} />
                    Contato
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div className="footer__section">
              <h4 className="footer__section-title">Contato</h4>
              <div className="footer__contact-info">
                <div className="footer__contact-item">
                  <Phone className="footer__contact-icon" size={20} />
                  <a href="tel:+55(55) 3343-2606" className="footer__contact-link">
                    (55) 3343-2606
                  </a>
                </div>
                <div className="footer__contact-item">
                  <Mail className="footer__contact-icon" size={20} />
                  <a href="mailto:contato@equalizagro.com" className="footer__contact-link">
                    contato@equalizagro.com
                  </a>
                </div>
                <div className="footer__contact-item">
                  <MapPin className="footer__contact-icon" size={20} />
                  <a 
                    href="https://www.google.com/maps?q=Cart%C3%B3rio%20de%20Registro%20de%20Im%C3%B3veis%20de%20Cruz%20Alta%2C%20R.%20Volunt%C3%A1rios%20da%20P%C3%A1tria%2C%20192%20-%20Centro%2C%20Cruz%20Alta%20-%20RS%2C%2098005-104" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="footer__contact-link"
                  >
                    Cruz Alta - RS, Brasil
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer__bottom">
          <div className="footer__copyright">
            © 2025 Equalizagro. Todos os direitos reservados.
          </div>
          
          <div className="footer__development">
            Desenvolvido por{' '}
            <a href="#" className="footer__development-link">
              Equalizagro
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
