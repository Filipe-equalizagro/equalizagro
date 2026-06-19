'use client';

import { useState, useEffect } from 'react';
import IASection from './IASection';

export default function ConditionalIASection() {
  // Pressuposto inicial: não logado → exibe a seção.
  // Se confirmar que há token, oculta.
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  if (isLoggedIn) return null;

  return <IASection />;
}
