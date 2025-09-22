import React, { useState } from 'react';
import { forgotPassword, resetPassword } from '../../utils/api/auth';

interface ResetPasswordFormProps {
  onResetSuccess: () => void;
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ onResetSuccess }) => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await forgotPassword({ email });
      setInfo('Sprawdź skrzynkę mailową i wpisz kod z wiadomości poniżej.');
      setStep(2);
    } catch {
      setError('Nie udało się wysłać prośby o reset hasła');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    if (newPassword.length < 5) {
      setError('Hasło musi mieć co najmniej 5 znaków');
      setLoading(false);
      return;
    }
    try {
      await resetPassword({ email, token, newPassword });
      setInfo('Hasło zostało zmienione. Możesz się zalogować.');
      setTimeout(() => {
        onResetSuccess();
      }, 1500);
    } catch {
      setError('Nie udało się zresetować hasła');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-center items-center">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Resetowanie hasła</h2>
        <p className="text-gray-600 mt-2">Podaj swój email, aby zresetować hasło</p>
      </div>
      {step === 1 && (
        <form className="space-y-4 w-full max-w-sm" onSubmit={handleForgot}>
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
        </form>
      )}
      {step === 2 && (
        <form className="space-y-4 w-full max-w-sm" onSubmit={handleReset}>
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
            <input
              type="text"
              value={token}
              onChange={e => setToken(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
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
        </form>
      )}
    </div>
  );
};

export default ResetPasswordForm;
