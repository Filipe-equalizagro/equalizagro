'use client';

import { useState, useEffect } from 'react';
import { verifySession } from '@/lib/auth';
import './kow.css';

export default function ConsultorKowPage() {
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
      <div className="kow-loading">
        <div className="kow-loading__spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="kow-fullscreen">
      {!iframeReady && (
        <div className="kow-iframe-loading">
          <div className="kow-iframe-loading__spinner" />
          <p>Carregando Consultor Kow...</p>
        </div>
      )}
      <iframe
        src="/ferramentas/consultor-kow.html"
        className={`kow-iframe${iframeReady ? ' kow-iframe--ready' : ''}`}
        title="Consultor Kow — Equalizagro"
        onLoad={() => setIframeReady(true)}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads allow-top-navigation-by-user-activation"
      />
    </div>
  );
}
