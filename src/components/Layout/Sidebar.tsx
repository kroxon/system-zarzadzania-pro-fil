import React, { useState } from 'react';
import { Calendar, Users, MapPin, Settings, BarChart3, User } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  userRole: 'admin' | 'employee';
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, userRole }) => {
  const [employeesOpen, setEmployeesOpen] = useState(false); // was true, now collapsed by default
  const [employeesGroupSelected, setEmployeesGroupSelected] = useState(false);

  // Base items excluding dashboard (handled separately at top) and patients (inserted after employees)
  const otherItems: { id: string; label: string; icon: any; roles: Array<'admin' | 'employee'> }[] = [
    { id: 'shared-calendar', label: 'Kalendarz wspólny', icon: Calendar, roles: ['admin', 'employee'] },
    { id: 'room-calendar', label: 'Rezerwacje sal', icon: MapPin, roles: ['admin', 'employee'] },
    { id: 'settings', label: 'Ustawienia', icon: Settings, roles: ['admin'] }
  ];
  const availableOther = otherItems.filter(i => i.roles.includes(userRole));

  const employeeChildren = [
    { id: 'employee-calendar', label: 'Grafiki', adminOnly: false },
    { id: 'employees-manage', label: 'Zarządzaj pracownikami', adminOnly: true }
  ];

  const isEmployeeChildActive = employeeChildren.some(c => c.id === currentView);
  const employeesActive = employeesGroupSelected || isEmployeeChildActive;

  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">Grafik Pracowników</h1>
        <p className="text-sm text-gray-500 mt-1">System zarządzania</p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {/* Panel główny */}
          <li>
            <button
              onClick={() => { onViewChange('dashboard'); setEmployeesGroupSelected(false); setEmployeesOpen(false); }}
              className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                currentView === 'dashboard' && !employeesGroupSelected
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <BarChart3 className={`mr-3 h-5 w-5 ${currentView === 'dashboard' && !employeesGroupSelected ? 'text-blue-700' : 'text-gray-400'}`} />
              <span className="font-medium">Panel główny</span>
            </button>
          </li>

          {/* Pracownicy Fundacji */}
          <li>
            <button
              onClick={() => {
                setEmployeesOpen(o => !o);
                setEmployeesGroupSelected(true);
                const target = 'employee-calendar'; // default to schedules for all roles
                if (currentView !== target) onViewChange(target);
              }}
              aria-expanded={employeesOpen}
              className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                employeesActive
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Users className={`mr-3 h-5 w-5 ${employeesActive ? 'text-blue-700' : 'text-gray-400'}`} />
              <span className="font-medium flex-1">Pracownicy Fundacji</span>
            </button>
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
          </li>

          {/* Podopieczni */}
          <li>
            <button
              onClick={() => { onViewChange('patients'); setEmployeesGroupSelected(false); setEmployeesOpen(false); }}
              className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                currentView === 'patients'
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <User className={`mr-3 h-5 w-5 ${currentView === 'patients' ? 'text-blue-700' : 'text-gray-400'}`} />
              <span className="font-medium">Podopieczni</span>
            </button>
          </li>

          {availableOther.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id && !employeesGroupSelected;
            return (
              <li key={item.id}>
                <button
                  onClick={() => { onViewChange(item.id); setEmployeesGroupSelected(false); setEmployeesOpen(false); }}
                  className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Obecny</span>
          </div>
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>W toku</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Odwołany</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;