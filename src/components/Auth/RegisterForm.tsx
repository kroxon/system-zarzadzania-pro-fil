import React, { useState } from 'react';

interface RegisterFormProps {
  onRegisterSuccess: () => void;
}

const roles = [
  { value: 'admin', label: 'Administrator' },
  { value: 'employee', label: 'Pracownik' },
  { value: 'contact', label: 'Pierwszy kontakt' },
];

const RegisterForm: React.FC<RegisterFormProps> = ({ onRegisterSuccess }) => {
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Błąd rejestracji');
    } catch {
      setError('Rejestracja nie powiodła się');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-4 mb-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Imię</label>
          <input
            type="text"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nazwisko</label>
          <input
            type="text"
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Rola</label>
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            required
          >
            <option value="">Wybierz rolę...</option>
            {roles.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Hasło</label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          required
        />
      </div>
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      <div className="flex gap-2 mt-2">
        <button
          type="submit"
          className="flex-1 bg-indigo-600 text-white py-2 px-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          disabled={loading}
        >
          {loading ? 'Rejestruję...' : 'Zarejestruj się'}
        </button>
        <button
          type="button"
          className="flex-1 bg-gray-100 text-indigo-700 py-2 px-2 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium"
          onClick={onRegisterSuccess}
        >
          Powrót do logowania
        </button>
      </div>
    </form>
  );
};

export default RegisterForm;
