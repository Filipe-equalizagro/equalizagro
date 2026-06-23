'use client';

import {
  Sprout,
  Target,
  Shield,
  Users,
  Award,
  Droplet,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Clock,
  TrendingUp,
  Info,
  Crosshair,
  Monitor
} from 'lucide-react';
import './Services.css';

export default function Services() {
  const services = [
    {
      icon: Droplet,
      iconClass: 'services__item-icon--gold',
      title: 'Consultoria em Tecnologia de Aplicação',
      description: 'Suporte técnico completo para pulverizações, herbologia e distribuição de sólidos, buscando a máxima performance de todos os insumos',
      features: [
        { text: 'Suporte em tempo integral', icon: CheckCircle },
        { text: 'Calibração e configuração periódica dos equipamentos', icon: CheckCircle },
        { text: 'Aferição da qualidade das aplicações', icon: CheckCircle },
        { text: 'Herbologia Aplicada — manejo de plantas daninhas', icon: CheckCircle },
        { text: 'Posicionamento baseado em pesquisa', icon: CheckCircle },
        { text: 'Foco na rentabilidade', icon: CheckCircle },
        { text: 'Distribuição de Sólidos — calibração e perfil de distribuição', icon: CheckCircle },
        { text: 'Regulagem conforme produto e dose', icon: CheckCircle },
      ],
      backgroundImage: 'services__item-bg--consultoria'
    },
    {
      icon: BarChart3,
      iconClass: 'services__item-icon--blue',
      title: 'Pesquisa Agrícola',
      description: 'Além de ser nosso pilar de sustentação, a pesquisa também é uma forma de serviço, atendendo quem deseja avaliar performance de produtos e manejos',
      features: [
        { text: 'Adjuvantes', icon: CheckCircle },
        { text: 'Herbicidas', icon: CheckCircle },
        { text: 'Compatibilidade na eficácia', icon: CheckCircle },
        { text: 'Compatibilidade em bancada', icon: CheckCircle },
        { text: 'Ajustes de posicionamento', icon: CheckCircle }
      ],
      backgroundImage: 'services__item-bg--pesquisa'
    },
    {
      icon: TrendingUp,
      iconClass: 'services__item-icon--purple',
      title: 'Treinamentos',
      description: 'Palestras e treinamentos pautados em resultados e muita prática',
      features: [
        { text: 'Manejo de Plantas Daninhas', icon: CheckCircle },
        { text: 'Tecnologia de Aplicação', icon: CheckCircle },
        { text: 'Formulações e adjuvantes', icon: CheckCircle },
        { text: 'E muito mais!', icon: CheckCircle },
      ],
      backgroundImage: 'services__item-bg--monitoramento'
    },
    {
      icon: Crosshair,
      iconClass: 'services__item-icon--blue',
      title: 'Pulverização em Taxa Variável',
      description: 'Aplicação inteligente com modulação de dose em tempo real, reduzindo custos e melhorando a eficiência dos insumos',
      features: [
        { text: 'Mapas de prescrição por zona', icon: CheckCircle },
        { text: 'Integração com GPS e controladores', icon: CheckCircle },
        { text: 'Redução do desperdício de insumos', icon: CheckCircle },
        { text: 'Relatórios de aplicação por seção', icon: CheckCircle },
      ],
      backgroundImage: 'services__item-bg--pesquisa'
    },
    {
      icon: Monitor,
      iconClass: 'services__item-icon--green',
      title: 'Ferramentas Digitais',
      description: 'Plataformas digitais para apoiar decisões técnicas no campo, com inteligência artificial e dados em tempo real',
      features: [
        { text: 'Consultor.IA especializado em caldas', icon: CheckCircle },
        { text: 'Calculadora de bicos e calibração', icon: CheckCircle },
        { text: 'Recomendações baseadas em banco de dados', icon: CheckCircle },
      ],
      backgroundImage: 'services__item-bg--consultoria',
      ctaButton: { href: '/login', imageSrc: '/images/go2apply-logo-branco.png', imageAlt: 'go2apply' }
    },
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
      icon: Info,
      title: 'Saiba Primeiro',
      description: 'Pioneirismo em diversos manejos que hoje já são usuais no agro brasileiro.'
    },
    {
      icon: Users,
      title: 'Equipe Especializada',
      description: 'Profissionais com vasta experiência, treinados a ponto de entregar treinamentos.'
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
            suas operações agrícolas e maximizar a rentabilidade do seu negócio, através da informação.
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
              {'ctaButton' in service && service.ctaButton && (
                <a href={service.ctaButton.href} className="services__go2apply-btn">
                  <img src={service.ctaButton.imageSrc} alt={service.ctaButton.imageAlt} className="services__go2apply-logo" />
                </a>
              )}
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
              Pronto para transformar seus manejos?
            </h3>
            <p className="services__cta-description">
              Entre em contato conosco e descubra como podemos ajudar você a 
              alcançar resultados extraordinários no campo.
            </p>
            <a href="https://api.whatsapp.com/send/?phone=555533432606&text=Ol%C3%A1!+Vim+atrav%C3%A9s+do+site+da+Equalizagro%2C+gostaria+de+mais+informa%C3%A7%C3%B5es+sobre+seus+servi%C3%A7os.&type=phone_number&app_absent=0" className="btn btn--large services__cta-button">
              Solicitar Consultoria
              <ArrowRight size={20} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}