import { RoomAPI, CreateRoom, UpdateRoom } from '../../types';
import { authFetch } from './http';

const API_URL = import.meta.env.VITE_API_URL;

// Helpers
async function buildError(res: Response, fallback: string) {
  let detail = '';
  try {
    const text = await res.text();
    detail = text ? `: ${text}` : '';
  } catch {}
  const status = ` (status ${res.status})`;
  return new Error(`${fallback}${status}${detail}`);
}

// GET /api/rooms – list all rooms
export async function getRooms(token: string): Promise<RoomAPI[]> {
	const res = await authFetch(`${API_URL}/api/rooms`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
	if (!res.ok) throw await buildError(res, 'Failed to fetch rooms');
	return await res.json();
}

// GET /api/rooms/{id} – get single room by id
export async function getRoom(id: number, token: string): Promise<RoomAPI> {
		const res = await authFetch(`${API_URL}/api/rooms/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
	if (!res.ok) throw await buildError(res, 'Failed to fetch room');
	return await res.json();
}

// POST /api/rooms – create new room
export async function createRoom(data: CreateRoom, token: string): Promise<RoomAPI> {
		const res = await authFetch(`${API_URL}/api/rooms`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!res.ok) throw await buildError(res, 'Failed to create room');
	return await res.json();
}

// PUT /api/rooms/{id} – update existing room
export async function updateRoom(id: number, data: UpdateRoom, token: string): Promise<void> {
		const res = await authFetch(`${API_URL}/api/rooms/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!res.ok) throw await buildError(res, 'Failed to update room');
}

// DELETE /api/rooms/{id} – remove room by id
export async function deleteRoom(id: number, token: string): Promise<void> {
		const res = await authFetch(`${API_URL}/api/rooms/${id}`, {
		method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
	});
	if (!res.ok) throw await buildError(res, 'Failed to delete room');
}
