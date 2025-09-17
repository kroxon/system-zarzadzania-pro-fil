import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { /* Calendar, */ Users, MapPin, Settings, BarChart3, User, /* ListChecks, */ ClipboardList } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  userRole: 'admin' | 'employee' | 'contact';
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, userRole }) => {
  const navigate = useNavigate();
  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [employeesGroupSelected, setEmployeesGroupSelected] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [roomsGroupSelected, setRoomsGroupSelected] = useState(false);
  const [expanded, setExpanded] = useState(false); // sidebar hover state

  // Base items excluding dashboard and groups
  const otherItems: { id: string; label: string; icon: React.ElementType; roles: Array<'admin' | 'employee' | 'contact'> }[] = [
    // Wyłączone tymczasowo: Kalendarz wspólny
    // { id: 'shared-calendar', label: 'Kalendarz wspólny', icon: Calendar, roles: ['admin', 'employee', 'contact'] },
    // Wyłączone tymczasowo: Quizy
    // { id: 'quizes', label: 'Quizy', icon: ListChecks, roles: ['admin', 'employee', 'contact'] },
    { id: 'tasks', label: 'Zadania', icon: ClipboardList, roles: ['admin', 'employee', 'contact'] },
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
      className={`transition-all duration-300 bg-white shadow-lg border-r border-gray-200 flex flex-col h-full relative ${expanded ? 'w-64' : 'w-16'}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{ minWidth: expanded ? '16rem' : '4rem', overflow: 'hidden' }}
    >
      <div
        className={`flex items-center border-b border-gray-200 transition-all duration-300 justify-center`}
        style={{ height: expanded ? '112px' : '112px' }} // 112px = 7rem, stała wysokość
      >
        <img
          src="/assets/logo/PRO-FIL-removebg-preview.png"
          alt="profil logo"
          className={`transition-all duration-300 ${expanded ? 'w-20' : 'w-10'}`}
        />
      </div>

      <nav className={`flex-1 transition-all duration-300 ${expanded ? 'p-4' : 'p-2'}`}>
  <ul className="space-y-2 flex flex-col">
          {/* Panel główny */}
          <li>
            <button
              onClick={() => { navigate('/dashboard'); setEmployeesGroupSelected(false); setEmployeesOpen(false); setRoomsGroupSelected(false); setRoomsOpen(false); }}
              className={`w-full flex items-center py-3 text-left rounded-lg transition-all duration-200 ${
                currentView === 'dashboard' && !employeesGroupSelected && !roomsGroupSelected
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } px-4 items-center`}
            >
              <BarChart3 className={`h-5 w-5 flex-shrink-0 ${currentView === 'dashboard' && !employeesGroupSelected && !roomsGroupSelected ? 'text-blue-700' : 'text-gray-400'}`} />
              <span
                className={`font-medium ml-3 sidebar-label transition-all duration-300 flex-shrink-0 ${expanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'} whitespace-nowrap`}
                style={{ display: 'inline-block' }}
              >Panel główny</span>
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
                navigate('/employees/schedule');
              }}
              aria-expanded={employeesOpen}
              className={`w-full flex items-center py-3 text-left rounded-lg transition-all duration-200 ${
                employeesActive
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } px-4 items-center`}
            >
              <Users className={`h-5 w-5 flex-shrink-0 ${employeesActive ? 'text-blue-700' : 'text-gray-400'}`} />
              <span
                className={`font-medium flex-1 ml-3 sidebar-label transition-all duration-300 flex-shrink-0 ${expanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'} whitespace-nowrap`}
                style={{ display: 'inline-block' }}
              >Pracownicy Fundacji</span>
            </button>
                {expanded && (
              <div
                className={`mt-1 overflow-hidden transition-all duration-300 ease-in-out ${employeesOpen && expanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <ul className={`space-y-1 pl-0 transition-all duration-300 ${employeesOpen && expanded ? 'opacity-100' : 'opacity-0'}`}>
                  {employeeChildren.map(child => {
                    const active = currentView === child.id;
                    const disabled = child.adminOnly && userRole !== 'admin';
                    return (
                      <li key={child.id}>
                        <button
                          onClick={() => {
                            if (disabled) return;
                            navigate(child.id === 'employee-calendar' ? '/employees/schedule' : '/employees/menage');
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
                navigate('/reservation/schedule');
              }}
              aria-expanded={roomsOpen}
              className={`w-full flex items-center py-3 text-left rounded-lg transition-all duration-200 ${
                roomsActive
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } px-4 items-center`}
            >
              <MapPin className={`h-5 w-5 flex-shrink-0 ${roomsActive ? 'text-blue-700' : 'text-gray-400'}`} />
              <span
                className={`font-medium flex-1 ml-3 sidebar-label transition-all duration-300 flex-shrink-0 ${expanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'} whitespace-nowrap`}
                style={{ display: 'inline-block' }}
              >Rezerwacje sal</span>
            </button>
            {expanded && (
              <div
                className={`mt-1 overflow-hidden transition-all duration-300 ease-in-out ${roomsOpen && expanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <ul className={`space-y-1 pl-0 transition-all duration-300 ${roomsOpen && expanded ? 'opacity-100' : 'opacity-0'}`}>
                  {roomChildren.map(child => {
                    const active = currentView === child.id;
                    const disabled = child.adminOnly && userRole !== 'admin';
                    return (
                      <li key={child.id}>
                        <button
                          onClick={() => {
                            if (disabled) return;
                            navigate(child.id === 'room-calendar' ? '/reservation/schedule' : '/reservation/menage');
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
              onClick={() => { navigate('/patients'); setEmployeesGroupSelected(false); setEmployeesOpen(false); setRoomsGroupSelected(false); setRoomsOpen(false); }}
              className={`w-full flex items-center py-3 text-left rounded-lg transition-all duration-200 ${
                currentView === 'patients' && !roomsGroupSelected && !employeesGroupSelected
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } px-4 items-center`}
            >
              <User className={`h-5 w-5 flex-shrink-0 ${currentView === 'patients' && !roomsGroupSelected && !employeesGroupSelected ? 'text-blue-700' : 'text-gray-400'}`} />
              <span
                className={`font-medium ml-3 sidebar-label transition-all duration-300 flex-shrink-0 ${expanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'} whitespace-nowrap`}
                style={{ display: 'inline-block' }}
              >Podopieczni</span>
            </button>
          </li>

          {availableOther.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id && !employeesGroupSelected && !roomsGroupSelected;
            return (
              <li key={item.id}>
                <button
                  onClick={() => { 
                    navigate(
                      item.id === 'tasks' ? '/tasks' : 
                      item.id === 'settings' ? '/options' : 
                      '/'+item.id
                    );
                    setEmployeesGroupSelected(false); setEmployeesOpen(false); setRoomsGroupSelected(false); setRoomsOpen(false); 
                  }}
                  className={`w-full flex items-center py-3 text-left rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } px-4 items-center`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                  <span
                    className={`font-medium ml-3 sidebar-label transition-all duration-300 flex-shrink-0 ${expanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'} whitespace-nowrap`}
                    style={{ display: 'inline-block' }}
                  >{item.label}</span>
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
            <span
              className={`sidebar-label transition-all duration-300 ${expanded ? 'opacity-100' : 'opacity-0'} w-24 whitespace-nowrap inline-block`}
            >Obecny</span>
          </div>
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span
              className={`sidebar-label transition-all duration-300 ${expanded ? 'opacity-100' : 'opacity-0'} w-24 whitespace-nowrap inline-block`}
            >W toku</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span
              className={`sidebar-label transition-all duration-300 ${expanded ? 'opacity-100' : 'opacity-0'} w-24 whitespace-nowrap inline-block`}
            >Odwołany</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;