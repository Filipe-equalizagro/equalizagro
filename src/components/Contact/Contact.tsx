'use client';

import { 
  MessageSquare, 
  Phone, 
  Mail, 
  MapPin, 
  Clock,
  Facebook,
  Instagram,
  Linkedin,
  Youtube
} from 'lucide-react';
import './Contact.css';

export default function Contact() {
  return (
    <section id="contact" className="contact">
      <div className="contact__background"></div>
      
      <div className="contact__container">
        {/* Header */}
        <div className="contact__header">
          <div className="contact__badge">
            <MessageSquare className="contact__badge-icon" />
            <span>Entre em Contato</span>
          </div>
          <h2 className="contact__title">
            Vamos <span className="hero__title-highlight">conversar</span> sobre seu <span className="hero__title-highlight"> projeto</span>
          </h2>
          <p className="contact__subtitle">
            Estamos prontos para ajudar você a otimizar suas aplicações agrícolas. 
            Entre em contato conosco e descubra como podemos transformar sua operação.
          </p>
        </div>

        {/* Content */}
        <div className="contact__content">
          {/* Contact Info */}
          <div className="contact__info">
            <div className="contact__info-card">
              <div className="contact__info-icon">
                <Phone size={24} />
              </div>
              <h4 className="contact__info-title">Telefone</h4>
              <div className="contact__info-content">
                <a href="tel:+55(55) 3343-2606" className="contact__info-link">
                  (55) 3343-2606
                </a>
                <br />
                Segunda a Sexta, 8h às 18h
              </div>
            </div>

            <div className="contact__info-card">
              <div className="contact__info-icon">
                <Mail size={24} />
              </div>
              <h4 className="contact__info-title">E-mail</h4>
              <div className="contact__info-content">
                <a href="mailto:contato@equalizagro.com" className="contact__info-link">
                contato@equalizagro.com
                </a>
                <br />
                Resposta em até 24 horas
              </div>
            </div>

            <div className="contact__info-card">
              <div className="contact__info-icon">
                <Clock size={24} />
              </div>
              <h4 className="contact__info-title">Horário de Atendimento</h4>
              <div className="contact__info-content">
                Segunda a Sexta: 8h às 18h
                <br />
                Sábado: 8h às 12h
                <br />
              </div>
            </div>
          </div>
        </div>

        {/* Location Section - Centered below contact info */}
        <div className="contact__location-section">
          <div className="contact__map">
            <div className="contact__map-icon">
              <MapPin size={32} />
            </div>
            <h4 className="contact__map-title">Nossa Localização</h4>
            <p className="contact__map-address">
              Atendemos todo o território nacional
            </p>
            <div className="contact__map-embed">
              <iframe
                src="https://www.google.com/maps?q=Cart%C3%B3rio%20de%20Registro%20de%20Im%C3%B3veis%20de%20Cruz%20Alta%2C%20R.%20Volunt%C3%A1rios%20da%20P%C3%A1tria%2C%20192%20-%20Centro%2C%20Cruz%20Alta%20-%20RS%2C%2098005-104&hl=pt-BR&z=16&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                title="Mapa - Cartório de Registro de Imóveis de Cruz Alta"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
