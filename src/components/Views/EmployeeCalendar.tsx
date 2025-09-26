import React, { useState } from 'react';
import CalendarHeader from '../Calendar/CalendarHeader';
import { generateTimeSlots } from '../../utils/timeSlots';
import { User, Room, Meeting, Patient } from '../../types';
import { ChevronDown, Check, Trash2, Loader2 } from 'lucide-react';
import MonthCalendar from './MonthCalendar';
import MeetingForm from '../Forms/MeetingForm';
import { fetchEmployeeWorkHours } from '../../utils/api/employees';
import { createWorkHour, deleteWorkHour, updateWorkHour } from '../../utils/api/workhours';
import { useUnsavedChangesGuard } from '../common/UnsavedChangesGuard';

const DAYOFF_MEETING_PREFIX = 'dayoff-';

// === Date helpers ===
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
  showWeekends: boolean;
  startHour: number;
  endHour: number;
  onMeetingCreate: (m: Omit<Meeting,'id'>) => void;
  onMeetingUpdate: (id:string, u: Partial<Meeting>) => void;
  onMeetingDelete?: (id:string) => void;
  patients?: Patient[];
}

const EmployeeCalendar: React.FC<EmployeeCalendarProps> = ({ users, rooms, meetings, currentUser, showWeekends, startHour, endHour, onMeetingCreate, onMeetingUpdate, onMeetingDelete, patients = [] }) => {
  const { register, attempt } = useUnsavedChangesGuard();
  // Core state
  // Only admin can edit availability hours
  const canEditAvailability = currentUser.role === 'admin';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'week' | 'month'>('week');
  // selectedEmployee: for 'employee' and 'contact' restrict to own ID; admin can switch
  const [selectedEmployee, setSelectedEmployee] = useState((currentUser.role === 'employee' || currentUser.role === 'contact') ? currentUser.id : '');
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);
  type CopyPreset = 'week' | '2weeks' | '4weeks' | '8weeks' | '12weeks' | 'endOfMonth' | 'endOfNextMonth' | 'endOfQuarter' | 'endOfYear';
  const [copyPeriod, setCopyPeriod] = useState<CopyPreset>('week');
  const copyPresetLabel = React.useMemo(() => {
    const map: Record<CopyPreset, string> = {
      week: 'kolejny tydzień',
      '2weeks': 'kolejne 2 tygodnie',
      '4weeks': 'kolejne 4 tygodnie',
      '8weeks': 'kolejne 8 tygodni',
      '12weeks': 'kolejne 12 tygodni',
      endOfMonth: 'do końca miesiąca',
      endOfNextMonth: 'do końca następnego miesiąca',
      endOfQuarter: 'do końca kwartału',
      endOfYear: 'do końca roku',
    };
    return map[copyPeriod];
  }, [copyPeriod]);
  const copyPresets = React.useMemo(() => ([
    { key: 'week' as CopyPreset, label: 'kolejny tydzień' },
    { key: '2weeks' as CopyPreset, label: 'kolejne 2 tygodnie' },
    { key: '4weeks' as CopyPreset, label: 'kolejne 4 tygodnie' },
    { key: '8weeks' as CopyPreset, label: 'kolejne 8 tygodni' },
    { key: '12weeks' as CopyPreset, label: 'kolejne 12 tygodni' },
    { key: 'endOfMonth' as CopyPreset, label: 'do końca miesiąca' },
    { key: 'endOfNextMonth' as CopyPreset, label: 'do końca następnego miesiąca' },
    { key: 'endOfQuarter' as CopyPreset, label: 'do końca kwartału' },
    { key: 'endOfYear' as CopyPreset, label: 'do końca roku' },
  ]), []);
  const [deletedRangeIds, setDeletedRangeIds] = useState<string[]>([]);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | undefined>();
  // const [selectedTime, setSelectedTime] = useState('');
  const [selectedTime] = useState('');
  // UI loading for copy action
  const [isCopying, setIsCopying] = useState(false);

  // Availability state
  interface AvailabilityRange { id: string; specialistId: string; start: string; end: string; }
  const [pendingDeleteRange, setPendingDeleteRange] = useState<AvailabilityRange | null>(null);
  const [availabilities, setAvailabilities] = useState<AvailabilityRange[]>([]);
  const [tempRanges, setTempRanges] = useState<AvailabilityRange[]>([]);

  // Day-offs for month view (now purely in-memory; no localStorage)
  interface DayOff { id: string; specialistId: string; date: string; note?: string; groupId?: string; }
  const [dayOffs, setDayOffs] = useState<DayOff[]>([]);
  const [allDayOffs, setAllDayOffs] = useState<DayOff[]>([]);
  const handleMonthBaselineChange = React.useCallback((base: DayOff[]) => {
    setAllDayOffs(base);
    if (selectedEmployee) {
      setDayOffs(base.filter(d => d.specialistId === selectedEmployee));
    } else {
      setDayOffs([]);
    }
  }, [selectedEmployee]);
  React.useEffect(() => {
    // re-filter when employee changes
    setDayOffs(selectedEmployee ? allDayOffs.filter(d => d.specialistId === selectedEmployee) : []);
  }, [selectedEmployee, allDayOffs]);
  // Helpers for rendering day-off blocks in week view
  const formatDayDisplayFull = React.useCallback((iso:string)=> { if(!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}.${m}.${y}`; }, []);
  const dayOffGroupMeta = React.useMemo(()=> {
    const map: Record<string, { start:string; end:string; note?: string; employees: string[] }> = {};
    allDayOffs.forEach(d=> {
      const key = d.groupId || d.id;
      if(!map[key]) { map[key] = { start:d.date, end:d.date, note:d.note, employees: [d.specialistId] }; }
      else {
        if(d.date < map[key].start) map[key].start = d.date;
        if(d.date > map[key].end) map[key].end = d.date;
        if(d.note && !map[key].note) map[key].note = d.note;
        if(!map[key].employees.includes(d.specialistId)) map[key].employees.push(d.specialistId);
      }
    });
    return map;
  }, [allDayOffs]);

  // Month view pending marker callback integration
  const [monthPending, setMonthPending] = React.useState(false);
  const monthActionsRef = React.useRef<{ save: ()=>void; discard: ()=>void } | null>(null);

  // Dynamic month container ref (tile height handled in MonthCalendar now)
  const monthContainerRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(()=> { const recalc=()=> { if(!monthContainerRef.current) return; }; window.addEventListener('resize', recalc); return ()=> window.removeEventListener('resize', recalc); }, []);

  // Employees list
  const timeSlots = generateTimeSlots(startHour, endHour);
  // Previously only employees were shown; now show all users (admin, contact, employee) and display full name
  const allDisplayUsers = React.useMemo(()=> {
    return [...users].sort((a,b)=> {
      const surCmp = (a.surname || '').localeCompare(b.surname || '', 'pl');
      if (surCmp !== 0) return surCmp;
      return a.name.localeCompare(b.name, 'pl');
    });
  }, [users]);

  // Week helpers
  const getWeekDays = (date: Date) => { const week: Date[]=[]; const start=new Date(date); start.setDate(date.getDate() - date.getDay() + 1); for(let i=0;i<7;i++){ const day=new Date(start); day.setDate(start.getDate()+i); if(!showWeekends){ const dow=day.getDay(); if(dow===0|| dow===6) continue; } week.push(day);} return week; };
  const formatDateForComparison = (date: Date)=> formatLocalDate(date);
  // const getEmployeeMeetings = ()=> selectedEmployee? meetings.filter(m=> m.specialistId===selectedEmployee): [];

  // Auto-select first user (including admins / contacts) if current user is not a regular employee and none selected yet
  // Auto-select first only for admin (contact behaves like employee)
  React.useEffect(()=> { if(currentUser.role!=='employee' && currentUser.role!=='contact' && !selectedEmployee && allDisplayUsers.length){ setSelectedEmployee(allDisplayUsers[0].id);} }, [currentUser.role, selectedEmployee, allDisplayUsers]);

  // Close copy dropdown on outside click
  React.useEffect(()=> { const handler=(e:MouseEvent)=> { const target=e.target as Element; if(showCopyDropdown && !target.closest('.copy-dropdown')) setShowCopyDropdown(false); }; document.addEventListener('mousedown', handler); return ()=> document.removeEventListener('mousedown', handler); }, [showCopyDropdown]);

  // Week bounds
  const getWeekBounds = (date: Date) => { const start=new Date(date); start.setDate(date.getDate()-date.getDay()+1); start.setHours(0,0,0,0); const end=new Date(start); end.setDate(end.getDate()+6); end.setHours(23,59,59,999); return { start, end }; };
  const weekBounds = getWeekBounds(currentDate);

  // Load availabilities for employee + week from backend WorkHours
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!selectedEmployee) {
        setAvailabilities([]);
        setTempRanges([]);
        return;
      }
      const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
      if (!token) {
        setAvailabilities([]);
        setTempRanges([]);
        return;
      }
      try {
        const empId = Number(selectedEmployee);
        if (!Number.isFinite(empId)) {
          setAvailabilities([]);
          setTempRanges([]);
          return;
        }
        const list = await fetchEmployeeWorkHours(empId, token);
        const startMs = weekBounds.start.getTime();
        const endMs = weekBounds.end.getTime();
        const mapped = list
          .filter(w => {
            const s = new Date(w.start).getTime();
            const e = new Date(w.end).getTime();
            return e >= startMs && s <= endMs;
          })
          .map(w => ({ id: String(w.id), specialistId: selectedEmployee, start: w.start, end: w.end }));
        if (!cancelled) {
          setAvailabilities(mapped);
          setTempRanges([]);
          setDeletedRangeIds([]);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('Nie udało się pobrać godzin pracy pracownika', e);
          setAvailabilities([]);
          setTempRanges([]);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedEmployee, weekBounds.start.getTime(), weekBounds.end.getTime(), currentUser?.token]);

  // Guard date change if unsaved (dialog-based)
  const guardedSetCurrentDateWithDialog = (d: Date) => {
    const newBounds = getWeekBounds(d);
    const sameWeek = weekBounds.start.getTime() === newBounds.start.getTime();
    if (sameWeek) { setCurrentDate(d); return; }
    attempt(() => setCurrentDate(d), {
      title: 'Niezapisane zmiany w grafiku',
      message: 'Masz zmiany w bieżącym tygodniu. Zapisz lub odrzuć, aby przejść do innego tygodnia.'
    });
  };

  // Merge adjacency helper
  const mergeRangesAdjacency = (ranges: AvailabilityRange[]): AvailabilityRange[] => {
    if (!ranges.length) return [];
    const sorted = [...ranges].sort((a,b)=> new Date(a.start).getTime() - new Date(b.start).getTime());
    const out: AvailabilityRange[] = [];
    for (const r of sorted) {
      if (!out.length) { out.push({...r}); continue; }
      const last = out[out.length - 1];
      const rStart = new Date(r.start).getTime();
      const lastEnd = new Date(last.end).getTime();
      if (rStart <= lastEnd) {
        const rEnd = new Date(r.end).getTime();
        if (rEnd > lastEnd) last.end = r.end; // extend
      } else {
        out.push({...r});
      }
    }
    return out;
  };

  // Save & discard
  // Persist selected employee availability ranges to backend WorkHours by replacing the CURRENT WEEK fully
  // Fixes: (1) Deletions were not persisted when week became empty; (2) Moves/edits created duplicates
  const saveAvailabilities = async () => {
    if (!selectedEmployee) return;
    const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
    if (!token) {
      console.warn('Brak tokenu – nie można zapisać dostępności.');
      return;
    }
    const employeeIdNum = Number(selectedEmployee);
    if (!Number.isFinite(employeeIdNum)) {
      console.warn('Nieprawidłowe ID pracownika – oczekiwano liczby.');
      return;
    }

    // Helper week bounds
    const weekStartMs = weekBounds.start.getTime();
    const weekEndMs = weekBounds.end.getTime();
    const intersectsRange = (s: Date, e: Date, ws: number, we: number) => e.getTime() >= ws && s.getTime() <= we;
    // Union of ranges for this employee (UI state)
    const unionRanges = [...availabilities, ...tempRanges].filter(r => r.specialistId === selectedEmployee);
    // Determine which weeks to persist: always current week + any weeks that have tempRanges (e.g., copied)
    const weeksToProcess = new Set<number>([weekStartMs]);
    for (const tr of tempRanges) {
      if (tr.specialistId !== selectedEmployee) continue;
      const d = new Date(tr.start);
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay() + 1);
      start.setHours(0,0,0,0);
      weeksToProcess.add(start.getTime());
    }

    try {
      // Helper to format local datetime without timezone (YYYY-MM-DDTHH:mm:ss)
      const toLocalNoZ = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = '00';
        return `${y}-${m}-${dd}T${hh}:${mm}:${ss}`;
      };
      // Load all existing once (we'll slice by week per iteration)
      const existingAll = await fetchEmployeeWorkHours(employeeIdNum, token);
      const isNumericId = (id: string) => /^\d+$/.test(id);
      const canonical = (s: string) => toLocalNoZ(new Date(s));

      // Process each affected week
      for (const wkStart of weeksToProcess) {
        const wkStartDate = new Date(wkStart);
        const wkEndDate = new Date(wkStartDate);
        wkEndDate.setDate(wkEndDate.getDate() + 6);
        wkEndDate.setHours(23,59,59,999);
        const wsMs = wkStartDate.getTime();
        const weMs = wkEndDate.getTime();

        const existingInWeek = existingAll.filter(w => {
          const s = new Date(w.start).getTime();
          const e = new Date(w.end).getTime();
          return e >= wsMs && s <= weMs;
        });
        const desiredInWeek = unionRanges.filter(r => intersectsRange(new Date(r.start), new Date(r.end), wsMs, weMs));

        if (wkStart === weekStartMs) {
          // Current week: granular DIFF (DELETE missing, PUT changed, POST new)
          const existingById = new Map<string, { id: number; start: string; end: string }>();
          for (const w of existingInWeek) existingById.set(String(w.id), { id: w.id, start: canonical(w.start), end: canonical(w.end) });
          const desiredById = new Map<string, { id: string; start: string; end: string }>();
          for (const r of desiredInWeek) desiredById.set(r.id, { id: r.id, start: canonical(r.start), end: canonical(r.end) });

          const deleteIds: number[] = [];
          for (const w of existingInWeek) {
            const idStr = String(w.id);
            if (!desiredById.has(idStr) || deletedRangeIds.includes(idStr)) deleteIds.push(w.id);
          }
          for (const id of deleteIds) {
            try { await deleteWorkHour(id, token); } catch (e) { console.warn('Delete workhour failed', id, e); }
          }

          for (const r of desiredInWeek) {
            const rStart = canonical(r.start);
            const rEnd = canonical(r.end);
            if (isNumericId(r.id) && existingById.has(r.id)) {
              const ex = existingById.get(r.id)!;
              if (ex.start !== rStart || ex.end !== rEnd) {
                try { await updateWorkHour(Number(r.id), { start: rStart, end: rEnd, employeeId: employeeIdNum }, token); } catch (e) { console.warn('Update workhour failed', r.id, e); }
              }
            } else {
              try { await createWorkHour({ start: rStart, end: rEnd, employeeId: employeeIdNum }, token); } catch (e) { console.warn('Create workhour failed', r, e); }
            }
          }
        } else {
          // Future (or other) week touched by copy: REPLACE that week (delete all existingInWeek then create desired)
          for (const w of existingInWeek) {
            try { await deleteWorkHour(w.id, token); } catch (e) { console.warn('Delete workhour (future) failed', w.id, e); }
          }
          for (const r of desiredInWeek) {
            try { await createWorkHour({ start: canonical(r.start), end: canonical(r.end), employeeId: employeeIdNum }, token); } catch (e) { console.warn('Create workhour (future) failed', r, e); }
          }
        }
      }

      // 3) Refetch current week from backend to ensure consistency and avoid duplicates
      try {
        const refreshed = await fetchEmployeeWorkHours(employeeIdNum, token);
        const mapped = refreshed
          .filter(w => {
            const s = new Date(w.start).getTime();
            const e = new Date(w.end).getTime();
            return e >= weekStartMs && s <= weekEndMs;
          })
          .map(w => ({ id: String(w.id), specialistId: selectedEmployee, start: w.start, end: w.end }));
        setAvailabilities(mapped);
      } catch (e) {
        console.warn('Refetch after save failed', e);
        // fallback: show current-week unionRanges filtered (best effort)
        const fallback = unionRanges.filter(r => intersectsRange(new Date(r.start), new Date(r.end), weekStartMs, weekEndMs));
        setAvailabilities(fallback);
      }
      setTempRanges([]);
      setDeletedRangeIds([]);
    } catch (e) {
      console.warn('Nie udało się zapisać dostępności do backendu', e);
    }
  };
  const discardChanges = () => {
    if (!selectedEmployee) return;
    setPendingDeleteRange(null);
    setActiveEdit(null);
    setDeletedRangeIds([]);
    setTempRanges([]);
    // Reload backend availabilities for current employee and week (do not clear persistent data)
    (async () => {
      try {
        const token = (currentUser?.token) || localStorage.getItem('token') || undefined;
        const empId = Number(selectedEmployee);
        if (!token || !Number.isFinite(empId)) return;
        const list = await fetchEmployeeWorkHours(empId, token);
        const startMs = weekBounds.start.getTime();
        const endMs = weekBounds.end.getTime();
        const mapped = list
          .filter(w => {
            const s = new Date(w.start).getTime();
            const e = new Date(w.end).getTime();
            return e >= startMs && s <= endMs;
          })
          .map(w => ({ id: String(w.id), specialistId: selectedEmployee, start: w.start, end: w.end }));
        setAvailabilities(mapped);
      } catch (e) {
        console.warn('Nie udało się odświeżyć godzin pracy po odrzuceniu zmian', e);
      }
    })();
  };

  // Delete confirm
  const handleConfirmDelete = () => { if(pendingDeleteRange){ const id=pendingDeleteRange.id; setAvailabilities(a=> a.filter(r=> r.id!==id)); setTempRanges(t=> t.filter(r=> r.id!==id)); setDeletedRangeIds(ids=> ids.includes(id)? ids : [...ids, id]); setPendingDeleteRange(null); } };

  // Active edit logic
  interface ActiveEditState { id: string; day: string; type: 'create'|'move'|'resize'; originalStartIndex: number; originalEndIndex: number; startIndex: number; endIndex: number; originY: number; slotHeight: number; isTemp: boolean; daySnapshot: AvailabilityRange[]; }
  const [activeEdit, setActiveEdit] = useState<ActiveEditState | null>(null);
  const activeEditRef = React.useRef<ActiveEditState | null>(null);
  React.useEffect(()=> { activeEditRef.current = activeEdit; }, [activeEdit]);
  const dayColRefs = React.useRef<{[day:string]: HTMLDivElement | null}>({});
  const totalSlots = (endHour - startHour) * 2;
  const timeFromIndex = (idx:number)=> timeSlots[idx];
  const endTimeFromEndIndex = (endIdx:number)=> { const base=timeSlots[endIdx-1]; const [h,m]=base.split(':').map(Number); const date=new Date(); date.setHours(h, m+30,0,0); return date.toTimeString().substring(0,5); };
  const toISO = (day:string, time:string)=> new Date(`${day}T${time}:00`).toISOString();
  const dayKey = (iso: string)=> iso.slice(0,10);

  const finalizeActiveEdit = React.useCallback(()=> { const prev=activeEditRef.current; if(!prev) return; const day=prev.day; const startTime=timeFromIndex(prev.startIndex); const endTime=endTimeFromEndIndex(prev.endIndex); const startISO=toISO(day,startTime); const endISO=toISO(day,endTime); const updated:AvailabilityRange={ id:prev.id, specialistId:selectedEmployee||'', start:startISO, end:endISO }; const snapshot=prev.daySnapshot.filter(r=> r.id!==updated.id); const mergedDay = mergeRangesAdjacency([...snapshot, updated]); setAvailabilities(a=> a.filter(r=> dayKey(r.start)!==day || r.specialistId!==selectedEmployee)); setTempRanges(t=> { const others=t.filter(r=> dayKey(r.start)!==day || r.specialistId!==selectedEmployee); return [...others, ...mergedDay]; }); setActiveEdit(null); }, [selectedEmployee]);

  React.useEffect(()=> { if(!activeEdit) return; const move=(e:MouseEvent)=> { setActiveEdit(prev=> { if(!prev) return prev; const deltaY=e.clientY - prev.originY; const slotH=prev.slotHeight; if(!slotH) return prev; if(prev.type==='move'){ const duration=prev.originalEndIndex-prev.originalStartIndex; let newStart=prev.originalStartIndex + Math.round(deltaY/slotH); const maxSlots=(endHour-startHour)*2; newStart=Math.max(0, Math.min(newStart, maxSlots - duration)); return { ...prev, startIndex:newStart, endIndex:newStart+duration }; } else if(prev.type==='resize'){ let newEnd=prev.originalEndIndex + Math.round(deltaY/slotH); const maxSlots=(endHour-startHour)*2; newEnd=Math.max(prev.originalStartIndex+1, Math.min(newEnd, maxSlots)); return { ...prev, endIndex:newEnd }; } else if(prev.type==='create'){ const colEl=dayColRefs.current[prev.day]; if(!colEl) return prev; const rect=colEl.getBoundingClientRect(); const relY=Math.min(Math.max(e.clientY-rect.top,0), rect.height-1); const currentIdx=Math.min((endHour-startHour)*2 -1, Math.max(0, Math.floor(relY / (rect.height/((endHour-startHour)*2))))); const anchor=prev.originalStartIndex; const newStart=Math.min(anchor, currentIdx); const newEnd=Math.max(anchor, currentIdx)+1; if(newStart===prev.startIndex && newEnd===prev.endIndex) return prev; return { ...prev, startIndex:newStart, endIndex:newEnd }; } return prev; }); }; const up=()=> finalizeActiveEdit(); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up, { once:true }); return ()=> { window.removeEventListener('mousemove', move); }; }, [activeEdit, finalizeActiveEdit, startHour, endHour]);

  const rangeToIndices = (range:AvailabilityRange)=> { const startD=new Date(range.start); const endD=new Date(range.end); const startMinutes=startD.getHours()*60 + startD.getMinutes(); const endMinutes=endD.getHours()*60 + endD.getMinutes(); const rawStart=(startMinutes-startHour*60)/30; const rawEnd=(endMinutes-startHour*60)/30; const startIndex=Math.max(0, Math.min(totalSlots-1, Math.floor(rawStart))); const endIndex=Math.max(startIndex+1, Math.min(totalSlots, Math.ceil(rawEnd))); return { startIndex, endIndex }; };

  // Meetings helper (przywrócone)
  const meetingToIndices = React.useCallback((m: Meeting) => {
    const [sh, sm] = m.startTime.split(':').map(Number);
    const [eh, em] = m.endTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    const rawStart = (startMinutes - startHour * 60) / 30;
    const rawEnd = (endMinutes - startHour * 60) / 30;
    const startIndex = Math.max(0, Math.min(totalSlots - 1, Math.floor(rawStart)));
    const endIndex = Math.max(startIndex + 1, Math.min(totalSlots, Math.ceil(rawEnd)));
    return { startIndex, endIndex };
  }, [startHour, endHour, totalSlots]);

  // Copy availability handler
  const handleCopyAvailability = async () => {
    if (!selectedEmployee) return;

    // Zbierz dane bazowe, zanim włączymy spinner
    const baseMonday = new Date(weekBounds.start);
    baseMonday.setHours(0, 0, 0, 0);
    const firstTargetMonday = new Date(baseMonday);
    firstTargetMonday.setDate(firstTargetMonday.getDate() + 7);

    const working = [
      ...availabilities.filter(r => r.specialistId === selectedEmployee),
      ...tempRanges.filter(r => r.specialistId === selectedEmployee),
    ];
    const baseWeekRanges = working.filter(r => {
      const startDate = new Date(r.start);
      return startDate >= weekBounds.start && startDate <= weekBounds.end;
    });
    if (!baseWeekRanges.length) { setShowCopyDropdown(false); return; }

    setIsCopying(true);
    const t0 = Date.now();
    try {
      // Helpers do wyznaczania granic
      const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const endOfNextMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 2, 0, 23, 59, 59, 999);
      const endOfQuarter = (d: Date) => {
        const qEndMonth = Math.floor(d.getMonth() / 3) * 3 + 2;
        return new Date(d.getFullYear(), qEndMonth + 1, 0, 23, 59, 59, 999);
      };
      const endOfYear = (d: Date) => new Date(d.getFullYear(), 12, 0, 23, 59, 59, 999); // Dec 31

      // Zbierz docelowe poniedziałki (pełne tygodnie)
      const targetMondays: Date[] = [];
      const pushWeeks = (count: number) => {
        for (let i = 1; i <= count; i++) {
          const m = new Date(baseMonday);
          m.setDate(m.getDate() + i * 7);
          targetMondays.push(m);
        }
      };
      const pushUntil = (endBoundary: Date) => {
        const capWeeks = 104; // twardy limit bezpieczeństwa
        let i = 0;
        for (let m = new Date(firstTargetMonday); m <= endBoundary && i < capWeeks; m.setDate(m.getDate() + 7), i++) {
          targetMondays.push(new Date(m));
        }
      };

      switch (copyPeriod) {
        case 'week': pushWeeks(1); break;
        case '2weeks': pushWeeks(2); break;
        case '4weeks': pushWeeks(4); break;
        case '8weeks': pushWeeks(8); break;
        case '12weeks': pushWeeks(12); break;
        case 'endOfMonth': pushUntil(endOfMonth(currentDate)); break;
        case 'endOfNextMonth': pushUntil(endOfNextMonth(currentDate)); break;
        case 'endOfQuarter': pushUntil(endOfQuarter(currentDate)); break;
        case 'endOfYear': pushUntil(endOfYear(currentDate)); break;
      }

      if (!targetMondays.length) { setShowCopyDropdown(false); return; }

      const dayMs = 24 * 60 * 60 * 1000;
      const newRanges: AvailabilityRange[] = [];
      let counter = 0;
      for (const targetMonday of targetMondays) {
        const deltaDays = Math.round((targetMonday.getTime() - baseMonday.getTime()) / dayMs);
        for (const r of baseWeekRanges) {
          const startDate = new Date(r.start);
          const endDate = new Date(r.end);
          startDate.setDate(startDate.getDate() + deltaDays);
          endDate.setDate(endDate.getDate() + deltaDays);
          newRanges.push({
            id: `copy-${Date.now()}-${deltaDays}-${counter++}`,
            specialistId: r.specialistId,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          });
        }
      }

      if (!newRanges.length) { setShowCopyDropdown(false); return; }
      setTempRanges(prev => [...prev, ...newRanges]);
      setShowCopyDropdown(false);
    } finally {
      const elapsed = Date.now() - t0;
      const remaining = Math.max(0, 500 - elapsed);
      window.setTimeout(() => setIsCopying(false), remaining);
    }
  };

  // Saving dialog overlay and helper
  const [showSavingDialog, setShowSavingDialog] = useState(false);
  const runWithSaving = async (action: ()=>void | Promise<void>) => {
    if (showSavingDialog) return;
    setShowSavingDialog(true);
    try {
      await action();
    } finally {
      setShowSavingDialog(false);
    }
  };

  // Register this calendar with the global Unsaved Changes guard
  React.useEffect(() => {
    const unsubscribe = register({
      isDirty: () => (tempRanges.length > 0 || deletedRangeIds.length > 0 || monthPending),
      save: async () => {
        await runWithSaving(async () => {
          if (monthPending && monthActionsRef.current) {
            await monthActionsRef.current.save();
          }
          if (tempRanges.length > 0 || deletedRangeIds.length > 0) {
            await saveAvailabilities();
          }
        });
      },
      discard: async () => {
        if (monthPending && monthActionsRef.current) {
          monthActionsRef.current.discard();
        }
        if (tempRanges.length > 0 || deletedRangeIds.length > 0) {
          discardChanges();
        }
      },
      title: 'Niezapisane zmiany',
      message: 'Masz niezapisane zmiany w grafiku. Co chcesz zrobić?'
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register, monthPending, tempRanges.length, deletedRangeIds.length]);

  // Patients resolver to display full names instead of IDs (prefer backend patients prop)
  const patientNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    try {
      if (patients && patients.length) {
        patients.forEach(p => { map[String(p.id)] = `${p.name} ${p.surname}`; });
      }
    } catch {}
    return map;
  }, [patients]);

  const getSpecialistNames = (m: Meeting) => {
    const ids = (m.specialistIds?.length ? m.specialistIds : [m.specialistId]).filter(Boolean) as string[];
    return ids.map(id => users.find(u => u.id === id)?.name || id).join(', ');
  };

  const getPatientNames = (m: Meeting) => {
    if (m.patientIds && m.patientIds.length) {
      const names = m.patientIds.map(id => patientNameById[id]).filter(Boolean);
      if (names.length) return names.join(', ');
    }
    if (m.patientNamesList && m.patientNamesList.length) {
      const fixed = m.patientNamesList.map(n => (/^p\d+$/i.test(n) && patientNameById[n]) ? patientNameById[n] : n);
      const label = fixed.join(', ').trim();
      if (label) return label;
    }
    // Legacy single fields
    // @ts-ignore - legacy property may exist
    if (m.patientId && patientNameById[m.patientId]) return patientNameById[m.patientId];
    return (m.patientName || '').trim();
  };

  const getRoomName = (roomId: string) => rooms.find(r => r.id === roomId)?.name || roomId;

  // Week view renderer
  const renderWeekView = () => { const weekDays=getWeekDays(currentDate); const employeeMeetings = selectedEmployee? meetings.filter(m=> (m.specialistId===selectedEmployee || (m.specialistIds?.includes(selectedEmployee) ?? false)) && !m.id.startsWith(DAYOFF_MEETING_PREFIX)): []; const calendarHeight='calc(100vh - 292px)'; const hourColWidth=56; const gridTemplate={ gridTemplateColumns: `${hourColWidth}px repeat(${weekDays.length}, 1fr)` }; const activeId=activeEdit?.id; const allRanges=[...availabilities, ...tempRanges].filter(r=> r.specialistId===selectedEmployee); const byDay: Record<string, AvailabilityRange[]> = {}; allRanges.forEach(r=> { if(r.id!==activeId){ const dayStr=new Date(r.start).toISOString().split('T')[0]; (byDay[dayStr] ||= []).push(r);} }); return (
    <div className="rounded-xl shadow-sm border border-gray-200 flex flex-col h-full bg-transparent">
      <div className="flex-1 overflow-hidden select-none">
        <div className="h-full flex flex-col">
          <div className="grid divide-x divide-gray-200 bg-white sticky top-0 z-10" style={gridTemplate}>
            <div className="px-1 py-0.5 bg-white flex items-center justify-center"><div className="text-[12px] font-semibold text-gray-600 leading-tight text-center">Godzina</div></div>
            {weekDays.map((day, idx)=> (
              <div key={idx} className="px-2 py-1 bg-white text-center">
                <div className="text-sm font-medium text-gray-900 leading-snug">{day.toLocaleDateString('pl-PL',{ weekday:'short' })}</div>
                <div className="text-xs text-gray-600 mt-0.5 leading-none">{day.toLocaleDateString('pl-PL',{ day:'numeric', month:'short' })}</div>
              </div>
            ))}
          </div>
          <div className="grid flex-1 divide-x divide-gray-200" style={{...gridTemplate, height:calendarHeight}}>
            <div className="relative px-1" style={{height:'100%'}}>
              <div className="absolute inset-0 flex flex-col">
                {timeSlots.map((t,i)=>(<div key={i} className={`flex-1 flex items-center justify-center ${i>0?'border-t border-gray-200':''}`}> <span className="text-[12px] font-medium text-gray-700 select-none leading-none tracking-tight">{t}</span></div>))}
              </div>
            </div>
            {weekDays.map((day, idx)=> { const dayStr=formatDateForComparison(day); const dayMeetings = employeeMeetings.filter(m=> m.date===dayStr); const dayRanges=byDay[dayStr] || []; const isEditDay=activeEdit?.day===dayStr; const editStart=activeEdit?.startIndex ?? -1; const editEnd=activeEdit?.endIndex ?? -1; return (
              <div key={idx} ref={el=> { dayColRefs.current[dayStr]=el; }} className="relative overflow-hidden" style={{height:'100%'}}>
                <div className="absolute inset-0 flex flex-col">
                  {timeSlots.map((t, slotIdx)=> { const isSelectedSlot=isEditDay && slotIdx>=editStart && slotIdx<editEnd; return (
                    <div key={slotIdx} className={`day-slot relative flex-1 px-1 ${slotIdx>0?'border-t border-gray-200':''} ${isSelectedSlot?'bg-green-50':''} ${canEditAvailability? 'cursor-crosshair':'cursor-default'}`}
                      onMouseDown={(e)=> { if(!canEditAvailability) return; if(e.button!==0) return; e.preventDefault(); if(!selectedEmployee || activeEdit) return; const colEl=dayColRefs.current[dayStr]; const rect=colEl? colEl.getBoundingClientRect(): {height:0} as any; const slotH=rect.height / totalSlots; const newId='new-'+Date.now()+'-'+Math.random().toString(36).slice(2,7); setActiveEdit({ id:newId, day:dayStr, type:'create', originalStartIndex:slotIdx, originalEndIndex:slotIdx+1, startIndex:slotIdx, endIndex:slotIdx+1, originY:e.clientY, slotHeight:slotH, isTemp:true, daySnapshot:[...(availabilities.filter(r=> dayKey(r.start)===dayStr && r.specialistId===selectedEmployee)), ...(tempRanges.filter(r=> dayKey(r.start)===dayStr && r.specialistId===selectedEmployee))] }); }}
                      onMouseEnter={()=> { if(!canEditAvailability) return; setActiveEdit(prev=> { if(!prev|| prev.type!=='create'|| prev.day!==dayStr) return prev; const anchor=prev.originalStartIndex; const newStart=Math.min(anchor, slotIdx); const newEnd=Math.max(anchor, slotIdx)+1; if(newStart===prev.startIndex && newEnd===prev.endIndex) return prev; return { ...prev, startIndex:newStart, endIndex:newEnd };}); }}>
                      <span className={`absolute inset-0 flex items-center justify-start pl-1 text-[11px] font-semibold select-none pointer-events-none ${isSelectedSlot?'text-green-800':'text-gray-600'}`}>{t}</span>
                    </div>
                  ); })}
                </div>
                <div className="absolute inset-0 z-0 pointer-events-none">
                  {dayRanges.map(r=> { const { startIndex, endIndex }= rangeToIndices(r); const topPct=(startIndex/totalSlots)*100; const heightPct=((endIndex-startIndex)/totalSlots)*100; return (
                    <div key={r.id} className={`group avail-block absolute left-1 right-1 rounded-md bg-green-100 ${canEditAvailability? 'hover:bg-green-200 cursor-move pointer-events-auto':'cursor-default'} shadow-sm text-[12px] md:text-[13px] flex flex-col z-20 text-green-800 border border-green-300 ${canEditAvailability? 'pointer-events-auto':'pointer-events-none'}`} style={{ top:`${topPct}%`, height:`${heightPct}%` }}
                      onMouseDown={(e)=> { if(!canEditAvailability) return; if(e.button!==0|| !selectedEmployee) return; const target=e.target as HTMLElement; if(target.closest('.delete-btn')|| target.closest('.avail-resize-handle')) return; e.stopPropagation(); const colEl=dayColRefs.current[dayStr]; const rect=colEl? colEl.getBoundingClientRect(): {height:0} as any; const slotH=rect.height / totalSlots; const { startIndex:sI, endIndex:eI }= rangeToIndices(r); const currentDayRanges=[...availabilities, ...tempRanges].filter(x=> x.specialistId===selectedEmployee && dayKey(x.start)===dayStr && x.id!==r.id); setAvailabilities(a=> a.filter(x=> x.id!==r.id)); setTempRanges(t=> t.filter(x=> x.id!==r.id)); setActiveEdit({ id:r.id, day:dayStr, type:'move', originalStartIndex:sI, originalEndIndex:eI, startIndex:sI, endIndex:eI, originY:e.clientY, slotHeight:slotH, isTemp: tempRanges.some(x=> x.id===r.id), daySnapshot: currentDayRanges }); }}>
                      <div className="px-2 pt-1 pb-2 flex justify-between items-start font-semibold text-[12px] md:text-[13px] select-none h-full">
                        <span className="leading-tight">{timeFromIndex(rangeToIndices(r).startIndex)} - {endTimeFromEndIndex(rangeToIndices(r).endIndex)}</span>
                        {canEditAvailability && (
                          <button type="button" aria-label="Usuń dostępność" onMouseDown={(e)=> e.stopPropagation()} onClick={(e)=> { e.stopPropagation(); setPendingDeleteRange(r); }} className="delete-btn ml-2 shrink-0 h-7 w-7 flex items-center justify-center rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-400">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {canEditAvailability && (
                        <div className="avail-resize-handle absolute left-1/2 -translate-x-1/2 bottom-1 h-1.5 w-14 bg-green-600 rounded cursor-ns-resize hover:bg-green-700" onMouseDown={(e)=> { e.stopPropagation(); if(!canEditAvailability) return; if(e.button!==0|| !selectedEmployee) return; const colEl=dayColRefs.current[dayStr]; const rect=colEl? colEl.getBoundingClientRect(): {height:0} as any; const slotH=rect.height / totalSlots; const { startIndex:sI, endIndex:eI }= rangeToIndices(r); const currentDayRanges=[...availabilities, ...tempRanges].filter(x=> x.specialistId===selectedEmployee && dayKey(x.start)===dayStr && x.id!==r.id); setAvailabilities(a=> a.filter(x=> x.id!==r.id)); setTempRanges(t=> t.filter(x=> x.id!==r.id)); setActiveEdit({ id:r.id, day:dayStr, type:'resize', originalStartIndex:sI, originalEndIndex:eI, startIndex:sI, endIndex:eI, originY:e.clientY, slotHeight:slotH, isTemp: tempRanges.some(x=> x.id===r.id), daySnapshot: currentDayRanges }); }} />
                      )}
                    </div>
                  ); })}
                  {activeEdit && activeEdit.day===dayStr && (()=> { const { startIndex, endIndex }=activeEdit; const topPct=(startIndex/totalSlots)*100; const heightPct=((endIndex-startIndex)/totalSlots)*100; const startTime=timeFromIndex(startIndex); const endTime=endTimeFromEndIndex(endIndex); return (<div className="absolute left-1 right-1 rounded-md bg-green-200/80 text-[12px] md:text-[13px] flex flex-col pointer-events-none z-30 text-green-800 border border-green-300" style={{ top:`${topPct}%`, height:`${heightPct}%` }}><div className="px-1 py-0.5 font-semibold select-none">{startTime} - {endTime}</div></div>); })()}
                </div>
                <div className="absolute inset-0 z-40 pointer-events-none">
                  {/* Day-offs full-day red blocks */}
                  {dayOffs.filter(o=> o.date===dayStr).map(o=> { const meta = o.groupId? dayOffGroupMeta[o.groupId]: dayOffGroupMeta[o.id]; const note=meta?.note; const rangeLabel = meta? (meta.start===meta.end? formatDayDisplayFull(meta.start): `${formatDayDisplayFull(meta.start)}-${formatDayDisplayFull(meta.end)}`): ''; const employeeNames = (meta?.employees||[]).map(id=> allDisplayUsers.find(e=> e.id===id)?.name || id).join(', '); return (
                    <div key={o.id} className="absolute left-2 right-2 rounded-md bg-red-200/95 text-red-900 shadow-md flex flex-col pointer-events-none z-30 border border-red-300 px-3 py-2 overflow-hidden" style={{ top:'0%', height:'100%' }}>
                      <div className="font-bold leading-tight tracking-tight text-[13px] md:text-[14px] mb-1 truncate">{rangeLabel}</div>
                      {employeeNames && <div className="text-[12px] md:text-[13px] font-medium mb-2 truncate">{employeeNames}</div>}
                      {note && <div className="text-[11px] md:text-[12px] leading-snug opacity-90 whitespace-pre-wrap break-words line-clamp-6">{note}</div>}
                    </div>
                  ); })}
                  {dayMeetings.map(m=> { const { startIndex, endIndex } = meetingToIndices(m); const topPct=(startIndex/ totalSlots)*100; const heightPct=((endIndex-startIndex)/ totalSlots)*100; const specNames=getSpecialistNames(m); const patientLabel=getPatientNames(m); const roomName=getRoomName(m.roomId); const timeLabel = `${m.startTime}-${m.endTime}`; const openAbove = startIndex > (totalSlots/2); const durationSlots = endIndex - startIndex; const isTall = durationSlots > 1; const showRoomInline = durationSlots >= 3; const meetingName = ((m as any)?.name || '').trim(); return (
                    <div key={m.id} className="group absolute left-[10%] right-[10%] rounded-md bg-yellow-100/95 text-yellow-900 shadow-md text-[11px] px-2 py-1 pointer-events-auto z-40" style={{ top:`${topPct}%`, height:`${heightPct}%` }}>
                      {isTall ? (
                        <div className="flex flex-col overflow-hidden w-full">
                          <div className="font-semibold leading-4">{timeLabel}</div>
                          {meetingName && (<div className="truncate font-medium leading-4">{meetingName}</div>)}
                          {patientLabel && (<div className="truncate leading-4">{patientLabel}</div>)}
                          {m.guestName && (<div className="truncate leading-4">{m.guestName}</div>)}
                          {showRoomInline && (<div className="truncate text-[10px] leading-4 opacity-80">{roomName}</div>)}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 overflow-hidden w-full">
                          <span className="font-semibold shrink-0 whitespace-nowrap leading-4">{timeLabel}</span>
                          {meetingName ? (
                            <span className="flex-1 truncate whitespace-nowrap min-w-0 leading-4">{meetingName}</span>
                          ) : (
                            <>
                              {patientLabel && (<span className="flex-1 truncate whitespace-nowrap min-w-0 leading-4">{patientLabel}</span>)}
                              {m.guestName && (<span className="truncate whitespace-nowrap shrink-0 leading-4">{m.guestName}</span>)}
                            </>
                          )}
                        </div>
                      )}
                      {/* Custom tooltip */}
                      <div className={`pointer-events-none absolute ${openAbove? 'bottom-full mb-1':'top-full mt-1'} left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 z-50`}> 
                        <div className="max-w-xs rounded-lg bg-white text-gray-900 shadow-xl border border-gray-200 px-3 py-2 text-[12px] leading-snug">
                          <div className="font-semibold">{timeLabel}</div>
                          <div className="mt-1">{roomName}</div>
                          <div className="mt-2">{specNames}</div>
                          {patientLabel && <>
                            <div className="my-2 h-px bg-gray-100" />
                            <div>{patientLabel}</div>
                          </>}
                        </div>
                      </div>
                    </div>
                  ); })}
                </div>
              </div>
            ); })}
          </div>
        </div>
      </div>
    </div>
  ); };

  // Pending delete modal confirm handled below

  return (
    <div className="flex-1 flex flex-col pb-6">
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {allDisplayUsers.map(emp=> { const active=emp.id===selectedEmployee; const disabled=(currentUser.role==='employee' || currentUser.role==='contact') && emp.id!==currentUser.id; const fullName = `${emp.surname || ''} ${emp.name}`.trim(); return (
            <button key={emp.id} type="button" aria-pressed={active} disabled={disabled} onClick={()=> { if(disabled) return; attempt(() => setSelectedEmployee(emp.id), { title: 'Zmiana pracownika', message: 'Masz niezapisane zmiany w grafiku. Zapisz je lub odrzuć przed zmianą pracownika.' }); }}
              className={`px-4 py-1.5 text-xs md:text-sm rounded-full border transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${active? 'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} ${disabled && !active? 'opacity-50 cursor-not-allowed hover:bg-white':''}`}>{fullName}</button>
          ); })}
        </div>
      </div>
      {selectedEmployee ? (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-shrink-0">
            <CalendarHeader currentDate={currentDate} viewType={viewType} onDateChange={guardedSetCurrentDateWithDialog} onViewTypeChange={(v)=> { if(v!=='week' && v!=='month') return; attempt(() => setViewType(v), { title: 'Zmiana widoku', message: 'Masz niezapisane zmiany. Zapisz je lub odrzuć przed zmianą widoku.' }); }} availableViews={['week','month']}
              centerContent={(<div className="flex flex-wrap items-center gap-4 justify-center">
                {viewType==='week' && canEditAvailability && (<>
                  <span className="text-sm font-medium text-gray-700">Powiel dostępność na:</span>
                  <div className="relative copy-dropdown">
                    <button onClick={()=> setShowCopyDropdown(!showCopyDropdown)} className="flex items-center justify-between gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors w-64">
                      <span className="truncate">{copyPresetLabel}</span>
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </button>
                    {showCopyDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                        {copyPresets.map(p => (
                          <button
                            key={p.key}
                            onClick={()=> { setCopyPeriod(p.key); setShowCopyDropdown(false);} }
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                          >
                            {copyPeriod===p.key && <Check className="h-4 w-4 text-blue-600" />}
                            <span className={copyPeriod===p.key? 'text-blue-600 font-medium':'text-gray-700'}>{p.label}</span>
                          </button>
                        ))}
                      </div>) }
                  </div>
                  <button onClick={handleCopyAvailability} disabled={!selectedEmployee || isCopying} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                    {isCopying ? (<><Loader2 className="h-4 w-4 animate-spin" /><span>Powielanie...</span></>) : 'Powiel'}
                  </button>
                </>)}
                {viewType==='month' && monthPending && (<div className="flex items-center gap-2 ml-8 md:ml-12">
                  <button onClick={()=> runWithSaving(()=> { monthActionsRef.current?.save(); })} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">Zapisz zmiany</button>
                  <button onClick={()=> monthActionsRef.current?.discard()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">Odrzuć</button>
                </div>)}
                {viewType==='week' && canEditAvailability && (!pendingDeleteRange && (tempRanges.length>0 || deletedRangeIds.length>0)) && (<div className="flex items-center gap-2 ml-8 md:ml-12">
                  <button onClick={()=> runWithSaving(saveAvailabilities)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">Zapisz zmiany</button>
                  <button onClick={discardChanges} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">Odrzuć</button>
                </div>)}
              </div>)} />
          </div>
          <div className="flex-1 min-h-0">
            {viewType==='week' && renderWeekView()}
            {viewType==='month' && (<MonthCalendar currentDate={currentDate} dayOffs={dayOffs} buildDateRange={buildDateRange} formatLocalDate={formatLocalDate} employees={allDisplayUsers.map(u=> ({ id:u.id, name:`${u.surname || ''} ${u.name}`.trim() }))} defaultEmployeeId={selectedEmployee || undefined} onPendingStateChange={(has, actions)=> { setMonthPending(has); monthActionsRef.current = actions; }} onBaselineChange={handleMonthBaselineChange} />)}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-1 flex items-center justify-center"><p className="text-gray-500 text-center">Wybierz pracownika, aby wyświetlić jego grafik</p></div>
      )}

      {/* Meeting form for editing/creating */}
      <MeetingForm
        isOpen={showMeetingForm}
        onClose={()=> { setShowMeetingForm(false); setEditingMeeting(undefined); }}
        onSubmit={(data)=> { if(editingMeeting){ onMeetingUpdate(editingMeeting.id, data); } else { onMeetingCreate(data); } setShowMeetingForm(false); setEditingMeeting(undefined); }}
        onDelete={(id)=> { onMeetingDelete?.(id); setShowMeetingForm(false); setEditingMeeting(undefined); }}
        users={users}
        rooms={rooms}
        meetings={meetings}
        selectedDate={formatLocalDate(currentDate)}
        selectedTime={selectedTime}
        currentUser={currentUser}
        editingMeeting={editingMeeting}
        patients={patients}
      />

      {pendingDeleteRange && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-scale-in">
          <div className="p-6">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center"><Trash2 className="h-6 w-6 text-red-600" /></div>
            <h3 className="text-base font-semibold text-gray-900 mb-2 text-center">Usuń dostępność?</h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed text-center">Czy na pewno chcesz usunąć ten zakres dostępności? Zmiana zostanie zapisana dopiero po kliknięciu "Zapisz zmiany".</p>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={()=> setPendingDeleteRange(null)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">Anuluj</button>
              <button type="button" onClick={handleConfirmDelete} className="px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400">Usuń</button>
            </div>
          </div>
        </div>
      </div>)}

      {showSavingDialog && (<div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center animate-fade-in">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center"><div className="h-6 w-6 rounded-full border-4 border-blue-300 border-t-blue-600 animate-spin" /></div>
          <h3 className="text-base font-semibold text-gray-800 mb-2">Wysyłanie zmian...</h3>
            <p className="text-sm text-gray-600">Trwa zapisywanie zmian w backendzie.</p>
        </div>
      </div>)}
    </div>
  );
}

export default EmployeeCalendar;