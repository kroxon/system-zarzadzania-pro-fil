import React, { useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import RegisterForm from './RegisterForm';
import ResetPasswordForm from './ResetPasswordForm';


interface LoginFormProps {
  onLogin?: (user: any, token?: string) => Promise<void>;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [flipState, setFlipState] = useState<'login' | 'register' | 'reset'>('login');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginSuccess, setLoginSuccess] = useState(false);
  // ...pozostałe hooki i logika

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent">
      <div className="w-full max-w-xl flex flex-col justify-center items-center" style={{ minHeight: '540px' }}>
        <div className="bg-white rounded-2xl shadow-xl w-full p-8 flex flex-col justify-center" style={{ width: '480px', height: '540px' }}>
          <div className="relative w-full h-full" style={{ perspective: '1200px' }}>
            <div
              className={`transition-transform duration-500 ease-in-out w-full h-full`}
              style={{
                minHeight: '400px',
                position: 'relative',
                transformStyle: 'preserve-3d',
                transform:
                  flipState === 'register' ? 'rotateY(180deg)' :
                  flipState === 'reset' ? 'rotateY(90deg)' : 'none'
              }}>
              {/* Front: logowanie */}
              <div className="absolute w-full h-full" style={{ backfaceVisibility: 'hidden' }}>
                <div className="bg-white rounded-2xl p-8 flex flex-col justify-center h-full">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <UserIcon className="h-8 w-8 text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Logowanie</h2>
                    <p className="text-gray-600 mt-2">Zaloguj się lub zarejestruj nowe konto</p>
                  </div>
                  <form className="space-y-4" onSubmit={e => { e.preventDefault(); /* handleFormLogin */ }}>
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
                        <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => setFlipState('reset')}>
                          Zapomniałeś hasła?
                        </button>
                      </div>
                    </div>
                    {loginSuccess && (
                      <div className='mb-4 text-green-600 fonr-semibold text-center'>
                        Zalogowano pomyślnie
                      </div>
                    )}
                    <button
                      type="submit"
                      className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                      Zaloguj się
                    </button>
                    <button
                      type="button"
                      className="w-full bg-gray-100 text-indigo-700 py-3 px-4 rounded-lg hover:bg-indigo-200 transition-colors font-medium mt-2"
                      onClick={() => setFlipState('register')}
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
                  <RegisterForm onRegisterSuccess={() => setFlipState('login')} />
                </div>
              </div>
              {/* Bok: reset hasła */}
              <div className="absolute w-full h-full" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(90deg)' }}>
                <div className="flex flex-col justify-center h-full">
                  <ResetPasswordForm onResetSuccess={() => setFlipState('login')} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;

