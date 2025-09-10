import { PendingUser, ApproveUser, Role } from '../../types';

const API_URL = import.meta.env.VITE_API_URL;

// GET /api/admin/pending-users
export async function fetchPendingUsers(token: string): Promise<PendingUser[]> {
  const res = await fetch(`${API_URL}/api/admin/pending-users`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error('Failed to fetch pending users');
  return res.json();
}

// POST /api/admin/approve-user/{userId}
export async function approveUser(userId: string, role: Role, token: string): Promise<void> {
  const body: ApproveUser = { role };
  const res = await fetch(`${API_URL}/api/admin/approve-user/${userId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Failed to approve user');
}

// DELETE /api/admin/reject-user/{userId}
export async function rejectUser(userId: string, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/reject-user/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error('Failed to reject user');
}