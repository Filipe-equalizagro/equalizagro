// lib/api-utils.ts
import { NextRequest, NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function apiResponse<T>(
  data: T,
  statusCode: number = 200
): NextResponse<T> {
  return NextResponse.json(data, { status: statusCode });
}

export function apiError(error: any): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  console.error('Unexpected error:', error);

  return NextResponse.json(
    {
      success: false,
      message: 'Erro interno do servidor',
    },
    { status: 500 }
  );
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): boolean {
  // Mínimo 8 caracteres
  if (password.length < 8) return false;
  // Maiúscula
  if (!/[A-Z]/.test(password)) return false;
  // Minúscula
  if (!/[a-z]/.test(password)) return false;
  // Número
  if (!/[0-9]/.test(password)) return false;
  // Caractere especial
  if (!/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(password)) return false;

  return true;
}

export function getClientIp(request: NextRequest): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip') ||
    '0.0.0.0';
  return ip;
}

export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'Unknown';
}
