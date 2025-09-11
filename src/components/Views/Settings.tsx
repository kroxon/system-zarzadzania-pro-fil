import React, { useEffect, useState } from 'react';
import { fetchPendingUsers, approveUser, rejectUser } from '../../utils/api/admin';
import { PendingUser, Role } from '../../types';

	type SettingsProps = {
		showWeekends: boolean;
		setShowWeekends: (val: boolean) => void;
		startHour: number;
		setStartHour: (val: number) => void;
		endHour: number;
		setEndHour: (val: number) => void;
		setUsersState: (users: any) => void;
		setRoomsState: (rooms: any) => void;
		setPatientsState: (patients: any) => void;
		setMeetings: (meetings: any) => void;
		loadUsers: () => any;
		loadRooms: () => any;
		loadMeetings: () => any;
		loadAndApplyDemo: () => any;
		purgeDemo: () => void;
		currentUser?: { role: string; };
		token?: string;
	}

const Settings: React.FC<SettingsProps> = ({
	showWeekends,
	setShowWeekends,
	startHour,
	setStartHour,
	endHour,
	setEndHour,
	setUsersState,
	setRoomsState,
	setPatientsState,
	setMeetings,
	loadUsers,
	loadRooms,
	loadMeetings,
	loadAndApplyDemo,
	purgeDemo,
	currentUser,
	token
}) => {
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
			setPendingUsers(prev => prev.filter(u => u.id !== userId));
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
		<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
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
								<option value="Admin">Admin</option>
								<option value="FirstContact">FirstContact</option>
								<option value="Employee">Employee</option>
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
			<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
				<h3 className="text-lg font-semibold text-gray-900 mb-4">Ustawienia kalendarza</h3>
				<div className="flex items-start space-x-3 mb-6">
					<input
						id="showWeekends"
						type="checkbox"
						checked={showWeekends}
						onChange={(e) => setShowWeekends(e.target.checked)}
						className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
					/>
					<label htmlFor="showWeekends" className="text-sm text-gray-700">
						Pokazuj soboty i niedziele w widoku tygodnia oraz uwzględniaj je przy nawigacji dni (domyślnie ukryte)
					</label>
				</div>
				<div className="grid gap-4 md:grid-cols-3">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Godzina otwarcia</label>
						<input
							type="number"
							min={0}
							max={23}
							value={startHour}
							onChange={(e) => setStartHour(Math.min(Math.max(0, Number(e.target.value)), endHour-1))}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Godzina zamknięcia</label>
						<input
							type="number"
							min={startHour+1}
							max={24}
							value={endHour}
							onChange={(e) => setEndHour(Math.max(startHour+1, Math.min(24, Number(e.target.value))))}
							className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
						/>
					</div>
					<div className="flex items-end">
						<div className="text-xs text-gray-500 leading-snug">
							Zakres generuje sloty co 30 min. Ostatni slot kończy się dokładnie o godzinie zamknięcia.
						</div>
					</div>
				</div>
				<div className="mt-8 border-t pt-6 space-y-4">
					<h4 className="text-sm font-semibold text-gray-800">Dane demonstracyjne</h4>
					<div className="flex flex-wrap gap-3">
						<button onClick={()=>{
							// Only generate if no data yet (prevent accidental overwrite)
							const existingUsers = loadUsers();
							const existingRooms = loadRooms();
							const existingMeetings = loadMeetings();
							if(existingUsers.length || existingRooms.length || existingMeetings.length){
								if(!confirm('Dane już istnieją. Czy na pewno nadpisać danymi demo?')) return;
							}
							const { users, rooms, patients, meetings: ms } = loadAndApplyDemo();
							setUsersState(users);
							setRoomsState(rooms);
							setPatientsState(patients);
							setMeetings(ms);
						}} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition">Wygeneruj dane (3 tygodnie)</button>
						<button onClick={()=>{
							if(!confirm('Usunąć wszystkie dane demonstracyjne?')) return;
							purgeDemo();
							setMeetings([]);
							setRoomsState([]);
							setUsersState([]);
							setPatientsState([]);
							localStorage.removeItem('schedule_current_user');
						}} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition">Wyczyść dane</button>
					</div>
					<p className="text-xs text-gray-500">Generuje 5 sal, 7 terapeutów, 20 podopiecznych i spotkania (pon-pt) dla ubiegłego, bieżącego i przyszłego tygodnia. Dane można następnie edytować.</p>
				</div>
			</div>
					<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
						<p className="text-gray-500 text-center py-8">Dodatkowe ustawienia będą dostępne w przyszłych wersjach</p>
					</div>
					{isAdmin && renderPendingUsers()}
		</div>
	);
};

export default Settings;
