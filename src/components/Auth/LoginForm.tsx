import React, { useState } from 'react';
import { User as UserIcon, Lock } from 'lucide-react';
import RegisterForm from './RegisterForm';
import { loginUser } from '../../utils/auth'
import { fetchUserById } from '../../utils/user';
import { User } from '../../types';

interface LoginFormProps {
  onLogin: (user: User) => void;
  onLoginSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginSuccess, setLoginSuccess] = useState(false);


  const demoUsers = [
    {
    id: '1',
    name: 'Anna',
    surname: 'Kowalska',
    role: 'admin' as const,
    specialization: 'Terapeuta',
    description: 'Administrator systemu'
    },
    {
    id: '2',
    name: 'Piotr',
    surname: 'Nowak',
    role: 'employee' as const,
    specialization: 'Psycholog',
    description: 'Specjalista - widzi tylko swój grafik'
    },
    {
    id: '3',
    name: 'Maria',
    surname: 'Wiśniewska',
    role: 'employee' as const,
    specialization: 'Fizjoterapeuta',
    description: 'Specjalista - widzi tylko swój grafik'
    }
  ];

  const handleLogin = () => {
    const user = demoUsers.find(u => u.id === selectedUser);
    if (user) {
      onLogin(user);
    }
  };

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try{
      const response = await loginUser({
        email: loginData.username,
        password: loginData.password
      });
      localStorage.setItem('token', response.token);

      // Pobierz dane użytkownika po employeeId
      if (response.employeeId && onLogin) {
        try {
          const userData = await fetchUserById(response.employeeId, response.token);
          onLogin(userData);
        } catch (err) {
          alert('Nie udało się pobrać danych użytkownika');
        }
      }

      if (onLoginSuccess) {
        onLoginSuccess();
        setLoginSuccess(true);
      }
    } catch (error) {
      alert('Nieprawidłowy login lub hasło' + error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
  <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl justify-center items-center">
        {/* Kafelek 1: Wybór użytkownika */}
  <div className="bg-white rounded-2xl shadow-xl w-full md:w-1/2 p-8 flex flex-col justify-center" style={{ width: '480px', height: '540px' }}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">System Grafików</h1>
            <p className="text-gray-600 mt-2">Wybierz użytkownika do logowania (MVP)</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wybierz profil użytkownika
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Wybierz użytkownika...</option>
                {demoUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.role === 'admin' ? 'Administrator' : 'Pracownik'}
                  </option>
                ))}
              </select>
            </div>

            {selectedUser && (
              <div className="bg-gray-50 rounded-lg p-4">
                {(() => {
                  const user = demoUsers.find(u => u.id === selectedUser);
                  return user ? (
                    <div className="text-sm">
                      <div className="flex items-center space-x-2 mb-2">
                        <UserIcon className="h-4 w-4 text-gray-600" />
                        <span className="font-medium">{user.name}</span>
                      </div>
                      <p className="text-gray-600">{user.specialization}</p>
                      <p className="text-gray-500 text-xs mt-1">{user.description}</p>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={!selectedUser}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Zaloguj się
            </button>

            <div className="text-center text-xs text-gray-500 mt-6">
              <p>To jest prototyp aplikacji (MVP)</p>
              <p>Wybierz różne profile, aby zobaczyć różne uprawnienia</p>
            </div>
          </div>
        </div>

        {/* Kafelek 2: flip logowanie/rejestracja */}
        <div className="bg-white rounded-2xl shadow-xl w-full md:w-1/2 p-8 flex flex-col justify-center" style={{ width: '480px', height: '540px' }}>
          <div className="relative w-full h-full" style={{ perspective: '1200px' }}>
            <div
              className={`transition-transform duration-500 ease-in-out w-full h-full`}
              style={{
                minHeight: '400px',
                position: 'relative',
                transformStyle: 'preserve-3d',
                transform: isRegistering ? 'rotateY(180deg)' : 'none'
              }}
            >
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
                        onClick={() => setIsRegistering(true)}
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
                  <RegisterForm onRegisterSuccess={() => setIsRegistering(false)} />
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