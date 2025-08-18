'use client';

import { 
  Sprout, 
  Target, 
  Shield, 
  Users, 
  Award, 
  CheckCircle, 
  ArrowRight,
  BarChart3,
  Clock,
  TrendingUp,
  Wrench,
  Zap,
  GraduationCap
} from 'lucide-react';
import './Services.css';

export default function Services() {
  const services = [
    {
      icon: Sprout,
      iconClass: 'services__item-icon--green',
      title: 'Consultoria Especializada',
      description: 'Análise completa da sua operação agrícola com recomendações personalizadas para otimização de aplicações.',
      features: [
        { text: 'Análise de Solo', icon: CheckCircle },
        { text: 'Mapeamento de Áreas', icon: CheckCircle },
        { text: 'Planejamento Estratégico', icon: CheckCircle }
      ],
      backgroundImage: 'services__item-bg--consultoria'
    },
    {
      icon: GraduationCap,
      iconClass: 'services__item-icon--gold',
      title: 'Treinamentos Práticos',
      description: 'Capacitação da sua equipe com técnicas avançadas de aplicação e manejo de equipamentos.',
      features: [
        { text: 'Técnicas de Aplicação', icon: Zap },
        { text: 'Manutenção de Equipamentos', icon: Wrench },
        { text: 'Segurança no Campo', icon: Shield }
      ],
      backgroundImage: 'services__item-bg--treinamento'
    },
    {
      icon: BarChart3,
      iconClass: 'services__item-icon--blue',
      title: 'Pesquisa e Desenvolvimento',
      description: 'Desenvolvimento de novas tecnologias e metodologias para maximizar a eficiência agrícola.',
      features: [
        { text: 'Novas Tecnologias', icon: CheckCircle },
        { text: 'Testes de Campo', icon: CheckCircle },
        { text: 'Inovação Agrícola', icon: CheckCircle }
      ],
      backgroundImage: 'services__item-bg--pesquisa'
    },
    {
      icon: TrendingUp,
      iconClass: 'services__item-icon--purple',
      title: 'Monitoramento de Resultados',
      description: 'Acompanhamento contínuo dos resultados com relatórios detalhados e ajustes em tempo real.',
      features: [
        { text: 'Relatórios Detalhados', icon: CheckCircle },
        { text: 'Monitoramento 24/7', icon: CheckCircle },
        { text: 'Ajustes Automáticos', icon: CheckCircle }
      ],
      backgroundImage: 'services__item-bg--monitoramento'
    }
  ];

  const features = [
    {
      icon: Shield,
      title: 'Garantia de Resultados',
      description: 'Compromisso com resultados mensuráveis e satisfação garantida.'
    },
    {
      icon: Clock,
      title: 'Suporte 24/7',
      description: 'Assistência técnica disponível a qualquer momento para sua operação.'
    },
    {
      icon: Award,
      title: 'Certificação ISO',
      description: 'Processos certificados e metodologias reconhecidas internacionalmente.'
    },
    {
      icon: Users,
      title: 'Equipe Especializada',
      description: 'Profissionais com vasta experiência no setor agrícola brasileiro.'
    }
  ];

  return (
    <section id="services" className="services">
      <div className="services__container">
        <div className="services__header">
          <div className="services__badge">
            <CheckCircle className="services__badge-icon" />
            <span>Nossos Serviços</span>
          </div>
          <h2 className="services__title">
            Soluções <span className="hero__title-highlight">Completas</span> para o Campo
          </h2>
          <p className="services__subtitle">
            Oferecemos uma gama completa de serviços especializados para otimizar 
            suas operações agrícolas e maximizar a produtividade do seu negócio.
          </p>
        </div>

        <div className="services__grid">
          {services.map((service, index) => (
            <div key={index} className={`services__item ${service.backgroundImage}`}>
              <div className="services__item-background"></div>
              <div className={`services__item-icon ${service.iconClass}`}>
                <service.icon size={32} />
              </div>
              <h3 className="services__item-title">{service.title}</h3>
              <p className="services__item-description">{service.description}</p>
              <ul className="services__item-features">
                {service.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="services__item-feature">
                    <feature.icon className="services__item-feature-icon" size={16} />
                    {feature.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="services__features">
          <div className="services__features-header">
            <h3 className="services__features-title">
              Por que escolher a <span className="hero__title-highlight">Equalizagro</span>?
            </h3>
            <p className="services__features-subtitle">
              Nossa experiência e metodologia comprovada fazem a diferença no seu negócio.
            </p>
          </div>
          
          <div className="services__features-grid">
            {features.map((feature, index) => (
              <div key={index} className="services__feature">
                <div className="services__feature-icon">
                  <feature.icon size={24} />
                </div>
                <div>
                  <h4 className="services__feature-title">{feature.title}</h4>
                  <p className="services__feature-description">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="services__cta">
          <div className="services__cta-content">
            <h3 className="services__cta-title">
              Pronto para transformar sua operação agrícola?
            </h3>
            <p className="services__cta-description">
              Entre em contato conosco e descubra como podemos ajudar você a 
              alcançar resultados extraordinários no campo.
            </p>
            <a href="#contact" className="btn btn--large services__cta-button">
              Solicitar Consultoria
              <ArrowRight size={20} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}