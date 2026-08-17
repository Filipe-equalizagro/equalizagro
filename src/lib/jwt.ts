// lib/jwt.ts
// Núcleo de emissão/verificação de sessão via JWT — assinatura HS256, sem
// consulta ao banco pra checar validade/expiração (isso é o que torna a
// verificação rápida, ao contrário do esquema anterior de bcrypt.compare
// contra toda a tabela auth_tokens). Revogação (logout, suspensão) ainda é
// garantida por fora: quem chama verifySessionToken deve conferir o claim
// `tv` contra equalizagro.users.token_version (ver lib/session.ts).
import { SignJWT, jwtVerify, errors } from 'jose';

const SESSION_DURATION = '7d'; // mesmo prazo do sistema anterior

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET não configurado no ambiente');
  }
  return new TextEncoder().encode(secret);
}

export interface SessionTokenPayload {
  sub: string;   // userId
  tv: number;    // token_version do usuário no momento da emissão
}

export async function signSessionToken(payload: SessionTokenPayload): Promise<string> {
  return new SignJWT({ tv: payload.tv })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecretKey());
}

/**
 * Verifica assinatura + expiração do JWT. Não decide sozinho se a sessão é
 * válida — isso depende também do token_version atual no banco (revogação),
 * checado por quem chama esta função.
 */
export async function verifySessionToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== 'string' || typeof payload.tv !== 'number') return null;
    return { sub: payload.sub, tv: payload.tv };
  } catch (err) {
    if (err instanceof errors.JWTExpired) return null;
    return null;
  }
}

// Um JWT sempre tem exatamente 2 pontos (header.payload.signature). Tokens
// antigos são 64 caracteres hex (crypto.randomBytes(32).toString('hex')) e
// nunca têm ponto — dá pra distinguir os dois formatos sem tentar decodificar.
export function looksLikeJwt(token: string): boolean {
  return token.split('.').length === 3;
}
