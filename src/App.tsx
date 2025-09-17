import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
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
import { User, Meeting, Room, Patient } from './types';
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
import { BarChart3, Users, Calendar as CalendarIcon, MapPin, User as UserIcon, Settings as SettingsIcon, ListChecks, ClipboardList } from 'lucide-react';
import { mapBackendRolesToFrontend } from './utils/roleMapper';
import { fetchEmployees } from './utils/api/employees';
import { getRooms as fetchRooms } from './utils/api/rooms';

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  // Initialize ONLY from persisted storage (no implicit sample fallback)
  const [meetings, setMeetings] = useState<Meeting[]>(() => loadMeetings());
  const [usersState, setUsersState] = useState<User[]>(() => loadUsers());
  const [patientsState, setPatientsState] = useState(() => loadPatients());
  const [roomsState, setRoomsState] = useState<Room[]>(() => loadRooms());
  const [showWeekends, setShowWeekends] = useState(false);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(17);
  // NEW: flag to avoid persisting when syncing backend employees
  const [suppressUsersPersist, setSuppressUsersPersist] = useState(false);
  // NEW: flag to avoid persisting when syncing backend rooms
  const [suppressRoomsPersist, setSuppressRoomsPersist] = useState(false);

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
    } catch {
      // ignore silently for now
    } finally {
      setSuppressRoomsPersist(false);
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

  // Only restore current user (do NOT overwrite entity states)
  useEffect(() => {
    const storedUser = loadCurrentUser();
    if (storedUser) setCurrentUser(storedUser);
  }, []);

  // Persist rooms on change
  useEffect(()=>{ if (!suppressRoomsPersist) saveRooms(roomsState); },[roomsState, suppressRoomsPersist]);
  // Persist users on change (skip when syncing backend)
  useEffect(()=>{ if (!suppressUsersPersist) saveUsers(usersState); },[usersState, suppressUsersPersist]);
  useEffect(()=>{ savePatients(patientsState); },[patientsState]);
  useEffect(()=>{ saveMeetings(meetings); },[meetings]);

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
    setCurrentView('dashboard');
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

  const viewMeta: Record<string, { title: string; icon: JSX.Element }> = {
    'dashboard': { title: 'Panel główny', icon: <BarChart3 className="h-6 w-6" /> },
    'shared-calendar': { title: 'Kalendarz wspólny', icon: <CalendarIcon className="h-6 w-6" /> },
    'employee-calendar': { title: 'Grafiki pracowników', icon: <Users className="h-6 w-6" /> },
    'room-calendar': { title: 'Rezerwacje sal', icon: <MapPin className="h-6 w-6" /> },
    'employees-manage': { title: 'Zarządzaj pracownikami', icon: <Users className="h-6 w-6" /> },
    'patients': { title: 'Podopieczni', icon: <UserIcon className="h-6 w-6" /> },
    'settings': { title: 'Ustawienia', icon: <SettingsIcon className="h-6 w-6" /> },
    'quizes': { title: 'Quizy', icon: <ListChecks className="h-6 w-6" /> },
    'tasks': { title: 'Zadania', icon: <ClipboardList className="h-6 w-6" /> },
  };


  return (
    <BrowserRouter>
      <Routes>
        {/* Login route, no bars */}
        <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />

        {/* Protected routes */}
        <Route element={<ProtectedLayout currentUser={currentUser} onLogout={handleLogout} />}>
          <Route path="/dashboard" element={<Dashboard users={usersState} rooms={roomsState} meetings={meetings} />} />
          <Route path="/employees/schedule" element={<EmployeeCalendar users={usersState} rooms={roomsState} meetings={meetings} currentUser={currentUser!} onMeetingCreate={handleMeetingCreate} onMeetingUpdate={handleMeetingUpdate} onMeetingDelete={handleMeetingDelete} showWeekends={showWeekends} startHour={startHour} endHour={endHour} />} />
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