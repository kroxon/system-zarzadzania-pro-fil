import React, { useState } from 'react';
import CalendarHeader from '../Calendar/CalendarHeader';
import MeetingForm from '../Forms/MeetingForm';
import { generateTimeSlots } from '../../utils/timeSlots';
import { User, Room, Meeting, MeetingBatchPayload } from '../../types';

interface SharedCalendarProps {
  users: User[];
  rooms: Room[];
  meetings: Meeting[];
  currentUser: User;
  onMeetingCreate: (meeting: Omit<Meeting, 'id'>) => Promise<void> | void;
  onMeetingUpdate: (meetingId: string, updates: Partial<Meeting>) => void;
  onMeetingDelete?: (meetingId: string) => void;
  showWeekends: boolean; // new
  startHour: number; // NEW
  endHour: number;   // NEW
}

// STATUS helper przeniesiony globalnie
const meetingStatusClasses = (status: Meeting['status']) => {
  switch (status) {
    case 'present': return 'bg-green-200 border-green-400 text-green-900';
    case 'absent': return 'bg-orange-200 border-orange-400 text-orange-900';
    case 'in-progress': return 'bg-yellow-200 border-yellow-400 text-yellow-900';
    case 'cancelled': return 'bg-red-200 border-red-400 text-red-900 line-through';
    default: return 'bg-gray-200 border-gray-400 text-gray-700';
  }
};

const SharedCalendar: React.FC<SharedCalendarProps> = ({
  users,
  rooms,
  meetings,
  currentUser,
  onMeetingCreate,
  onMeetingUpdate,
  onMeetingDelete,
  showWeekends,
  startHour,
  endHour
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'day' | 'week' | 'month'>('week');
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [selectedTime, setSelectedTime] = useState('');
  const [editingMeeting, setEditingMeeting] = useState<Meeting | undefined>();
  
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const timeSlots = generateTimeSlots(startHour, endHour);
  const employees = users.filter(user => user.role === 'employee');

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
    if (meeting) {
      if (currentUser.role === 'employee') {
        const isMine = meeting.specialistId === currentUser.id || (meeting.specialistIds?.includes(currentUser.id) ?? false) || meeting.createdBy === currentUser.id;
        if (!isMine) return;
      }
      setEditingMeeting(meeting);
      setSelectedTime(meeting.startTime);
    } else {
      setEditingMeeting(undefined);
      setSelectedTime(time);
    }
    setCurrentDate(new Date(date));
    setShowMeetingForm(true);
  };

  const handleMeetingFormSubmit = async (payload: MeetingBatchPayload) => {
    if (editingMeeting) {
      const first = payload.meetings[0];
      if (first) {
        await Promise.resolve(onMeetingUpdate(editingMeeting.id, first));
      }
    } else {
      for (const meetingData of payload.meetings) {
        await Promise.resolve(onMeetingCreate(meetingData));
      }
    }
    setShowMeetingForm(false);
    setEditingMeeting(undefined);
  };

  const handleMeetingDelete = (meetingId: string) => {
    onMeetingDelete?.(meetingId);
    setShowMeetingForm(false);
    setEditingMeeting(undefined);
  };

  const filteredMeetings = meetings.filter(meeting => {
    if (selectedEmployee && !(meeting.specialistId === selectedEmployee || (meeting.specialistIds?.includes(selectedEmployee) ?? false))) return false;
    if (selectedRoom && meeting.roomId !== selectedRoom) return false;
    if (statusFilter && meeting.status !== statusFilter) return false;
    return true;
  });

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const halfHourSlots = timeSlots;
    const hourStarts = halfHourSlots.filter(t => t.endsWith(':00'));
    const gridTemplate = { gridTemplateColumns: `100px repeat(${weekDays.length}, 1fr)` }; // slightly narrower hour col

    const slotMeetings = (slotTime: string, dayMeetings: Meeting[]) => {
      return dayMeetings.filter(m => {
        const start = parseInt(m.startTime.replace(':',''));
        const end = parseInt(m.endTime.replace(':',''));
        const cur = parseInt(slotTime.replace(':',''));
        return cur >= start && cur < end; // overlap 30m segment
      });
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
        <div className="max-h-[32rem] overflow-y-auto styled-scrollbar" style={{ scrollbarGutter: 'stable' }}>
          <div className="min-w-full inline-block select-none">
            {/* HEADER */}
            <div className="grid divide-x divide-gray-200 bg-gray-50 sticky top-0 z-10" style={gridTemplate}>
              <div className="p-3 bg-gray-50">
                <div className="text-xs font-medium text-gray-600">Godzina</div>
              </div>
              {weekDays.map((day, i) => (
                <div key={i} className="p-3 bg-gray-50 text-center">
                  <div className="text-xs font-semibold text-gray-900">{day.toLocaleDateString('pl-PL', { weekday: 'short' })}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">{day.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</div>
                </div>
              ))}
            </div>
            {/* BODY grouped by hour */}
            <div className="space-y-1 pb-2">
              {hourStarts.map(hour => {
                const [hh] = hour.split(':');
                const firstSlot = hour;
                const secondSlot = `${hh}:30`;
                return (
                  <div key={hour} className="grid" style={{ ...gridTemplate, gridTemplateRows: 'repeat(2,minmax(0,1fr))' }}>
                    {/* hour cell spans 2 */}
                    <div className="row-span-2 flex items-start justify-center text-[11px] font-medium text-gray-600 bg-gray-50 border-r border-gray-200 pt-1">
                      {hour}
                    </div>
                    {/* first half */}
                    {weekDays.map(day => {
                      const dateStr = formatDateForComparison(day);
                      const dayMeetings = filteredMeetings.filter(m => m.date === dateStr);
                      const overlaps = slotMeetings(firstSlot, dayMeetings);
                      const isEmpty = overlaps.length === 0;
                      return (
                        <div
                          key={dateStr+firstSlot}
                          onClick={() => isEmpty && handleTimeSlotClick(dateStr, firstSlot)}
                          className={`relative m-0.5 rounded-md min-h-[22px] px-1 flex flex-col justify-center border ${isEmpty ? 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer' : 'bg-white border-gray-300'} transition-colors`}
                        >
                          <div className="absolute top-0 left-0 text-[8px] text-gray-400 px-1 pt-0.5 select-none">{firstSlot}</div>
                          {overlaps.length > 0 && (
                            <div className="flex w-full gap-0.5 pt-1.5">
                              {overlaps.map(m => (
                                <div
                                  key={m.id+firstSlot}
                                  onClick={(e) => { e.stopPropagation(); handleTimeSlotClick(dateStr, m.startTime, m); }}
                                  className={`flex-1 min-w-0 group ${meetingStatusClasses(m.status)} border text-[9px] leading-[10px] rounded-sm px-1 py-0.5 cursor-pointer overflow-hidden hover:brightness-95`}
                                  title={`${m.patientName} (${m.startTime}-${m.endTime})`}
                                >
                                  <span className="truncate block">{(users.find(u=>u.id===m.specialistId)?.name.split(' ')[0]||'')} {m.patientName}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* second half */}
                    {weekDays.map(day => {
                      const dateStr = formatDateForComparison(day);
                      const dayMeetings = filteredMeetings.filter(m => m.date === dateStr);
                      const overlaps = slotMeetings(secondSlot, dayMeetings);
                      const isEmpty = overlaps.length === 0;
                      return (
                        <div
                          key={dateStr+secondSlot}
                          onClick={() => isEmpty && handleTimeSlotClick(dateStr, secondSlot)}
                          className={`relative m-0.5 rounded-md min-h-[22px] px-1 flex flex-col justify-center border ${isEmpty ? 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer' : 'bg-white border-gray-300'} transition-colors`}
                        >
                          <div className="absolute top-0 left-0 text-[8px] text-gray-400 px-1 pt-0.5 select-none">{secondSlot}</div>
                          {overlaps.length > 0 && (
                            <div className="flex w-full gap-0.5 pt-1.5">
                              {overlaps.map(m => (
                                <div
                                  key={m.id+secondSlot}
                                  onClick={(e) => { e.stopPropagation(); handleTimeSlotClick(dateStr, m.startTime, m); }}
                                  className={`flex-1 min-w-0 group ${meetingStatusClasses(m.status)} border text-[9px] leading-[10px] rounded-sm px-1 py-0.5 cursor-pointer overflow-hidden hover:brightness-95`}
                                  title={`${m.patientName} (${m.startTime}-${m.endTime})`}
                                >
                                  <span className="truncate block">{(users.find(u=>u.id===m.specialistId)?.name.split(' ')[0]||'')} {m.patientName}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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

  const renderDayView = () => {
    const dateStr = formatDateForComparison(currentDate);
    const dayMeetings = filteredMeetings.filter(meeting => meeting.date === dateStr);
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">
            {currentDate.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
          {timeSlots.map((time, idx) => {
            const overlaps = dayMeetings.filter(m => {
              const start = parseInt(m.startTime.replace(':',''));
              const end = parseInt(m.endTime.replace(':',''));
              const cur = parseInt(time.replace(':',''));
              return cur >= start && cur < end;
            });
            const empty = overlaps.length === 0;
            return (
              <div key={idx} onClick={() => empty && handleTimeSlotClick(dateStr, time)} className={`relative rounded-md min-h-[30px] p-1 border ${empty ? 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer' : 'bg-white border-gray-300'} transition-colors`}> 
                <div className="absolute top-0 left-0 text-[9px] text-gray-400 px-1 pt-0.5 select-none">{time}</div>
                {overlaps.length > 0 && (
                  <div className="flex w-full gap-0.5 pt-3">
                    {overlaps.map(m => (
                      <div key={m.id+time} onClick={(e)=>{ e.stopPropagation(); handleTimeSlotClick(dateStr, m.startTime, m); }} className={`${meetingStatusClasses(m.status)} flex-1 min-w-0 border text-[10px] leading-[11px] rounded-sm px-1 py-0.5 cursor-pointer overflow-hidden`}> 
                        <span className="truncate block">{(users.find(u=>u.id===m.specialistId)?.name.split(' ')[0]||'')} {m.patientName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filtry */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pracownik</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Wszyscy</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sala
            </label>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Wszystkie sale</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Wszystkie statusy</option>
              <option value="present">Obecny</option>
              <option value="in-progress">W toku</option>
              <option value="cancelled">Odwołany</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              &nbsp;
            </label>
            <button
              onClick={() => {
                setSelectedEmployee('');
                setSelectedRoom('');
                setStatusFilter('');
              }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Resetuj filtry
            </button>
          </div>
        </div>
      </div>

      <CalendarHeader
        currentDate={currentDate}
        viewType={viewType}
        onDateChange={setCurrentDate}
        onViewTypeChange={setViewType}
      />

      {viewType === 'week' && renderWeekView()}
      {viewType === 'day' && renderDayView()}
      {viewType === 'month' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500 text-center py-8">Widok miesięczny będzie dostępny w przyszłych wersjach</p>
        </div>
      )}

      <MeetingForm
        isOpen={showMeetingForm}
        onClose={() => {
          setShowMeetingForm(false);
          setEditingMeeting(undefined);
        }}
        onSubmit={handleMeetingFormSubmit}
        onDelete={handleMeetingDelete}
        users={users}
        rooms={rooms}
        meetings={meetings}
        selectedDate={formatDateForComparison(currentDate)}
        selectedTime={selectedTime}
        currentUser={currentUser}
        editingMeeting={editingMeeting}
      />
    </div>
  );
};

export default SharedCalendar;