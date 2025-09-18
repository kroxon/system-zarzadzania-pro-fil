import {  Event, CreateEvent, PatchEventPersons} from '../../types/index';

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

export async function createEvent(data: CreateEvent, token: string): Promise<Event> {
  const response = await fetch(`${API_URL}/api/events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Nie udało się utworzyć wydarzenia');
  }

  return await response.json();
}

// GET /api/events/{id}
export async function fetchEvent(id: number, token: string): Promise<Event> {
  const response = await fetch(`${API_URL}/api/events/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Nie udało się pobrać wydarzenia');
  }

  return await response.json();
}

// DELETE /api/events/{id}
export async function deleteEvent(id: number, token: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/events/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Nie udało się usunąć wydarzenia');
  }
}


// PUT /api/events/{id}

import { UpdateEvent } from '../../types/index';

export async function updateEvent(id: number, data: UpdateEvent, token: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/events/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Nie udało się zaktualizować wydarzenia');
  }
}


// PATCH /api/events/{eventId}/persons

export async function patchEventPersons(eventId: number, data: PatchEventPersons, token: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/events/${eventId}/persons`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Nie udało się zaktualizować uczestników wydarzenia');
  }
}




