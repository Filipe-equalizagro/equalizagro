'use client';

import { 
  TrendingUp, 
  Award, 
  CheckCircle, 
  Star,
  Users,
  Target,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  BarChart3,
  TrendingDown,
  DollarSign,
  Leaf,
  MapPin,
  Calendar,
  Eye
} from 'lucide-react';
import './Results.css';

export default function Results() {
  const results = [
    {
      icon: Calendar,
      iconClass: 'results__item-icon--green',
      title: '9 anos gerando rentabilidade no campo',
      description: '+ de 800 mil hectares de consultoria, nas principais regiões agrícolas do Brasil',
      gradient: 'results__item--gradient-green'
    },
    {
      icon: Users,
      iconClass: 'results__item-icon--gold',
      title: '+ de 300 treinamentos ministrados em 2023',
      description: 'Do bate-papo prático na fazenda até os maiores palcos do agro nacional, estamos presentes',
      gradient: 'results__item--gradient-gold'
    },
    {
      icon: Eye,
      iconClass: 'results__item-icon--blue',
      title: 'De olho no futuro',
      description: 'Participamos constante e ativamente de projetos disruptivos envolvendo formulações, adjuvantes e sensoriamento remoto, com alto potencial de incremento na sustentabilidade.',
      gradient: 'results__item--gradient-blue'
    }
  ];

  return (
    <section id="results" className="results">
      <div className="results__background"></div>
      <div className="results__floating-elements">
        <div className="results__floating-element results__floating-element--1"></div>
        <div className="results__floating-element results__floating-element--2"></div>
        <div className="results__floating-element results__floating-element--3"></div>
      </div>
      
      <div className="results__container">
        <div className="results__header">
          <div className="results__badge">
            <CheckCircle className="results__badge-icon" />
            <span>Resultados Comprovados</span>
          </div>
          <h2 className="results__title">
            Números que <span className="hero__title-highlight">Falam por Si</span>
          </h2>
          <p className="results__subtitle">
            Nossos resultados são baseados em dados reais e métricas mensuráveis, 
            demonstrando o impacto positivo que nossa consultoria traz para o seu negócio.
          </p>
        </div>

        <div className="results__grid">
          {results.map((result, index) => (
            <div key={index} className={`results__item ${result.gradient}`}>
              <div className="results__item-glow"></div>
              <div className={`results__item-icon ${result.iconClass}`}>
                <result.icon size={32} />
              </div>
              <h3 className="results__item-title">{result.title}</h3>
              <p className="results__item-description">{result.description}</p>
              <div className="results__item-overlay"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

