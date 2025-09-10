// this file connects user data after login by it's id
import { User } from '../../types';

const API_URL = import.meta.env.VITE_API_URL;

export const fetchUserById = async (id: string | number, token: string): Promise<User> => {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Nie udało się pobrać danych użytkownika');
  }
  return await response.json();
};
