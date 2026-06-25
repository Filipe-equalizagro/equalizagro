'use client';

import { useState, useEffect } from 'react';
import { verifySession } from '@/lib/auth';
import './go2apply.css';

export default function Go2ApplyPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const result = await verifySession();
      if (!result.valid) {
        window.location.href = '/';
        return;
      }
      setIsAuthenticated(true);
      setIsLoading(false);
    };
    checkSession();
  }, []);

  if (isLoading) {
    return (
      <div className="bicos-loading">
        <div className="bicos-loading__spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="bicos-fullscreen">
      {!iframeReady && (
        <div className="bicos-iframe-loading">
          <div className="bicos-iframe-loading__spinner" />
          <p>Carregando calculadora...</p>
        </div>
      )}
      <iframe
        src="/ferramentas/calculadora-bicos.html"
        className={`bicos-iframe${iframeReady ? ' bicos-iframe--ready' : ''}`}
        title="Pulverização — Equalizagro"
        onLoad={() => setIframeReady(true)}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads allow-top-navigation-by-user-activation"
      />
    </div>
  );
}
