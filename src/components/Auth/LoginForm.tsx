import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../../utils/api/auth';
import { fetchUserById } from '../../utils/api/user';
import { User as UserIcon, HelpCircle, X } from 'lucide-react';
import RegisterForm from './RegisterForm';
import ResetPasswordForm from './ResetPasswordForm';
import { notify } from '../common/Notification';
import Portal from '../common/Portal';


interface LoginFormProps {
  onLogin?: (user: any, token?: string) => Promise<void>;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  // ...existing code...
  // Flip tylko login <-> register, reset fade
  const [isRegistering, setIsRegistering] = useState(false);
  const [resetFlip, setResetFlip] = useState<'none' | 'in' | 'out'>('none');
  const [showHelp, setShowHelp] = useState(false);

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
  // loginSuccess state removed (unused)

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
          notify.error('Nie udało się pobrać danych użytkownika');
        }
    }
    navigate('/dashboard');
    } catch (error) {
      // loginUser already shows a user-friendly notification for failed logins.
      // Avoid duplicating the toast here. Keep a console log for debugging.
      console.error('Login failed', error);
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
                    <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-2">Login</label>
                    <input
                      id="login-email"
                      name="email"
                      autoComplete="email"
                      type="email"
                      value={loginData.username}
                      onChange={e => setLoginData({ ...loginData, username: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-2">Hasło</label>
                    <input
                      id="login-password"
                      name="password"
                      autoComplete="current-password"
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
                  {/* Subtle inline helpers removed; dedicated floating help button added below */}
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

      {showHelp && (
        <Portal>
          <div className="fixed inset-0 z-[9999]">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowHelp(false)} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Poradnik: logowanie i rejestracja</h3>
                  <button
                    type="button"
                    onClick={() => setShowHelp(false)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-500"
                    aria-label="Zamknij"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-4 py-3 text-sm text-gray-700 space-y-3">
                  <div>
                    <div className="font-medium text-gray-900 mb-1">Logowanie</div>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Użyj adresu e‑mail i hasła przypisanego do Twojego konta.</li>
                      <li>Jeśli konto jest nowe, upewnij się, że zostało aktywowane przez administratora.</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 mb-1">Rejestracja</div>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Wybierz „Zarejestruj się” i wypełnij formularz.</li>
                      <li>Po rejestracji konto wymaga akceptacji przez administratora. Do czasu aktywacji logowanie będzie niedostępne.</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 mb-1">Reset hasła</div>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Kliknij „Zapomniałeś hasła?” i podaj adres e‑mail.</li>
                      <li>Jeśli wiadomość nie dociera, sprawdź foldery SPAM/Oferty/„Inne”.</li>
                      <li>Jeżeli nadal nie otrzymujesz wiadomości, skontaktuj się z administratorem.</li>
                    </ul>
                  </div>
                  {/* Removed: Additional FAQ hint link per request */}
                </div>
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => setShowHelp(false)}
                    className="w-full mt-2 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 text-sm"
                  >
                    Rozumiem
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {/* Floating help button in bottom-right corner */}
      <button
        type="button"
        onClick={() => setShowHelp(true)}
        aria-label="Pomoc z logowaniem"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-white border border-gray-200 text-indigo-600 hover:text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center justify-center"
        title="Pomoc"
      >
        <HelpCircle className="h-8 w-8" />
      </button>
    </div>
  );
}

export default LoginForm;