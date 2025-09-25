import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Meeting, User, EmployeeTask, Room } from '../../types';
import { LogOut, ChevronLeft, ChevronRight, CalendarDays, ClipboardList, CheckCircle2, Clock } from 'lucide-react';
import { fetchEmployeeTasks } from '../../utils/api/tasks';

type Props = {
  currentUser: User;
  meetings: Meeting[];
  onLogout: () => void;
  rooms?: Room[];
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // make Monday=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Lokalny format YYYY-MM-DD (bez UTC), aby uniknąć przesunięć strefy czasowej
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameYMD(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function polishDayName(d: Date): string {
  const days = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];
  return days[(d.getDay() + 6) % 7];
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function MobileMeetings({ currentUser, meetings, onLogout, rooms }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [mode, setMode] = useState<'schedule' | 'tasks'>('schedule');
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Swipe handling
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    // threshold
    if (Math.abs(deltaX) > 60) {
      if (deltaX < 0) nextWeek(); else prevWeek();
      touchStartX.current = null;
    }
  };
  const handleTouchEnd = () => { touchStartX.current = null; };

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Poniedziałek - Piątek
  const workingDays = useMemo(() => weekDays.slice(0, 5), [weekDays]);

  const myMeetingsThisWeek = useMemo(() => {
    if (!currentUser?.id) return [] as Meeting[];
    const userIdStr = String(currentUser.id);
    const startStr = formatDate(weekDays[0]);
    const endStr = formatDate(weekDays[6]);
    const inRange = (dateStr: string) => dateStr >= startStr && dateStr <= endStr;
    return meetings
      .filter(ev => {
        // Match only when user is among specialists (employee/contact/admin accounts)
        const specialists = [ev.specialistId, ...(ev.specialistIds || [])];
        return specialists.map(String).includes(userIdStr) && inRange(ev.date);
      })
      .sort((a, b) => {
        if (a.date === b.date) return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
        return a.date.localeCompare(b.date);
      });
  }, [meetings, currentUser?.id, weekDays]);

  const groupedByDay = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    // Tylko poniedziałek-piątek
    for (const d of workingDays) {
      map[formatDate(d)] = [];
    }
    for (const m of myMeetingsThisWeek) {
      if (!map[m.date]) continue; // ignoruj spotkania weekendowe na mobile
      map[m.date].push(m);
    }
    return map;
  }, [myMeetingsThisWeek, workingDays]);

  const prevWeek = () => setWeekStart(s => addDays(s, -7));
  const nextWeek = () => setWeekStart(s => addDays(s, 7));
  const thisWeek = () => setWeekStart(startOfWeek(new Date()));

  useEffect(() => {
    // ensure weekStart aligns to start of week whenever date changes
    setWeekStart(ws => startOfWeek(ws));
  }, []);

  // Refs: dzienne sekcje, nagłówek i kontener scrolla
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const headerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // (usunięto duplikat auto-scroll) 

  // Fetch tasks assigned to current user (mobile tasks mode)
  useEffect(() => {
    let active = true;
    const load = async () => {
      const token = currentUser?.token || localStorage.getItem('token') || undefined;
      if (!token) return;
      setTasksLoading(true);
      setTasksError(null);
      try {
        const all = await fetchEmployeeTasks(token);
        const meIdNum = Number(currentUser.id);
        const mine = all.filter(t => Array.isArray(t.assignedEmployeesIds) && t.assignedEmployeesIds.includes(meIdNum));
        if (active) setTasks(mine);
      } catch (e) {
        if (active) setTasksError('Nie udało się pobrać zadań');
      } finally {
        if (active) setTasksLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [currentUser?.id, currentUser?.token]);
  const title = useMemo(() => {
    const a = weekDays[0];
    const b = weekDays[6];
    const fmt = (d: Date) => `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth()+1).toString().padStart(2, '0')}.${d.getFullYear()}`;
    return `${fmt(a)} - ${fmt(b)}`;
  }, [weekDays]);

  // Auto-scroll w bieżącym tygodniu do dzisiejszego dnia (wyrównanie pod nagłówkiem)
  useLayoutEffect(() => {
    if (mode !== 'schedule') return;
    const today = new Date();
    const todayStr = formatDate(today);
    const thisWeekStart = startOfWeek(today);
    const isCurrentWeek = isSameYMD(thisWeekStart, weekStart);
    const days = workingDays.map(d => formatDate(d));
    if (!isCurrentWeek || !days.includes(todayStr)) return;
    const t = setTimeout(() => {
      const run = () => {
        const el = dayRefs.current[todayStr];
        const container = contentRef.current;
        if (!el) return;
        const headerH = headerRef.current?.getBoundingClientRect().height ?? 0;
        const padding = 8;
        if (container && container.scrollHeight > container.clientHeight + 2) {
          const containerRect = container.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const top = elRect.top - containerRect.top + container.scrollTop - padding;
          container.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
        } else {
          const elRect = el.getBoundingClientRect();
          const topWin = elRect.top + window.scrollY - headerH - padding;
          window.scrollTo({ top: Math.max(topWin, 0), behavior: 'smooth' });
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(run));
    }, 120);
    return () => clearTimeout(t);
  }, [mode, weekStart, workingDays, groupedByDay]);

  // Map roomId -> color/name helpers
  const roomColor = (id?: string) => rooms?.find(r => r.id === id)?.hexColor || '';
  const roomName = (id?: string) => rooms?.find(r => r.id === id)?.name || '';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-indigo-50 to-white" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {/* Top header */}
      <div ref={headerRef} className="sticky top-0 z-10 backdrop-blur bg-white/85 border-b border-indigo-100">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-3">
            {mode === 'schedule' ? (
              <>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-sm">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="leading-tight">
                  <div className="text-xs text-gray-500">Twoje spotkania</div>
                  <div className="text-base font-semibold text-gray-900">{title}</div>
                </div>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-sm">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="leading-tight">
                  <div className="text-xs text-gray-500">Twoje zadania</div>
                  <div className="text-base font-semibold text-gray-900">Przydzielone</div>
                </div>
              </>
            )}
          </div>
          <button onClick={onLogout} className="ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 text-red-700 hover:bg-red-100 text-sm transition-colors">
            <LogOut className="w-4 h-4" /> Wyloguj
          </button>
        </div>
        <div className="px-4 pb-3 flex items-center gap-2">
          {mode === 'schedule' && (
            <>
              <button onClick={prevWeek} className="p-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors" aria-label="Poprzedni tydzień">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={thisWeek} className="px-3 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 active:bg-gray-200 text-sm transition-colors">Bieżący tydzień</button>
              <button onClick={nextWeek} className="p-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors" aria-label="Następny tydzień">
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          <div className="ml-auto flex items-center rounded-full p-1 bg-indigo-50 ring-1 ring-indigo-200">
            <button
              onClick={() => setMode('schedule')}
              className={`px-3 py-1 text-sm rounded-full transition-all ${mode === 'schedule' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-700 hover:bg-indigo-100'}`}
            >Grafik</button>
            <button
              onClick={() => setMode('tasks')}
              className={`px-3 py-1 text-sm rounded-full transition-all ${mode === 'tasks' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-700 hover:bg-indigo-100'}`}
            >Zadania</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        {mode === 'schedule' ? (
          workingDays.map((d) => {
            const key = formatDate(d);
            const items = groupedByDay[key] || [];
            const isToday = key === formatDate(new Date());
            return (
              <div key={key} ref={el => (dayRefs.current[key] = el)} className="px-4 py-3">
                <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md ring-1 ${isToday ? 'bg-indigo-100 text-indigo-800 ring-indigo-300' : 'bg-indigo-50 text-indigo-700 ring-indigo-200'}`}>
                    {polishDayName(d)} {d.getDate().toString().padStart(2, '0')}.{(d.getMonth()+1).toString().padStart(2, '0')}
                  </span>
                  <span className="text-gray-400 text-xs">{items.length} spotkań</span>
                </div>
                {items.length === 0 ? (
                  <div className="text-sm text-gray-500 bg-white border border-dashed border-indigo-200 rounded-xl p-3">Brak spotkań</div>
                ) : (
                  <ul className="space-y-2">
                    {items.map(ev => (
                      <li key={ev.id} className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 p-3 pl-3 relative overflow-hidden border-l-[6px] ${
                        ev.status === 'cancelled' ? 'border-l-rose-500' :
                        ev.status === 'absent' ? 'border-l-amber-500' :
                        ev.status === 'in-progress' ? 'border-l-blue-500' :
                        'border-l-green-500'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-gray-900">{ev.name || 'Spotkanie'}</div>
                          <div className="text-xs text-gray-500">{ev.startTime} - {ev.endTime}</div>
                        </div>
                        <div className="mt-1 text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                          {ev.roomId && (
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: roomColor(ev.roomId) }} />
                              <span className="text-gray-600">{roomName(ev.roomId)}</span>
                            </span>
                          )}
                          {ev.patientName ? (
                            <span className="inline-block">Pacjent: {ev.patientName}</span>
                          ) : ev.patientNamesList && ev.patientNamesList.length ? (
                            <span className="inline-block">Pacjenci: {ev.patientNamesList.filter(Boolean).join(', ')}</span>
                          ) : ev.guestName ? (
                            <span className="inline-block">Gość: {ev.guestName}</span>
                          ) : (
                            <span className="inline-block">Uczestnicy: {[(ev.specialistIds||[]).length + (ev.patientIds||[]).length]} os.</span>
                          )}
                          <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            ev.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                            ev.status === 'absent' ? 'bg-amber-100 text-amber-700' :
                            ev.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {ev.status === 'cancelled' ? 'Odwołane' : ev.status === 'absent' ? 'Nieobecność' : ev.status === 'in-progress' ? 'W toku' : 'Planowane'}
                          </span>
                        </div>
                        {ev.notes && (
                          <div className="mt-1 text-xs text-gray-500">{ev.notes}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        ) : (
          <div className="px-4 py-3 space-y-3">
            {tasksLoading && (
              <div className="text-sm text-gray-500">Ładowanie zadań…</div>
            )}
            {tasksError && (
              <div className="text-sm text-red-600">{tasksError}</div>
            )}
            {!tasksLoading && !tasksError && tasks.length === 0 && (
              <div className="text-sm text-gray-500 bg-white border border-dashed border-gray-200 rounded-md p-3">Brak przydzielonych zadań</div>
            )}
            <ul className="space-y-2">
              {tasks
                .slice()
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .map(t => {
                  const done = !!t.isCompleted;
                  const todayLocal = formatDate(new Date());
                  const overdue = !done && t.dueDate < todayLocal;
                  return (
                    <li key={t.id} className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 p-3 pl-3 transition-colors border-l-[6px] ${
                      done ? 'border-l-green-500' : overdue ? 'border-l-rose-500' : 'border-l-amber-400'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {done ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-600" />
                          )}
                          <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                        </div>
                        <div className={`text-xs ${done ? 'text-gray-400' : overdue ? 'text-rose-600' : 'text-gray-600'}`}>Termin: {t.dueDate}</div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
        <div className="h-8" />
      </div>
    </div>
  );
}
