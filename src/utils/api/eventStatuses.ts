import { EventStatus } from "../../types";

const API_URL = import.meta.env.VITE_API_URL;

const getAllEventStasuses = async (token: string): Promise<EventStatus[]> => {
    const res = await fetch(`${API_URL}/api/event-statuses`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
    });
    if (!res.ok) {
        throw new Error('Failed to fetch event statuses');
    }
    return await res.json();
}