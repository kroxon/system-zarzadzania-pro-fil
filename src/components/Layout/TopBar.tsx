import React from 'react';
import { User, LogOut, Bell } from 'lucide-react';
import { useUnsavedChangesGuard } from '../common/UnsavedChangesGuard';
import { fetchEmployeeTasks } from '../../utils/api/tasks';
import { fetchPendingUsers } from '../../utils/api/admin';
import type { EmployeeTask, PendingUser } from '../../types';

interface TopBarProps {
  currentUser: {
    id?: string | number;
    name: string;
    role: 'admin' | 'employee' | 'contact';
    token?: string;
  };
  onLogout: () => void;
  pageTitle: string; // NEW
  pageIcon?: React.ReactNode; // optional icon
}

const TopBar: React.FC<TopBarProps> = ({ currentUser, onLogout, pageTitle, pageIcon }) => {
  const { attempt } = useUnsavedChangesGuard();
  const [hasNotifications, setHasNotifications] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    const resolveToken = () => {
      if (currentUser?.token) return currentUser.token;
      const storedToken = localStorage.getItem('token');
      if (storedToken) return storedToken;
      try {
        const raw = localStorage.getItem('schedule_current_user');
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        return parsed?.token;
      } catch {
        return undefined;
      }
    };

    const resolveUserId = () => {
      if (currentUser?.id != null) {
        const parsed = Number(currentUser.id);
        if (!Number.isNaN(parsed)) return parsed;
      }
      try {
        const raw = localStorage.getItem('schedule_current_user');
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        const id = parsed?.id;
        const numeric = Number(id);
        return Number.isNaN(numeric) ? undefined : numeric;
      } catch {
        return undefined;
      }
    };

    const load = async () => {
      const token = resolveToken();
      const userId = resolveUserId();
      if (!token || userId == null) {
        if (active) setHasNotifications(false);
        return;
      }

      try {
        const tasksPromise: Promise<EmployeeTask[]> = fetchEmployeeTasks(token).catch(() => []);
        const pendingPromise: Promise<PendingUser[]> = currentUser.role === 'admin'
          ? fetchPendingUsers(token).catch(() => [])
          : Promise.resolve([]);

        const [tasks, pending] = await Promise.all([tasksPromise, pendingPromise]);

        const hasIncompleteAssignedTask = tasks.some(task => {
          if (task.isCompleted) return false;
          if (!Array.isArray(task.assignedEmployeesIds)) return false;
          return task.assignedEmployeesIds.some(id => Number(id) === userId);
        });

        const hasPendingApprovals = currentUser.role === 'admin' && pending.length > 0;

        if (active) {
          setHasNotifications(hasIncompleteAssignedTask || hasPendingApprovals);
        }
      } catch {
        if (active) setHasNotifications(false);
      }
    };

    load();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        load();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleExternalRefresh = () => {
      load();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('app:notificationsRefresh', handleExternalRefresh);
    }

    const intervalId = window.setInterval(load, 60000);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
      if (typeof window !== 'undefined') {
        window.removeEventListener('app:notificationsRefresh', handleExternalRefresh);
      }
    };
  }, [currentUser.id, currentUser.role, currentUser.token]);
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
          {hasNotifications && (
            <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full" aria-label="Nowe powiadomienia" />
          )}
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
          onClick={() => attempt(onLogout, { title: 'Wylogować się?', message: 'Masz niezapisane zmiany. Zapisz je lub odrzuć, zanim się wylogujesz.' })}
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