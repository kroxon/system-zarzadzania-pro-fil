import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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
import { User, Meeting, Room } from './types';
import Settings from './components/Views/Settings';
import {
  saveMeetings,
  loadMeetings,
  loadCurrentUser,
  saveCurrentUser,
  addMeeting,
  updateMeeting,
  deleteMeeting,
  loadRooms,
  saveRooms,
  loadUsers,
  saveUsers,
  loadPatients,
  savePatients,
} from './utils/storage';
import { loadAndApplyDemo, purgeDemo } from './utils/demoData';
// Icons were used in removed view meta; keeping import minimal
import { mapBackendRolesToFrontend } from './utils/roleMapper';
import { fetchEmployees } from './utils/api/employees';
import { getRooms as fetchRooms } from './utils/api/rooms';
import { fetchEvents } from './utils/api/events';
import { getAllEventStasuses } from './utils/api/eventStatuses';
import { fetchPatients } from './utils/api/patients';

function ProtectedLayout({ currentUser, onLogout, children }: { currentUser: any, onLogout: () => void, children?: React.ReactNode }) {
  if (!currentUser) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentView={''}
        userRole={currentUser.role}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          currentUser={currentUser}
          onLogout={onLogout}
          pageTitle={''}
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
  // Toggle to disable local storage and use backend-only data
  const BACKEND_ONLY = true;
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // const [currentView, setCurrentView] = useState('dashboard');
  // Initialize ONLY from persisted storage (no implicit sample fallback)
  const [meetings, setMeetings] = useState<Meeting[]>(() => BACKEND_ONLY ? [] : loadMeetings());
  const [usersState, setUsersState] = useState<User[]>(() => BACKEND_ONLY ? [] : loadUsers());
  const [patientsState, setPatientsState] = useState(() => BACKEND_ONLY ? [] : loadPatients());
  const [roomsState, setRoomsState] = useState<Room[]>(() => BACKEND_ONLY ? [] : loadRooms());
  const [showWeekends, setShowWeekends] = useState(false);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(17);
  // NEW: flag to avoid persisting when syncing backend employees
  const [suppressUsersPersist, setSuppressUsersPersist] = useState(false);
  // NEW: flag to avoid persisting when syncing backend rooms
  const [suppressRoomsPersist, setSuppressRoomsPersist] = useState(false);
  // NEW: flag to avoid persisting when syncing backend patients
  const [suppressPatientsPersist, setSuppressPatientsPersist] = useState(false);

  // Backend events refresh (merge with local for now)
  const refreshBackendEventsGlobal = useCallback(async () => {
    const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
    if (!token) return;
    try {
      // Fetch events, statuses (optional), and patients (for participants split)
      const [apiEvents, statuses, apiPatients] = await Promise.all([
        fetchEvents(token),
        // Statuses are optional; if it fails, continue with defaults
        getAllEventStasuses(token).catch(() => []),
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

      // Build lookup set for employees (specialists)
      const employeeIdSet = new Set<number>();
      try {
        usersState
          .filter(u => u.role === 'employee')
          .forEach(u => { const n = Number(u.id); if (!Number.isNaN(n)) employeeIdSet.add(n); });
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
          // Reguła: jeżeli ID należy do pracowników -> specjalista; jeżeli należy do pacjentów -> pacjent; inaczej ignorujemy do czasu pełnej synchronizacji
          if (employeeIdSet.has(pid)) {
            specNumIds.push(pid);
          } else if (patientIdSet.has(pid)) {
            patientNumIds.push(pid);
          } else {
            // unknown id -> do not classify as patient to avoid fake entries
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
          status: normalizeStatus(ev.statusId),
          createdBy: 'backend',
        } as Meeting;
      });

      if (BACKEND_ONLY) {
        setMeetings(mapped);
        if (!suppressUsersPersist && !suppressRoomsPersist && !suppressPatientsPersist) {
          // do not save to local in backend-only
        }
      } else {
        // Merge strategy: replace all previous backend-sourced meetings (bevt-*) with freshly fetched ones
        setMeetings(prev => {
          const withoutBackend = prev.filter(m => !String(m.id).startsWith('bevt-'));
          const next = [...withoutBackend, ...mapped];
          saveMeetings(next);
          return next;
        });
      }
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
      if (BACKEND_ONLY) {
        setSuppressUsersPersist(true);
        setUsersState(mapped);
      } else {
        const newBackendIds = mapped.map(m => m.id);
        const prevBackendIds: string[] = (() => {
          try { return JSON.parse(localStorage.getItem('schedule_backend_ids') || '[]'); } catch { return []; }
        })();
        setSuppressUsersPersist(true);
        setUsersState(prev => {
          const demoOnly = prev.filter(u => !prevBackendIds.includes(u.id));
          saveUsers(demoOnly);
          return [...demoOnly, ...mapped];
        });
        localStorage.setItem('schedule_backend_ids', JSON.stringify(newBackendIds));
      }
    } finally {
      setSuppressUsersPersist(false);
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
      if (BACKEND_ONLY) {
        setSuppressRoomsPersist(true);
        setRoomsState(mapped);
      } else {
        const newBackendRoomIds = mapped.map(m => m.id);
        const prevBackendRoomIds: string[] = (() => {
          try { return JSON.parse(localStorage.getItem('schedule_backend_room_ids') || '[]'); } catch { return []; }
        })();
        setSuppressRoomsPersist(true);
        setRoomsState(prev => {
          const demoOnly = prev.filter(r => !prevBackendRoomIds.includes(r.id));
          saveRooms(demoOnly);
          return [...demoOnly, ...mapped];
        });
        localStorage.setItem('schedule_backend_room_ids', JSON.stringify(newBackendRoomIds));
      }
    } catch {
      // ignore silently for now
    } finally {
      setSuppressRoomsPersist(false);
    }
  }, [currentUser?.token]);

  // NEW: Reusable backend patients refresh
  const refreshBackendPatientsGlobal = useCallback(async () => {
    const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
    if (!token) return;
    try {
      const apiPatients = await fetchPatients(token);
      // Store as-is (backend Patient shape), do not persist to local demo storage
      setSuppressPatientsPersist(true);
      setPatientsState(apiPatients as any);
    } catch {
      // ignore for now
    } finally {
      setSuppressPatientsPersist(false);
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

  // NEW: Fetch events from backend and merge with local meetings
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
  }, []);

  // Persist rooms on change
  useEffect(()=>{ if (!BACKEND_ONLY && !suppressRoomsPersist) saveRooms(roomsState); },[roomsState, suppressRoomsPersist]);
  // Persist users on change (skip when syncing backend)
  useEffect(()=>{ if (!BACKEND_ONLY && !suppressUsersPersist) saveUsers(usersState); },[usersState, suppressUsersPersist]);
  useEffect(()=>{ if (!BACKEND_ONLY && !suppressPatientsPersist) savePatients(patientsState as any); },[patientsState, suppressPatientsPersist]);
  useEffect(()=>{ if (!BACKEND_ONLY) saveMeetings(meetings); },[meetings]);

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
  };

  const handleMeetingCreate = (meetingData: Omit<Meeting, 'id'>) => {
    const newMeeting: Meeting = {
      ...meetingData,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };
    const updatedMeetings = addMeeting(newMeeting);
    setMeetings(updatedMeetings);
    saveMeetings(updatedMeetings); // ensure persist
  };

  const handleMeetingUpdate = (meetingId: string, updates: Partial<Meeting>) => {
    const updatedMeetings = updateMeeting(meetingId, updates);
    setMeetings(updatedMeetings);
    saveMeetings(updatedMeetings); // ensure persist
  };

  const handleMeetingDelete = (meetingId: string) => {
    const updatedMeetings = deleteMeeting(meetingId);
    setMeetings(updatedMeetings);
    saveMeetings(updatedMeetings); // ensure persist
  };

  const handleAddEmployee = (data: Omit<User, 'id'>) => {
    const newUser: User = { id: Date.now().toString(), ...data };
    setUsersState(prev => {
      const next = [...prev, newUser];
      saveUsers(next); // immediate persist
      return next;
    });
  };

  const handleUpdateEmployee = (id: string, update: Partial<User>) => {
    setUsersState(prev => {
      const next = prev.map(u => u.id === id ? { ...u, ...update } : u);
      saveUsers(next); // immediate persist
      return next;
    });
  };

  const handleDeleteEmployee = (id: string) => {
    setUsersState(prev => {
      const next = prev.filter(u => u.id !== id);
      saveUsers(next); // immediate persist
      return next;
    });
  };

  // const viewMeta: Record<string, { title: string; icon: JSX.Element }> = { ... };


  return (
    <BrowserRouter>
      <Routes>
        {/* Login route, no bars */}
        <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />

        {/* Protected routes */}
        <Route element={<ProtectedLayout currentUser={currentUser} onLogout={handleLogout} />}>
          <Route path="/dashboard" element={<Dashboard users={usersState} rooms={roomsState} meetings={meetings} />} />
          <Route path="/employees/schedule" element={<EmployeeCalendar users={usersState} rooms={roomsState} meetings={meetings} currentUser={currentUser!} onMeetingCreate={handleMeetingCreate} onMeetingUpdate={handleMeetingUpdate} onMeetingDelete={handleMeetingDelete} showWeekends={showWeekends} startHour={startHour} endHour={endHour} patients={patientsState as any} />} />
          <Route path="/employees/menage" element={<EmployeesManage users={usersState} onAdd={handleAddEmployee} onUpdate={handleUpdateEmployee} onDelete={handleDeleteEmployee} onBackendRefresh={refreshBackendUsersGlobal} />} />
          <Route path="/reservation/schedule" element={<RoomCalendar users={usersState} rooms={roomsState} meetings={meetings} patients={patientsState} currentUser={currentUser!} onMeetingCreate={handleMeetingCreate} onMeetingUpdate={handleMeetingUpdate} onMeetingDelete={handleMeetingDelete} showWeekends={showWeekends} startHour={startHour} endHour={endHour} />} />
          <Route path="/reservation/menage" element={<RoomsManage rooms={roomsState} onRoomsChange={setRoomsState} userRole={currentUser?.role || 'employee'} onBackendRoomsRefresh={refreshBackendRoomsGlobal} />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/tasks" element={<TasksPage userRole={currentUser?.role || 'employee'} />} />
          <Route path="/options" element={<Settings showWeekends={showWeekends} setShowWeekends={setShowWeekends} startHour={startHour} setStartHour={setStartHour} endHour={endHour} setEndHour={setEndHour} setUsersState={setUsersState} setRoomsState={setRoomsState} setPatientsState={setPatientsState} setMeetings={setMeetings} loadUsers={loadUsers} loadRooms={loadRooms} loadMeetings={loadMeetings} loadAndApplyDemo={loadAndApplyDemo} purgeDemo={purgeDemo} currentUser={currentUser!} token={currentUser?.token || localStorage.getItem('token') || undefined} />} />
        </Route>

        {/* Redirect root to dashboard if authenticated, else to login */}
        <Route path="/" element={currentUser ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />

        {/* 404 route */}
        <Route path="*" element={<NotFound404 isAuthenticated={!!currentUser} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;