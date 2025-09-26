import React, { useState } from 'react';
import { forgotPassword, resetPassword } from '../../utils/api/auth';

export interface ResetPasswordFormProps {
  onResetSuccess: () => void;
  onBackToLogin?: () => void;
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ onResetSuccess, onBackToLogin }) => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // info state removed - global notify used instead
  const [loading, setLoading] = useState(false);

  // Obsługa backendu
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await forgotPassword({ email });
  setStep(2);
    } catch (err: any) {
      // let backend-driven notification (translated) be shown; avoid local duplicate messages
      console.error('forgotPassword failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await resetPassword({ email, token, newPassword });
      // success notification shown by backend (translated) via auth API
      onResetSuccess();
    } catch (err: any) {
      // backend-driven notification will be shown (translated). Keep a console log for debugging.
      console.error('resetPassword failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setToken(text.trim());
        setInfo('Kod wklejony ze schowka');
        setTimeout(() => setInfo(null), 2500);
      } else {
        setInfo('Schowek jest pusty');
        setTimeout(() => setInfo(null), 2500);
      }
    } catch (e) {
      setInfo('Brak dostepu do schowka');
      setTimeout(() => setInfo(null), 2500);
    }
  };

  return (
    <div className="w-full flex flex-col justify-center items-center">
  <div className="w-full max-w-sm bg-white p-4 flex flex-col justify-center items-center">
        {step === 1 && (
          <form className="space-y-4 w-full" onSubmit={handleForgot}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
            {info && <div className="text-green-600 text-sm mb-2">{info}</div>}
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              disabled={loading}
            >
              {loading ? 'Wysyłam...' : 'Wyślij link resetujący'}
            </button>
            {onBackToLogin && (
              <button
                type="button"
                className="w-full bg-gray-100 text-indigo-700 py-3 px-4 rounded-lg font-medium hover:bg-indigo-200 transition-colors mt-2"
                onClick={onBackToLogin}
              >
                Powrót do logowania
              </button>
            )}
          </form>
        )}
        {step === 2 && (
          <form className="space-y-4 w-full" onSubmit={handleReset}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kod z maila</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
                        <button type="button" onClick={handlePasteFromClipboard} className="px-3 py-2 bg-gray-100 rounded-md text-sm hover:bg-gray-200">
                          Wklej ze schowka
                        </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nowe hasło</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
            {info && <div className="text-green-600 text-sm mb-2">{info}</div>}
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              disabled={loading}
            >
              {loading ? 'Resetuję...' : 'Zmień hasło'}
            </button>
            {onBackToLogin && (
              <button
                type="button"
                className="w-full bg-gray-100 text-indigo-700 py-3 px-4 rounded-lg font-medium hover:bg-indigo-200 transition-colors mt-2"
                onClick={onBackToLogin}
              >
                Powrót do logowania
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordForm;
