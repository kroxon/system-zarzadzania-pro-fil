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

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    saveCurrentUser(user);
    // Optional: ensure logged user exists in users list if storage empty
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
          </div>
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