import React, { useState } from 'react';
import CalendarHeader from '../Calendar/CalendarHeader';
import TimeSlot from '../Calendar/TimeSlot';
import MeetingForm from '../Forms/MeetingForm';
import { generateTimeSlots } from '../../utils/timeSlots';
import { User, Room, Meeting } from '../../types';
import { ChevronDown, Copy, Check } from 'lucide-react';

interface EmployeeCalendarProps {
  users: User[];
  rooms: Room[];
  meetings: Meeting[];
  currentUser: User;
  onMeetingCreate: (meeting: Omit<Meeting, 'id'>) => void;
  onMeetingUpdate: (meetingId: string, updates: Partial<Meeting>) => void;
  showWeekends: boolean; // new
  startHour: number; // NEW
  endHour: number;   // NEW
}

const EmployeeCalendar: React.FC<EmployeeCalendarProps> = ({
  users,
  rooms,
  meetings,
  currentUser,
  onMeetingCreate,
  onMeetingUpdate,
  showWeekends,
  startHour,
  endHour
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'week' | 'month'>('week');
  const [selectedEmployee, setSelectedEmployee] = useState(
    currentUser.role === 'employee' ? currentUser.id : ''
  );
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [selectedTime, setSelectedTime] = useState('');
  const [editingMeeting, setEditingMeeting] = useState<Meeting | undefined>();
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);
  const [copyPeriod, setCopyPeriod] = useState<'week' | '4weeks'>('week');

  const timeSlots = generateTimeSlots(startHour, endHour);
  const employees = users.filter(user => user.role === 'employee');
  const sortedEmployees = React.useMemo(() => [...employees].sort((a,b)=> a.name.localeCompare(b.name,'pl')), [employees]);

  const formatDateForComparison = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const getWeekDays = (date: Date): Date[] => {
    const week: Date[] = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay() + 1);
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      if (!showWeekends) {
        const dow = day.getDay();
        if (dow === 0 || dow === 6) continue;
      }
      week.push(day);
    }
    return week;
  };

  const handleTimeSlotClick = (date: string, time: string, meeting?: Meeting) => {
    // Sprawdź uprawnienia
    if (currentUser.role === 'employee' && meeting && meeting.specialistId !== currentUser.id) {
      return; // Nie pozwalaj edytować cudzych spotkań
    }

    if (meeting) {
      setEditingMeeting(meeting);
      setSelectedTime(meeting.startTime);
    } else {
      setEditingMeeting(undefined);
      setSelectedTime(time);
    }
    setCurrentDate(new Date(date));
    setShowMeetingForm(true);
  };

  const handleMeetingFormSubmit = (meetingData: Omit<Meeting, 'id'>) => {
    if (editingMeeting) {
      onMeetingUpdate(editingMeeting.id, meetingData);
    } else {
      onMeetingCreate(meetingData);
    }
    setShowMeetingForm(false);
    setEditingMeeting(undefined);
  };

  const getEmployeeMeetings = () => {
    if (!selectedEmployee) return [];
    return meetings.filter(meeting => meeting.specialistId === selectedEmployee);
  };

  React.useEffect(() => {
    if (currentUser.role === 'admin' && !selectedEmployee && sortedEmployees.length) {
      setSelectedEmployee(sortedEmployees[0].id);
    }
  }, [currentUser.role, selectedEmployee, sortedEmployees]);

  // Zamknij dropdown przy kliknięciu poza nim
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Sprawdź czy kliknięcie nie było w dropdown'ie
      if (showCopyDropdown && !target.closest('.copy-dropdown')) {
        setShowCopyDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCopyDropdown]);

  const handleViewTypeChange = (viewType: 'day' | 'week' | 'month') => {
    if (viewType === 'week' || viewType === 'month') {
      setViewType(viewType);
    }
  };

  const handleCopyAvailability = () => {
    if (!selectedEmployee) return;
    
    const periodText = copyPeriod === 'week' ? 'kolejny tydzień' : 'kolejne 4 tygodnie';
    console.log(`Kopiowanie dostępności pracownika ${selectedEmployee} na ${periodText}`);
    console.log('Aktualny copyPeriod:', copyPeriod);
    
    // TODO: Implementacja logiki kopiowania dostępności
    
    setShowCopyDropdown(false);
  };

  // Debug: sprawdź zmiany copyPeriod
  React.useEffect(() => {
    console.log('copyPeriod zmienił się na:', copyPeriod);
  }, [copyPeriod]);

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const employeeMeetings = getEmployeeMeetings();
    const gridTemplate = { gridTemplateColumns: `120px repeat(${weekDays.length}, 1fr)` };
    const hourStarts = timeSlots.filter(t => t.endsWith(':00'));
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
        <div className="flex-1 max-h-[38rem] overflow-y-auto styled-scrollbar" style={{ scrollbarGutter: 'stable' }}>
          <div className="min-w-full inline-block">
            <div className="grid divide-x divide-gray-200 bg-gray-50 sticky top-0 z-10" style={gridTemplate}>
              <div className="p-4 bg-gray-50">
                <div className="text-sm font-medium text-gray-600">Godzina</div>
              </div>
              {weekDays.map((day, index) => (
                <div key={index} className="p-4 bg-gray-50 text-center">
                  <div className="text-sm font-medium text-gray-900">{day.toLocaleDateString('pl-PL', { weekday: 'short' })}</div>
                  <div className="text-sm text-gray-600 mt-1">{day.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</div>
                </div>
              ))}
            </div>
            <div className="divide-y divide-gray-200">
              {hourStarts.map(hour => {
                const [hh] = hour.split(':');
                const firstSlot = hour;        // HH:00
                const secondSlot = `${hh}:30`; // HH:30
                return (
                  <div
                    key={hour}
                    className="grid divide-x divide-gray-200"
                    style={{ ...gridTemplate, gridTemplateRows: 'repeat(2, minmax(0,1fr))' }}
                  >
                    {/* scalona godzina */}
                    <div className="row-span-2 p-3 bg-gray-50 flex items-start text-sm font-medium text-gray-600 border-r border-gray-200">
                      {hour}
                    </div>
                    {/* pierwsze 30 min */}
                    {weekDays.map((day, dayIndex) => {
                      const slotTime = firstSlot;
                      const dateStr = formatDateForComparison(day);
                      const dayMeetings = employeeMeetings.filter(m => m.date === dateStr);
                      const meetingAtTime = dayMeetings.find(meeting => {
                        const startTime = parseInt(meeting.startTime.replace(':', ''));
                        const endTime = parseInt(meeting.endTime.replace(':', ''));
                        const currentTime = parseInt(slotTime.replace(':', ''));
                        return currentTime >= startTime && currentTime < endTime;
                      });
                      const isAvailable = !meetingAtTime;
                      const canInteract = !selectedEmployee || currentUser.role === 'admin' || selectedEmployee === currentUser.id;
                      return (
                        <TimeSlot
                          key={`${dayIndex}-${slotTime}-a`}
                          time={slotTime}
                          isAvailable={isAvailable}
                          meeting={meetingAtTime}
                          onClick={() => canInteract && handleTimeSlotClick(dateStr, slotTime, meetingAtTime)}
                          className={`min-h-[32px] border-b border-gray-100 ${!canInteract ? 'cursor-not-allowed opacity-50' : ''}`}
                          compact
                        />
                      );
                    })}
                    {/* drugie 30 min */}
                    {weekDays.map((day, dayIndex) => {
                      const slotTime = secondSlot;
                      const dateStr = formatDateForComparison(day);
                      const dayMeetings = employeeMeetings.filter(m => m.date === dateStr);
                      const meetingAtTime = dayMeetings.find(meeting => {
                        const startTime = parseInt(meeting.startTime.replace(':', ''));
                        const endTime = parseInt(meeting.endTime.replace(':', ''));
                        const currentTime = parseInt(slotTime.replace(':', ''));
                        return currentTime >= startTime && currentTime < endTime;
                      });
                      const isAvailable = !meetingAtTime;
                      const canInteract = !selectedEmployee || currentUser.role === 'admin' || selectedEmployee === currentUser.id;
                      return (
                        <TimeSlot
                          key={`${dayIndex}-${slotTime}-b`}
                          time={slotTime}
                          isAvailable={isAvailable}
                          meeting={meetingAtTime}
                          onClick={() => canInteract && handleTimeSlotClick(dateStr, slotTime, meetingAtTime)}
                          className={`min-h-[32px] ${!canInteract ? 'cursor-not-allowed opacity-50' : ''}`}
                          compact
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Wybór pracownika */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="space-y-3">
          <div>
            <div className="flex flex-wrap gap-2">
              {sortedEmployees.map(emp => {
                const active = selectedEmployee === emp.id;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setSelectedEmployee(emp.id)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {emp.name}
                  </button>
                );
              })}
              {sortedEmployees.length === 0 && (
                <span className="text-xs text-gray-400 italic">Brak pracowników</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedEmployee ? (
        <>
          <CalendarHeader
            currentDate={currentDate}
            viewType={viewType}
            onDateChange={setCurrentDate}
            onViewTypeChange={handleViewTypeChange}
            availableViews={['week', 'month']}
            centerContent={
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Powiel dostępność na:</span>
                
                <div className="relative copy-dropdown">
                  <button
                    onClick={() => setShowCopyDropdown(!showCopyDropdown)}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors w-44"
                  >
                    <span>{copyPeriod === 'week' ? 'kolejny tydzień' : 'kolejne 4 tygodnie'}</span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </button>

                  {showCopyDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                      <button
                        onClick={() => {
                          console.log('Wybrano: week');
                          setCopyPeriod('week');
                          setShowCopyDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        {copyPeriod === 'week' && <Check className="h-4 w-4 text-blue-600" />}
                        <span className={copyPeriod === 'week' ? 'text-blue-600 font-medium' : 'text-gray-700'}>
                          kolejny tydzień
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          console.log('Wybrano: 4weeks');
                          setCopyPeriod('4weeks');
                          setShowCopyDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        {copyPeriod === '4weeks' && <Check className="h-4 w-4 text-blue-600" />}
                        <span className={copyPeriod === '4weeks' ? 'text-blue-600 font-medium' : 'text-gray-700'}>
                          kolejne 4 tygodnie
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCopyAvailability}
                  disabled={!selectedEmployee}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  Zastosuj
                </button>
              </div>
            }
          />

          {viewType === 'week' && renderWeekView()}
          {viewType === 'month' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-gray-500 text-center py-8">Widok miesięczny będzie dostępny w przyszłych wersjach</p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500 text-center py-8">Wybierz pracownika, aby wyświetlić jego grafik</p>
        </div>
      )}

      <MeetingForm
        isOpen={showMeetingForm}
        onClose={() => {
          setShowMeetingForm(false);
          setEditingMeeting(undefined);
        }}
        onSubmit={handleMeetingFormSubmit}
        users={users}
        rooms={rooms}
        meetings={meetings}
        selectedDate={formatDateForComparison(currentDate)}
        selectedTime={selectedTime}
        currentUser={currentUser}
        editingMeeting={editingMeeting}
      />

      {/* Nowa legenda na dole strony */}
      {/* legenda przeniesiona do nagłówka */}
    </div>
  );
};

export default EmployeeCalendar;