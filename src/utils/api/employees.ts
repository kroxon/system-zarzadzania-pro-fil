import { Employee } from '../../types';

const API_URL = import.meta.env.VITE_API_URL;

export const fetchEmployees = async (token: string): Promise<Employee[]> => {
  const response = await fetch(`${API_URL}/api/employees`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Nie udało się pobrać listy pracowników');
  }
  return await response.json();
};
