'use client';

import { useState, useEffect, useRef } from 'react';
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { loginWithCredentials, verifySession } from '@/lib/auth';
import './login.css';

// Slides do painel de imagem — alternam automaticamente e o usuário
// pode escolher manualmente pelos indicadores (dots).
const LOGIN_SLIDES = [
  { src: '/images/laptop_consultoria_taskbar_clean_880x727.png', alt: 'Consultor.IA — go2apply' },
  { src: '/images/laptop_dmv_taskbar_clean_880x727.png', alt: 'DMV — go2apply' },
];

const SLIDE_INTERVAL_MS = 6000;

export default function LoginPage() {
  const [checking, setChecking]   = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Loop automático entre os slides
  useEffect(() => {
    slideTimerRef.current = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % LOGIN_SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, []);

  // Seleção manual — reinicia o timer para não trocar logo em seguida
  const goToSlide = (index: number) => {
    setActiveSlide(index);
    if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    slideTimerRef.current = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % LOGIN_SLIDES.length);
    }, SLIDE_INTERVAL_MS);
  };

  useEffect(() => {
    verifySession().then(r => {
      if (r.valid) window.location.href = '/go2apply';
      else setChecking(false);
    });
  }, []);

  if (checking) return <div className="lp-checking"><div className="lp-spinner" /></div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!email)    errs.email    = 'Email obrigatório';
    if (!password) errs.password = 'Senha obrigatória';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    try {
      const r = await loginWithCredentials({ email, password });
      if (r.success) window.location.href = '/go2apply';
      else setErrors({ submit: r.message });
    } catch {
      setErrors({ submit: 'Erro ao fazer login. Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="lp-root">

      {/* ── Painel esquerdo — imagem (carrossel) ── */}
      <div className="lp-image-panel">
        <div className="lp-image-inner">
          {LOGIN_SLIDES.map((slide, index) => (
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              className={`lp-image-slide${index === activeSlide ? ' lp-image-slide--active' : ''}`}
            />
          ))}
          <div className="lp-image-dots">
            {LOGIN_SLIDES.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                className={`lp-image-dot${index === activeSlide ? ' lp-image-dot--active' : ''}`}
                aria-label={`Mostrar imagem: ${slide.alt}`}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Painel direito — formulário ── */}
      <div className="lp-form-panel">
        <div className="lp-card">

          <a href="/" className="lp-logo">
            <img src="/images/go2apply-logo-colorido.png" alt="Equalizagro" />
          </a>

          <div className="lp-header">
            <h1 className="lp-title">Entrar na plataforma</h1>
          </div>

          <form onSubmit={handleSubmit} className="lp-form">
            <div className="lp-field">
              <label>Email</label>
              <div className="lp-input-wrap">
                <Mail size={17} className="lp-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
                  placeholder="seu@email.com"
                  className={errors.email ? 'lp-input lp-input--err' : 'lp-input'}
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="lp-err"><AlertCircle size={14} />{errors.email}</p>}
            </div>

            <div className="lp-field">
              <label>Senha</label>
              <div className="lp-input-wrap">
                <Lock size={17} className="lp-icon" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                  placeholder="Sua senha"
                  className={errors.password ? 'lp-input lp-input--err' : 'lp-input'}
                  style={{ paddingRight: '2.8rem' }}
                  autoComplete="current-password"
                />
                <button type="button" className="lp-eye" onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="lp-err"><AlertCircle size={14} />{errors.password}</p>}
            </div>

            {errors.submit && (
              <div className="lp-alert"><AlertCircle size={16} />{errors.submit}</div>
            )}

            <button type="submit" className="lp-btn" disabled={isLoading}>
              {isLoading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="lp-forgot"><a href="/recuperar-senha">Esqueci minha senha</a></p>

          <div className="lp-register-notice">
            <p>Não tem cadastro?</p>
            <a href="/cadastro">
              Cadastre-se
            </a>
          </div>

          <p className="lp-footer-link"><a href="/">← Voltar ao site</a></p>
        </div>
      </div>

    </div>
  );
}
