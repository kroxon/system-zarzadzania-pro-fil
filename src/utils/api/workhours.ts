import { WorkHours, CreateWorkHours, UpdateWorkHours } from '../../types';

const API_URL = import.meta.env.VITE_API_URL;

// GET /api/workhours
export async function fetchWorkHours(token: string): Promise<WorkHours[]> {
	const res = await fetch(`${API_URL}/api/workhours`, {
		headers: {
			'Authorization': `Bearer ${token}`,
			'Accept': 'application/json'
		}
	});
	if (!res.ok) throw new Error('Failed to fetch workhours');
	return await res.json();
}

// GET /api/workhours/{id}
export async function fetchWorkHour(id: number, token: string): Promise<WorkHours> {
	const res = await fetch(`${API_URL}/api/workhours/${id}`, {
		headers: {
			'Authorization': `Bearer ${token}`,
			'Accept': 'application/json'
		}
	});
	if (!res.ok) throw new Error('Failed to fetch workhour');
	return await res.json();
}

// POST /api/workhours
export async function createWorkHour(data: CreateWorkHours, token: string): Promise<WorkHours> {
	const res = await fetch(`${API_URL}/api/workhours`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		},
		body: JSON.stringify(data)
	});
	if (!res.ok) throw new Error('Failed to create workhour');
	return await res.json();
}

// PUT /api/workhours/{id}
export async function updateWorkHour(id: number, data: UpdateWorkHours, token: string): Promise<WorkHours> {
	const res = await fetch(`${API_URL}/api/workhours/${id}`, {
		method: 'PUT',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		},
		body: JSON.stringify(data)
	});
	if (!res.ok) throw new Error('Failed to update workhour');
	return await res.json();
}

// DELETE /api/workhours/{id}
export async function deleteWorkHour(id: number, token: string): Promise<void> {
	const res = await fetch(`${API_URL}/api/workhours/${id}`, {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Accept': 'application/json'
		}
	});
	if (!res.ok) throw new Error('Failed to delete workhour');
}
