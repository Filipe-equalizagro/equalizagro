'use client';

import { 
  Award, 
  Users, 
  Target, 
  CheckCircle, 
  Star,
  Eye,
  Heart,
  Zap,
  Shield,
  TrendingUp
} from 'lucide-react';
import './About.css';

export default function About() {
  const values = [
    {
      icon: Heart,
      title: 'Paixão pelo Campo',
      description: 'Amamos o que fazemos e isso se reflete na qualidade dos nossos serviços.'
    },
    {
      icon: Target,
      title: 'Foco em Resultados',
      description: 'Cada projeto é desenvolvido com o objetivo de maximizar a produtividade.'
    },
    {
      icon: Shield,
      title: 'Compromisso com Qualidade',
      description: 'Garantimos excelência em todos os aspectos do nosso trabalho.'
    },
    {
      icon: Users,
      title: 'Trabalho em Equipe',
      description: 'Valorizamos a colaboração e o conhecimento compartilhado.'
    }
  ];

  const achievements = [
    {
      icon: Award,
      number: '8+',
      label: 'Anos de Experiência',
      description: 'Tempo dedicado ao setor agrícola'
    },
    {
      icon: Users,
      number: '500+',
      label: 'Fazendas Atendidas',
      description: 'Clientes satisfeitos em todo Brasil'
    },
    {
      icon: TrendingUp,
      number: '95%',
      label: 'Taxa de Sucesso',
      description: 'Resultados comprovados'
    },
    {
      icon: Star,
      number: '100%',
      label: 'Satisfação Cliente',
      description: 'Compromisso com a excelência'
    }
  ];

  return (
    <section id="about" className="about">
      <div className="about__background"></div>
      
      <div className="about__container">
        {/* Header */}
        <div className="about__header">
          <div className="about__badge">
            <CheckCircle className="about__badge-icon" />
            <span>Sobre Nós</span>
          </div>
          <h2 className="about__title">
            Conheça a <span className="hero__title-highlight">Equalizagro</span>
          </h2>
          <p className="about__subtitle">
            Somos especialistas em otimização de aplicações agrícolas, 
            comprometidos em transformar a produtividade do seu negócio.
          </p>
        </div>

        {/* Main Content */}
        <div className="about__content">
          <div className="about__text">
            <div className="about__story">
              <h3 className="about__story-title">
                Nossa História
              </h3>
              <p className="about__story-description">
                Fundada com a missão de revolucionar o setor agrícola brasileiro, 
                a Equalizagro nasceu da paixão pelo campo e da necessidade de 
                otimizar processos de aplicação. Nossa equipe de especialistas 
                trabalha diretamente no campo, analisando cada detalhe para 
                otimizar suas aplicações e maximizar seus resultados.
              </p>
              <p className="about__story-description">
                Ao longo de mais de 8 anos, desenvolvemos metodologias únicas 
                e tecnologias inovadoras que já beneficiaram centenas de 
                fazendas em todo o Brasil, estabelecendo novos padrões de 
                eficiência e produtividade no setor.
              </p>
            </div>
          </div>

          <div className="about__visual">
            <div className="about__visual-container">
              <div className="about__visual-background"></div>
              <div className="about__visual-content">
                <div className="about__visual-icon">
                  <Eye size={48} />
                </div>
                <h3 className="about__visual-title">
                  Nossa Visão para o Futuro
                </h3>
                <p className="about__visual-description">
                  Queremos ser a principal referência em consultoria agrícola no Brasil, 
                  contribuindo para o desenvolvimento sustentável do agronegócio através 
                  de tecnologia, inovação e conhecimento aplicado. Nosso compromisso é 
                  continuar transformando o campo brasileiro, uma aplicação de cada vez.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Values Section - Positioned before achievements */}
        <div className="about__values-section">
          <div className="about__values-header">
            <h3 className="about__values-title">
              Nossos Valores
            </h3>
          </div>
          <div className="about__values-grid">
            {values.map((value, index) => (
              <div key={index} className="about__value">
                <div className="about__value-icon">
                  <value.icon size={24} />
                </div>
                <h4 className="about__value-title">{value.title}</h4>
                <p className="about__value-description">{value.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className="about__achievements">
          <div className="about__achievements-header">
            <h3 className="about__achievements-title">
              Números que <span className="hero__title-highlight">Falam por Si</span>
            </h3>
            <p className="about__achievements-subtitle">
              Resultados que demonstram nossa dedicação e expertise no setor agrícola.
            </p>
          </div>
          
          <div className="about__achievements-grid">
            {achievements.map((achievement, index) => (
              <div key={index} className="about__achievement">
                <div className="about__achievement-icon">
                  <achievement.icon size={32} />
                </div>
                <div className="about__achievement-content">
                  <div className="about__achievement-number">{achievement.number}</div>
                  <div className="about__achievement-label">{achievement.label}</div>
                  <div className="about__achievement-description">{achievement.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
