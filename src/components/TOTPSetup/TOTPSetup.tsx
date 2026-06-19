import React, { useState, useEffect } from 'react';
import { Copy, Check, Eye, EyeOff, AlertCircle } from 'lucide-react';
import './TOTPSetup.css';

interface TOTPSetupProps {
  email: string;
  onSuccess: (backupCodes: string[]) => void;
  onCancel: () => void;
}

export const TOTPSetup: React.FC<TOTPSetupProps> = ({
  email,
  onSuccess,
  onCancel,
}) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step, setStep] = useState<'qr' | 'verify' | 'backup'>('qr');
  const [totp, setTotp] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateTOTP();
  }, []);

  const generateTOTP = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/auth/2fa/generate-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate TOTP');
      }

      const data = await response.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate TOTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyTOTP = async () => {
    if (totp.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/auth/2fa/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, token: totp }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Invalid code');
      }

      setStep('backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
      setTotp('');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackupCodesConfirmed = () => {
    onSuccess(backupCodes);
  };

  return (
    <div className="totp-setup">
      <div className="totp-setup__container">
        {step === 'qr' && (
          <div className="totp-setup__step">
            <h2>Configure o Google Authenticator</h2>
            <p className="totp-setup__description">
              Escaneie o código QR abaixo com seu aplicativo autenticador
            </p>

            {loading && qrCode === null ? (
              <div className="totp-setup__loading">Gerando código QR...</div>
            ) : (
              <>
                {qrCode && (
                  <div className="totp-setup__qr">
                    <img src={qrCode} alt="QR Code" />
                  </div>
                )}

                <div className="totp-setup__divider">
                  <span>ou</span>
                </div>

                {secret && (
                  <div className="totp-setup__manual">
                    <p className="totp-setup__manual-label">
                      Chave de entrada manual:
                    </p>
                    <div className="totp-setup__secret-box">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        value={secret}
                        readOnly
                        className="totp-setup__secret-input"
                      />
                      <button
                        onClick={() => setShowSecret(!showSecret)}
                        className="totp-setup__icon-button"
                        title={showSecret ? 'Ocultar' : 'Mostrar'}
                      >
                        {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(secret)}
                        className="totp-setup__icon-button"
                        title="Copiar"
                      >
                        {copied ? (
                          <Check size={18} className="totp-setup__icon-check" />
                        ) : (
                          <Copy size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setStep('verify')}
                  className="totp-setup__button totp-setup__button--primary"
                  disabled={loading}
                >
                  Continuar
                </button>
              </>
            )}
          </div>
        )}

        {step === 'verify' && (
          <div className="totp-setup__step">
            <h2>Verifique seu código</h2>
            <p className="totp-setup__description">
              Digite o código de 6 dígitos do seu aplicativo autenticador
            </p>

            <div className="totp-setup__code-input">
              <input
                type="text"
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="totp-setup__input"
                autoFocus
              />
            </div>

            {error && (
              <div className="totp-setup__error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={verifyTOTP}
              className="totp-setup__button totp-setup__button--primary"
              disabled={loading || totp.length !== 6}
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>

            <button
              onClick={() => {
                setStep('qr');
                setTotp('');
                setError('');
              }}
              className="totp-setup__button totp-setup__button--secondary"
              disabled={loading}
            >
              Voltar
            </button>
          </div>
        )}

        {step === 'backup' && (
          <div className="totp-setup__step">
            <h2>Codigos de Backup</h2>
            <p className="totp-setup__description">
              Guarde estes códigos em um local seguro. Você pode usá-los se perder acesso ao seu autenticador.
            </p>

            <div className="totp-setup__backup-codes">
              {backupCodes.map((code, index) => (
                <div key={index} className="totp-setup__backup-code">
                  <span className="totp-setup__backup-code-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="totp-setup__backup-code-text">{code}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => copyToClipboard(backupCodes.join('\n'))}
              className="totp-setup__button totp-setup__button--secondary"
            >
              <Copy size={16} />
              Copiar todos os códigos
            </button>

            <button
              onClick={handleBackupCodesConfirmed}
              className="totp-setup__button totp-setup__button--primary"
            >
              Confirmar e Continuar
            </button>
          </div>
        )}

        {step !== 'backup' && (
          <button
            onClick={onCancel}
            className="totp-setup__button totp-setup__button--cancel"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
};
