import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { UnsavedChangesProvider } from './components/common/UnsavedChangesGuard';
import NotFound404 from './components/Views/NotFound404';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import Dashboard from './components/Views/Dashboard';
import EmployeeCalendar from './components/Views/EmployeeCalendar';
import RoomCalendar from './components/Views/RoomCalendar';
import LoginForm from './components/Auth/LoginForm';
import EmployeesManage from './components/Views/EmployeesManage';
import Patients from './components/Views/Patients';
import RoomsManage from './components/Views/RoomsManage';
import TasksPage from './components/Tasks/TasksPage';
import { User, Meeting, Room, CreateEvent } from './types';
import MobileMeetings from './components/Views/MobileMeetings';
import { useIsMobile } from './utils/device';
import Settings from './components/Views/Settings';
// Icons were used in removed view meta; keeping import minimal
import { mapBackendRolesToFrontend } from './utils/roleMapper';
import { fetchEmployees } from './utils/api/employees';
import { getRooms as fetchRooms } from './utils/api/rooms';
import { fetchEvents, createEvent, updateEvent, deleteEvent } from './utils/api/events';
import { getAllEventStatuses } from './utils/api/eventStatuses';
import { fetchPatients } from './utils/api/patients';

// Minimal local helpers for persisting current user only (storage module removed)
const LOCAL_USER_KEY = 'schedule_current_user';
function loadCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}
function saveCurrentUser(user: User) {
  try {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  } catch {}
}

function ProtectedLayout({ currentUser, onLogout, children }: { currentUser: any, onLogout: () => void, children?: React.ReactNode }) {
  const isMobile = useIsMobile();
  if (!currentUser) return <Navigate to="/login" replace />;
  // If mobile, block desktop routes and redirect to mobile view
  if (isMobile) return <Navigate to="/m" replace />;
  // Derive current page meta (title + sidebar view) from the route path
  const { pathname } = useLocation();
  const getViewInfo = (path: string) => {
    // default
    let currentView = 'dashboard';
    let pageTitle = 'Panel główny';
    if (path.startsWith('/employees/schedule')) {
      currentView = 'employee-calendar';
      pageTitle = 'Grafiki pracowników';
    } else if (path.startsWith('/employees/menage')) {
      currentView = 'employees-manage';
      pageTitle = 'Zarządzaj pracownikami';
    } else if (path.startsWith('/reservation/schedule')) {
      currentView = 'room-calendar';
      pageTitle = 'Grafiki sal';
    } else if (path.startsWith('/reservation/menage')) {
      currentView = 'rooms-manage';
      pageTitle = 'Zarządzanie salami';
    } else if (path.startsWith('/patients')) {
      currentView = 'patients';
      pageTitle = 'Podopieczni';
    } else if (path.startsWith('/tasks')) {
      currentView = 'tasks';
      pageTitle = 'Zadania';
    } else if (path.startsWith('/options')) {
      currentView = 'settings';
      pageTitle = 'Ustawienia';
    } else if (path.startsWith('/dashboard')) {
      currentView = 'dashboard';
      pageTitle = 'Panel główny';
    }
    return { currentView, pageTitle };
  };
  const { currentView, pageTitle } = getViewInfo(pathname || '/dashboard');
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentView={currentView}
        userRole={currentUser.role}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          currentUser={currentUser}
          onLogout={onLogout}
          pageTitle={pageTitle}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 flex-1 flex flex-col overflow-y-auto">
            {children ? children : <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const isMobile = useIsMobile();
  // const [currentView, setCurrentView] = useState('dashboard');
  // Initialize ONLY from persisted storage (no implicit sample fallback)
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [usersState, setUsersState] = useState<User[]>([]);
  const [patientsState, setPatientsState] = useState([]);
  const [roomsState, setRoomsState] = useState<Room[]>([]);
  const [showWeekends] = useState(false);
  const [startHour] = useState(8);
  const [endHour] = useState(17);
  // Backend-only mode: no local persistence flags needed
  // No local persistence flags in backend-only mode

  // Backend events refresh (merge with local for now)
  const refreshBackendEventsGlobal = useCallback(async () => {
    const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
    if (!token) return;
    try {
      // Fetch events, statuses (optional), and patients (for participants split)
      const [apiEvents, statuses, apiPatients] = await Promise.all([
        fetchEvents(token),
        // Statuses are optional; if it fails, continue with defaults
  getAllEventStatuses(token).catch(() => []),
        // Patients are optional for mapping; if it fails, we still fall back to employees-only participants
        fetchPatients(token).catch(() => [])
      ]);
      const statusMap: Record<number, string> = {};
      (statuses as any[]).forEach((s: any) => { statusMap[s.id] = s.name; });

      // Helper to normalize backend status name/id to Meeting.status
      const normalizeStatus = (statusId?: number): 'present' | 'absent' | 'cancelled' | 'in-progress' => {
        const name = statusId ? (statusMap[statusId] || '') : '';
        const s = name.toLowerCase();
        if (/(cancel|odwo)/.test(s)) return 'cancelled';
        if (/(absent|nieobec)/.test(s)) return 'absent';
        if (/(progress|w toku)/.test(s)) return 'in-progress';
        return 'present';
      };

      const toLocalParts = (iso: string) => {
        const d = new Date(iso);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return { date: `${y}-${m}-${dd}`, time: `${hh}:${mm}` };
      };

      // Build lookup set for ALL users (admin/contact/employee) as potential specialists.
      // POPRAWKA: wcześniej filtrowaliśmy tylko role==='employee', przez co admin/contact byli traceni po odświeżeniu (ich ID nie wracało w specialistIds).
      const specialistIdSet = new Set<number>();
      try {
        usersState.forEach(u => { const n = Number(u.id); if (!Number.isNaN(n)) specialistIdSet.add(n); });
      } catch {}
      const patientNameMap = new Map<number, string>();
      const patientIdSet = new Set<number>();
      try {
        (apiPatients as any[]).forEach((p: any) => {
          if (typeof p?.id === 'number') {
            const full = `${p.name ?? ''} ${p.surname ?? ''}`.trim();
            patientIdSet.add(p.id);
            if (full) patientNameMap.set(p.id, full);
          }
        });
      } catch {}

      const mapped = apiEvents.map(ev => {
        const start = toLocalParts(ev.start);
        const end = toLocalParts(ev.end);
        // Uczestnicy backendu: participantIds to ogólnie osoby (pracownicy + podopieczni).
        // Rozdzielamy po ID pewnie: jeśli ID jest w employeeIdSet -> specjalista; jeśli w patientIdSet -> pacjent.
        // Jeżeli ID nie jest znane w żadnym zbiorze, nie zakładamy że to pacjent (unikamy fałszywego pN).
        const specNumIds: number[] = [];
        const patientNumIds: number[] = [];
        (ev.participantIds || []).forEach((pid: number) => {
          // Jeśli ID jest w zbiorze użytkowników -> traktujemy jako specjalistę.
            if (specialistIdSet.has(pid)) {
              specNumIds.push(pid);
            } else if (patientIdSet.has(pid)) {
              patientNumIds.push(pid);
            } else {
              // unknown id -> ignorujemy (może to być typ uczestnika którego jeszcze nie obsługujemy)
            }
          });
        const specIds = specNumIds.map(n => String(n));
        const patientIds = patientNumIds.map(n => String(n));
        const primarySpec = specIds[0] || '';
        const primaryPatientId = patientIds[0];
        // Only use real names we know from backend, do not fabricate placeholders
        const patientNamesResolved = patientNumIds.map(n => patientNameMap.get(n) || '');
        const roomId = ev.roomId != null ? String(ev.roomId) : '';
        return {
          id: `bevt-${ev.id}`,
          name: ev.name,
          specialistId: primarySpec,
          patientName: (primaryPatientId ? (patientNameMap.get(Number(primaryPatientId)) || '') : ''),
          patientId: primaryPatientId,
          guestName: ev.guest || undefined,
          specialistIds: specIds.length ? specIds : undefined,
          patientIds: patientIds.length ? patientIds : undefined,
          patientNamesList: patientNamesResolved.some(Boolean) ? patientNamesResolved : undefined,
          roomId,
          date: start.date,
          startTime: start.time,
          endTime: end.time,
          notes: ev.info || undefined,
          statusId: ev.statusId,
          status: normalizeStatus(ev.statusId),
          createdBy: 'backend',
        } as Meeting;
      });

      // Backend-only: just set mapped events
      setMeetings(mapped);
    } catch (e) {
      // Silent for now; could add Notification later
      console.warn('Failed to fetch backend events', e);
    }
  }, [currentUser?.token, usersState]);

  // Reusable backend users refresh
  const refreshBackendUsersGlobal = useCallback(async () => {
    const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
    if (!token) return;
    try {
      const apiEmployees = await fetchEmployees(token);
      const mapped = apiEmployees.map(e => ({
        id: e.id.toString(),
        name: e.name,
        surname: e.surname,
        role: (mapBackendRolesToFrontend(e.roles)[0]) || 'employee',
        specialization: e.occupationName,
        notes: e.info || undefined,
      }));
      setUsersState(mapped);
    } finally {
      // noop
    }
  }, [currentUser?.token]);

  // NEW: Reusable backend rooms refresh
  const refreshBackendRoomsGlobal = useCallback(async () => {
    const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
    if (!token) return;
    try {
      const apiRooms = await fetchRooms(token);
      const mapped: Room[] = apiRooms.map(r => ({
        id: r.id.toString(),
        name: r.name,
        hexColor: r.hexColor,
      }));
      setRoomsState(mapped);
    } catch {
      // ignore silently for now
    } finally {
      // noop
    }
  }, [currentUser?.token]);

  // NEW: Reusable backend patients refresh
  const refreshBackendPatientsGlobal = useCallback(async () => {
    const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
    if (!token) return;
    try {
      const apiPatients = await fetchPatients(token);
      setPatientsState(apiPatients as any);
    } catch {
      // ignore for now
    } finally {
      // noop
    }
  }, [currentUser?.token]);

  // Fetch employees from backend when token available and merge into usersState
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refreshBackendUsersGlobal();
    })();
    return () => { cancelled = true; };
  }, [refreshBackendUsersGlobal]);

  // NEW: Fetch rooms from backend when token available and merge into roomsState
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refreshBackendRoomsGlobal();
    })();
    return () => { cancelled = true; };
  }, [refreshBackendRoomsGlobal]);

  // NEW: Fetch patients from backend when token available
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refreshBackendPatientsGlobal();
    })();
    return () => { cancelled = true; };
  }, [refreshBackendPatientsGlobal]);

  // NEW: Fetch events from backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refreshBackendEventsGlobal();
    })();
    return () => { cancelled = true; };
  }, [refreshBackendEventsGlobal]);

  // Only restore current user (do NOT overwrite entity states)
  useEffect(() => {
    const storedUser = loadCurrentUser();
    if (storedUser) setCurrentUser(storedUser);
    setAuthReady(true);
  }, []);

  // Removed local persistence side-effects (backend-only mode)

  const handleLogin = async (user: any, token?: string) => {
    // Jeśli user ma pole 'roles' (Employee z backendu), wykonaj mapowanie
    if (user && Array.isArray(user.roles)) {
      console.log('Backend roles:', user.roles);
      const mappedRole = user.roles.length > 0
        ? mapBackendRolesToFrontend(user.roles)[0]
        : 'employee';
      const frontendUser: User = {
        id: user.id.toString(),
        name: user.name,
        surname: user.surname,
        role: mappedRole,
        specialization: user.occupationName,
          token: token || localStorage.getItem('token') || undefined,
        // ...inne pola jeśli potrzebne
      };
  setCurrentUser(frontendUser);
  saveCurrentUser(frontendUser);
      // Nie dodawaj tutaj backendowego usera do usersState (zapobiegnie to zapisowi do localStorage).
      // Lista zostanie zsynchronizowana przez efekt fetchEmployees powyżej.
      return;
    }
    // DemoUsers lub fallback
    setCurrentUser(user);
    saveCurrentUser(user);
    setUsersState(prev => prev.some(u=>u.id===user.id) ? prev : [...prev, user]);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('schedule_current_user');
    localStorage.removeItem('token');
  };

  const handleMeetingCreate = async (meetingData: Omit<Meeting, 'id'>) => {
    const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
    if (!token) return;
    // Map Meeting -> CreateEvent
    // Build local time string without timezone (YYYY-MM-DDTHH:mm:ss)
    const toLocalNaiveIso = (date: string, time: string) => {
      // date is already YYYY-MM-DD, time is HH:mm
      const [hh, mm] = time.split(':');
      const h = hh?.padStart(2, '0') || '00';
      const m = mm?.padStart(2, '0') || '00';
      return `${date}T${h}:${m}:00`;
    };
    const participantIds: number[] = [
      ...(meetingData.specialistIds || (meetingData.specialistId ? [meetingData.specialistId] : [])).map(id => Number(id)).filter(n => Number.isFinite(n)),
      ...(meetingData.patientIds || (meetingData.patientId ? [meetingData.patientId] : [])).map(id => Number(id)).filter(n => Number.isFinite(n)),
    ];
    const payload: CreateEvent = {
      name: meetingData.name || 'Spotkanie',
      start: toLocalNaiveIso(meetingData.date, meetingData.startTime),
      end: toLocalNaiveIso(meetingData.date, meetingData.endTime),
      participantIds,
      roomId: meetingData.roomId ? Number(meetingData.roomId) : null,
      info: meetingData.notes || null,
      guest: meetingData.guestName || undefined,
    };
    try {
      await createEvent(payload, token);
      await refreshBackendEventsGlobal();
    } catch (e) {
      console.warn('Nie udało się utworzyć spotkania', e);
    }
  };

  const handleMeetingUpdate = async (meetingId: string, updates: Partial<Meeting>) => {
    const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
    if (!token) return;
    const idNum = String(meetingId).startsWith('bevt-') ? Number(String(meetingId).replace('bevt-','')) : Number(meetingId);
    if (!Number.isFinite(idNum)) return;
    // Build local time string without timezone (YYYY-MM-DDTHH:mm:ss)
    const toLocalNaiveIso = (date?: string, time?: string) => {
      if (!date || !time) return undefined;
      const [hh, mm] = time.split(':');
      const h = hh?.padStart(2, '0') || '00';
      const m = mm?.padStart(2, '0') || '00';
      return `${date}T${h}:${m}:00`;
    };
    // Find existing meeting to fill required fields
    const existing = meetings.find(m => m.id === meetingId);
    if (!existing) return;
    const date = updates.date || existing.date;
    const startTime = updates.startTime || existing.startTime;
    const endTime = updates.endTime || existing.endTime;
    const name = (updates as any).name ?? (existing as any).name ?? 'Spotkanie';
    const specialistIds = updates.specialistIds || existing.specialistIds || (existing.specialistId ? [existing.specialistId] : []);
    const patientIds = updates.patientIds || existing.patientIds || (existing.patientId ? [existing.patientId] : []);
    const participantIds: number[] = [
      ...specialistIds.map(id => Number(id)).filter(n => Number.isFinite(n)),
      ...patientIds.map(id => Number(id)).filter(n => Number.isFinite(n)),
    ];
    const payload: CreateEvent = {
      name,
      start: toLocalNaiveIso(date, startTime)!,
      end: toLocalNaiveIso(date, endTime)!,
      participantIds,
      roomId: (updates.roomId ?? existing.roomId) ? Number(updates.roomId ?? existing.roomId) : null,
      info: (updates.notes ?? existing.notes) || null,
      guest: (updates.guestName ?? existing.guestName) || undefined,
    };
    try {
      await updateEvent(idNum, payload, token);
      await refreshBackendEventsGlobal();
    } catch (e) {
      console.warn('Nie udało się zaktualizować spotkania', e);
    }
  };

  const handleMeetingDelete = async (meetingId: string) => {
    const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
    if (!token) return;
    const idNum = String(meetingId).startsWith('bevt-') ? Number(String(meetingId).replace('bevt-','')) : Number(meetingId);
    if (!Number.isFinite(idNum)) return;
    try {
      await deleteEvent(idNum, token);
      await refreshBackendEventsGlobal();
    } catch (e) {
      console.warn('Nie udało się usunąć spotkania', e);
    }
  };

  const handleAddEmployee = (_data: Omit<User, 'id'>) => {
    // Local demo add disabled in backend-only mode
    console.warn('Dodawanie lokalnych pracowników jest wyłączone. Użyj backendu.');
  };

  const handleUpdateEmployee = (_id: string, _update: Partial<User>) => {
    console.warn('Aktualizacja lokalnych pracowników jest wyłączona. Użyj backendu.');
  };

  const handleDeleteEmployee = (_id: string) => {
    console.warn('Usuwanie lokalnych pracowników jest wyłączone. Użyj backendu.');
  };

  // const viewMeta: Record<string, { title: string; icon: JSX.Element }> = { ... };


  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
          <span>Ładowanie…</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <UnsavedChangesProvider>
      <Routes>
        {/* Login route, no bars */}
        <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />

        {/* Protected routes for desktop */}
        <Route element={<ProtectedLayout currentUser={currentUser} onLogout={handleLogout} />}>
          <Route path="/dashboard" element={<Dashboard users={usersState} rooms={roomsState} meetings={meetings} patients={patientsState as any} />} />
          <Route path="/employees/schedule" element={<EmployeeCalendar users={usersState} rooms={roomsState} meetings={meetings} currentUser={currentUser!} onMeetingCreate={handleMeetingCreate} onMeetingUpdate={handleMeetingUpdate} onMeetingDelete={handleMeetingDelete} showWeekends={showWeekends} startHour={startHour} endHour={endHour} patients={patientsState as any} />} />
          <Route path="/employees/menage" element={<EmployeesManage users={usersState} onAdd={handleAddEmployee} onUpdate={handleUpdateEmployee} onDelete={handleDeleteEmployee} onBackendRefresh={refreshBackendUsersGlobal} />} />
          <Route path="/reservation/schedule" element={<RoomCalendar users={usersState} rooms={roomsState} meetings={meetings} patients={patientsState} currentUser={currentUser!} onMeetingCreate={handleMeetingCreate} onMeetingUpdate={handleMeetingUpdate} onMeetingDelete={handleMeetingDelete} showWeekends={showWeekends} startHour={startHour} endHour={endHour} />} />
          <Route path="/reservation/menage" element={<RoomsManage rooms={roomsState} onRoomsChange={setRoomsState} userRole={currentUser?.role || 'employee'} onBackendRoomsRefresh={refreshBackendRoomsGlobal} />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/tasks" element={<TasksPage userRole={currentUser?.role || 'employee'} currentUserId={currentUser?.id || ''} />} />
          <Route path="/options" element={<Settings currentUser={currentUser!} token={currentUser?.token || localStorage.getItem('token') || undefined} onUsersRefresh={refreshBackendUsersGlobal} />} />
        </Route>

        {/* Protected mobile route (no desktop layout) */}
        <Route path="/m" element={currentUser ? (
          <MobileMeetings currentUser={currentUser} meetings={meetings} onLogout={handleLogout} rooms={roomsState} />
        ) : (
          <Navigate to="/login" replace />
        )} />

        {/* Redirect root to dashboard if authenticated, else to login */}
        <Route path="/" element={currentUser ? <Navigate to={isMobile ? '/m' : '/dashboard'} /> : <Navigate to="/login" />} />

        {/* 404 route */}
        <Route path="*" element={<NotFound404 isAuthenticated={!!currentUser} />} />
      </Routes>
      </UnsavedChangesProvider>
    </BrowserRouter>
  );
}

export default App;