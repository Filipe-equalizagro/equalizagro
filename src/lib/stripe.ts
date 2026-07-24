// lib/stripe.ts
import Stripe from 'stripe';

// Singleton — evita recriar o client em toda invocação serverless
declare global {
  // eslint-disable-next-line no-var
  var __stripeClient: Stripe | undefined;
}

function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY não configurada nas variáveis de ambiente');
  }
  return new Stripe(key, {
    apiVersion: '2026-06-24.dahlia',
  });
}

export function getStripe(): Stripe {
  return (globalThis.__stripeClient ??= createStripeClient());
}
