import React, { useState } from 'react';
import { User, Lock } from 'lucide-react';

interface LoginFormProps {
  onLogin: (user: { id: string; name: string; role: 'admin' | 'employee'; specialization?: string }) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [selectedUser, setSelectedUser] = useState('');

  const demoUsers = [
    {
      id: '1',
      name: 'Anna Kowalska',
      role: 'admin' as const,
      specialization: 'Terapeuta',
      description: 'Administrator systemu'
    },
    {
      id: '2',
      name: 'Piotr Nowak',
      role: 'employee' as const,
      specialization: 'Psycholog',
      description: 'Specjalista - widzi tylko swój grafik'
    },
    {
      id: '3',
      name: 'Maria Wiśniewska',
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
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
                      <User className="h-4 w-4 text-gray-600" />
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
    </div>
  );
};

export default LoginForm;