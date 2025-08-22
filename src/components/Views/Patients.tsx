import React, { useState, useEffect } from 'react';
import { Patient } from '../../types';
import { Search } from 'lucide-react';

const samplePatients: Patient[] = [
	{ id: 'p1', firstName: 'Jan', lastName: 'Kowalski', birthDate: '2010-05-12', status: 'aktywny' },
	{ id: 'p2', firstName: 'Anna', lastName: 'Nowak', birthDate: '2011-08-23', status: 'aktywny' },
	{ id: 'p3', firstName: 'Piotr', lastName: 'Zieliński', birthDate: '2009-02-17', status: 'aktywny' },
	{ id: 'p4', firstName: 'Maria', lastName: 'Wiśniewska', birthDate: '2012-11-03', status: 'aktywny' },
	{ id: 'p5', firstName: 'Tomasz', lastName: 'Lewandowski', birthDate: '2008-07-29', status: 'nieaktywny' },
	{ id: 'p6', firstName: 'Katarzyna', lastName: 'Szymańska', birthDate: '2013-01-05', status: 'nieaktywny' },
	{ id: 'p7', firstName: 'Michał', lastName: 'Dąbrowski', birthDate: '2011-04-14', status: 'aktywny' },
	{ id: 'p8', firstName: 'Agnieszka', lastName: 'Król', birthDate: '2009-09-09', status: 'aktywny' },
	{ id: 'p9', firstName: 'Karolina', lastName: 'Wójcik', birthDate: '2010-12-20', status: 'nieaktywny' },
	{ id: 'p10', firstName: 'Łukasz', lastName: 'Kaczmarek', birthDate: '2007-03-30', status: 'aktywny' },
	// NEW extra examples
	{ id: 'p11', firstName: 'Ola', lastName: 'Lis', birthDate: '2012-06-18', status: 'aktywny' },
	{ id: 'p12', firstName: 'Bartek', lastName: 'Adamski', birthDate: '2008-10-02', status: 'aktywny' },
	{ id: 'p13', firstName: 'Ewa', lastName: 'Bąk', birthDate: '2011-01-11', status: 'aktywny' },
	{ id: 'p14', firstName: 'Igor', lastName: 'Gajewski', birthDate: '2013-03-21', status: 'aktywny' },
	{ id: 'p15', firstName: 'Zuzanna', lastName: 'Maj', birthDate: '2009-07-07', status: 'nieaktywny' },
];

interface Visit {
	id: string;
	patientId: string;
	date: string; // YYYY-MM-DD
	therapist: string;
	room: string;
	status: 'zaplanowana' | 'odwołana' | 'zrealizowana';
}

const sampleVisits: Visit[] = [
	{ id: 'v1', patientId: 'p1', date: '2025-08-01', therapist: 'Piotr Nowak', room: 'Gabinet A', status: 'zrealizowana' },
	{ id: 'v2', patientId: 'p1', date: '2025-08-08', therapist: 'Piotr Nowak', room: 'Gabinet A', status: 'zrealizowana' },
	{ id: 'v3', patientId: 'p2', date: '2025-08-05', therapist: 'Maria Wiśniewska', room: 'Sala konsultacyjna', status: 'zaplanowana' },
	{ id: 'v4', patientId: 'p3', date: '2025-08-03', therapist: 'Jan Kowalczyk', room: 'Gabinet B', status: 'odwołana' },
	{ id: 'v5', patientId: 'p3', date: '2025-08-10', therapist: 'Jan Kowalczyk', room: 'Gabinet B', status: 'zaplanowana' },
	{ id: 'v6', patientId: 'p4', date: '2025-08-02', therapist: 'Piotr Nowak', room: 'Gabinet A', status: 'zrealizowana' },
	{ id: 'v7', patientId: 'p5', date: '2025-07-28', therapist: 'Maria Wiśniewska', room: 'Sala konsultacyjna', status: 'zrealizowana' },
	{ id: 'v8', patientId: 'p7', date: '2025-08-06', therapist: 'Piotr Nowak', room: 'Gabinet A', status: 'zaplanowana' },
	{ id: 'v9', patientId: 'p8', date: '2025-08-04', therapist: 'Jan Kowalczyk', room: 'Gabinet B', status: 'zrealizowana' },
	{ id: 'v10', patientId: 'p10', date: '2025-08-09', therapist: 'Piotr Nowak', room: 'Gabinet A', status: 'zaplanowana' },
	// NEW more variety
	{ id: 'v11', patientId: 'p11', date: '2025-08-01', therapist: 'Anna Kowalska', room: 'Gabinet C', status: 'zrealizowana' },
	{ id: 'v12', patientId: 'p11', date: '2025-08-08', therapist: 'Anna Kowalska', room: 'Gabinet C', status: 'zaplanowana' },
	{ id: 'v13', patientId: 'p12', date: '2025-08-05', therapist: 'Piotr Nowak', room: 'Gabinet A', status: 'zrealizowana' },
	{ id: 'v14', patientId: 'p12', date: '2025-08-12', therapist: 'Piotr Nowak', room: 'Gabinet A', status: 'zaplanowana' },
	{ id: 'v15', patientId: 'p13', date: '2025-08-03', therapist: 'Maria Wiśniewska', room: 'Sala konsultacyjna', status: 'zrealizowana' },
	{ id: 'v16', patientId: 'p13', date: '2025-08-10', therapist: 'Maria Wiśniewska', room: 'Sala konsultacyjna', status: 'zaplanowana' },
	{ id: 'v17', patientId: 'p14', date: '2025-08-04', therapist: 'Jan Kowalczyk', room: 'Gabinet B', status: 'odwołana' },
	{ id: 'v18', patientId: 'p14', date: '2025-08-11', therapist: 'Jan Kowalczyk', room: 'Gabinet B', status: 'zaplanowana' },
	{ id: 'v19', patientId: 'p15', date: '2025-08-02', therapist: 'Piotr Nowak', room: 'Gabinet A', status: 'zrealizowana' },
	{ id: 'v20', patientId: 'p15', date: '2025-08-09', therapist: 'Piotr Nowak', room: 'Gabinet A', status: 'odwołana' },
];

// NEW: initial additional info per patient
const initialPatientNotes: Record<string, string> = {
	p1: 'Uczeń szkoły podstawowej. Trudności z koncentracją w godzinach popołudniowych. Preferuje krótsze sesje. Rodzice bardzo zaangażowani.',
	p2: 'Wysoka motywacja. Lekkie napięcie przed pierwszą wizytą – zaproponowano techniki oddechowe.',
	p3: 'Sezonowe pogorszenia nastroju. Monitorować reakcje na zmianę rutyny.',
	p4: 'Silne wsparcie rówieśnicze. Lubi pracę w parach.',
	p5: 'Przerwa w terapii z powodu zmiany miejsca zamieszkania. Możliwy powrót za 2 miesiące.',
	p6: 'Wrażliwa na hałas – preferowane ciche pomieszczenia.',
	p7: 'Poprawa w zakresie komunikacji niewerbalnej.',
	p8: 'Rodzeństwo również w terapii – możliwość sesji łączonych.',
	p9: 'Wypisany z aktywnej terapii – utrzymanie sporadycznego kontaktu.',
	p10: 'Pracujemy nad regulacją emocji. Dobrze reaguje na zadania ruchowe.',
	p11: 'Nowy pacjent – adaptacja przebiega spokojnie.',
	p12: 'Trudności z organizacją czasu – wdrożono planer tygodniowy.',
	p13: 'Świetna współpraca. Rozważyć zwiększenie częstotliwości.',
	p14: 'Niska motywacja po odwołanej sesji – zaplanować rozmowę wzmacniającą.',
	p15: 'Zakończony cykl podstawowy. Monitorowanie okresowe.',
};

// NEW: initial notes for specific visits (session notes)
const initialSessionNotes: Record<string, string> = {
	v1: 'Ćwiczenia koncentracji uwagi. Reakcja dobra, końcówka lekko zmęczona.',
	v2: 'Powtórzenie technik + wprowadzenie elementów pamięci roboczej.',
	v3: 'Pierwsze spotkanie planujące – ustalono cele krótkoterminowe.',
	v4: 'Sesja odwołana – choroba pacjenta.',
	v6: 'Duża aktywność – potrzeba częstszych przerw na wodę.',
	v7: 'Omówienie postępów przed przerwą wakacyjną.',
	v9: 'Stabilna realizacja zadań. Dodać element grywalizacji.',
	v11: 'Diagnoza wstępna, obserwacja reakcji na nowe otoczenie.',
	v13: 'Praca nad planowaniem sekwencji działań.',
	v15: 'Ćwiczenia językowe + elementy narracji.',
	v17: 'Odwołane – brak transportu.',
	v19: 'Podsumowanie zakończonego etapu terapii.',
};

const Patients: React.FC = () => {
	// NEW: stateful patients instead of static constant
	const [patients, setPatients] = useState<Patient[]>(samplePatients);
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<Patient | null>(null);
	const [statusFilter, setStatusFilter] = useState<'aktywny' | 'nieaktywny' | 'wszyscy'>(
		'aktywny'
	);
	// NEW: edit mode + form state
	const [editMode, setEditMode] = useState(false);
	const [editForm, setEditForm] = useState({
		firstName: '',
		lastName: '',
		birthDate: '',
		status: 'aktywny',
		therapists: [] as string[],
		notes: '',
	});
	// NEW: therapists assignments (multiple)
	const therapistNames = [
		'Piotr Nowak',
		'Maria Wiśniewska',
		'Jan Kowalczyk',
		'Anna Kowalska',
	];
	const [therapistAssignments, setTherapistAssignments] = useState<Record<string, string[]>>(
		{}
	);
	// NEW: notes per patient
	const [patientNotes, setPatientNotes] = useState<Record<string, string>>(initialPatientNotes);
	// NEW tabs state
	const [activeTab, setActiveTab] = useState<'info' | 'sessions'>('info'); // tabs state extended
	// visitId -> note
	const [sessionNotes, setSessionNotes] = useState<Record<string, string>>(initialSessionNotes);
	const [openSessionNotes, setOpenSessionNotes] = useState<Set<string>>(new Set());

	// initialize assignments once
	useEffect(() => {
		setTherapistAssignments((prev) => {
			if (Object.keys(prev).length) return prev;
			const init: Record<string, string[]> = {};
			patients.forEach((p) => {
				init[p.id] = [
					therapistNames[Math.floor(Math.random() * therapistNames.length)],
				];
			});
			return init;
		});
	}, [patients]);

	// when selecting patient populate edit form
	useEffect(() => {
		if (selected) {
			setActiveTab('info'); // reset tab on patient change
			setEditMode(false);
			setEditForm({
				firstName: selected.firstName || '',
				lastName: selected.lastName || '',
				birthDate: selected.birthDate || '',
				status: (selected as any).status || 'aktywny',
				therapists: therapistAssignments[selected.id] || [],
				notes: patientNotes[selected.id] || '',
			});
		}
	}, [selected, therapistAssignments, patientNotes]);

	const filtered = patients
		.filter((p) =>
			`${p.firstName} ${p.lastName}`.toLowerCase().includes(query.toLowerCase())
		)
		.filter((p) =>
			statusFilter === 'wszyscy' ? true : p.status === statusFilter
		);

	const statusBadge = (status?: string) => {
		const isActive = status === 'aktywny';
		return (
			<span
				className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] leading-none ${
					isActive
						? 'text-green-700 bg-green-50 border-green-200'
						: 'text-gray-500 bg-gray-100 border-gray-300'
				}`}
			>
				{status || '—'}
			</span>
		);
	};

	const calcAge = (birthDate?: string) => {
		if (!birthDate) return '—';
		const bd = new Date(birthDate);
		if (isNaN(bd.getTime())) return '—';
		const now = new Date();
		let age = now.getFullYear() - bd.getFullYear();
		const m = now.getMonth() - bd.getMonth();
		if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
		return age + ' lat';
	};

	const selectedVisits = selected
		? sampleVisits.filter((v) => v.patientId === selected.id)
		: [];

	const visitCounts = React.useMemo(() => {
		return {
			total: selectedVisits.length,
			zrealizowana: selectedVisits.filter((v) => v.status === 'zrealizowana').length,
			odwolana: selectedVisits.filter((v) => v.status === 'odwołana').length,
			zaplanowana: selectedVisits.filter((v) => v.status === 'zaplanowana').length,
		};
	}, [selectedVisits]);

	const startEdit = () => {
		if (selected) setEditMode(true);
	};
	const cancelEdit = () => {
		if (selected) {
			setEditMode(false);
			/* reset */
			setEditForm({
				firstName: selected.firstName,
				lastName: selected.lastName,
				birthDate: selected.birthDate || '',
				status: (selected.status as any),
				therapists: therapistAssignments[selected.id] || [],
				notes: patientNotes[selected.id] || '',
			});
		}
	};
	const saveEdit = () => {
		if (!selected) return;
		setPatients((prev) =>
			prev.map((p) =>
				p.id === selected.id
					? {
							...p,
							firstName: editForm.firstName,
							lastName: editForm.lastName,
							birthDate: editForm.birthDate,
							status: editForm.status as any,
					  }
					: p
			)
		);
		setTherapistAssignments((prev) => ({
			...prev,
			[selected.id]: editForm.therapists,
		}));
		setPatientNotes((prev) => ({ ...prev, [selected.id]: editForm.notes }));
		setSelected((prev) =>
			prev
				? {
						...prev,
						firstName: editForm.firstName,
						lastName: editForm.lastName,
						birthDate: editForm.birthDate,
						status: editForm.status as any,
				  }
				: prev
		);
		setEditMode(false);
	};

	const addTherapist = (name: string) => {
		if (!name || !selected) return;
		setEditForm((f) =>
			f.therapists.includes(name) ? f : { ...f, therapists: [...f.therapists, name] }
		);
	};
	const removeTherapist = (name: string) => {
		setEditForm((f) => ({
			...f,
			therapists: f.therapists.filter((t) => t !== name),
		}));
	};

	return (
		<div className="space-y-6">
			{/* removed duplicate title (handled by TopBar) */}
			{/* Pasek wyszukiwania i filtrów */}
			<div className="flex items-center flex-wrap gap-3">
				<div className="flex-1 max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex items-center space-x-2">
					<Search className="h-4 w-4 text-gray-400" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Szukaj podopiecznego..."
						className="flex-1 bg-transparent outline-none text-sm"
					/>
				</div>
				<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value as any)}
						className="text-xs bg-transparent outline-none"
					>
						<option value="aktywny">Aktywni</option>
						<option value="nieaktywny">Nieaktywni</option>
						<option value="wszyscy">Wszyscy</option>
					</select>
				</div>
			</div>

			<div className="flex items-start gap-6">
				{/* Lista */}
				<div className="w-72 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
					<table className="w-full divide-y divide-gray-100">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
									Imię i nazwisko
								</th>
								<th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
									Status
								</th>
							</tr>
						</thead>
						<tbody className="bg-white divide-y divide-gray-100">
							{filtered.map((p) => (
								<tr
									key={p.id}
									onClick={() => setSelected(p)}
									className={`cursor-pointer hover:bg-blue-50 ${
										selected?.id === p.id ? 'bg-blue-50/70' : ''
									}`}
								>
									<td className="px-3 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">
										{p.firstName} {p.lastName}
									</td>
									<td className="px-3 py-1.5 text-[11px]">
										{statusBadge(p.status)}
									</td>
								</tr>
							))}
							{filtered.length === 0 && (
								<tr>
									<td colSpan={2} className="px-3 py-4 text-center text-sm text-gray-500">
										Brak wyników
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				{/* Panel szczegółów */}
				<div className="flex-1 min-h-[400px] bg-white rounded-xl shadow-sm border border-gray-200 p-6">
					{!selected && (
						<div className="h-full flex items-center justify-center text-gray-400 text-sm">
							Wybierz podopiecznego z listy po lewej
						</div>
					)}
					{selected && (
						<div className="space-y-6">
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<div className="flex items-start justify-between">
										<h2 className="text-xl font-semibold text-gray-900">
											{editMode ? (
												<div className="flex gap-2">
													<input
														value={editForm.firstName}
														onChange={(e) =>
															setEditForm((f) => ({
																...f,
																firstName: e.target.value,
															}))
														}
														className="px-2 py-1 text-sm border rounded"
													/>
													<input
														value={editForm.lastName}
														onChange={(e) =>
															setEditForm((f) => ({
																...f,
																lastName: e.target.value,
															}))
														}
														className="px-2 py-1 text-sm border rounded"
													/>
												</div>
											) : (
												`${selected.firstName} ${selected.lastName}`
											)}
										</h2>
										<div className="flex items-center gap-2 ml-4">
											{!editMode && (
												<button
													onClick={startEdit}
													className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
												>
													Edytuj
												</button>
											)}
											{editMode && (
												<>
													<button
														onClick={saveEdit}
														className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
													>
														Zapisz
													</button>
													<button
														onClick={cancelEdit}
														className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
													>
														Anuluj
													</button>
												</>
											)}
										</div>
									</div>
									<div className="mt-4 grid grid-cols-3 gap-6 items-start">
										<div className="space-y-2 text-sm text-gray-600 col-span-1">
											{/* patient basic info now narrower */}
											<p>
												<strong>Data urodzenia:</strong>{' '}
												{editMode ? (
													<input
														type="date"
														value={editForm.birthDate}
														onChange={(e) =>
															setEditForm((f) => ({
																...f,
																birthDate: e.target.value,
															}))
														}
														className="ml-2 px-2 py-1 text-xs border rounded"
													/>
												) : (
													<>
														<span className="ml-1">
															{selected.birthDate || '—'}
														</span>{' '}
														<span className="ml-2 text-gray-500">
															({calcAge(selected.birthDate)})
														</span>
													</>
												)}
											</p>
											<p className="flex items-center">
												<strong className="mr-1">Status:</strong>{' '}
												{editMode ? (
													<select
														value={editForm.status}
														onChange={(e) =>
															setEditForm((f) => ({
																...f,
																status: e.target.value,
															}))
														}
														className="px-2 py-1 text-xs border rounded"
													>
														<option value="aktywny">aktywny</option>
														<option value="nieaktywny">nieaktywny</option>
													</select>
												) : (
													statusBadge(selected.status)
												)}
											</p>
											<div>
												<p className="mb-1">
													<strong>Terapeuci:</strong>
												</p>
												{!editMode && (
													<div className="flex flex-wrap gap-1">
														{(therapistAssignments[selected.id] || []).map((t) => (
															<span
																key={t}
																className="px-2 py-0.5 text-[11px] bg-blue-50 text-blue-700 rounded-full border border-blue-200"
															>
																{t}
															</span>
														))}
													</div>
												)}
												{editMode && (
													<div className="space-y-2">
														<div className="flex flex-wrap gap-1">
															{editForm.therapists.map((t) => (
																<span
																	key={t}
																	className="px-2 py-0.5 text-[11px] bg-blue-50 text-blue-700 rounded-full border border-blue-200 flex items-center gap-1"
																>
																	{t}
																	<button
																		onClick={() => removeTherapist(t)}
																		className="text-blue-500 hover:text-blue-700"
																	>
																		×
																	</button>
																</span>
															))}
															{editForm.therapists.length === 0 && (
																<span className="text-[11px] text-gray-400">
																	Brak terapeutów
																</span>
															)}
														</div>
														<div className="flex items-center gap-2">
															<select
																className="px-2 py-1 text-xs border rounded"
																onChange={(e) => {
																	addTherapist(e.target.value);
																	e.target.selectedIndex = 0;
																}}
															>
																<option value="">Dodaj terapeutę...</option>
																{therapistNames
																	.filter((n) => !editForm.therapists.includes(n))
																	.map((n) => (
																		<option key={n} value={n}>
																			{n}
																		</option>
																	))}
															</select>
														</div>
													</div>
												)}
											</div>
											{/* NEW: visit counts */}
											<div className="mt-4 pt-3 border-t border-gray-200">
												{visitCounts.total === 0 ? (
													<p className="text-[12px] italic text-gray-400">
														Brak sesji
													</p>
												) : (
													<div className="space-y-1">
														<p className="text-[12px] font-semibold text-gray-700">
															Sesje łącznie: {visitCounts.total}
														</p>
														<div className="flex flex-wrap gap-1 text-[11px]">
															<span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
																zrealizowane: {visitCounts.zrealizowana}
															</span>
															<span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-yellow-50 text-yellow-700 border-yellow-200">
																zaplanowane: {visitCounts.zaplanowana}
															</span>
															<span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">
																odwołane: {visitCounts.odwolana}
															</span>
														</div>
													</div>
												)}
											</div>
										</div>
										{/* spacer / can be used for future fields */}
										<div className="col-span-2 flex flex-col h-full">
											{/* Tabs */}
											<div className="flex border-b border-gray-200 mb-3">
												<button
													className={`px-4 py-2 text-xs font-medium -mb-px border-b-2 transition-colors ${
														activeTab === 'info'
															? 'border-blue-600 text-blue-700'
															: 'border-transparent text-gray-500 hover:text-gray-700'
													}`}
													onClick={() => setActiveTab('info')}
												>
													Informacje dodatkowe
												</button>
												<button
													className={`px-4 py-2 text-xs font-medium -mb-px border-b-2 transition-colors ${
														activeTab === 'sessions'
															? 'border-blue-600 text-blue-700'
															: 'border-transparent text-gray-500 hover:text-gray-700'
													}`}
													onClick={() => setActiveTab('sessions')}
												>
													Notatki z sesji
												</button>
											</div>
											{/* Tab panels */}
											{activeTab === 'info' && (
												<div className="flex-1 flex flex-col">
													<label className="text-xs font-semibold text-gray-700 mb-1">
														Informacje dodatkowe
													</label>
													{editMode ? (
														<textarea
															value={editForm.notes}
															onChange={(e) =>
																setEditForm((f) => ({ ...f, notes: e.target.value }))
															}
															className="flex-1 min-h-[160px] max-h-[300px] overflow-y-auto w-full text-sm p-3 border rounded resize-y leading-relaxed"
															placeholder="Wpisz dodatkowe informacje..."
														/>
													) : (
														<div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap min-h-[160px] max-h-[300px] overflow-y-auto p-3 border rounded bg-gray-50">
															{(patientNotes[selected.id] || '').trim() || (
																<span className="italic text-gray-400">
																	Brak informacji
																</span>
															)}
														</div>
													)}
												</div>
											)}
											{activeTab === 'sessions' && (
												<div className="flex-1 flex flex-col min-h-[160px] max-h-[300px] overflow-y-auto">
													{selectedVisits.length === 0 && (
														<div className="text-xs text-gray-500 italic">
															Brak wizyt do wyświetlenia notatek
														</div>
													)}
													<ul className="space-y-2">
														{selectedVisits.map((v) => {
															const open = openSessionNotes.has(v.id);
															const toggle = () =>
																setOpenSessionNotes((prev) => {
																	const n = new Set(prev);
																	n.has(v.id) ? n.delete(v.id) : n.add(v.id);
																	return n;
																});
															return (
																<li
																	key={v.id}
																	className="border border-gray-200 rounded-lg bg-white overflow-hidden"
																>
																	<button
																		onClick={toggle}
																		className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50"
																	>
																		<span className="flex items-center gap-2">
																			<span className="text-gray-500">{v.date}</span>
																			<span className="text-gray-400">•</span>
																			<span>{v.therapist}</span>
																			<span className="text-gray-400">•</span>
																			<span className="capitalize">{v.status}</span>
																		</span>
																		<span
																			className={`ml-2 inline-flex h-5 w-5 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 shadow-sm transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
																		>
																			<svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
																				<path fillRule="evenodd" d="M6.293 7.293a1 1 0 011.414 0L11 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
																			</svg>
																		</span>
																	</button>
																	{open && (
																		<div className="p-3 border-t border-gray-200 bg-gray-50">
																			{editMode ? (
																				<textarea
																					className="w-full text-xs p-2 border rounded resize-y min-h-[80px]"
																					placeholder="Wpisz notatkę z sesji..."
																					value={sessionNotes[v.id] || ''}
																					onChange={(e) =>
																						setSessionNotes((s) => ({
																							...s,
																							[v.id]: e.target.value,
																						}))
																					}
																				/>
																			) : (
																				<div className="text-xs whitespace-pre-wrap text-gray-700 min-h-[40px]">
																					{(sessionNotes[v.id] || '').trim() || (
																						<span className="italic text-gray-400">
																							Brak notatki
																						</span>
																					)}
																				</div>
																			)}
																		</div>
																	)}
																</li>
															);
														})}
													</ul>
													{selectedVisits.length > 0 && openSessionNotes.size > 0 && (
														<div className="mt-3 pt-3 border-t border-gray-200">
															<button
																onClick={() => setOpenSessionNotes(new Set())}
																className="px-3 py-1.5 text-[11px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-300"
															>
																Zwiń wszystkie notatki
															</button>
														</div>
													)}
												</div>
											)}
										</div>
									</div>
								</div>
								{/* removed ID display */}
							</div>
						</div>
					)}
					{selected && (
						<div className="border-t border-gray-200 pt-4 mt-6">
							<h3 className="text-sm font-semibold text-gray-800 mb-3">
								Historia wizyt
							</h3>
							<div className="overflow-x-auto">
								<table className="w-full text-xs">
									<thead className="bg-gray-50 border border-gray-200">
										<tr className="text-gray-600">
											<th className="px-3 py-2 text-left font-medium">Data</th>
											<th className="px-3 py-2 text-left font-medium">
												Terapeuta
											</th>
											<th className="px-3 py-2 text-left font-medium">Sala</th>
											<th className="px-3 py-2 text-left font-medium">Status</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100 border border-gray-200 border-t-0">
										{selectedVisits.map((v) => (
											<tr key={v.id} className="hover:bg-gray-50">
												<td className="px-3 py-2 whitespace-nowrap">{v.date}</td>
												<td className="px-3 py-2 whitespace-nowrap">
													{v.therapist}
												</td>
												<td className="px-3 py-2 whitespace-nowrap">{v.room}</td>
												<td className="px-3 py-2 whitespace-nowrap">
													<span
														className={`inline-flex px-2 py-0.5 rounded-full border ${
															v.status === 'zrealizowana'
																? 'bg-green-50 text-green-700 border-green-200'
																: v.status === 'odwołana'
																? 'bg-red-50 text-red-600 border-red-200'
																: 'bg-yellow-50 text-yellow-700 border-yellow-200'
														}`}
													>
														{v.status}
													</span>
												</td>
											</tr>
										))}
										{selectedVisits.length === 0 && (
											<tr>
												<td colSpan={4} className="px-3 py-4 text-center text-gray-500">
													Brak wizyt
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default Patients;
