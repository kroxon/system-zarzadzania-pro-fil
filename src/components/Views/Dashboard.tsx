import React from 'react';
import { Users, MapPin, Calendar, TrendingUp } from 'lucide-react';
import { User, Room, Meeting } from '../../types';

interface DashboardProps {
  users: User[];
  rooms: Room[];
  meetings: Meeting[];
}

const Dashboard: React.FC<DashboardProps> = ({ users, rooms, meetings }) => {
  const today = new Date().toISOString().split('T')[0];
  const todayMeetings = meetings.filter(m => m.date === today);
  
  const stats = [
    {
      title: 'Dzisiejsze spotkania',
      value: todayMeetings.length,
      icon: Calendar,
      color: 'bg-blue-500',
      change: '+12%'
    },
    {
      title: 'Aktywni pracownicy',
      value: users.filter(u => u.role === 'employee').length,
      icon: Users,
      color: 'bg-green-500',
      change: '0%'
    },
    {
      title: 'Dostępne sale',
      value: rooms.length,
      icon: MapPin,
      color: 'bg-purple-500',
      change: '0%'
    },
    {
      title: 'Obecność dziś',
      value: `${Math.round((todayMeetings.filter(m => m.status === 'present').length / todayMeetings.length) * 100) || 0}%`,
      icon: TrendingUp,
      color: 'bg-orange-500',
      change: '+5%'
    }
  ];

  const recentMeetings = meetings
    .sort((a, b) => new Date(b.date + ' ' + b.startTime).getTime() - new Date(a.date + ' ' + a.startTime).getTime())
    .slice(0, 5);

  const getStatusBadge = (status: string) => {
    const colors = {
      'present': 'bg-green-100 text-green-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    const labels = {
      'present': 'Obecny',
      'in-progress': 'W toku',
      'cancelled': 'Odwołany'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status as keyof typeof colors]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  <p className="text-sm text-green-600 mt-1">{stat.change}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dzisiejsze spotkania */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Dzisiejsze spotkania</h2>
        </div>
        <div className="p-6">
          {todayMeetings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Brak spotkań na dziś</p>
          ) : (
            <div className="space-y-4">
              {todayMeetings.map(meeting => {
                const specialist = users.find(u => u.id === meeting.specialistId);
                const room = rooms.find(r => r.id === meeting.roomId);
                
                return (
                  <div key={meeting.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-600 min-w-0 w-16">
                          {meeting.startTime}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{meeting.patientName}</p>
                          <p className="text-sm text-gray-500">
                            {specialist?.name} • {room?.name}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(meeting.status)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ostatnie spotkania */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Ostatnie spotkania</h2>
        </div>
        <div className="p-6">
          {recentMeetings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Brak spotkań</p>
          ) : (
            <div className="space-y-4">
              {recentMeetings.map(meeting => {
                const specialist = users.find(u => u.id === meeting.specialistId);
                const room = rooms.find(r => r.id === meeting.roomId);
                
                return (
                  <div key={meeting.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-600 min-w-0 w-20">
                          {new Date(meeting.date).toLocaleDateString('pl-PL')}
                        </div>
                        <div className="text-sm text-gray-600 min-w-0 w-16">
                          {meeting.startTime}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{meeting.patientName}</p>
                          <p className="text-sm text-gray-500">
                            {specialist?.name} • {room?.name}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(meeting.status)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;