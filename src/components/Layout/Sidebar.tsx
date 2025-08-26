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
  const [roomsOpen, setRoomsOpen] = useState(false); // NEW state for rooms submenu
  const [roomsGroupSelected, setRoomsGroupSelected] = useState(false);

  // Base items excluding dashboard and groups
  const otherItems: { id: string; label: string; icon: any; roles: Array<'admin' | 'employee'> }[] = [
    { id: 'shared-calendar', label: 'Kalendarz wspólny', icon: Calendar, roles: ['admin', 'employee'] },
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
    <div className="sidebar">
      <div className="sidebar__header">
        <h1 className="sidebar__title">Grafik Pracowników</h1>
        <p className="sidebar__subtitle">System zarządzania</p>
      </div>

      <nav className="sidebar__nav">
        <ul className="sidebar-menu" style={{display:'flex', flexDirection:'column', gap:'8px'}}>
          {/* Panel główny */}
          <li>
            <button
              onClick={() => { onViewChange('dashboard'); setEmployeesGroupSelected(false); setEmployeesOpen(false); setRoomsGroupSelected(false); setRoomsOpen(false); }}
              className={`nav-btn ${currentView === 'dashboard' && !employeesGroupSelected && !roomsGroupSelected ? 'nav-btn--active' : ''}`}
            >
              <BarChart3 className="nav-btn__icon" />
              <span>Panel główny</span>
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
              className={`nav-btn ${employeesActive ? 'nav-btn--active' : ''}`}
            >
              <Users className="nav-btn__icon" />
              <span style={{flex:1}}>Pracownicy Fundacji</span>
            </button>
            <div className="submenu" style={{maxHeight: employeesOpen ? '160px' : '0', opacity: employeesOpen ? 1:0}}>
              <ul className="submenu-items" style={{opacity: employeesOpen ? 1:0}}>
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
                        className={`submenu-item-btn ${active ? 'submenu-item-btn--active' : ''} ${disabled ? 'is-disabled' : ''}`}
                      >
                        <span>{child.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
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
              className={`nav-btn ${roomsActive ? 'nav-btn--active' : ''}`}
            >
              <MapPin className="nav-btn__icon" />
              <span style={{flex:1}}>Rezerwacje sal</span>
            </button>
            <div className="submenu" style={{maxHeight: roomsOpen ? '160px' : '0', opacity: roomsOpen ? 1:0}}>
              <ul className="submenu-items" style={{opacity: roomsOpen ? 1:0}}>
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
                        className={`submenu-item-btn ${active ? 'submenu-item-btn--active' : ''} ${disabled ? 'is-disabled' : ''}`}
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
              onClick={() => { onViewChange('patients'); setEmployeesGroupSelected(false); setEmployeesOpen(false); setRoomsGroupSelected(false); setRoomsOpen(false); }}
              className={`nav-btn ${currentView === 'patients' && !roomsGroupSelected && !employeesGroupSelected ? 'nav-btn--active' : ''}`}
            >
              <User className="nav-btn__icon" />
              <span>Podopieczni</span>
            </button>
          </li>

          {availableOther.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id && !employeesGroupSelected && !roomsGroupSelected;
            return (
              <li key={item.id}>
                <button
                  onClick={() => { onViewChange(item.id); setEmployeesGroupSelected(false); setEmployeesOpen(false); setRoomsGroupSelected(false); setRoomsOpen(false); }}
                  className={`nav-btn ${isActive ? 'nav-btn--active' : ''}`}
                >
                  <Icon className="nav-btn__icon" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar__footer">
        <div className="status-legend">
          <div className="status-row"><div className="status-dot status-dot--green"></div><span>Obecny</span></div>
          <div className="status-row"><div className="status-dot status-dot--yellow"></div><span>W toku</span></div>
          <div className="status-row"><div className="status-dot status-dot--red"></div><span>Odwołany</span></div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;