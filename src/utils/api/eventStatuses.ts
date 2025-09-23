import { EventStatus } from "../../types";

const API_URL = import.meta.env.VITE_API_URL;

// NOTE: zachowujemy eksport starej nazwy dla kompatybilności (alias niżej)
const getAllEventStatuses = async (token: string): Promise<EventStatus[]> => {
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

const getEventStatus = async (id: number, token: string): Promise<EventStatus> => {
    const res = await fetch(`${API_URL}/api/event-statuses/${id}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
    });
    if (!res.ok) {
        throw new Error('Failed to fetch event status');
    }
    return await res.json();
}

// Legacy alias (stara literówka) – można usunąć po refaktorze wszystkich importów
const getAllEventStasuses = getAllEventStatuses;
export { getAllEventStatuses, getAllEventStasuses, getEventStatus };