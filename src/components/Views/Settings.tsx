import React, { useEffect, useState } from 'react';
import { fetchPendingUsers, approveUser, rejectUser } from '../../utils/api/admin';
import { PendingUser, Role } from '../../types';
import { notify } from '../common/Notification';

const emitNotificationsRefresh = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:notificationsRefresh'));
  }
};

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
	const fetchPendingData = React.useCallback(async () => {
		if (!isAdmin || !token) return;
		setLoadingPending(true);
		setErrorPending(null);
		try {
			const users = await fetchPendingUsers(token);
			setPendingUsers(users);
		} catch (e: any) {
			setErrorPending(e.message);
			setPendingUsers([]);
		} finally {
			setLoadingPending(false);
		}
	}, [isAdmin, token]);

	// Single useEffect to handle all data fetching logic
	useEffect(() => {
		if (!isAdmin || !token) {
			setPendingUsers([]);
			return;
		}

		// Initial fetch
		fetchPendingData();

		// Set up periodic refresh (more frequent than TopBar to catch changes quickly)
		const intervalId = setInterval(fetchPendingData, 30000); // refresh every 30 seconds

		// Set up external refresh listener with small delay to ensure sync
		const handleExternalRefresh = () => {
			// Small delay to ensure TopBar has finished its update cycle
			setTimeout(fetchPendingData, 200);
		};

		if (typeof window !== 'undefined') {
			window.addEventListener('app:notificationsRefresh', handleExternalRefresh);
		}

		// Cleanup
		return () => {
			clearInterval(intervalId);
			if (typeof window !== 'undefined') {
				window.removeEventListener('app:notificationsRefresh', handleExternalRefresh);
			}
		};
	}, [isAdmin, token, fetchPendingData]);

	// Approve user
	const handleApprove = async (userId: string) => {
		const role = roleSelect[userId] || 'Employee';
		if (!token) return;
		try {
			await approveUser(userId, role, token);
			// Natychmiastowe usunięcie z lokalnej listy
			setPendingUsers(prev => prev.filter(u => u.id !== userId));
			// Powiadom TopBar o zmianie
			emitNotificationsRefresh();
			// Odśwież globalną listę pracowników
			if (onUsersRefresh) {
				try { await onUsersRefresh(); } catch { /* ciche pominięcie */ }
			}
			// Dodatkowe odświeżenie danych po krótkim opóźnieniu dla pewności
			setTimeout(fetchPendingData, 1000);
		} catch (e: any) {
			notify.error('Nie udało się zaakceptować użytkownika' + (e?.message ? `: ${e.message}` : ''));
		}
	};

	// Reject user
	const handleReject = async (userId: string) => {
		if (!token) return;
		try {
			await rejectUser(userId, token);
			// Natychmiastowe usunięcie z lokalnej listy
			setPendingUsers(prev => prev.filter(u => u.id !== userId));
			// Powiadom TopBar o zmianie
			emitNotificationsRefresh();
			// Dodatkowe odświeżenie danych po krótkim opóźnieniu dla pewności
			setTimeout(fetchPendingData, 1000);
		} catch (e: any) {
			notify.error('Nie udało się odrzucić użytkownika' + (e?.message ? `: ${e.message}` : ''));
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
