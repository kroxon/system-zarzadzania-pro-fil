import React, { useState } from 'react';
import CalendarHeader from '../Calendar/CalendarHeader';
import { generateTimeSlots } from '../../utils/timeSlots';
import { User, Room, Meeting } from '../../types';
import { ChevronDown, Copy, Check, Trash2 } from 'lucide-react';
import MonthCalendar from './MonthCalendar'; // FIX: corrected relative path

// === Date helpers (moved up to avoid forward reference issues) ===
const formatLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const parseLocalDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const buildDateRange = (a: string, b: string) => {
  if (!a || !b) return [] as string[];
  const d1 = parseLocalDate(a); const d2 = parseLocalDate(b);
  const from = d1 < d2 ? d1 : d2; const to = d1 < d2 ? d2 : d1;
  const out: string[] = []; const cur = new Date(from);
  while (cur <= to) { out.push(formatLocalDate(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
};

interface EmployeeCalendarProps {
  users: User[];
  rooms: Room[];
  meetings: Meeting[];
  currentUser: User;
  showWeekends: boolean; // new
  startHour: number; // NEW
  endHour: number;   // NEW
}

const EmployeeCalendar: React.FC<EmployeeCalendarProps> = ({
  users,
  rooms,
  meetings,
  currentUser,
  showWeekends,
  startHour,
  endHour
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'week' | 'month'>('week');
  const [selectedEmployee, setSelectedEmployee] = useState(
    currentUser.role === 'employee' ? currentUser.id : ''
  );
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);
  const [copyPeriod, setCopyPeriod] = useState<'week' | '4weeks'>('week');
  // const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null); // replaced by pendingDeleteRange
  const [deletedRangeIds, setDeletedRangeIds] = useState<string[]>([]); // NEW: pending deletions
  
  // ==== AVAILABILITY STATE (Stage 1) ====
  interface AvailabilityRange { id: string; specialistId: string; start: string; end: string; }
  const [pendingDeleteRange, setPendingDeleteRange] = useState<AvailabilityRange | null>(null); // NEW: holds range awaiting confirmation
  const AVAIL_KEY = 'schedule_availabilities';
  const [availabilities, setAvailabilities] = useState<AvailabilityRange[]>([]); // persisted for employee & week
  const [tempRanges, setTempRanges] = useState<AvailabilityRange[]>([]); // unsaved new ranges
  const [showSavedTick, setShowSavedTick] = useState(false); // PRZYWRÓCONE: wskaźnik zapisu

  // === CAŁODNIOWE NIEDOSTĘPNOŚCI (widok miesiąca) ===
  interface DayOff { id: string; specialistId: string; date: string; note?: string; groupId?: string; }
  const DAY_OFF_KEY = 'schedule_day_offs';
  const [dayOffs, setDayOffs] = useState<DayOff[]>([]);

  React.useEffect(()=> {
    if(!selectedEmployee) return;
    try {
      const raw = localStorage.getItem(DAY_OFF_KEY);
      const all: DayOff[] = raw ? JSON.parse(raw) : [];
      setDayOffs(all.filter(d=> d.specialistId === selectedEmployee));
    } catch(e){ console.warn('Load dayOffs failed', e); }
  }, [selectedEmployee]);

  // === MONTH VIEW DYNAMIC TILE HEIGHT ===
  const monthContainerRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const recalcMonthTileHeight = () => {
      if (!monthContainerRef.current) return;
      const rect = monthContainerRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const bottomMargin = 36; // zostaw stały margines na dole
      const available = viewportH - rect.top - bottomMargin; // całkowita przestrzeń dla całego boxa
      // ELEMENTY STAŁE WEWNĄTRZ: wiersz nazw dni + gapy + paddingy
      const headerRowHeight = 28; // wysokość wiersza z nazwami dni
      const verticalPadding = 16; // p-4 (góra+dół ~16px) w kontenerze + drobne marginesy
      const gapY = 10; // gap między wierszami (grid gap-[10px])
      const rows = 6;
      const totalGaps = (rows - 1) * gapY;
      const inner = available - headerRowHeight - verticalPadding - totalGaps;
      const rawTile = inner / rows;
      const clamped = Math.max(64, Math.min(140, Math.floor(rawTile)));
      if(!Number.isNaN(clamped)) {/* tile height internal now */}
    };
    recalcMonthTileHeight();
    window.addEventListener('resize', recalcMonthTileHeight);
    return () => window.removeEventListener('resize', recalcMonthTileHeight);
  }, [currentDate]);

  const timeSlots = generateTimeSlots(startHour, endHour);
  const employees = users.filter(user => user.role === 'employee');
  const sortedEmployees = React.useMemo(() => [...employees].sort((a,b)=> a.name.localeCompare(b.name,'pl')), [employees]);

  const formatDateForComparison = (date: Date): string => {
    return formatLocalDate(date); // używane w week view – lokalnie również OK
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

  const handleCopyAvailability = () => {
    if (!selectedEmployee) return;

    // NIE zapisujemy automatycznie. Pracujemy na bieżącym stanie (availabilities + tempRanges)
    // i dokładamy skopiowane zakresy jako niezapisane (tempRanges).

    // Bazowy tydzień = aktualny tydzień (tylko zakresy tego pracownika w bieżącym tygodniu)
    const working = [
      ...availabilities.filter(r => r.specialistId === selectedEmployee),
      ...tempRanges.filter(r => r.specialistId === selectedEmployee)
    ];

    const baseWeekRanges = working.filter(r => {
      const startDate = new Date(r.start);
      return startDate >= weekBounds.start && startDate <= weekBounds.end;
    });

    if (!baseWeekRanges.length) {
      setShowCopyDropdown(false);
      return;
    }

    const weeksToCopy = copyPeriod === 'week' ? 1 : 4; // 1 lub 4 kolejne tygodnie
    const newRanges: AvailabilityRange[] = [];
    let counter = 0;

    for (let w = 1; w <= weeksToCopy; w++) {
      const dayOffset = w * 7;
      for (const r of baseWeekRanges) {
        const startDate = new Date(r.start);
        startDate.setDate(startDate.getDate() + dayOffset);
        const endDate = new Date(r.end);
        endDate.setDate(endDate.getDate() + dayOffset);
        newRanges.push({
          id: `copy-${Date.now()}-${w}-${counter++}`,
          specialistId: r.specialistId,
          start: startDate.toISOString(),
          end: endDate.toISOString()
        });
      }
    }

    if (!newRanges.length) {
      setShowCopyDropdown(false);
      return;
    }

    // Dodajemy nowe zakresy jako niezapisane: tempRanges.
    // (Nie zapisujemy do localStorage; użytkownik musi kliknąć "Zapisz zmiany").
    setTempRanges(prev => [...prev, ...newRanges]);

    setShowCopyDropdown(false);
    // NIE ustawiamy showSavedTick – nic jeszcze nie zapisano.
  };

  // Debug: sprawdź zmiany copyPeriod
  React.useEffect(() => {
    console.log('copyPeriod zmienił się na:', copyPeriod);
  }, [copyPeriod]);

  // Zamknij dropdown przy przełączeniu na widok miesiąca
  React.useEffect(() => {
    if(viewType === 'month') setShowCopyDropdown(false);
  }, [viewType]);

  // Helper: start of week (Mon) and end (Sun) for currentDate (even if weekends hidden)
  const getWeekBounds = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay() + 1); // Monday
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23,59,59,999);
    return { start, end };
  };

  const weekBounds = getWeekBounds(currentDate);

  // Load persisted availabilities for selected employee + current week
  React.useEffect(() => {
    if(!selectedEmployee) return;
    try {
      const raw = localStorage.getItem(AVAIL_KEY);
      const all: AvailabilityRange[] = raw ? JSON.parse(raw) : [];
      const filtered = all.filter(a => a.specialistId === selectedEmployee && new Date(a.start) >= weekBounds.start && new Date(a.start) <= weekBounds.end);
      setAvailabilities(filtered);
      setTempRanges([]);
    } catch(e){
      console.warn('Load availabilities failed', e);
    }
  }, [selectedEmployee, weekBounds.start.getTime()]);

  // Prevent week navigation if unsaved
  const guardedSetCurrentDate = (d: Date) => {
    const newBounds = getWeekBounds(d);
    const sameWeek = weekBounds.start.getTime() === newBounds.start.getTime();
    if(!sameWeek && tempRanges.length){
      alert('Najpierw zapisz zmiany dostępności dla tego tygodnia.');
      return;
    }
    setCurrentDate(d);
  };

  const dayKey = (iso: string) => iso.slice(0,10);

  // Proste łączenie: scala gdy nachodzą lub stykają się (rStart <= lastEnd)
  const mergeRangesAdjacency = (ranges: AvailabilityRange[]) => {
    if(!ranges.length) return [] as AvailabilityRange[];
    const sorted = [...ranges].sort((a,b)=> new Date(a.start).getTime() - new Date(b.start).getTime());
    const out: AvailabilityRange[] = [];
    for(const r of sorted){
      if(!out.length){ out.push({...r}); continue; }
      const last = out[out.length-1];
      const rStart = new Date(r.start).getTime();
      const lastEnd = new Date(last.end).getTime();
      if(rStart <= lastEnd){ // overlap lub styk
        const rEnd = new Date(r.end).getTime();
        if(rEnd > lastEnd) last.end = r.end;
      } else {
        out.push({...r});
      }
    }
    return out;
  };

  // Usunięto: złożony mechanizm opóźnionego łączenia + pulse
  const saveAvailabilities = () => {
    if(!selectedEmployee) return;
    const raw = localStorage.getItem(AVAIL_KEY);
    const all: AvailabilityRange[] = raw ? JSON.parse(raw) : [];
    const merged = mergeRangesAdjacency([...availabilities, ...tempRanges].filter(r=> r.specialistId === selectedEmployee));
    const keep = all.filter(a => a.specialistId !== selectedEmployee || new Date(a.start) < weekBounds.start || new Date(a.start) > weekBounds.end);
    const nextAll = [...keep, ...merged];
    localStorage.setItem(AVAIL_KEY, JSON.stringify(nextAll));
    setAvailabilities(merged);
    setTempRanges([]);
    setDeletedRangeIds([]); // clear pending deletions
    setShowSavedTick(true);
    setTimeout(()=> setShowSavedTick(false), 1400);
  };

  // Przywrócone: odrzucenie zmian
  const discardChanges = () => {
    if(!selectedEmployee) return;
    try {
      const raw = localStorage.getItem(AVAIL_KEY);
      const all: AvailabilityRange[] = raw ? JSON.parse(raw) : [];
      const filtered = all.filter(a => a.specialistId === selectedEmployee && new Date(a.start) >= weekBounds.start && new Date(a.start) <= weekBounds.end);
      setAvailabilities(filtered);
      setTempRanges([]);
      setDeletedRangeIds([]);
      setPendingDeleteRange(null);
      setActiveEdit(null);
    } catch(e){ console.warn('Discard changes failed', e); }
  };

  const handleConfirmDelete = () => {
    if(pendingDeleteRange){
      const id = pendingDeleteRange.id;
      setAvailabilities(a => a.filter(r => r.id !== id));
      setTempRanges(t => t.filter(r => r.id !== id));
      setDeletedRangeIds(ids => ids.includes(id) ? ids : [...ids, id]);
      setPendingDeleteRange(null);
    }
  };

  // === Floating availability block editing state ===
  interface ActiveEditState { id: string; day: string; type: 'create' | 'move' | 'resize'; originalStartIndex: number; originalEndIndex: number; startIndex: number; endIndex: number; originY: number; slotHeight: number; isTemp: boolean; daySnapshot: AvailabilityRange[]; }
  const [activeEdit, setActiveEdit] = useState<ActiveEditState | null>(null);
  const activeEditRef = React.useRef<ActiveEditState | null>(null);
  React.useEffect(()=> { activeEditRef.current = activeEdit; }, [activeEdit]);
  // Przywrócone referencje kolumn dnia oraz liczba slotów (30m) – były usunięte
  const dayColRefs = React.useRef<{ [day: string]: HTMLDivElement | null }>({});
  const totalSlots = (endHour - startHour) * 2;

  const timeFromIndex = (idx: number) => timeSlots[idx];
  const endTimeFromEndIndex = (endIdx: number) => {
    const base = timeSlots[endIdx - 1];
    const [h, m] = base.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + 30, 0, 0);
    return date.toTimeString().substring(0,5);
  };
  const toISO = (day: string, time: string) => new Date(`${day}T${time}:00`).toISOString();

  const finalizeActiveEdit = React.useCallback(() => {
    const prev = activeEditRef.current; if(!prev) return;
    const day = prev.day;
    const startTime = timeFromIndex(prev.startIndex);
    const endTime = endTimeFromEndIndex(prev.endIndex);
    const startISO = toISO(day, startTime);
    const endISO = toISO(day, endTime);
    const updated: AvailabilityRange = { id: prev.id, specialistId: selectedEmployee || '', start: startISO, end: endISO };
    const snapshot = prev.daySnapshot.filter(r => r.id !== updated.id);
    const mergedDay = mergeRangesAdjacency([...snapshot, updated]);
    setAvailabilities(a => a.filter(r => dayKey(r.start) !== day || r.specialistId !== selectedEmployee));
    setTempRanges(t => {
      const others = t.filter(r => dayKey(r.start) !== day || r.specialistId !== selectedEmployee);
      return [...others, ...mergedDay];
    });
    setActiveEdit(null);
  }, [selectedEmployee]);

  React.useEffect(() => {
    if(!activeEdit) return;
    const handleEditMove = (e: MouseEvent) => {
      setActiveEdit(prev => {
        if(!prev) return prev;
        const deltaY = e.clientY - prev.originY;
        const slotH = prev.slotHeight;
        if(!slotH) return prev;
        if(prev.type === 'move') {
          const duration = prev.originalEndIndex - prev.originalStartIndex;
            let newStart = prev.originalStartIndex + Math.round(deltaY / slotH);
          const maxSlots = (endHour - startHour) * 2;
          newStart = Math.max(0, Math.min(newStart, maxSlots - duration));
          return { ...prev, startIndex: newStart, endIndex: newStart + duration };
        } else if(prev.type === 'resize') {
          let newEnd = prev.originalEndIndex + Math.round(deltaY / slotH);
          const maxSlots = (endHour - startHour) * 2;
          newEnd = Math.max(prev.originalStartIndex + 1, Math.min(newEnd, maxSlots));
          return { ...prev, endIndex: newEnd };
        } else if(prev.type === 'create') {
          // NOWE: oblicz slot wg pozycji kursora względem kolumny dnia – dwukierunkowe zaznaczanie
          const colEl = dayColRefs.current[prev.day];
          if(!colEl) return prev;
          const rect = colEl.getBoundingClientRect();
          const relY = Math.min(Math.max(e.clientY - rect.top, 0), rect.height - 1);
          const currentIdx = Math.min((endHour - startHour)*2 - 1, Math.max(0, Math.floor(relY / (rect.height / ((endHour - startHour)*2)))));
          const anchor = prev.originalStartIndex;
          const newStart = Math.min(anchor, currentIdx);
          const newEnd = Math.max(anchor, currentIdx) + 1; // exclusive
          if(newStart === prev.startIndex && newEnd === prev.endIndex) return prev;
          return { ...prev, startIndex: newStart, endIndex: newEnd };
        }
        return prev;
      });
    };
    const handleEditUp = () => { finalizeActiveEdit(); };
    window.addEventListener('mousemove', handleEditMove);
    window.addEventListener('mouseup', handleEditUp, { once: true });
    return () => { window.removeEventListener('mousemove', handleEditMove); };
  }, [activeEdit, finalizeActiveEdit, startHour, endHour]);

  // Helper to compute slot indices for a range
  const rangeToIndices = (range: AvailabilityRange) => {
    const startD = new Date(range.start);
    const endD = new Date(range.end);
    const startMinutes = startD.getHours()*60 + startD.getMinutes();
    const endMinutes = endD.getHours()*60 + endD.getMinutes();
    const rawStart = (startMinutes - startHour*60)/30;
    const rawEnd = (endMinutes - startHour*60)/30;
    const startIndex = Math.max(0, Math.min(totalSlots-1, Math.floor(rawStart)));
    const endIndex = Math.max(startIndex+1, Math.min(totalSlots, Math.ceil(rawEnd)));
    return { startIndex, endIndex };
  };

  // NEW: helper do przeliczenia spotkań na indeksy slotów
  const meetingToIndices = (meeting: Meeting) => {
    const [sh, sm] = meeting.startTime.split(':').map(Number);
    const [eh, em] = meeting.endTime.split(':').map(Number);
    const startMinutes = sh*60 + sm;
    const endMinutes = eh*60 + em;
    const rawStart = (startMinutes - startHour*60)/30;
    const rawEnd = (endMinutes - startHour*60)/30;
    const startIndex = Math.max(0, Math.min(totalSlots-1, Math.floor(rawStart)));
    const endIndex = Math.max(startIndex+1, Math.min(totalSlots, Math.ceil(rawEnd)));
    return { startIndex, endIndex };
  };

  // NEW: tooltip state for meetings
  const [hoveredMeeting, setHoveredMeeting] = useState<{meeting: Meeting; x: number; y: number} | null>(null);
  const roomMap = React.useMemo(()=> Object.fromEntries(rooms.map(r=> [r.id, r.name])), [rooms]);
  const handleMeetingEnter = (e: React.MouseEvent, meeting: Meeting) => {
    setHoveredMeeting({ meeting, x: e.clientX, y: e.clientY });
  };
  const handleMeetingMove = (e: React.MouseEvent) => {
    setHoveredMeeting(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev);
  };
  const handleMeetingLeave = () => setHoveredMeeting(null);

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const employeeMeetings = getEmployeeMeetings();
    const calendarHeight = 'calc(100vh - 292px)';
    const hourColWidth = 56;
    const gridTemplate = { gridTemplateColumns: `${hourColWidth}px repeat(${weekDays.length}, 1fr)` };
    const activeId = activeEdit?.id;
    const allRanges = [...availabilities, ...tempRanges].filter(r => r.specialistId === selectedEmployee);
    const byDay: Record<string, AvailabilityRange[]> = {};
    allRanges.forEach(r => { if(r.id!==activeId){ const dayStr = new Date(r.start).toISOString().split('T')[0]; (byDay[dayStr] ||= []).push(r);} });
    return (
      <div className="rounded-xl shadow-sm border border-gray-200 flex flex-col h-full bg-transparent">
        <div className="flex-1 overflow-hidden select-none">
          <div className="h-full flex flex-col">
            <div className="grid divide-x divide-gray-200 bg-white sticky top-0 z-10" style={gridTemplate}>
              <div className="px-1 py-0.5 bg-white flex items-center justify-center">
                <div className="text-[12px] font-semibold text-gray-600 leading-tight text-center">Godzina</div>
              </div>
              {weekDays.map((day, idx) => (
                <div key={idx} className="px-2 py-1 bg-white text-center">
                  <div className="text-sm font-medium text-gray-900 leading-snug">{day.toLocaleDateString('pl-PL', { weekday: 'short' })}</div>
                  <div className="text-xs text-gray-600 mt-0.5 leading-none">{day.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</div>
                </div>
              ))}
            </div>
            <div className="grid flex-1 divide-x divide-gray-200" style={{...gridTemplate, height: calendarHeight}}>
              <div className="relative px-1" style={{height:'100%'}}>
                <div className="absolute inset-0 flex flex-col">
                  {timeSlots.map((t,i)=>(
                    <div key={i} className={`flex-1 flex items-center justify-center ${i>0?'border-t border-gray-200':''}`}> <span className="text-[12px] font-medium text-gray-700 select-none leading-none tracking-tight">{t}</span></div>
                  ))}
                </div>
              </div>
              {weekDays.map((day, idx) => {
                const dayStr = formatDateForComparison(day);
                const dayMeetings = employeeMeetings.filter(m=> m.date===dayStr);
                const dayRanges = byDay[dayStr] || [];
                const isEditDay = activeEdit?.day === dayStr;
                const editStart = activeEdit?.startIndex ?? -1;
                const editEnd = activeEdit?.endIndex ?? -1;
                return (
                  <div key={idx} ref={el=> { dayColRefs.current[dayStr]=el; }} className="relative overflow-hidden" style={{height:'100%'}}>
                    <div className="absolute inset-0 flex flex-col">
                      {timeSlots.map((t, slotIdx)=> {
                        const isSelectedSlot = isEditDay && slotIdx>=editStart && slotIdx<editEnd;
                        return (
                          <div key={slotIdx} className={`day-slot relative flex-1 px-1 ${slotIdx>0?'border-t border-gray-200':''} ${isSelectedSlot?'bg-green-50':''} cursor-crosshair`}
                            onMouseDown={(e)=> {
                              if(e.button!==0) return; e.preventDefault(); if(!selectedEmployee || activeEdit) return;
                              const colEl = dayColRefs.current[dayStr];
                              const rect = colEl? colEl.getBoundingClientRect(): {height:0} as any;
                              const slotH = rect.height / totalSlots;
                              const newId = 'new-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
                              setActiveEdit({ id:newId, day:dayStr, type:'create', originalStartIndex:slotIdx, originalEndIndex:slotIdx+1, startIndex:slotIdx, endIndex:slotIdx+1, originY:e.clientY, slotHeight:slotH, isTemp:true, daySnapshot:[...(availabilities.filter(r=> dayKey(r.start)===dayStr && r.specialistId===selectedEmployee)), ...(tempRanges.filter(r=> dayKey(r.start)===dayStr && r.specialistId===selectedEmployee))] });
                            }}
                            onMouseEnter={()=> { setActiveEdit(prev=> { if(!prev|| prev.type!=='create'|| prev.day!==dayStr) return prev; const anchor=prev.originalStartIndex; const newStart=Math.min(anchor, slotIdx); const newEnd=Math.max(anchor, slotIdx)+1; if(newStart===prev.startIndex && newEnd===prev.endIndex) return prev; return { ...prev, startIndex:newStart, endIndex:newEnd };}); }}>
                            <span className={`absolute inset-0 flex items-center justify-start pl-1 text-[11px] font-semibold select-none pointer-events-none ${isSelectedSlot?'text-green-800':'text-gray-600'}`}>{t}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="absolute inset-0 z-0 pointer-events-none">
                      {dayRanges.map(r=> {
                        const { startIndex, endIndex } = rangeToIndices(r);
                        const topPct = (startIndex/ totalSlots)*100;
                        const heightPct = ((endIndex-startIndex)/ totalSlots)*100;
                        return (
                          <div key={r.id} className="group avail-block absolute left-1 right-1 rounded-md bg-green-100 hover:bg-green-200 shadow-sm text-[12px] md:text-[13px] flex flex-col cursor-move z-20 text-green-800 border border-green-300 pointer-events-auto" style={{ top:`${topPct}%`, height:`${heightPct}%` }}
                            onMouseDown={(e)=> { if(e.button!==0|| !selectedEmployee) return; const target=e.target as HTMLElement; if(target.closest('.delete-btn')|| target.closest('.avail-resize-handle')) return; e.stopPropagation(); const colEl=dayColRefs.current[dayStr]; const rect=colEl? colEl.getBoundingClientRect(): {height:0} as any; const slotH=rect.height / totalSlots; const { startIndex:sI, endIndex:eI }= rangeToIndices(r); const currentDayRanges=[...availabilities, ...tempRanges].filter(x=> x.specialistId===selectedEmployee && dayKey(x.start)===dayStr && x.id!==r.id); setAvailabilities(a=> a.filter(x=> x.id!==r.id)); setTempRanges(t=> t.filter(x=> x.id!==r.id)); setActiveEdit({ id:r.id, day:dayStr, type:'move', originalStartIndex:sI, originalEndIndex:eI, startIndex:sI, endIndex:eI, originY:e.clientY, slotHeight:slotH, isTemp: tempRanges.some(x=> x.id===r.id), daySnapshot: currentDayRanges }); }}>
                            <div className="px-2 pt-1 pb-2 flex justify-between items-start font-semibold text-[12px] md:text-[13px] select-none h-full">
                              <span className="leading-tight">{timeFromIndex(rangeToIndices(r).startIndex)} - {endTimeFromEndIndex(rangeToIndices(r).endIndex)}</span>
                              <button type="button" aria-label="Usuń dostępność" onMouseDown={(e)=> e.stopPropagation()} onClick={(e)=> { e.stopPropagation(); setPendingDeleteRange(r); }} className="delete-btn ml-2 shrink-0 h-7 w-7 flex items-center justify-center rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-400">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="avail-resize-handle absolute left-1/2 -translate-x-1/2 bottom-1 h-1.5 w-14 bg-green-600 rounded cursor-ns-resize hover:bg-green-700" onMouseDown={(e)=> { e.stopPropagation(); if(e.button!==0|| !selectedEmployee) return; const colEl=dayColRefs.current[dayStr]; const rect=colEl? colEl.getBoundingClientRect(): {height:0} as any; const slotH=rect.height / totalSlots; const { startIndex:sI, endIndex:eI }= rangeToIndices(r); const currentDayRanges=[...availabilities, ...tempRanges].filter(x=> x.specialistId===selectedEmployee && dayKey(x.start)===dayStr && x.id!==r.id); setAvailabilities(a=> a.filter(x=> x.id!==r.id)); setTempRanges(t=> t.filter(x=> x.id!==r.id)); setActiveEdit({ id:r.id, day:dayStr, type:'resize', originalStartIndex:sI, originalEndIndex:eI, startIndex:sI, endIndex:eI, originY:e.clientY, slotHeight:slotH, isTemp: tempRanges.some(x=> x.id===r.id), daySnapshot: currentDayRanges }); }} />
                          </div>
                        );
                      })}
                      {activeEdit && activeEdit.day===dayStr && (()=> { const { startIndex, endIndex }= activeEdit; const topPct=(startIndex/ totalSlots)*100; const heightPct=((endIndex-startIndex)/ totalSlots)*100; const startTime=timeFromIndex(startIndex); const endTime=endTimeFromEndIndex(endIndex); return (<div className="absolute left-1 right-1 rounded-md bg-green-200/80 text-[12px] md:text-[13px] flex flex-col pointer-events-none z-30 text-green-800 border border-green-300" style={{ top:`${topPct}%`, height:`${heightPct}%` }}><div className="px-1 py-0.5 font-semibold select-none">{startTime} - {endTime}</div></div>); })()}
                    </div>
                    <div className="absolute inset-0 z-40 pointer-events-none">
                      {dayMeetings.map(m=> { const { startIndex, endIndex } = meetingToIndices(m); const topPct=(startIndex/ totalSlots)*100; const heightPct=((endIndex-startIndex)/ totalSlots)*100; return (
                        <div key={m.id} className="absolute left-2 right-2 rounded-md bg-yellow-100/90 text-yellow-900 shadow-md text-[10px] leading-tight px-2 py-1 flex flex-col pointer-events-auto" style={{ top:`${topPct}%`, height:`${heightPct}%` }} onMouseEnter={(e)=> handleMeetingEnter(e,m)} onMouseMove={handleMeetingMove} onMouseLeave={handleMeetingLeave}>
                          <div className="font-semibold truncate">{m.patientName}</div>
                          <div className="text-[11px] opacity-80 tracking-tight">{m.startTime}-{m.endTime}</div>
                        </div> ); })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const [monthPending, setMonthPending] = React.useState(false);
  const monthActionsRef = React.useRef<{save:()=>void; discard:()=>void} | null>(null);

  return (
    <div className="flex-1 flex flex-col pb-6">
      {/* Sekcja wyboru pracownika */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">{/* removed label 'Pracownik:' */}
          {sortedEmployees.map(emp => {
            const active = emp.id === selectedEmployee;
            const disabled = currentUser.role === 'employee' && emp.id !== currentUser.id; // pracownik widzi tylko siebie
            return (
              <button
                key={emp.id}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={()=> { if(disabled) return; setSelectedEmployee(emp.id); }}
                className={`px-4 py-1.5 text-xs md:text-sm rounded-full border transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                  ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}
                  ${disabled && !active ? 'opacity-50 cursor-not-allowed hover:bg-white' : ''}`}
              >
                {emp.name}
              </button>
            );
          })}
        </div>
      </div>
      {/* Wybór pracownika + Save button on same row */}
      {selectedEmployee ? (
        <div className="flex flex-col flex-1 min-h-0">{/* wrapped to avoid adjacent JSX root elements error */}
          <div className="flex-shrink-0">{/* header container */}
            <CalendarHeader
              currentDate={currentDate}
              viewType={viewType}
              onDateChange={guardedSetCurrentDate}
              onViewTypeChange={(v)=>{ if(v==='week'||v==='month') setViewType(v); }}
              availableViews={['week','month']}
              centerContent={(
                <div className="flex flex-wrap items-center gap-4 justify-center">
                  {viewType === 'week' && (
                    <>
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
                              onClick={() => { setCopyPeriod('week'); setShowCopyDropdown(false); }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                            >
                              {copyPeriod === 'week' && <Check className="h-4 w-4 text-blue-600" />}
                              <span className={copyPeriod === 'week' ? 'text-blue-600 font-medium' : 'text-gray-700'}>kolejny tydzień</span>
                            </button>
                            <button
                              onClick={() => { setCopyPeriod('4weeks'); setShowCopyDropdown(false); }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                            >
                              {copyPeriod === '4weeks' && <Check className="h-4 w-4 text-blue-600" />}
                              <span className={copyPeriod === '4weeks' ? 'text-blue-600 font-medium' : 'text-gray-700'}>kolejne 4 tygodnie</span>
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
                    </>
                  )}
                  {viewType === 'month' && monthPending && (
                    <div className="flex items-center gap-2 ml-8 md:ml-12">
                      <button onClick={()=> monthActionsRef.current?.save()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">Zapisz zmiany</button>
                      <button onClick={()=> monthActionsRef.current?.discard()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">Odrzuć</button>
                    </div>
                  )}
                  {viewType === 'week' && (
                    <> {/* copy controls already above */} </>
                  )}
                  {viewType === 'month' && !monthPending && null}
                  {viewType === 'week' && (!pendingDeleteRange && (tempRanges.length > 0 || deletedRangeIds.length > 0)) && (
                    <div className="flex items-center gap-2 ml-8 md:ml-12">
                      <button onClick={saveAvailabilities} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">Zapisz zmiany</button>
                      <button onClick={discardChanges} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">Odrzuć</button>
                    </div>
                  )}
                </div>
              )}
            />
            {/* Removed separate bottom save/discard bar (now integrated in centerContent) */}
          </div>
          <div className="flex-1 min-h-0">
            {viewType === 'week' && renderWeekView()}
            {viewType === 'month' && (
              <MonthCalendar
                currentDate={currentDate}
                dayOffs={dayOffs}
                buildDateRange={buildDateRange}
                formatLocalDate={formatLocalDate}
                employees={sortedEmployees.map(e=> ({ id: e.id, name: e.name }))}
                defaultEmployeeId={selectedEmployee || undefined}
                onPendingStateChange={(has, actions)=> { setMonthPending(has); monthActionsRef.current = actions; }}
              />)}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-1 flex items-center justify-center">
          <p className="text-gray-500 text-center">Wybierz pracownika, aby wyświetlić jego grafik</p>
        </div>
      )}

      {/* Modal potwierdzenia usunięcia */}
      {pendingDeleteRange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-6">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2 text-center">Usuń dostępność?</h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed text-center">
                Czy na pewno chcesz usunąć ten zakres dostępności?
                Zmiana zostanie zapisana dopiero po kliknięciu "Zapisz zmiany".
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={()=> setPendingDeleteRange(null)}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >Anuluj</button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                >Usuń</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hoveredMeeting && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{ top: hoveredMeeting.y + 14, left: hoveredMeeting.x + 12 }}
        >
          <div className="bg-white border border-yellow-300 shadow-lg rounded-md px-3 py-2 text-xs text-gray-700 min-w-[160px]">
            <div className="font-semibold text-yellow-800 mb-1 leading-tight">{hoveredMeeting.meeting.patientName || 'Spotkanie'}</div>
            <div className="leading-tight text-gray-600">Sala: <span className="text-gray-800 font-medium">{roomMap[hoveredMeeting.meeting.roomId] || hoveredMeeting.meeting.roomId || 'Brak sali'}</span></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeCalendar;