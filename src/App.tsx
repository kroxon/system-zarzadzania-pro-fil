import { useState, useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import Dashboard from './components/Views/Dashboard';
import SharedCalendar from './components/Views/SharedCalendar';
import EmployeeCalendar from './components/Views/EmployeeCalendar';
import RoomCalendar from './components/Views/RoomCalendar';
import LoginForm from './components/Auth/LoginForm';
import EmployeesManage from './components/Views/EmployeesManage';
import Patients from './components/Views/Patients';
import RoomsManage from './components/Views/RoomsManage';
import QuizzesPage from './components/Quizes/QuizList';
import TasksPage from './components/Tasks/TasksPage';
import { User, Meeting, Room } from './types';
import Settings from './components/Views/Settings';
import { 
  saveMeetings, 
  loadMeetings, 
  saveCurrentUser, 
  loadCurrentUser,
  addMeeting,
  updateMeeting,
  deleteMeeting,
  loadRooms,
  saveRooms,
  loadUsers,
  saveUsers,
  loadPatients,
  savePatients
} from './utils/storage';
import { loadAndApplyDemo, purgeDemo } from './utils/demoData';
import { BarChart3, Users, Calendar as CalendarIcon, MapPin, User as UserIcon, Settings as SettingsIcon, ListChecks, ClipboardList } from 'lucide-react';
import { mapBackendRolesToFrontend } from './utils/roleMapper';

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

  // Only restore current user (do NOT overwrite entity states)
  useEffect(() => {
    const storedUser = loadCurrentUser();
    if (storedUser) setCurrentUser(storedUser);
  }, []);

  // Persist rooms on change
  useEffect(()=>{ saveRooms(roomsState); },[roomsState]);
  useEffect(()=>{ saveUsers(usersState); },[usersState]);
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
      setUsersState(prev => prev.some(u=>u.id===frontendUser.id) ? prev : [...prev, frontendUser]);
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

  if (!currentUser) {
    return <LoginForm onLogin={handleLogin} onLoginSuccess={() => setCurrentView('dashboard')} />;
  }

  const renderCurrentView = () => {
    const commonProps = {
      users: usersState,
      rooms: roomsState,
      meetings,
      patients: patientsState,
      currentUser,
      onMeetingCreate: handleMeetingCreate,
      onMeetingUpdate: handleMeetingUpdate,
      onMeetingDelete: handleMeetingDelete,
      showWeekends,
      startHour,
      endHour
    };

    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            users={usersState}
            rooms={roomsState}
            meetings={meetings}
          />
        );
      case 'shared-calendar':
        return <SharedCalendar {...commonProps} />;
      case 'employee-calendar':
        return <EmployeeCalendar {...commonProps} />;
      case 'room-calendar':
        return <RoomCalendar {...commonProps} />;
      case 'rooms-manage':
        return <RoomsManage rooms={roomsState} onRoomsChange={setRoomsState} userRole={currentUser!.role} />;
      case 'employees-manage':
        return <EmployeesManage users={usersState} onAdd={handleAddEmployee} onUpdate={handleUpdateEmployee} onDelete={handleDeleteEmployee} />;
      case 'patients':
        return <Patients />;
      case 'settings':
        return (
          <Settings
            showWeekends={showWeekends}
            setShowWeekends={setShowWeekends}
            startHour={startHour}
            setStartHour={setStartHour}
            endHour={endHour}
            setEndHour={setEndHour}
            setUsersState={setUsersState}
            setRoomsState={setRoomsState}
            setPatientsState={setPatientsState}
            setMeetings={setMeetings}
            loadUsers={loadUsers}
            loadRooms={loadRooms}
            loadMeetings={loadMeetings}
            loadAndApplyDemo={loadAndApplyDemo}
            purgeDemo={purgeDemo}
            currentUser={currentUser}
            token={currentUser?.token || localStorage.getItem('token') || undefined}
          />
        );
      case 'quizes':
        return <QuizzesPage />;
      case 'tasks':
        return <TasksPage userRole={currentUser!.role} />;
      default:
        return <Dashboard users={usersState} rooms={roomsState} meetings={meetings} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        userRole={currentUser!.role}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          currentUser={currentUser!}
          onLogout={handleLogout}
          pageTitle={(viewMeta[currentView]?.title) || ''}
          pageIcon={viewMeta[currentView]?.icon}
        />
        
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className={`p-6 flex-1 flex flex-col ${currentView==='room-calendar' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {renderCurrentView()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;