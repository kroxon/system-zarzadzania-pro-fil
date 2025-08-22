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
import { User, Meeting } from './types';
import { sampleUsers, sampleRooms, sampleMeetings } from './data/sampleData';
import { 
  saveMeetings, 
  loadMeetings, 
  saveCurrentUser, 
  loadCurrentUser,
  addMeeting,
  updateMeeting,
  deleteMeeting
} from './utils/storage';
import { BarChart3, Users, Calendar as CalendarIcon, MapPin, User as UserIcon, Settings as SettingsIcon } from 'lucide-react';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [usersState, setUsersState] = useState(sampleUsers);
  const [showWeekends, setShowWeekends] = useState(false); // global setting
  const [startHour, setStartHour] = useState(8); // NEW opening hours start
  const [endHour, setEndHour] = useState(17);   // NEW opening hours end (closing time)

  // Inicjalizacja danych przy pierwszym uruchomieniu
  useEffect(() => {
    const storedUser = loadCurrentUser();
    const storedMeetings = loadMeetings();

    if (storedUser) {
      setCurrentUser(storedUser);
    }

    if (storedMeetings.length > 0) {
      setMeetings(storedMeetings);
    } else {
      // Jeśli nie ma danych, użyj przykładowych
      setMeetings(sampleMeetings);
      saveMeetings(sampleMeetings);
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    saveCurrentUser(user);
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
  };

  const handleMeetingUpdate = (meetingId: string, updates: Partial<Meeting>) => {
    const updatedMeetings = updateMeeting(meetingId, updates);
    setMeetings(updatedMeetings);
  };

  const handleMeetingDelete = (meetingId: string) => {
    const updatedMeetings = deleteMeeting(meetingId);
    setMeetings(updatedMeetings);
  };

  const handleAddEmployee = (data: Omit<User, 'id'>) => {
    const newUser: User = { id: Date.now().toString(), ...data };
    setUsersState(prev => [...prev, newUser]);
  };

  const handleUpdateEmployee = (id: string, update: Partial<User>) => {
    setUsersState(prev => prev.map(u => u.id === id ? { ...u, ...update } : u));
  };

  const handleDeleteEmployee = (id: string) => {
    setUsersState(prev => prev.filter(u => u.id !== id));
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
      rooms: sampleRooms,
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
            users={sampleUsers}
            rooms={sampleRooms}
            meetings={meetings}
          />
        );
      case 'shared-calendar':
        return <SharedCalendar {...commonProps} />;
      case 'employee-calendar':
        return <EmployeeCalendar {...commonProps} />;
      case 'room-calendar':
        return <RoomCalendar {...commonProps} />;
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
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-gray-500 text-center py-8">Dodatkowe ustawienia będą dostępne w przyszłych wersjach</p>
            </div>
          </div>
        );
      default:
        return <Dashboard users={sampleUsers} rooms={sampleRooms} meetings={meetings} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        userRole={currentUser.role}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          currentUser={currentUser}
          onLogout={handleLogout}
          pageTitle={viewMeta[currentView]?.title || ''}
          pageIcon={viewMeta[currentView]?.icon}
        />
        
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {renderCurrentView()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;