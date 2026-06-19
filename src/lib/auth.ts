// API Base Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Fazer requisição à API (helper simplificado)
 */
async function apiRequest<T>(
  endpoint: string,
  method: string,
  body?: any,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'Erro ao processar a requisição',
    }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Gerar device fingerprint (função interna para evitar problemas de hoisting)
 */
function getDeviceFingerprintInternal(): string {
  if (typeof window === 'undefined') return 'server';
  
  let fingerprint = localStorage.getItem('deviceFingerprint');
  if (!fingerprint) {
    // Gerar fingerprint baseado em características do navegador
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 'unknown',
      (navigator as any).deviceMemory || 'unknown',
    ];
    
    const str = components.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    fingerprint = Math.abs(hash).toString(36);
    localStorage.setItem('deviceFingerprint', fingerprint);
  }
  return fingerprint;
}

export interface LoginCredentials {
  email: string;
  password: string;
  deviceFingerprint?: string;
}

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  // Campos opcionais para cadastro da equipe
  cargo?: string;
  regiao?: string;
  interesse?: string;
  comoConheceu?: string;
  role?: 'client' | 'team';
}

export interface AuthResponse {
  success: boolean;
  message: string;
  userId?: string;
  requiresTwoFactor?: boolean;
  twoFactorId?: string;
  twoFactorMethod?: 'totp' | 'code';
  requiresEmailVerification?: boolean;
  verificationToken?: string;
  devCode?: string;
}

export interface TwoFactorVerifyRequest {
  twoFactorId: string;
  code: string;
  deviceFingerprint?: string;
}

export interface TwoFactorVerifyResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

/**
 * Fazer login com email e senha
 * Retorna um ID de 2FA se a autenticação inicial for bem-sucedida
 */
export async function loginWithCredentials(
  credentials: LoginCredentials
): Promise<AuthResponse> {
  try {
    // Adicionar deviceFingerprint automaticamente se não fornecido
    const credentialsWithFingerprint = {
      ...credentials,
      deviceFingerprint: credentials.deviceFingerprint || (typeof window !== 'undefined' ? getDeviceFingerprintInternal() : 'server'),
    };
    
    const data = await apiRequest<any>('/auth/login', 'POST', credentialsWithFingerprint);

    // Se login completo (sem 2FA), salvar token e dados do usuário
    if (data?.token) {
      localStorage.setItem('authToken', data.token);
    }
    if (data?.user?.id) {
      localStorage.setItem('userId', data.user.id);
      console.log('[Auth] userId salvo:', data.user.id);
    } else if (data?.userId) {
      localStorage.setItem('userId', data.userId);
      console.log('[Auth] userId salvo:', data.userId);
    }
    // Cache do nome para o Header exibir instantaneamente sem chamar verifySession
    const fullName: string = data?.user?.name || data?.user?.fullName || '';
    if (fullName) {
      const initial = fullName.trim().charAt(0).toUpperCase();
      localStorage.setItem('userInitial', initial);
      localStorage.setItem('userName', fullName);
      console.log('[Auth] Cache de nome salvo:', fullName);
    }

    return {
      success: true,
      message: data.message || 'Login bem-sucedido',
      userId: data.userId || data?.user?.id,
      requiresTwoFactor: data.requiresTwoFactor || false,
      twoFactorId: data.twoFactorId,
      twoFactorMethod: data.twoFactorMethod,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao fazer login',
    };
  }
}

/**
 * Registrar novo usuário
 * Retorna um ID de 2FA para verificação
 */
export async function registerUser(data: RegisterData): Promise<AuthResponse> {
  try {
    // Cadastro de equipe requer token do admin autenticado no header
    const extraHeaders: Record<string, string> = {};
    if (data.role === 'team') {
      const token = getAuthToken();
      if (token) extraHeaders['Authorization'] = `Bearer ${token}`;
    }
    const responseData = await apiRequest<any>('/auth/register', 'POST', data, extraHeaders);

    return {
      success: true,
      message: responseData.message || 'Usuário registrado com sucesso',
      userId: responseData.userId,
      requiresEmailVerification: responseData.requiresEmailVerification ?? true,
      verificationToken: responseData.verificationToken,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao registrar',
    };
  }
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  twoFactorSetup?: {
    secret: string;
    qrCode: string;
    manualEntry: string;
  };
}

export async function verifyEmailToken(token: string): Promise<VerifyEmailResponse> {
  try {
    const data = await apiRequest<any>('/auth/verify-email', 'POST', { token });

    return {
      success: true,
      message: data.message || 'Email verificado com sucesso',
      twoFactorSetup: data.twoFactorSetup,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao verificar email',
    };
  }
}

/**
 * Enviar código 2FA via email ou SMS
 */
export async function sendTwoFactorCode(twoFactorId: string): Promise<AuthResponse> {
  try {
    const data = await apiRequest<any>('/auth/2fa/send', 'POST', { twoFactorId });

    return {
      success: true,
      message: data.message || 'Código enviado com sucesso',
      devCode: data.devCode,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao enviar código',
    };
  }
}

/**
 * Verificar código 2FA e completar autenticação
 */
export async function verifyTwoFactorCode(
  request: TwoFactorVerifyRequest
): Promise<TwoFactorVerifyResponse> {
  try {
    // Adicionar deviceFingerprint automaticamente se não fornecido
    const requestWithFingerprint = {
      ...request,
      deviceFingerprint: request.deviceFingerprint || getDeviceFingerprintInternal(),
    };
    
    const data = await apiRequest<any>('/auth/2fa/verify', 'POST', requestWithFingerprint);

    // Armazenar token no localStorage
    if (data.token) {
      localStorage.setItem('authToken', data.token);
    }
    
    // Armazenar userId no localStorage
    if (data.user?.id) {
      localStorage.setItem('userId', data.user.id);
      console.log('[Auth] userId salvo:', data.user.id);
    }

    return {
      success: true,
      message: data.message || 'Autenticação bem-sucedida',
      token: data.token,
      user: data.user,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao verificar código',
    };
  }
}

/**
 * Fazer logout e remover token
 */
export function logout(): void {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('deviceFingerprint');
  // Limpar cache de sessão do Header
  localStorage.removeItem('userInitial');
  localStorage.removeItem('userName');
}

/**
 * Obter token do localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

/**
 * Obter userId do localStorage
 */
export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userId');
}

/**
 * Verificar se usuário está autenticado
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * Gerar device fingerprint baseado em características do navegador
 */
export function generateDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server';
  
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    (navigator as any).deviceMemory || 'unknown',
  ];
  
  // Hash simples das características
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Obter ou gerar device fingerprint
 */
export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server';
  
  let fingerprint = localStorage.getItem('deviceFingerprint');
  if (!fingerprint) {
    fingerprint = generateDeviceFingerprint();
    localStorage.setItem('deviceFingerprint', fingerprint);
  }
  return fingerprint;
}

export interface SessionVerifyResult {
  valid: boolean;
  reason?: 'no_token' | 'invalid_token' | '2fa_expired' | 'device_changed' | 'error';
  message?: string;
  userId?: string;
  email?: string;
  fullName?: string;
  /** Role do usuário no banco: 'client' | 'team' | 'admin' */
  role?: string;
  /** Verdadeiro apenas se role === 'admin' */
  isAdmin?: boolean;
}

/**
 * Verificar se a sessão é válida para acessar o ConsultorIA
 * Verifica: token válido, 2FA nos últimos 7 dias, mesmo dispositivo
 */
export async function verifySession(): Promise<SessionVerifyResult> {
  const token = getAuthToken();
  
  if (!token) {
    return {
      valid: false,
      reason: 'no_token',
      message: 'Você precisa fazer login para acessar a plataforma.',
    };
  }
  
  try {
    const deviceFingerprint = getDeviceFingerprint();
    
    const response = await fetch('/api/auth/verify-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ deviceFingerprint }),
    });
    
    const result = await response.json();
    
    if (result.valid) {
      // Atualizar userId no localStorage se veio da resposta
      if (result.userId) {
        localStorage.setItem('userId', result.userId);
      }
      return {
        valid: true,
        userId: result.userId,
        email: result.email,
        fullName: result.fullName,
        role: result.role,
        isAdmin: result.isAdmin === true,
      };
    }
    
    // Sessão inválida - retornar o motivo
    return {
      valid: false,
      reason: result.reason,
      message: result.message,
      userId: result.userId,
    };
  } catch (error) {
    console.error('[Auth] Erro ao verificar sessão:', error);
    return {
      valid: false,
      reason: 'error',
      message: 'Erro ao verificar sessão. Tente fazer login novamente.',
    };
  }
}
