import React, { useEffect, useState } from 'react';
import { fetchPendingUsers, approveUser, rejectUser } from '../../utils/api/admin';
import { PendingUser, Role } from '../../types';

type SettingsProps = {
	currentUser?: { role: string };
	token?: string;
	// Callback do globalnego odświeżenia pracowników (App -> refreshBackendUsersGlobal)
	onUsersRefresh?: () => Promise<void> | void;
};

const Settings: React.FC<SettingsProps> = ({ currentUser, token, onUsersRefresh }) => {
	// Pending users state
	const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
	const [loadingPending, setLoadingPending] = useState(false);
	const [errorPending, setErrorPending] = useState<string | null>(null);
	const [roleSelect, setRoleSelect] = useState<Record<string, Role>>({});
	const isAdmin = currentUser?.role === 'admin';

	// Fetch pending users only for admin
	useEffect(() => {
		if (!isAdmin || !token) return;
		setLoadingPending(true);
		fetchPendingUsers(token)
			.then(setPendingUsers)
			.catch(e => setErrorPending(e.message))
			.finally(() => setLoadingPending(false));
	}, [isAdmin, token]);

	// Approve user
	const handleApprove = async (userId: string) => {
		const role = roleSelect[userId] || 'Employee';
		if (!token) return;
		try {
			await approveUser(userId, role, token);
			// Usuń z listy oczekujących
			setPendingUsers(prev => prev.filter(u => u.id !== userId));
			// Spróbuj odświeżyć globalną listę pracowników aby nowy był natychmiast widoczny
			if (onUsersRefresh) {
				try { await onUsersRefresh(); } catch { /* ciche pominięcie */ }
			}
		} catch (e: any) {
			alert('Error approving user: ' + e.message);
		}
	};

	// Reject user
	const handleReject = async (userId: string) => {
		if (!token) return;
		try {
			await rejectUser(userId, token);
			setPendingUsers(prev => prev.filter(u => u.id !== userId));
		} catch (e: any) {
			alert('Error rejecting user: ' + e.message);
		}
	};

	// Render pending users section (only for admin)
	const renderPendingUsers = () => (
		<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
			<h3 className="text-lg font-semibold text-gray-900 mb-4">Zarządzanie oczekującymi użytkownikami</h3>
			{loadingPending && <div>Ładowanie...</div>}
			{errorPending && <div className="text-red-500">{errorPending}</div>}
			<ul>
				{pendingUsers.map(user => (
					<li key={user.id} className="mb-4 flex items-center justify-between">
						<div>
							<span className="font-medium">{user.name} {user.surname}</span> <span className="text-gray-500">({user.email})</span>
						</div>
						<div className="flex items-center gap-2">
							<select
								value={roleSelect[user.id] || user.role || 'Employee'}
								onChange={e => setRoleSelect(r => ({ ...r, [user.id]: e.target.value as Role }))}
								className="border rounded px-2 py-1 text-sm"
							>
								<option value="Admin">Administrator</option>
								<option value="FirstContact">Pierwszy kontakt</option>
								<option value="Employee">Pracownik</option>
							</select>
							<button
								onClick={() => handleApprove(user.id)}
								className="px-3 py-1 rounded bg-green-600 text-white text-sm hover:bg-green-700"
							>Akceptuj</button>
							<button
								onClick={() => handleReject(user.id)}
								className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
							>Odrzuć</button>
						</div>
					</li>
				))}
			</ul>
			{!pendingUsers.length && !loadingPending && <div className="text-gray-500">Brak oczekujących użytkowników.</div>}
		</div>
	);

	return (
		<div className="space-y-6">
			{isAdmin && renderPendingUsers()}
		</div>
	);
};

export default Settings;
