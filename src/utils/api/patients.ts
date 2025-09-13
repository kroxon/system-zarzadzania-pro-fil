
import { Patient, CreatePatient, UpdatePatient } from '../../types';
const API_URL = import.meta.env.VITE_API_URL;

// GET /api/patients
export async function fetchPatients(token: string): Promise<Patient[]> {
	const res = await fetch(`${API_URL}/api/patients`, {
		headers: {
			'Authorization': `Bearer ${token}`,
			'Accept': 'application/json'
		}
	});
	if (!res.ok) throw new Error('Failed to fetch patients');
	return await res.json();
}

// GET /api/patients/{id}
export async function fetchPatient(id: number, token: string): Promise<Patient> {
	const res = await fetch(`${API_URL}/api/patients/${id}`, {
		headers: {
			'Authorization': `Bearer ${token}`,
			'Accept': 'application/json'
		}
	});
	if (!res.ok) throw new Error('Failed to fetch patient');
	return await res.json();
}

// POST /api/patients
export async function createPatient(data: CreatePatient, token: string): Promise<Patient> {
	const res = await fetch(`${API_URL}/api/patients`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		},
		body: JSON.stringify(data)
	});
	if (!res.ok) throw new Error('Failed to create patient');
	return await res.json();
}

// PUT /api/patients/{id}
export async function updatePatient(id: number, data: UpdatePatient, token: string): Promise<Patient> {
	const res = await fetch(`${API_URL}/api/patients/${id}`, {
		method: 'PUT',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		},
		body: JSON.stringify(data)
	});
	if (!res.ok) throw new Error('Failed to update patient');
	return await res.json();
}

// DELETE /api/patients/{id}
export async function deletePatient(id: number, token: string): Promise<void> {
	const res = await fetch(`${API_URL}/api/patients/${id}`, {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Accept': 'application/json'
		}
	});
	if (!res.ok) throw new Error('Failed to delete patient');
}

