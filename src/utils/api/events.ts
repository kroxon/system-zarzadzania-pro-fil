import { Event } from '../../types/index';

const API_URL = import.meta.env.VITE_API_URL

// GET /api/events
export async function fetchEvents(token: string): Promise<Event[]> {
  const response = await fetch(`${API_URL}/api/events`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Nie udało się pobrać wydarzeń');
  }

  return await response.json();
}


// POST /api/events


// GET /api/events/{id}


// DELETE /api/events/{id}


// PUT /api/events/{id}


// PATCH /api/events/{eventId}/persons

