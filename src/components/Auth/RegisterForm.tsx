import React, { useState, useEffect } from 'react';
import { getAllOccupations } from '../../utils/api/occupations';
import { Occupation } from '../../types';
import { registerUser } from '../../utils/api/auth';


interface RegisterFormProps {
  onRegisterSuccess: () => void;
}


const RegisterForm: React.FC<RegisterFormProps> = ({ onRegisterSuccess }) => {
  const [form, setForm] = useState({
    name: '',
    surname: '',
    email: '',
    password: '',
    occupationId: 0,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [occupations, setOccupations] = useState<Occupation[]>([]);

  useEffect(() => {
  getAllOccupations()
    .then(setOccupations)
    .catch(() => setOccupations([]));
}, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]: name === 'occupationId' ? Number(value) : value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await registerUser(form);
      onRegisterSuccess();
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
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 h-12 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nazwisko</label>
            <input
              type="text"
              name="surname"
              value={form.surname}
              onChange={handleChange}
              className="w-full px-4 h-12 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
            className="w-full px-4 h-12 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Profesja</label>
          <select
            name="occupationId"
            value={form.occupationId}
            onChange={handleChange}
          className="w-full px-2 h-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            required
          >
            <option value="">Wybierz profesję...</option>
            {occupations.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
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
          className="w-full px-4 h-12 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
      </div>
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
    <div className="h-8" />
    <div className="flex gap-2">
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Zarejestruj się
          </button>
          <button
            type="button"
            className="w-full bg-gray-100 text-indigo-700 py-3 px-4 rounded-lg font-medium hover:bg-indigo-200 transition-colors"
            onClick={onRegisterSuccess}
          >
            Powrót do logowania
          </button>
      </div>
    </form>
  );
};

export default RegisterForm;
