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

        <div className="contact__content">
          <div className="contact__info">
            <div className="contact__info-card">
              <div className="contact__info-icon">
                <Phone size={24} />
              </div>
              <h4 className="contact__info-title">Telefone</h4>
              <div className="contact__info-content">
                <a href="https://api.whatsapp.com/send/?phone=555533432606&text=Ol%C3%A1!+Vim+atrav%C3%A9s+do+site+da+Equalizagro%2C+gostaria+de+mais+informa%C3%A7%C3%B5es+sobre+seus+servi%C3%A7os.&type=phone_number&app_absent=0" className="contact__info-link">
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
                src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d4163.996758888566!2d-53.60279937639443!3d-28.64504509907205!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94fd97d637cf90dd%3A0xcd471181c8a6bd1e!2sEqualizagro%20Consultoria%20e%20Tecnologia%20Ltda!5e0!3m2!1spt-BR!2sus!4v1769628133354!5m2!1spt-BR!2sus"
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
