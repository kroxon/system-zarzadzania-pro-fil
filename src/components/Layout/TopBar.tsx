import React from 'react';
import { User, LogOut, Bell } from 'lucide-react';

interface TopBarProps {
  currentUser: {
    name: string;
  role: 'admin' | 'employee' | 'contact';
  };
  onLogout: () => void;
  pageTitle: string; // NEW
  pageIcon?: React.ReactNode; // optional icon
}

const TopBar: React.FC<TopBarProps> = ({ currentUser, onLogout, pageTitle, pageIcon }) => {
  // Używaj tylko currentUser.role
  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'contact':
        return 'Kontakt';
      case 'employee':
        return 'Pracownik';
      default:
        return 'Pracownik';
    }
  };

  return (
    <div className="h-16 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center space-x-3">
        {pageIcon && <span className="text-gray-700">{pageIcon}</span>}
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">{pageTitle}</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title="Powiadomienia">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
        </button>
        
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
            <p className="text-xs text-gray-500">{getRoleName(currentUser.role)}</p>
          </div>
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-blue-600" />
          </div>
        </div>
        
        <button
          onClick={onLogout}
          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Wyloguj"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default TopBar;