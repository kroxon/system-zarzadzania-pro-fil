import { RoomAPI, CreateRoom, UpdateRoom } from '../../types';

const API_URL = import.meta.env.VITE_API_URL;

export async function getRooms(): Promise<RoomAPI[]> {
	const res = await fetch(`${API_URL}/api/rooms`);
	if (!res.ok) throw new Error('Failed to fetch rooms');
	return await res.json();
}

export async function getRoom(id: number): Promise<RoomAPI> {
		const res = await fetch(`${API_URL}/api/rooms/${id}`);
	if (!res.ok) throw new Error('Failed to fetch room');
	return await res.json();
}

export async function createRoom(data: CreateRoom): Promise<RoomAPI> {
		const res = await fetch(`${API_URL}/api/rooms`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!res.ok) throw new Error('Failed to create room');
	return await res.json();
}

export async function updateRoom(id: number, data: UpdateRoom): Promise<void> {
		const res = await fetch(`${API_URL}/api/rooms/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!res.ok) throw new Error('Failed to update room');
}

export async function deleteRoom(id: number): Promise<void> {
		const res = await fetch(`${API_URL}/api/rooms/${id}`, {
		method: 'DELETE'
	});
	if (!res.ok) throw new Error('Failed to delete room');
}
