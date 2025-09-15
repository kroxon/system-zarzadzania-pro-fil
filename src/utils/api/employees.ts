import { Employee, UpdateEmployee, WorkHours } from '../../types';
const API_URL = import.meta.env.VITE_API_URL;


// GET /api/employees/{id}
export async function fetchEmployee(id: number, token: string): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!response.ok) throw new Error('Failed to fetch employee');
  return await response.json();
}

// PUT /api/employees/{id}
export async function updateEmployee(id: number, data: UpdateEmployee, token: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update employee');
}

// DELETE /api/employees/{id}
export async function deleteEmployee(id: number, token: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!response.ok) throw new Error('Failed to delete employee');
}

// GET /api/employees/{id}/work-hours
export async function fetchEmployeeWorkHours(id: number, token: string): Promise<WorkHours[]> {
  const response = await fetch(`${API_URL}/api/employees/${id}/work-hours`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!response.ok) throw new Error('Failed to fetch employee work hours');
  return await response.json();
}

// GET /api/employees/{id}/report
export async function fetchEmployeeReport(id: number, month: number, year: number, token: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/employees/${id}/report?month=${month}&year=${year}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/pdf'
    }
  });
  if (!response.ok) throw new Error('Failed to fetch employee report');
  return await response.blob();
}

// GET /api/employees

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
