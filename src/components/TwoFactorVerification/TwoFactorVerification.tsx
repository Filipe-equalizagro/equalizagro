'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, Clock, Smartphone } from 'lucide-react';
import { sendTwoFactorCode, verifyTwoFactorCode } from '@/lib/auth';
import './TwoFactorVerification.css';

interface TwoFactorVerificationProps {
  twoFactorId: string;
  email: string;
  onSuccess: (token: string, user: any) => void;
  onError: (message: string) => void;
  isLoading: boolean;
  isTOTP?: boolean; // true se usar Google Authenticator
}

export default function TwoFactorVerification({
  twoFactorId,
  email,
  onSuccess,
  onError,
  isLoading: externalIsLoading,
  isTOTP = false,
}: TwoFactorVerificationProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutos (só para código por email)
  const [canResend, setCanResend] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Iniciar timer e enviar código (só se não for TOTP)
  useEffect(() => {
    if (!isTOTP) {
      sendCodeInitial();
    }
  }, []);

  // Timer countdown (só para código por email)
  useEffect(() => {
    if (isTOTP) return; // Não usar timer para TOTP

    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, isTOTP]);

  const sendCodeInitial = async () => {
    setIsLoading(true);
    const response = await sendTwoFactorCode(twoFactorId);
    setIsLoading(false);

    if (!response.success) {
      onError(response.message);
      setError(response.message);
      return;
    }

    if (response.devCode) {
      setDevCode(response.devCode);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Apenas números
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto focus próximo campo
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    // Backspace - ir para campo anterior
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Enter - enviar código
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const fullCode = code.join('');

    if (fullCode.length !== 6) {
      setError('Por favor, insira os 6 dígitos do código');
      return;
    }

    setError('');
    setIsLoading(true);

    const response = await verifyTwoFactorCode({
      twoFactorId,
      code: fullCode,
    });

    setIsLoading(false);

    if (response.success) {
      setSuccess(true);
      console.log('[2FA] Login bem sucedido, token:', !!response.token, 'user:', response.user);
      // Sempre chamar onSuccess se o login foi bem sucedido
      // O token e user devem estar no localStorage mesmo se não vieram na resposta
      onSuccess(response.token || '', response.user || {});
    } else {
      setError(response.message);
      onError(response.message);
    }
  };

  const handleResend = async () => {
    setCanResend(false);
    setTimeLeft(300);
    setCode(['', '', '', '', '', '']);
    setError('');
    await sendCodeInitial();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="two-factor">
      <div className="two-factor__header">
        <h3 className="two-factor__title">Autenticação em Duas Etapas</h3>
        {isTOTP ? (
          <p className="two-factor__description">
            <Smartphone size={16} style={{ display: 'inline', marginRight: '6px' }} />
            Digite o código de 6 dígitos do seu <strong>Google Authenticator</strong>
          </p>
        ) : (
          <p className="two-factor__description">
            Enviamos um código de 6 dígitos para <strong>{email}</strong>
          </p>
        )}
      </div>

      {success ? (
        <div className="two-factor__success">
          <CheckCircle size={48} className="two-factor__success-icon" />
          <p className="two-factor__success-message">
            Autenticação realizada com sucesso!
          </p>
        </div>
      ) : (
        <>
          {devCode && !isTOTP && (
            <div className="two-factor__dev-code">
              <strong>Código de desenvolvimento:</strong> {devCode}
            </div>
          )}
          <div className="two-factor__input-group">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="two-factor__input"
                disabled={isLoading || externalIsLoading}
                aria-label={`Dígito ${index + 1} do código`}
              />
            ))}
          </div>

          {error && (
            <div className="two-factor__error">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading || externalIsLoading || code.join('').length !== 6}
            className="two-factor__button"
          >
            {isLoading || externalIsLoading ? 'Verificando...' : 'Verificar Código'}
          </button>

          {!isTOTP && (
            <div className="two-factor__footer">
              <div className="two-factor__timer">
                <Clock size={16} />
                <span>{formatTime(timeLeft)}</span>
              </div>

              <button
                onClick={handleResend}
                disabled={!canResend || isLoading || externalIsLoading}
                className="two-factor__resend"
              >
                {canResend ? 'Reenviar código' : 'Aguarde para reenviar'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
