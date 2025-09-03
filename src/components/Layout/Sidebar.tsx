import React, { useState } from 'react';
import { Calendar, Users, MapPin, Settings, BarChart3, User, ListChecks, ClipboardList } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  userRole: 'admin' | 'employee';
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, userRole }) => {
  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [employeesGroupSelected, setEmployeesGroupSelected] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [roomsGroupSelected, setRoomsGroupSelected] = useState(false);
  const [expanded, setExpanded] = useState(false); // sidebar hover state
  const [showLabels, setShowLabels] = useState(false); // opóźnione wyświetlanie napisów

  React.useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (expanded) {
  timeout = setTimeout(() => setShowLabels(true), 200); // czas animacji = 200ms
    } else {
      setShowLabels(false);
    }
    return () => clearTimeout(timeout);
  }, [expanded]);

  // Base items excluding dashboard and groups
  const otherItems: { id: string; label: string; icon: React.ElementType; roles: Array<'admin' | 'employee'> }[] = [
    { id: 'shared-calendar', label: 'Kalendarz wspólny', icon: Calendar, roles: ['admin', 'employee'] },
    { id: 'quizes', label: 'Quizy', icon: ListChecks, roles: ['admin', 'employee'] },
    { id: 'tasks', label: 'Zadania', icon: ClipboardList, roles: ['admin', 'employee'] },
    { id: 'settings', label: 'Ustawienia', icon: Settings, roles: ['admin'] }
  ];
  const availableOther = otherItems.filter(i => i.roles.includes(userRole));

  const employeeChildren = [
    { id: 'employee-calendar', label: 'Grafiki', adminOnly: false },
    { id: 'employees-manage', label: 'Zarządzaj pracownikami', adminOnly: true }
  ];

  // NEW room children
  const roomChildren = [
    { id: 'room-calendar', label: 'Grafiki', adminOnly: false },
    { id: 'rooms-manage', label: 'Zarządzanie salami', adminOnly: true }
  ];

  const isEmployeeChildActive = employeeChildren.some(c => c.id === currentView);
  const employeesActive = employeesGroupSelected || isEmployeeChildActive;
  const isRoomChildActive = roomChildren.some(c => c.id === currentView);
  const roomsActive = roomsGroupSelected || isRoomChildActive;

  return (
    <div
      className={`transition-all duration-300 bg-white shadow-lg border-r border-gray-200 flex flex-col h-full ${expanded ? 'w-64' : 'w-16'}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{ minWidth: expanded ? '16rem' : '4rem' }}
    >
      <div
        className={`flex items-center border-b border-gray-200 transition-all duration-300 justify-center`}
        style={{ height: expanded ? '112px' : '112px' }} // 112px = 7rem, stała wysokość
      >
        <img
          src="src/assets/logo/PRO-FIL-removebg-preview.png"
          alt="profil logo"
          className={`transition-all duration-300 ${expanded ? 'w-20' : 'w-10'}`}
        />
      </div>

      <nav className={`flex-1 transition-all duration-300 ${expanded ? 'p-4' : 'p-2'}`}>
        <ul className="space-y-2 flex flex-col">
          {/* Panel główny */}
          <li>
            <button
              onClick={() => { onViewChange('dashboard'); setEmployeesGroupSelected(false); setEmployeesOpen(false); setRoomsGroupSelected(false); setRoomsOpen(false); }}
              className={`w-full flex items-center py-3 text-left rounded-lg transition-all duration-200 ${
                currentView === 'dashboard' && !employeesGroupSelected && !roomsGroupSelected
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${expanded ? 'px-4' : 'px-2'} items-center`}
            >
              <BarChart3 className={`h-5 w-5 ${currentView === 'dashboard' && !employeesGroupSelected && !roomsGroupSelected ? 'text-blue-700' : 'text-gray-400'}`} />
              {showLabels && <span className="font-medium ml-3">Panel główny</span>}
            </button>
          </li>

          {/* Pracownicy Fundacji */}
          <li>
            <button
              onClick={() => {
                setEmployeesOpen(o => !o);
                setEmployeesGroupSelected(true);
                setRoomsGroupSelected(false);
                setRoomsOpen(false);
                const target = 'employee-calendar';
                if (currentView !== target) onViewChange(target);
              }}
              aria-expanded={employeesOpen}
              className={`w-full flex items-center py-3 text-left rounded-lg transition-all duration-200 ${
                employeesActive
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${expanded ? 'px-4' : 'px-2'} items-center`}
            >
              <Users className={`h-5 w-5 ${employeesActive ? 'text-blue-700' : 'text-gray-400'}`} />
              {showLabels && <span className="font-medium flex-1 ml-3">Pracownicy Fundacji</span>}
            </button>
              {showLabels && (
              <div
                className={`mt-1 overflow-hidden transition-all duration-300 ease-in-out ${
                  employeesOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <ul className={`space-y-1 pl-0 transition-all duration-300 ${employeesOpen ? 'opacity-100' : 'opacity-0'}`}>
                  {employeeChildren.map(child => {
                    const active = currentView === child.id;
                    const disabled = child.adminOnly && userRole !== 'admin';
                    return (
                      <li key={child.id}>
                        <button
                          onClick={() => {
                            if (disabled) return;
                            onViewChange(child.id);
                            setEmployeesGroupSelected(true);
                          }}
                          disabled={disabled}
                          className={`w-full flex items-center pl-11 pr-4 py-2 text-left rounded-md text-sm transition-colors ${
                            disabled
                              ? 'text-gray-300 cursor-not-allowed'
                              : active
                                ? 'text-blue-700 font-medium'
                                : 'text-gray-600 hover:text-blue-600'
                          }`}
                        >
                          <span>{child.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>

          {/* Rezerwacje sal (submenu) */}
          <li>
            <button
              onClick={() => {
                setRoomsOpen(o => !o);
                setRoomsGroupSelected(true);
                setEmployeesGroupSelected(false);
                setEmployeesOpen(false);
                const target = 'room-calendar';
                if (currentView !== target) onViewChange(target);
              }}
              aria-expanded={roomsOpen}
              className={`w-full flex items-center py-3 text-left rounded-lg transition-all duration-200 ${
                roomsActive
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${expanded ? 'px-4' : 'px-2'} items-center`}
            >
              <MapPin className={`h-5 w-5 ${roomsActive ? 'text-blue-700' : 'text-gray-400'}`} />
              {showLabels && <span className="font-medium flex-1 ml-3">Rezerwacje sal</span>}
            </button>
            {expanded && (
              <div
                className={`mt-1 overflow-hidden transition-all duration-300 ease-in-out ${
                  roomsOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <ul className={`space-y-1 pl-0 transition-all duration-300 ${roomsOpen ? 'opacity-100' : 'opacity-0'}`}>
                  {roomChildren.map(child => {
                    const active = currentView === child.id;
                    const disabled = child.adminOnly && userRole !== 'admin';
                    return (
                      <li key={child.id}>
                        <button
                          onClick={() => {
                            if (disabled) return;
                            onViewChange(child.id);
                            setRoomsGroupSelected(true);
                          }}
                          disabled={disabled}
                          className={`w-full flex items-center pl-11 pr-4 py-2 text-left rounded-md text-sm transition-colors ${
                            disabled
                              ? 'text-gray-300 cursor-not-allowed'
                              : active
                                ? 'text-blue-700 font-medium'
                                : 'text-gray-600 hover:text-blue-600'
                          }`}
                        >
                          <span>{child.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>

          {/* Podopieczni */}
          <li>
            <button
              onClick={() => { onViewChange('patients'); setEmployeesGroupSelected(false); setEmployeesOpen(false); setRoomsGroupSelected(false); setRoomsOpen(false); }}
              className={`w-full flex items-center py-3 text-left rounded-lg transition-all duration-200 ${
                currentView === 'patients' && !roomsGroupSelected && !employeesGroupSelected
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${expanded ? 'px-4' : 'px-2'} items-center`}
            >
              <User className={`h-5 w-5 ${currentView === 'patients' && !roomsGroupSelected && !employeesGroupSelected ? 'text-blue-700' : 'text-gray-400'}`} />
              {showLabels && <span className="font-medium ml-3">Podopieczni</span>}
            </button>
          </li>

          {availableOther.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id && !employeesGroupSelected && !roomsGroupSelected;
            return (
              <li key={item.id}>
                <button
                  onClick={() => { onViewChange(item.id); setEmployeesGroupSelected(false); setEmployeesOpen(false); setRoomsGroupSelected(false); setRoomsOpen(false); }}
                  className={`w-full flex items-center py-3 text-left rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } ${expanded ? 'px-4' : 'px-2'} items-center`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                  {showLabels && <span className="font-medium ml-3">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={`border-t border-gray-200 transition-all duration-300 ${expanded ? 'p-4' : 'p-2'}`}>
        <div className="text-xs text-gray-500">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            {showLabels && <span>Obecny</span>}
          </div>
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            {showLabels && <span>W toku</span>}
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            {showLabels && <span>Odwołany</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;