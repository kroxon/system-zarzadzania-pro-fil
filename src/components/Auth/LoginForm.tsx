import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../../utils/api/auth';
import { fetchUserById } from '../../utils/api/user';
import { User as UserIcon } from 'lucide-react';
import RegisterForm from './RegisterForm';
import ResetPasswordForm from './ResetPasswordForm';


interface LoginFormProps {
  onLogin?: (user: any, token?: string) => Promise<void>;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  // ...existing code...
  // Flip tylko login <-> register, reset fade
  const [isRegistering, setIsRegistering] = useState(false);
  const [resetFlip, setResetFlip] = useState<'none' | 'in' | 'out'>('none');

  const handleFlip = (panel: 'login' | 'register' | 'reset') => {
    if (panel === 'register') {
      setIsRegistering(true);
      setResetFlip('none');
    } else if (panel === 'login') {
      setIsRegistering(false);
      if (resetFlip === 'in') {
        setResetFlip('out');
        setTimeout(() => setResetFlip('none'), 500);
      }
    } else if (panel === 'reset') {
      setResetFlip('in');
      setIsRegistering(false);
    }
  };

  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Obsługa logowania z backendem
  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await loginUser({
        email: loginData.username,
        password: loginData.password
      });
      localStorage.setItem('token', response.token);

      // Pobierz dane użytkownika po employeeId
      if (response.employeeId && onLogin) {
        try {
          const userData = await fetchUserById(response.employeeId, response.token);
          onLogin(userData, response.token);
        } catch (err) {
          alert('Nie udało się pobrać danych użytkownika');
        }
      }
  setLoginSuccess(true);
  navigate('/dashboard');
    } catch (error) {
      alert('Nieprawidłowy login lub hasło');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent">
      <div className="w-full max-w-xl flex flex-col justify-center items-center" style={{ minHeight: '540px' }}>
            <div
              className="bg-white shadow-md p-8 w-full max-w-sm mx-auto flex flex-col justify-center"
              style={{ width: '480px', height: '540px', overflow: 'visible', perspective: '1200px' }}
            >
          {/* FlipX panel: reset */}
          <div
            className="absolute w-full h-full top-0 left-0"
            style={{
              zIndex: resetFlip !== 'none' ? 10 : 0,
              pointerEvents: resetFlip === 'in' ? 'auto' : 'none',
              transition: 'transform 0.5s cubic-bezier(.4,2,.3,1), opacity 0.4s cubic-bezier(.4,2,.3,1)',
              background: 'white',
              opacity: resetFlip === 'in' ? 1 : 0,
              transform:
                resetFlip === 'in' ? 'rotateX(0deg)' :
                resetFlip === 'out' ? 'rotateX(90deg)' :
                'rotateX(90deg)',
            }}
          >
            <div className="flex flex-col justify-center h-full">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserIcon className="h-8 w-8 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Resetowanie hasła</h2>
                <p className="text-gray-600 mt-2">Podaj swój email, aby zresetować hasło</p>
              </div>
              <ResetPasswordForm onResetSuccess={() => handleFlip('login')} onBackToLogin={() => handleFlip('login')} />
            </div>
          </div>
          {/* FlipY panel: login/register */}
          <div
            className="relative w-full h-full"
            style={{
              minHeight: '400px',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.5s cubic-bezier(.4,2,.3,1)',
              transform: isRegistering ? 'rotateY(180deg)' : 'none',
              opacity: resetFlip === 'in' ? 0 : 1,
            }}
          >
            {/* Front: logowanie */}
            <div className="absolute w-full h-full" style={{ backfaceVisibility: 'hidden' }}>
              <div className="bg-white rounded-2xl flex flex-col justify-center h-full">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserIcon className="h-8 w-8 text-indigo-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Logowanie</h2>
                  <p className="text-gray-600 mt-2">Zaloguj się lub zarejestruj nowe konto</p>
                </div>
                <form className="space-y-4" onSubmit={handleFormLogin}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Login</label>
                    <input
                      type="text"
                      value={loginData.username}
                      onChange={e => setLoginData({ ...loginData, username: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hasło</label>
                    <input
                      type="password"
                      value={loginData.password}
                      onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                    <div className="mt-2 text-left">
                      <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => handleFlip('reset')}>
                        Zapomniałeś hasła?
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  >
                    Zaloguj się
                  </button>
                  <button
                    type="button"
                    className="w-full bg-gray-100 text-indigo-700 py-3 px-4 rounded-lg hover:bg-indigo-200 transition-colors font-medium mt-2"
                    onClick={() => handleFlip('register')}
                  >
                    Zarejestruj się
                  </button>
                </form>
              </div>
            </div>
            {/* Back: rejestracja */}
            <div className="absolute w-full h-full" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <div className="flex flex-col justify-center h-full">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserIcon className="h-8 w-8 text-indigo-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Rejestracja</h2>
                  <p className="text-gray-600 mt-2">Załóż nowe konto</p>
                </div>
                <RegisterForm onRegisterSuccess={() => { setIsRegistering(false); }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;