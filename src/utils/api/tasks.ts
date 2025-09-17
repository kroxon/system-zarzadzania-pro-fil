import { EmployeeTask, CreateEmployeeTask, UpdateEmployeeTask } from '../../types';

const API_URL = import.meta.env.VITE_API_URL;


// GET /api/employeetasks
export async function fetchEmployeeTasks(token: string): Promise<EmployeeTask[]> {
  const res = await fetch(`${API_URL}/api/employeetasks`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return await res.json();
}


// GET /api/employeetasks/{id}
export async function fetchEmployeeTask(id: number, token: string): Promise<EmployeeTask> {
  const res = await fetch(`${API_URL}/api/employeetasks/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error('Failed to fetch task');
  return await res.json();
}


// POST /api/employeetasks
export async function createEmployeeTask(task: CreateEmployeeTask, token: string): Promise<EmployeeTask> {
  const res = await fetch(`${API_URL}/api/employeetasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return await res.json();
}


// PUT /api/employeetasks/{id}
export async function updateEmployeeTask(id: number, task: UpdateEmployeeTask, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/employeetasks/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to update task');
}


// DELETE /api/employeetasks/{id}
export async function deleteEmployeeTask(id: number, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/employeetasks/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error('Failed to delete task');
}
