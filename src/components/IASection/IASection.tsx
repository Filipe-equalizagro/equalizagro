'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Brain,
  Zap,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Shield,
  MessageSquare,
  TrendingUp,
  Leaf,
  Target,
  BarChart3,
  Send,
} from 'lucide-react';
import './IASection.css';

export default function IASection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [typedText, setTypedText] = useState('');
  const sectionRef = useRef<HTMLElement>(null);

  const fullText = 'A deriva depende de vários fatores. Recomendo verificar a velocidade do vento (< 10 km/h), usar pontas de pulverização adequadas (ex: AIXR), e manter a altura de barra correta entre 40-50cm do alvo.';

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible && typedText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.slice(0, typedText.length + 1));
      }, 20);
      return () => clearTimeout(timeout);
    }
  }, [isVisible, typedText, fullText]);

  const features = [
    {
      icon: <Brain size={28} />,
      title: 'Consultoria Inteligente',
      description: 'IA treinada com vasto conhecimento em tecnologia de aplicação e manejo agrícola.',
      gradient: 'feature-gradient-1'
    },
    {
      icon: <Zap size={28} />,
      title: 'Respostas Instantâneas',
      description: 'Orientações precisas em segundos sobre suas dúvidas agronômicas.',
      gradient: 'feature-gradient-2'
    },
    {
      icon: <Shield size={28} />,
      title: 'Dados Confidenciais',
      description: 'Informações protegidas com criptografia e segurança de nível empresarial.',
      gradient: 'feature-gradient-3'
    },
    {
      icon: <Target size={28} />,
      title: 'Recomendações Validadas',
      description: 'Baseado em pesquisa científica e experiência comprovada de especialistas.',
      gradient: 'feature-gradient-4'
    }
  ];

  const expertiseAreas = [
    {
      icon: <Leaf size={24} />,
      title: 'Tecnologia de Aplicação',
      items: ['Pulverização terrestre e aérea', 'Controle de deriva', 'Cobertura de alvos biológicos'],
    },
    {
      icon: <BarChart3 size={24} />,
      title: 'Manejo de Plantas Daninhas',
      items: ['Resistência a herbicidas', 'Estratégias integradas', 'Rotação de mecanismos de ação'],
    },
    {
      icon: <TrendingUp size={24} />,
      title: 'Consultoria Agrícola',
      items: ['Práticas recomendadas', 'Regulamentações vigentes', 'Análise de cenários produtivos'],
    },
  ];

  const plans = [
    {
      name: 'Iniciante',
      credits: 'xx.x',
      price: 'xx,xx',
      consultations: '~xx consultas',
      features: ['Acesso completo ao go2apply', '~xx consultas inteligentes', 'Suporte por email'],
      popular: false
    },
    {
      name: 'Profissional',
      credits: 'xx.x',
      price: 'xx,xx',
      consultations: '~xx consultas',
      features: ['Acesso completo ao go2apply', '~xx consultas inteligentes', 'Suporte prioritário', 'Respostas aprofundadas'],
      popular: true
    },
    {
      name: 'Empresarial',
      credits: 'xx.x',
      price: 'xx,xx',
      consultations: '~xx0 consultas',
      features: ['Acesso completo ao go2apply', '~xx consultas inteligentes', 'Suporte 24/7', 'Respostas aprofundadas', 'Múltiplos usuários'],
      popular: false
    }
  ];

  return (
    <section ref={sectionRef} id="ia-consultor" className="ia-section">
      {/* Background decorations */}
      <div className="ia-section__bg-glow ia-section__bg-glow--1" />
      <div className="ia-section__bg-glow ia-section__bg-glow--2" />
      <div className="ia-section__bg-grid" />

      <div className="ia-section__container">

        {/* ═══════════════ HERO SECTION ═══════════════ */}
        <div className={`ia-section__hero ${isVisible ? 'ia-section--visible' : ''}`}>
          <div className="ia-section__hero-content">
            <div className="ia-section__badge">
                <Brain size={14} />
              <span>Tecnologia de Aplicação Agrícola</span>
            </div>

            <h1 className="ia-section__title">
              go2<span className="ia-section__title-accent">apply</span>
            </h1>

            <p className="ia-section__subtitle">
              Ferramentas de calibração, aferição, dimensionamento e avaliação de espectro de gotas, disponível <strong>24 horas</strong>.
            </p>

            <div className="ia-section__hero-stats">
              <div className="ia-section__stat">
                <span className="ia-section__stat-number">24/7</span>
                <span className="ia-section__stat-label">Disponível</span>
              </div>
              <div className="ia-section__stat-divider" />
              <div className="ia-section__stat">
                <span className="ia-section__stat-number">{`<`}3s</span>
                <span className="ia-section__stat-label">Tempo de Resposta</span>
              </div>
              <div className="ia-section__stat-divider" />
              <div className="ia-section__stat">
                <span className="ia-section__stat-number">100%</span>
                <span className="ia-section__stat-label">Confidencial</span>
              </div>
            </div>

            <div className="ia-section__hero-actions">
              <Link href="/Consultor.IA" className="ia-section__btn-primary">
                <span>Experimentar Agora</span>
                <ArrowRight size={18} />
              </Link>
              <a href="#ia-plans" className="ia-section__btn-secondary">
                <span>Ver Planos</span>
              </a>
            </div>
          </div>

          <div className="ia-section__hero-visual">
            <div className="ia-section__chat-window">
              <div className="ia-section__chat-header">
                <div className="ia-section__chat-header-left">
                  <div className="ia-section__chat-avatar">
                    <Brain size={20} />
                  </div>
                  <div>
                    <p className="ia-section__chat-name">go2apply</p>
                    <div className="ia-section__chat-status">
                      <span className="ia-section__chat-status-dot" />
                      <span>Online</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ia-section__chat-body">
                <div className="ia-section__chat-msg ia-section__chat-msg--user">
                  <p>Qual é a melhor forma de controlar a deriva em pulverizações?</p>
                </div>
                <div className="ia-section__chat-msg ia-section__chat-msg--ai">
                  <div className="ia-section__chat-msg-header">
                    <Brain size={14} />
                    <span>go2apply</span>
                  </div>
                  <p>{typedText}<span className="ia-section__cursor">|</span></p>
                </div>
              </div>

              <div className="ia-section__chat-input">
                <span>Digite sua pergunta...</span>
                <Send size={16} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════ FEATURES GRID ═══════════════ */}
        <div className={`ia-section__features ${isVisible ? 'ia-section--visible' : ''}`}>
          {features.map((feature, index) => (
            <div
              key={index}
              className={`ia-section__feature-card`}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className={`ia-section__feature-icon ${feature.gradient}`}>
                {feature.icon}
              </div>
              <h3 className="ia-section__feature-title">{feature.title}</h3>
              <p className="ia-section__feature-desc">{feature.description}</p>
              <div className="ia-section__feature-line" />
            </div>
          ))}
        </div>

        {/* ═══════════════ EXPERTISE SECTION ═══════════════ */}
        <div className={`ia-section__expertise ${isVisible ? 'ia-section--visible' : ''}`}>
          <div className="ia-section__section-header">
            <span className="ia-section__section-tag">Conhecimento Especializado</span>
            <h2 className="ia-section__section-title">
              Treinado com <span className="ia-section__title-accent">Excelência</span>
            </h2>
            <p className="ia-section__section-desc">
              O go2apply foi desenvolvido com base em pesquisas científicas e décadas de experiência em campo.
            </p>
          </div>

          <div className="ia-section__expertise-tabs">
            {expertiseAreas.map((area, index) => (
              <button
                key={index}
                className={`ia-section__tab ${activeTab === index ? 'ia-section__tab--active' : ''}`}
                onClick={() => setActiveTab(index)}
              >
                {area.icon}
                <span>{area.title}</span>
              </button>
            ))}
          </div>

          <div className="ia-section__expertise-content">
            <div className="ia-section__expertise-card">
              <div className="ia-section__expertise-icon">
                {expertiseAreas[activeTab].icon}
              </div>
              <h3 className="ia-section__expertise-title">{expertiseAreas[activeTab].title}</h3>
              <ul className="ia-section__expertise-list">
                {expertiseAreas[activeTab].items.map((item, i) => (
                  <li key={i} className="ia-section__expertise-item">
                    <CheckCircle size={18} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ═══════════════ PLANS SECTION ═══════════════ */}
        <div id="ia-plans" className={`ia-section__plans ${isVisible ? 'ia-section--visible' : ''}`}>
          <div className="ia-section__section-header">
            <span className="ia-section__section-tag">Investimento</span>
            <h2 className="ia-section__section-title">
              Planos <span className="ia-section__title-accent">&amp;</span> Créditos
            </h2>
            <p className="ia-section__section-desc">
              Cada consulta utiliza créditos. Escolha o plano que melhor se adequa à sua operação.
            </p>
          </div>

          <div className="ia-section__plans-grid">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`ia-section__plan ${plan.popular ? 'ia-section__plan--popular' : ''}`}
              >
                {plan.popular && (
                  <div className="ia-section__plan-ribbon">
                    <span>Mais Popular</span>
                  </div>
                )}
                <div className="ia-section__plan-header">
                  <h3 className="ia-section__plan-name">{plan.name}</h3>
                  <div className="ia-section__plan-pricing">
                    <span className="ia-section__plan-currency">R$</span>
                    <span className="ia-section__plan-price">{plan.price}</span>
                  </div>
                  <p className="ia-section__plan-credits">{plan.credits} créditos</p>
                  <p className="ia-section__plan-consultations">{plan.consultations}</p>
                </div>
                <div className="ia-section__plan-divider" />
                <ul className="ia-section__plan-features">
                  {plan.features.map((feature, i) => (
                    <li key={i}>
                      <CheckCircle size={16} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button className={`ia-section__plan-btn ${plan.popular ? 'ia-section__plan-btn--primary' : ''}`}>
                  Escolher Plano
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════ CTA FINAL ═══════════════ */}
        <div className={`ia-section__final-cta ${isVisible ? 'ia-section--visible' : ''}`}>
          <div className="ia-section__final-cta-bg" />
          <div className="ia-section__final-cta-content">
            <h2 className="ia-section__final-cta-title">
              Pronto para Transformar sua Consultoria?
            </h2>
            <p className="ia-section__final-cta-desc">
              Acesse orientações especializadas com a velocidade e precisão que seu negócio merece.
            </p>
            <div className="ia-section__final-cta-actions">
              <Link href="/ConsultorIA" className="ia-section__cta-btn-light">
                <MessageSquare size={18} />
                <span>Acessar go2apply</span>
                <ArrowRight size={18} />
              </Link>
              <Link href="#contact" className="ia-section__cta-btn-outline">
                <span>Tirar Dúvidas</span>
              </Link>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
