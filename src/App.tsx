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
import { BarChart3, Users, Calendar as CalendarIcon, MapPin, User as UserIcon, Settings as SettingsIcon } from 'lucide-react';

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
    'settings': { title: 'Ustawienia', icon: <SettingsIcon className="h-6 w-6" /> }
  };

  if (!currentUser) {
    return <LoginForm onLogin={handleLogin} />;
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
            <div className="card">
              <h3 className="card__title">Ustawienia kalendarza</h3>
              <div className="form-inline mb-6">
                <input
                  id="showWeekends"
                  type="checkbox"
                  checked={showWeekends}
                  onChange={(e) => setShowWeekends(e.target.checked)}
                  className="form-checkbox mt-1"
                />
                <label htmlFor="showWeekends" className="checkbox-label">
                  Pokazuj soboty i niedziele w widoku tygodnia oraz uwzględniaj je przy nawigacji dni (domyślnie ukryte)
                </label>
              </div>
              <div className="form-grid" style={{gridTemplateColumns:'repeat(3,1fr)', gap:'16px'}}>
                <div className="form-group">
                  <label className="form-label">Godzina otwarcia</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={startHour}
                    onChange={(e) => setStartHour(Math.min(Math.max(0, Number(e.target.value)), endHour-1))}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Godzina zamknięcia</label>
                  <input
                    type="number"
                    min={startHour+1}
                    max={24}
                    value={endHour}
                    onChange={(e) => setEndHour(Math.max(startHour+1, Math.min(24, Number(e.target.value))))}
                    className="form-input"
                  />
                </div>
                <div className="form-group" style={{display:'flex', alignItems:'flex-end'}}>
                  <div className="small-muted" style={{lineHeight:'1.3'}}>
                    Zakres generuje sloty co 30 min. Ostatni slot kończy się dokładnie o godzinie zamknięcia.
                  </div>
                </div>
              </div>
              <div className="divider-t space-y-4">
                <h4 className="text-sm font-semibold text-gray-800">Dane demonstracyjne</h4>
                <div className="demo-actions">
                  <button onClick={()=>{
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
                  }} className="btn btn-primary">Wygeneruj dane (3 tygodnie)</button>
                  <button onClick={()=>{
                    if(!confirm('Usunąć wszystkie dane demonstracyjne?')) return;
                    purgeDemo();
                    setMeetings([]);
                    setRoomsState([]);
                    setUsersState([] as any);
                    setPatientsState([] as any);
                    localStorage.removeItem('schedule_current_user');
                  }} className="btn btn-danger">Wyczyść dane</button>
                </div>
                <p className="small-muted">Generuje 5 sal, 7 terapeutów, 20 podopiecznych i spotkania (pon-pt) dla ubiegłego, bieżącego i przyszłego tygodnia. Dane można następnie edytować.</p>
              </div>
            </div>
            <div className="card">
              <p className="text-gray-500" style={{textAlign:'center', padding:'32px 0'}}>Dodatkowe ustawienia będą dostępne w przyszłych wersjach</p>
            </div>
          </div>
        );
      default:
        return <Dashboard users={usersState} rooms={roomsState} meetings={meetings} />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        userRole={currentUser!.role}
      />
      <div className="main">
        <TopBar
          currentUser={currentUser!}
          onLogout={handleLogout}
          pageTitle={(viewMeta[currentView]?.title) || ''}
          pageIcon={viewMeta[currentView]?.icon}
        />
        <main className="main__scroll">
          <div className={`p-6 flex-1 flex flex-col ${currentView==='room-calendar' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {renderCurrentView()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;