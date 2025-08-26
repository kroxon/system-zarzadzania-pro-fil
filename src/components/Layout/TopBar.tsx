import React from 'react';
import { User, LogOut, Bell } from 'lucide-react';

interface TopBarProps {
  currentUser: {
    name: string;
    role: 'admin' | 'employee';
  };
  onLogout: () => void;
  pageTitle: string; // NEW
  pageIcon?: React.ReactNode; // optional icon
}

const TopBar: React.FC<TopBarProps> = ({ currentUser, onLogout, pageTitle, pageIcon }) => {
  const getRoleName = (role: string) => {
    return role === 'admin' ? 'Administrator' : 'Pracownik';
  };

  return (
    <div className="topbar">
      <div className="topbar__left">
        {pageIcon && <span className="nav-btn__icon">{pageIcon}</span>}
        <h1 className="topbar__title">{pageTitle}</h1>
      </div>
      <div className="topbar__user">
        <button className="icon-btn notification-btn" title="Powiadomienia">
          <Bell className="h-5 w-5" />
          <span className="badge-dot"></span>
        </button>
        <div className="topbar__user">
          <div className="user-info">
            <p className="user-info__name">{currentUser.name}</p>
            <p className="user-info__role">{getRoleName(currentUser.role)}</p>
          </div>
          <div className="avatar">
            <User className="h-4 w-4 text-blue-600" />
          </div>
        </div>
        <button
          onClick={onLogout}
          className="icon-btn icon-btn--danger"
          title="Wyloguj"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default TopBar;