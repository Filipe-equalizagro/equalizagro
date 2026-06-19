'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Phone,
  Brain
} from 'lucide-react';
import './Hero.css';

export default function Hero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section id="home" className="hero">
      <div className="hero__background-overlay"></div>
      <div className="hero__container">
        <div className={`hero__content ${isVisible ? 'hero__content--visible' : ''}`}>
          <div className="hero__text">
            <div className="hero__badge">
              <span>Tecnologia de Aplicação e Manejo de Plantas Daninhas</span>
            </div>

            <h1 className="hero__title">
              Transforme suas <span className="hero__title-highlight">Aplicações</span> em 
              <span className="hero__title-highlight"> Resultados</span>
            </h1>

            <p className="hero__description">
              Convertemos pulverizações em aplicações através de Pesquisa, Consultoria e Treinamentos.
            </p>

            <div className="hero__cta-group">
              <Link href="#contact" className="btn btn--large hero__cta-primary">
                <span>Começar Agora</span>
                <ArrowRight size={20} />
              </Link>
              <a href="https://api.whatsapp.com/send/?phone=555533432606&text=Ol%C3%A1!+Vim+atrav%C3%A9s+do+site+da+Equalizagro%2C+gostaria+de+mais+informa%C3%A7%C3%B5es+sobre+seus+servi%C3%A7os.&type=phone_number&app_absent=0" className="btn btn--outline btn--large hero__cta-secondary">
                <Phone size={20} />
                <span>Solicitar Orçamento</span>
              </a>
            </div>
          </div>

          <div className="hero__image-container">
            <img 
              src="/images/hero-background.png" 
              alt="Trator pulverizador trabalhando em uma lavoura verde" 
              className="hero__image" 
            />
          </div>
        </div>
      </div>
    </section>
  );
}