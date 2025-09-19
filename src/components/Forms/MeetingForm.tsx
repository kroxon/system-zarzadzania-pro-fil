import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Trash2, AlertCircle } from 'lucide-react';
import { Meeting, User, Room, Patient, EventStatus } from '../../types';
import { generateTimeSlots } from '../../utils/timeSlots';
import { fetchEmployeeWorkHours } from '../../utils/api/employees';
import type { WorkHours } from '../../types';
import { getAllEventStasuses } from '../../utils/api/eventStatuses';

// Availability will be validated against backend workhours


interface MeetingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (meeting: Omit<Meeting, 'id'>) => void;
  onDelete?: (meetingId: string) => void;
  users: User[];
  rooms: Room[];
  meetings: Meeting[];
  selectedDate: string;
  selectedTime: string;
  currentUser: User;
  editingMeeting?: Meeting;
  initialRoomId?: string;
  selectedEndTime?: string;
  patients?: Patient[]; // NEW list of patients for multi-select
}

interface MeetingFormState {
  specialistId: string; // legacy primary
  patientName: string; // legacy primary name
  guestName: string;
  roomId: string;
  startTime: string;
  endTime: string;
  notes: string;
  status: Meeting['status'];
  specialistIds: string[]; // NEW multi
  patientIds: string[];    // NEW multi
  meetingName: string;     // NEW: display name/title for the meeting
}

const MeetingForm: React.FC<MeetingFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  users,
  rooms,
  meetings,
  selectedDate,
  selectedTime,
  currentUser,
  editingMeeting,
  initialRoomId,
  selectedEndTime,
  patients = []
}) => {
  const computeDefaultEnd = (start: string): string => {
    if (!start) return '';
    const [h, m] = start.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m + 30, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // helpery konfliktów (pełny przedział)
  const toMin = (t:string) => { const [h,m]=t.split(':').map(Number); return h*60+m; };
  // Overlap uses half-open intervals [start, end); end==start means no conflict (back-to-back allowed)
  const overlap = (s1:string,e1:string,s2:string,e2:string) => !(toMin(e1) <= toMin(s2) || toMin(s1) >= toMin(e2));
  const specialistHasConflict = (specialistId:string, date:string, start:string, end:string, excludeId?:string) => meetings.some(m=> m.id!==excludeId && m.date===date && ((m.specialistIds && m.specialistIds.includes(specialistId)) || m.specialistId===specialistId) && overlap(start,end,m.startTime,m.endTime));
  const roomHasConflict = (roomId:string, date:string, start:string, end:string, excludeId?:string) => meetings.some(m=> m.id!==excludeId && m.date===date && m.roomId===roomId && overlap(start,end,m.startTime,m.endTime));

  // creation guard: allow only future start times
  const isDateTimeInFuture = (date: string, time: string) => {
    if (!date || !time) return false;
    const [y, mo, d] = date.split('-').map(Number);
    const [sh, sm] = time.split(':').map(Number);
    const startLocal = new Date(y, (mo || 1) - 1, d || 1, sh || 0, sm || 0, 0, 0);
    return startLocal.getTime() > Date.now();
  };

  const [formData, setFormData] = useState<MeetingFormState>({
    specialistId: currentUser.role === 'employee' ? currentUser.id : '',
    patientName: '',
    guestName: '',
    roomId: initialRoomId || '',
    startTime: selectedTime,
    endTime: selectedEndTime || computeDefaultEnd(selectedTime),
    notes: '',
    status: 'present',
    specialistIds: currentUser.role === 'employee' ? [currentUser.id] : [],
    patientIds: [],
    meetingName: ''
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [patientAssignmentFilter, setPatientAssignmentFilter] = useState<'wszyscy'|'przypisani'>('wszyscy'); // filter patients
  const effectivePatients = patients.length ? patients : [];
  const [showPastSubmitInfo, setShowPastSubmitInfo] = useState(false);

  // Workhours cache for employees used to determine availability
  const [workhoursByEmployee, setWorkhoursByEmployee] = useState<Record<string, WorkHours[]>>({});
  const [loadingEmployees, setLoadingEmployees] = useState<Set<string>>(new Set());
  const token = (currentUser?.token) || localStorage.getItem('token') || undefined;

  // Test-only: event statuses fetch and display
  const [eventStatuses, setEventStatuses] = useState<EventStatus[]>([]);
  const [eventStatusesLoading, setEventStatusesLoading] = useState(false);
  const [eventStatusesError, setEventStatusesError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isOpen || !token) return;
      setEventStatusesLoading(true);
      setEventStatusesError(null);
      try {
        const list = await getAllEventStasuses(token);
        if (!cancelled) setEventStatuses(list);
      } catch (e: any) {
        if (!cancelled) setEventStatusesError(e?.message || 'Nie udało się pobrać statusów');
      } finally {
        if (!cancelled) setEventStatusesLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isOpen, token]);

  // Helper: normalize backend status name to Meeting.status union
  const normalizeStatusName = React.useCallback((name?: string): 'present' | 'absent' | 'cancelled' | 'in-progress' => {
    const s = (name || '').toLowerCase();
    if (/(cancel|odwo)/.test(s)) return 'cancelled';
    if (/(absent|nieobec)/.test(s)) return 'absent';
    if (/(progress|w toku)/.test(s)) return 'in-progress';
    return 'present';
  }, []);

  // Determine which statusId should be selected (only one) when editing an event
  const activeStatusId = React.useMemo(() => {
    // Prefer editingMeeting.statusId if present
    if (editingMeeting?.statusId != null) return editingMeeting.statusId;
    // Otherwise, try to infer from current normalized status (formData.status)
    if (!eventStatuses || !eventStatuses.length) return undefined;
    const match = eventStatuses.find(s => normalizeStatusName(s.name) === formData.status);
    return match?.id;
  }, [editingMeeting?.statusId, eventStatuses, formData.status, normalizeStatusName]);

  const fetchWorkhoursForIds = React.useCallback(async (ids: string[], dateYmd: string) => {
    if (!token || !ids.length || !dateYmd) return;
    // compute week window for filtering (Mon..Sun)
    const [y, m, d] = dateYmd.split('-').map(Number);
    const day = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
    const weekStart = new Date(day); // Monday
    weekStart.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23,59,59,999);
    const wsMs = weekStart.getTime();
    const weMs = weekEnd.getTime();

    // mark all as loading
    setLoadingEmployees(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    try {
      // limit concurrency in chunks to avoid spamming backend
      const chunkSize = 10;
      const toApply: Record<string, WorkHours[]> = {};
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const results = await Promise.allSettled(chunk.map(async (id) => {
          const numId = Number(id);
          const raw = Number.isFinite(numId) ? await fetchEmployeeWorkHours(numId, token) : [];
          // filter to current week window
          const list = (raw || []).filter(w => {
            const s = new Date(w.start).getTime();
            const e = new Date(w.end).getTime();
            return e >= wsMs && s <= weMs;
          });
          return { id, list: list as WorkHours[] };
        }));
        results.forEach((r, idx) => {
          const id = chunk[idx];
          if (r.status === 'fulfilled') toApply[id] = r.value.list;
          else toApply[id] = [];
        });
      }
      setWorkhoursByEmployee(prev => ({ ...prev, ...toApply }));
    } finally {
      // clear loading flags
      setLoadingEmployees(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [token]);

  // (effects to load workhours are defined later, after specOpen declaration)

  // Check availability using backend workhours: requires the requested interval to be fully covered by at least one workhour range
  const isSpecialistAvailable = React.useCallback((id: string, date: string, start: string, end: string) => {
    const list = workhoursByEmployee[id];
    if (!list) return false; // not loaded yet -> treat as niedostępny until data arrives
    if (!date || !start || !end) return false;
    const startLocal = new Date(`${date}T${start}:00`);
    const endLocal = new Date(`${date}T${end}:00`);
    let coverFrom = startLocal.getTime();
    const reqEnd = endLocal.getTime();
    if (!(coverFrom < reqEnd)) return false;
    // consider union of workhour intervals that overlap the requested date/time
    const intervals = list
      .map(w => ({ s: new Date(w.start).getTime(), e: new Date(w.end).getTime() }))
      .filter(r => r.e > coverFrom && r.s < reqEnd)
      .sort((a,b) => a.s - b.s);
    for (const r of intervals) {
      if (r.s > coverFrom) {
        // gap before next interval
        return false;
      }
      if (r.e >= coverFrom) {
        coverFrom = Math.max(coverFrom, r.e);
        if (coverFrom >= reqEnd) return true;
      }
    }
    return coverFrom >= reqEnd;
  }, [workhoursByEmployee]);

  // Reset validation errors on open and when switching context (create/edit another meeting)
  useEffect(() => { if (isOpen) setErrors([]); }, [isOpen]);
  useEffect(() => { setErrors([]); }, [editingMeeting]);

  // Centralized close to also clear transient UI states and errors
  const handleClose = () => {
    setErrors([]);
    setRoomsOpen(false);
    setDateOpen(false);
    setStartOpen(false);
    setEndOpen(false);
    setShowDeleteConfirm(false);
    setShowPastSubmitInfo(false);
    onClose();
  };

  // In cutover: no persisted therapist assignments; show all patients regardless of specialist selection
  const assignedPatientIds = React.useMemo(()=> new Set<string>(), []);

  const filteredPatients = React.useMemo(()=> {
    if(patientAssignmentFilter === 'przypisani') {
      return effectivePatients.filter(p => assignedPatientIds.has(String(p.id)));
    }
    return effectivePatients;
  }, [effectivePatients, patientAssignmentFilter, assignedPatientIds]);

  useEffect(() => {
    if (editingMeeting) {
      setFormData(prev => ({
        ...prev,
        specialistId: editingMeeting.specialistId,
        patientName: editingMeeting.patientName,
        guestName: editingMeeting.guestName || '',
        roomId: editingMeeting.roomId,
        startTime: editingMeeting.startTime,
        endTime: editingMeeting.endTime,
        notes: editingMeeting.notes || '',
        status: editingMeeting.status,
        specialistIds: editingMeeting.specialistIds || [editingMeeting.specialistId],
        patientIds: editingMeeting.patientIds || (editingMeeting.patientId ? [editingMeeting.patientId] : []),
        meetingName: (editingMeeting as any)?.name || ''
      }));
    } else {
      setFormData({
        specialistId: currentUser.role === 'employee' ? currentUser.id : '',
        patientName: '',
        guestName: '',
        roomId: initialRoomId || '',
        startTime: selectedTime,
        endTime: selectedEndTime || computeDefaultEnd(selectedTime),
        notes: '',
        status: 'present',
        specialistIds: currentUser.role === 'employee' ? [currentUser.id] : [],
        patientIds: [],
        meetingName: ''
      });
    }
  }, [editingMeeting, currentUser, selectedTime, initialRoomId, selectedEndTime]);

  const validateForm = (): boolean => {
    // When editing a past meeting with permissions, allow saving status/notes only without blocking on other validations
    if (restrictPastEdit) {
      setErrors([]);
      return true;
    }
    const newErrors: string[] = [];
    if (!formData.specialistIds.length) newErrors.push('Wybierz co najmniej jednego specjalistę');
    // patient optional – no error
    if (!formData.roomId) newErrors.push('Wybierz salę');
    if (!formData.startTime || !formData.endTime) newErrors.push('Określ godziny spotkania');
    if (formData.startTime && formData.endTime) {
      const startM = toMin(formData.startTime); const endM = toMin(formData.endTime);
      if (endM <= startM) newErrors.push('Godzina zakończenia musi być późniejsza niż rozpoczęcia');
    }
    // creation: start must be in the future
    if (!editingMeeting && formData.startTime && !isDateTimeInFuture(effectiveDate, formData.startTime)) {
      newErrors.push('Termin rozpoczęcia musi być w przyszłości');
    }
    // conflict per specialist and room (using effectiveDate)
    formData.specialistIds.forEach(id => {
      const u = users.find(u=>u.id===id);
      const fullName = u ? `${u.surname} ${u.name}` : id;
      if (!isSpecialistAvailable(id, effectiveDate, formData.startTime, formData.endTime)) {
        newErrors.push(`Specjalista (${fullName}) jest niedostępny`);
      } else if (specialistHasConflict(id, effectiveDate, formData.startTime, formData.endTime, editingMeeting?.id)) {
        newErrors.push(`Specjalista (${fullName}) jest zajęty`);
      }
    });
    if (roomHasConflict(formData.roomId, effectiveDate, formData.startTime, formData.endTime, editingMeeting?.id)) newErrors.push('Sala jest zajęta w tym przedziale czasu');
    setErrors(newErrors); return newErrors.length===0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    // If user changed time to past while form is open, block submission
    if (!editingMeeting && !isDateTimeInFuture(effectiveDate, formData.startTime)) {
      setShowPastSubmitInfo(true);
      return;
    }
    const primarySpec = formData.specialistIds[0];
    const primaryPatientId = formData.patientIds[0];
    // Use effectivePatients (prop patients or loaded from storage) to resolve names
    const patientNamesList = formData.patientIds.map(id => {
      const p = effectivePatients.find(pp => String(pp.id) === String(id));
      if (!p) return String(id);
      return `${p.name} ${p.surname}`;
    });
    onSubmit({
      specialistId: primarySpec,
      patientName: patientNamesList[0] || formData.patientName,
      patientId: primaryPatientId,
      guestName: formData.guestName,
      roomId: formData.roomId,
      date: effectiveDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      notes: formData.notes,
      status: formData.status,
      createdBy: currentUser.id,
      specialistIds: formData.specialistIds,
      patientIds: formData.patientIds,
      patientNamesList,
      name: formData.meetingName
    } as any);
    onClose();
  };

  const [roomsOpen, setRoomsOpen] = useState(false);
  // a11y refs
  const dialogRef = useRef<HTMLDivElement|null>(null);
  // removed firstFieldRef autofocus per user request
  const prevFocusRef = useRef<HTMLElement|null>(null);

  useEffect(()=> {
    if(isOpen){
      prevFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      // autofocus disabled
    } else {
      document.body.style.overflow = '';
      prevFocusRef.current?.focus?.();
    }
  }, [isOpen]);

  useEffect(()=> {
    if(!isOpen) return;
    const handleKey = (e:KeyboardEvent) => {
      if(e.key==='Escape') { e.stopPropagation(); onClose(); }
      if(e.key==='Tab' && dialogRef.current){
        const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"))
          .filter(el => !el.hasAttribute('disabled'));
        if(!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length-1];
        if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
        else if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return ()=> window.removeEventListener('keydown', handleKey, true);
  }, [isOpen, onClose]);

  // Determine if meeting is in the future (based on start time)
  const isMeetingInFuture = (m: Meeting | undefined) => {
    if (!m) return false;
    const [y, mo, d] = m.date.split('-').map(Number);
    const [sh, sm] = m.startTime.split(':').map(Number);
    const startLocal = new Date(y, (mo || 1) - 1, d || 1, sh || 0, sm || 0, 0, 0);
    return startLocal.getTime() > Date.now();
  };

  // Determine if meeting is in the past (based on end time)
  const isMeetingInPastByEnd = (m: Meeting | undefined) => {
    if (!m) return false;
    const [y, mo, d] = m.date.split('-').map(Number);
    const [eh, em] = m.endTime.split(':').map(Number);
    const endLocal = new Date(y, (mo || 1) - 1, d || 1, eh || 0, em || 0, 0, 0);
    return endLocal.getTime() < Date.now();
  };

  const canCurrentUserDelete = (m: Meeting | undefined) => {
    if (!m) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'contact') return true;
    if (currentUser.role === 'employee') return m.specialistId === currentUser.id || (m.specialistIds?.includes(currentUser.id) ?? false);
    return false;
  };

  // Determine if current user can edit this meeting (broader than delete)
  const canCurrentUserEdit = (m: Meeting | undefined) => {
    if (!m) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'contact') return true;
    if (currentUser.role === 'employee') {
      return m.specialistId === currentUser.id || (m.specialistIds?.includes(currentUser.id) ?? false) || m.createdBy === currentUser.id;
    }
    return false;
  };

  const canShowDelete = !!editingMeeting && isMeetingInFuture(editingMeeting) && canCurrentUserDelete(editingMeeting) && !!onDelete;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isEditingPast = !!editingMeeting && isMeetingInPastByEnd(editingMeeting);
  const effectiveStatus: 'present' | 'absent' | 'cancelled' = ((): any => {
    const s = (formData.status as any);
    return s === 'present' || s === 'absent' || s === 'cancelled' ? s : 'present';
  })();

  // When editing a past meeting and user has permission, restrict editing to status + notes only
  const restrictPastEdit = !!editingMeeting && isEditingPast && canCurrentUserEdit(editingMeeting);
  const canEditThis = !!editingMeeting && canCurrentUserEdit(editingMeeting);

  // Local date state with Polish formatting helpers
  const [localDate, setLocalDate] = useState<string>(selectedDate);
  useEffect(()=>{ if(isOpen) setLocalDate(selectedDate); }, [isOpen, selectedDate]);
  const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseYMD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m||1)-1, d||1); };
  const formatPolishDate = (s: string) => { const d = parseYMD(s); const day = String(d.getDate()).padStart(2,'0'); const month = new Intl.DateTimeFormat('pl-PL', { month: 'long' }).format(d); const year = d.getFullYear(); return `${day}.${month}.${year}`; };
  const effectiveDate = localDate || selectedDate;

  // If opening create form on a past date, correct to today and show info, but keep form visible
  useEffect(() => {
    if (!isOpen || editingMeeting) return;
    const todayYMD = toYMD(new Date());
    if (localDate < todayYMD) {
      setLocalDate(todayYMD);
      setShowPastSubmitInfo(true);
    }
  }, [isOpen, editingMeeting, localDate]);

  // Reset form on open
  useEffect(() => {
    // Removed auto-reset on open to avoid overriding edit state; initialization handled elsewhere
  }, [isOpen, currentUser, initialRoomId, selectedTime, selectedEndTime]);

  const [dateOpen, setDateOpen] = useState(false);
  const base = parseYMD(localDate);
  const [viewYear, setViewYear] = useState<number>(base.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(base.getMonth()); // 0-11
  useEffect(()=>{ const d = parseYMD(localDate); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }, [localDate]);
  const monthLabelPl = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth, 1));
  const getCalendarDays = (y:number, m:number) => {
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday=0
    const start = new Date(y, m, 1 - startOffset);
    const days: { d: Date; inMonth: boolean }[] = [];
    for (let i=0;i<42;i++) {
      const cur = new Date(start); cur.setDate(start.getDate()+i);
      days.push({ d: cur, inMonth: cur.getMonth()===m });
    }
    return days;
  };
  const calendarDays = getCalendarDays(viewYear, viewMonth);

  // Month navigation helpers
  const prevMonth = () => {
    setViewMonth((m: number) => {
      if (m === 0) { setViewYear(y => y - 1); return 11; }
      return m - 1;
    });
  };
  const nextMonth = () => {
    setViewMonth((m: number) => {
      if (m === 11) { setViewYear(y => y + 1); return 0; }
      return m + 1;
    });
  };

  // Time pickers state and options
  // Time range adjusted to business hours 08:00 - 17:00
  const timeOptions = React.useMemo(()=> {
    // base half-hour slots 08:00..16:30 then explicitly add 17:00 as selectable end
    const base = generateTimeSlots(8, 17); // stops at 16:30
    // ensure 17:00 present (avoid duplicate if implementation changes later)
    if (!base.includes('17:00')) base.push('17:00');
    return base;
  }, []);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  // NEW: custom dropdown states for specialists and patients
  const [specOpen, setSpecOpen] = useState(false);
  const [patientsOpen, setPatientsOpen] = useState(false);
  // Search term for specialists dropdown
  const [specSearch, setSpecSearch] = useState<string>('');
  // Search term for patients dropdown
  const [patientsSearch, setPatientsSearch] = useState<string>('');

  // Load workhours for currently selected specialists (lazy)
  useEffect(() => {
    if (!isOpen || !token) return;
    const ids = formData.specialistIds;
    const idsToFetch = ids.filter(id => !Object.prototype.hasOwnProperty.call(workhoursByEmployee, id) && !loadingEmployees.has(id));
    if (!idsToFetch.length) return;
    fetchWorkhoursForIds(idsToFetch, effectiveDate);
  }, [isOpen, token, formData.specialistIds, workhoursByEmployee, loadingEmployees, fetchWorkhoursForIds, effectiveDate]);

  // When opening specialists dropdown, prefetch all employees' workhours to show correct statuses in the list
  useEffect(() => {
    if (!isOpen || !token || !specOpen) return;
    const allEmpIds = users.filter(u => u.role === 'employee').map(u => u.id);
    const idsToFetch = allEmpIds.filter(id => !Object.prototype.hasOwnProperty.call(workhoursByEmployee, id) && !loadingEmployees.has(id));
    if (!idsToFetch.length) return;
    fetchWorkhoursForIds(idsToFetch, effectiveDate);
  }, [isOpen, specOpen, token, users, workhoursByEmployee, loadingEmployees, fetchWorkhoursForIds, effectiveDate]);

  // Prefetch all employees' workhours once when form opens (speed up statuses)
  // Removed aggressive prefetch-all on open to avoid heavy load with many employees/entries

  // Inline computed validations for live feedback on time and collisions
  const startEndInvalid = React.useMemo(() => {
    if (!formData.startTime || !formData.endTime) return false;
    return toMin(formData.endTime) <= toMin(formData.startTime);
  }, [formData.startTime, formData.endTime]);


  // Sprawdź dostępność specjalistów (czy są dostępni wg EmployeeCalendar)
  const unavailableSpecialists = React.useMemo(() => {
    if (!formData.startTime || !formData.endTime) return [] as string[];
    return formData.specialistIds.filter(id => !isSpecialistAvailable(id, effectiveDate, formData.startTime, formData.endTime));
  }, [formData.specialistIds, formData.startTime, formData.endTime, effectiveDate, isSpecialistAvailable]);

  // Sprawdź konflikty spotkań (zajętość)
  const conflictedSpecialists = React.useMemo(() => {
    if (!formData.startTime || !formData.endTime) return [] as string[];
    return formData.specialistIds.filter(id =>
      specialistHasConflict(id, effectiveDate, formData.startTime, formData.endTime, editingMeeting?.id)
    );
  }, [formData.specialistIds, formData.startTime, formData.endTime, effectiveDate, editingMeeting?.id, meetings]);

  const hasRoomConflict = React.useMemo(() => {
    if (!formData.roomId || !formData.startTime || !formData.endTime) return false;
    return roomHasConflict(formData.roomId, effectiveDate, formData.startTime, formData.endTime, editingMeeting?.id);
  }, [formData.roomId, formData.startTime, formData.endTime, effectiveDate, editingMeeting?.id, meetings]);

  // Live check: creating in the past (date+start)
  const isCreatePastSelection = React.useMemo(() => {
    if (editingMeeting) return false;
    if (!formData.startTime) return false;
    return !isDateTimeInFuture(effectiveDate, formData.startTime);
  }, [editingMeeting, effectiveDate, formData.startTime]);

  // Today guard: disable past time options when creating for today
  const isCreateToday = React.useMemo(() => {
    if (editingMeeting) return false;
    const today = toYMD(new Date());
    return effectiveDate === today;
  }, [editingMeeting, effectiveDate]);
  const nowMinutes = React.useMemo(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }, []);

  // NEW: refs for outside-click handling on custom dropdowns
  const specMenuRef = useRef<HTMLDivElement|null>(null);
  const patientsMenuRef = useRef<HTMLDivElement|null>(null);

  // NEW: close dropdowns on outside click
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
  if (specMenuRef.current && !specMenuRef.current.contains(t)) { setSpecOpen(false); setSpecSearch(''); }
  if (patientsMenuRef.current && !patientsMenuRef.current.contains(t)) { setPatientsOpen(false); setPatientsSearch(''); }
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center p-6 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="meetingFormTitle">
      <div ref={dialogRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl border border-gray-100">
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-700 ring-1 ring-indigo-100">
                <Calendar className="h-5 w-5" />
              </span>
              <h2 id="meetingFormTitle" className="text-lg font-semibold text-gray-900">{editingMeeting ? 'Edytuj spotkanie' : 'Nowe spotkanie'}</h2>
            </div>
          </div>
          {/* Moved live conflict & validation hints to top */}
          {!restrictPastEdit && (
            <div className="space-y-1" aria-live="polite">
              {startEndInvalid && (
                <div className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>Koniec musi być późniejszy niż start.</span>
                </div>
              )}
              {!startEndInvalid && isCreatePastSelection && (
                <div className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>Data i godzina rozpoczęcia są w przeszłości. Wybierz termin w przyszłości.</span>
                </div>
              )}
              {!startEndInvalid && !isCreatePastSelection && unavailableSpecialists.length>0 && (
                <div className="text-xs text-red-700 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{unavailableSpecialists.length === 1 ? 'Wybrany specjalista jest niedostępny w tym czasie.' : 'Co najmniej jeden wybrany specjalista jest niedostępny w tym czasie.'}</span>
                </div>
              )}
              {!startEndInvalid && !isCreatePastSelection && unavailableSpecialists.length===0 && conflictedSpecialists.length>0 && (
                <div className="text-xs text-amber-700 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{conflictedSpecialists.length === 1 ? 'Wybrany specjalista jest zajęty w tym czasie.' : 'Co najmniej jeden wybrany specjalista jest zajęty w tym czasie.'}</span>
                </div>
              )}
              {!startEndInvalid && !isCreatePastSelection && hasRoomConflict && (
                <div className="text-xs text-amber-700 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>Sala jest zajęta w tym przedziale czasu.</span>
                </div>
              )}
            </div>
          )}
          {/* Meeting name - full width below header */}
          <div>
            <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Nazwa spotkania</label>
            <div>
              <input
                type="text"
                value={formData.meetingName}
                onChange={e=> setFormData(fd=> ({...fd, meetingName: e.target.value}))}
                placeholder="Np. Spotkanie konsulatacyjne"
                className="w-full px-3 py-2.5 border border-indigo-200 rounded-lg bg-white text-gray-900 shadow-sm hover:bg-indigo-50 focus:outline-none focus:ring-0 disabled:opacity-60 disabled:cursor-not-allowed text-xl"
                disabled={isEditingPast}
              />
            </div>
          </div>
          {errors.length>0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4" aria-live="assertive">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-sm font-medium text-red-800">Błędy formularza:</span>
              </div>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-0.5">
                {errors.map((e,i)=>(<li key={i}>{e}</li>))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-12 gap-6">
            {/* Left column: date and time pickers now at top, then room */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* Modern date + time picker: Date on top, Start/End side by side */}
              <div className="space-y-4">
                {/* Date picker */}
                <div className="relative min-w-0">
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Data</label>
                  <button type="button" disabled={isEditingPast} onClick={()=> setDateOpen(o=>!o)} className="relative w-full pl-11 pr-3 py-2.5 border border-indigo-200 rounded-lg bg-white text-left shadow-sm hover:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed truncate">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"><Calendar className="h-3.5 w-3.5" /></span>
                    {formatPolishDate(effectiveDate)}
                  </button>
                  {dateOpen && !isEditingPast && (
                    <div className="absolute z-20 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <button type="button" onClick={prevMonth} className="px-2 py-1 text-sm rounded hover:bg-gray-100">‹</button>
                        <div className="text-sm font-medium capitalize">{monthLabelPl}</div>
                        <button type="button" onClick={nextMonth} className="px-2 py-1 text-sm rounded hover:bg-gray-100">›</button>
                      </div>
                      <div className="grid grid-cols-7 text-[11px] text-gray-500 mb-1">
                        {['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d=> <div key={d} className="text-center py-1">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map(({ d, inMonth }, i) => {
                          const ymd = toYMD(d);
                          const isSelected = ymd === effectiveDate;
                          const todayYMD = toYMD(new Date());
                          const isPastDay = ymd < todayYMD;
                          const isToday = ymd === todayYMD;
                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={isEditingPast}
                              onClick={() => { if (isEditingPast) return; setLocalDate(ymd); setDateOpen(false); }}
                              className={[
                                'h-8 w-8 rounded-md text-[12px] flex items-center justify-center transition-colors',
                                !inMonth ? 'text-gray-300' : 'text-gray-700',
                                isPastDay && !isToday ? 'opacity-50' : '',
                                isSelected ? 'bg-indigo-600 text-white shadow ring-1 ring-indigo-500' : 'hover:bg-indigo-100',
                                isToday && !isSelected ? 'ring-1 ring-indigo-300 font-medium' : ''
                              ].join(' ')}
                            >
                              {d.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                {/* Start and End side-by-side */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {/* Start time picker */}
                  <div className="relative min-w-0">
                    <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Start</label>
                    <button
                      type="button"
                      disabled={isEditingPast}
                      onClick={()=> { setStartOpen(o=>!o); setEndOpen(false); }}
                      className="relative w-full pl-10 pr-2 py-2 border border-indigo-200 rounded-lg bg-white text-left shadow-sm hover:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed truncate"
                    >
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"><Clock className="h-3.5 w-3.5" /></span>
                      {formData.startTime || 'Wybierz...'}
                    </button>
                    {startOpen && !isEditingPast && (
                      <div className="absolute z-20 mt-2 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-xl">
                        <ul className="py-1 text-sm">
                          {timeOptions
                            .filter(t=> !formData.endTime || toMin(t) < toMin(formData.endTime))
                            .map(t=> {
                              const disabledOpt = isCreateToday && toMin(t) <= nowMinutes; // disable past times for today
                              return (
                                <li key={t}>
                                  <button
                                    type="button"
                                    disabled={disabledOpt}
                                    onClick={()=> { if(disabledOpt) return; setFormData(fd=> ({...fd, startTime:t, endTime: (!fd.endTime || toMin(fd.endTime) <= toMin(t)) ? computeDefaultEnd(t) : fd.endTime })); setStartOpen(false); }}
                                    className={`w-full text-left pl-10 pr-3 py-1.5 ${disabledOpt ? 'opacity-40 cursor-not-allowed' : 'hover:bg-indigo-50'}`}
                                  >
                                    {t}
                                  </button>
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    )}
                  </div>
                  {/* End time picker */}
                  <div className="relative min-w-0">
                    <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Koniec</label>
                    <button type="button" disabled={isEditingPast} onClick={()=> { setEndOpen(o=>!o); setStartOpen(false); }} className="relative w-full pl-10 pr-2 py-2 border border-indigo-200 rounded-lg bg-white text-left shadow-sm hover:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed truncate">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"><Clock className="h-3.5 w-3.5" /></span>
                      {formData.endTime || 'Wybierz...'}
                    </button>
                    {endOpen && !isEditingPast && (
                      <div className="absolute z-20 mt-2 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-xl">
                        <ul className="py-1 text-sm">
                          {timeOptions
                            .filter(t=> !formData.startTime || toMin(t) > toMin(formData.startTime))
                            .map(t=> {
                              const disabledOpt = isCreateToday && !formData.startTime && toMin(t) <= nowMinutes;
                              return (
                                <li key={t}>
                                  <button
                                    type="button"
                                    disabled={disabledOpt}
                                    onClick={()=> { if(disabledOpt) return; setFormData(fd=> ({...fd, endTime:t})); setEndOpen(false); }}
                                    className={`w-full text-left pl-10 pr-3 py-1.5 ${disabledOpt ? 'opacity-40 cursor-not-allowed' : 'hover:bg-indigo-50'}`}
                                  >
                                    {t}
                                  </button>
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* (Validation hints moved to top) */}

              {/* Sala selector remains under date/time */}
              <div>
                <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Sala</label>
                <div className="relative">
                  <button type="button" onClick={()=> setRoomsOpen(o=>!o)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed" disabled={isEditingPast}>
                    {formData.roomId ? (
                      <span className="flex items-center gap-2">
                        {(() => { const rc = rooms.find(r=>r.id===formData.roomId); const col = rc?.hexColor || '#9ca3af'; return <span style={{ backgroundColor: col }} className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white shadow" />; })()}
                        <span>{rooms.find(r=>r.id===formData.roomId)?.name}</span>
                      </span>
                    ) : <span className="text-gray-400">Wybierz salę</span>}
                    <svg className={`h-4 w-4 text-gray-500 transition-transform ${roomsOpen? 'rotate-180':''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.38a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                  </button>
                  {roomsOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto text-sm">
                      <ul className="py-1">
                        {rooms.map(r => {
                          const disabledOpt = !!(formData.startTime && formData.endTime && roomHasConflict(r.id, effectiveDate, formData.startTime, formData.endTime, editingMeeting?.id) && r.id!==formData.roomId);
                          const selectedRoom = formData.roomId === r.id;
                          const col = r.hexColor || '#9ca3af';
                          return (
                            <li key={r.id}>
                              <button
                                type="button"
                                disabled={disabledOpt}
                                onClick={()=> { setFormData(fd=> ({...fd, roomId:r.id})); setRoomsOpen(false);} }
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-50 focus:bg-indigo-50 transition-colors ${disabledOpt? 'opacity-40 cursor-not-allowed':''} ${selectedRoom? 'bg-indigo-100':''}`}
                              >
                                <span style={{ backgroundColor: col }} className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white shadow" />
                                <span className="flex-1 truncate">{r.name}</span>
                                {disabledOpt && <span className="text-[10px] text-red-500 ml-2">zajęta</span>}
                                {selectedRoom && !disabledOpt && <span className="text-[10px] text-indigo-600 ml-2">wybrana</span>}
                              </button>
                            </li>
                          );
                        })}
                        {rooms.length===0 && (
                          <li className="px-3 py-2 text-xs text-gray-400">Brak sal</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column: specialists on the left, patients on the right */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Specjaliści (left) */}
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Specjaliści</label>
                  {/* Searchable input trigger with chevron */}
                  <div className="relative" ref={specMenuRef}>
                    <div className="relative">
                      <input
                        type="text"
                        value={specSearch}
                        onChange={(e)=> { setSpecSearch(e.target.value); if (!isEditingPast) { setSpecOpen(true); setRoomsOpen(false); setDateOpen(false); setStartOpen(false); setEndOpen(false); setPatientsOpen(false); } }}
                        onFocus={()=> { if (!isEditingPast) { setSpecOpen(true); setRoomsOpen(false); setDateOpen(false); setStartOpen(false); setEndOpen(false); setPatientsOpen(false); } }}
                        onKeyDown={(e)=> {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setSpecOpen(false);
                            setSpecSearch('');
                            (e.currentTarget as HTMLInputElement).blur();
                            return;
                          }
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (isEditingPast) return;
                            const q = specSearch.trim().toLowerCase();
                            const candidates = users
                              .filter(u=>u.role==='employee')
                              .filter(u=> !q || (u.surname||'').toLowerCase().includes(q) || (u.name||'').toLowerCase().includes(q));
                            for (const u of candidates) {
                              const busy = !!(formData.startTime && formData.endTime && specialistHasConflict(u.id, effectiveDate, formData.startTime, formData.endTime, editingMeeting?.id));
                              const workLoaded = Object.prototype.hasOwnProperty.call(workhoursByEmployee, u.id);
                              const unavailable = !!(formData.startTime && formData.endTime && workLoaded && !isSpecialistAvailable(u.id, effectiveDate, formData.startTime, formData.endTime));
                              const already = formData.specialistIds.includes(u.id);
                              const disabledOpt = (workLoaded && (busy || unavailable)) || already;
                              if (!disabledOpt) {
                                setFormData(fd=> fd.specialistIds.includes(u.id)? fd : {...fd, specialistIds:[...fd.specialistIds, u.id]});
                                setSpecOpen(false);
                                setSpecSearch('');
                                (e.currentTarget as HTMLInputElement).blur();
                                break;
                              }
                            }
                          }
                        }}
                        placeholder="Dodaj specjalistę..."
                        className="w-full px-3 pr-8 py-2 border border-indigo-200 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-0 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isEditingPast}
                      />
                      <button
                        type="button"
                        onClick={() => { if (isEditingPast) return; setSpecOpen(o=>{ const next = !o; if (!next) setSpecSearch(''); return next; }); setRoomsOpen(false); setDateOpen(false); setStartOpen(false); setEndOpen(false); setPatientsOpen(false); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                        aria-label="Rozwiń listę"
                        disabled={isEditingPast}
                      >
                        <svg className={`h-4 w-4 text-gray-500 transition-transform ${specOpen? 'rotate-180':''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.38a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                      </button>
                    </div>
                    {specOpen && !isEditingPast && (
                      <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto text-[15px]">
                        <ul className="py-1">
                          {users
                            .filter(u=>u.role==='employee')
                            .filter(u=> { const q = specSearch.trim().toLowerCase(); if(!q) return true; return (u.surname||'').toLowerCase().includes(q) || (u.name||'').toLowerCase().includes(q); })
                            .map(u=> {
                            const busy = !!(formData.startTime && formData.endTime && specialistHasConflict(u.id, effectiveDate, formData.startTime, formData.endTime, editingMeeting?.id));
                            const workLoaded = Object.prototype.hasOwnProperty.call(workhoursByEmployee, u.id);
                            const unavailable = !!(formData.startTime && formData.endTime && workLoaded && !isSpecialistAvailable(u.id, effectiveDate, formData.startTime, formData.endTime));
                            const already = formData.specialistIds.includes(u.id);
                            const isAvailable = workLoaded && !busy && !unavailable;
                            const disabledOpt = (workLoaded && (busy || unavailable)) || already;

                            // Less intense backgrounds; selected (already) highlighted in blue
                            const baseBg = already ? 'bg-indigo-50' : (!workLoaded ? 'bg-white' : unavailable ? 'bg-red-50' : busy ? 'bg-amber-50' : 'bg-emerald-50');
                            const hoverBg = already ? 'hover:bg-indigo-100' : (!workLoaded ? 'hover:bg-gray-50' : unavailable ? 'hover:bg-red-100' : busy ? 'hover:bg-amber-100' : 'hover:bg-emerald-100');
                            const leftBorder = already ? 'border-l-4 border-indigo-300' : (!workLoaded ? 'border-l border-gray-200' : unavailable ? 'border-l-4 border-red-300' : busy ? 'border-l-4 border-amber-300' : 'border-l-4 border-emerald-300');
                            const nameColor = already ? 'text-indigo-900' : (!workLoaded ? 'text-gray-700' : unavailable ? 'text-red-900' : busy ? 'text-amber-900' : 'text-emerald-900');
                            const disabledClass = 'cursor-not-allowed';
                            return (
                              <li key={u.id}>
                                <button
                                  type="button"
                                  disabled={disabledOpt}
                                  onClick={() => { if (disabledOpt) return; setFormData(fd=> fd.specialistIds.includes(u.id)? fd : {...fd, specialistIds:[...fd.specialistIds, u.id]}); setSpecOpen(false); setSpecSearch(''); }}
                                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left ${baseBg} ${hoverBg} ${leftBorder} ${disabledOpt? disabledClass:''}`}
                                >
                                  <div className="min-w-0 flex items-center gap-2">
                                    <div className="min-w-0">
                                      <div className={`font-semibold truncate ${nameColor}`}>{`${u.surname} ${u.name}`}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {/* before load show neutral styling, no badge */}
                                    {workLoaded && isAvailable && !already && (
                                      <span className="text-[10px] text-emerald-900 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300">dostępny</span>
                                    )}
                                    {workLoaded && busy && !unavailable && (
                                      <span className="text-[10px] text-amber-900 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300">zajęty</span>
                                    )}
                                    {workLoaded && unavailable && (
                                      <span className="text-[10px] text-red-900 px-2 py-0.5 rounded-full bg-red-100 border border-red-300">niedostępny</span>
                                    )}
                                    {already && (
                                      <span className="text-[10px] text-indigo-700 px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-300">wybrany</span>
                                    )}
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                          {users.filter(u=>u.role==='employee').length===0 && (
                            <li className="px-3 py-2 text-xs text-gray-400">Brak pracowników</li>
                          )}
                          {users.filter(u=>u.role==='employee').filter(u=> { const q = specSearch.trim().toLowerCase(); if(!q) return true; return (u.surname||'').toLowerCase().includes(q) || (u.name||'').toLowerCase().includes(q); }).length===0 && users.filter(u=>u.role==='employee').length>0 && (
                            <li className="px-3 py-2 text-xs text-gray-400">Brak wyników</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                  {/* Selected specialists list */}
                  <div className="mt-2">
                    <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white max-h-56 overflow-auto">
                      {formData.specialistIds.length===0 && (
                        <li className="p-3 text-sm text-gray-400">Brak wybranych specjalistów</li>
                      )}
                      {formData.specialistIds.map(id=> {
                        const u = users.find(us=>us.id===id);
                        if(!u) return null;
                        const workLoaded = Object.prototype.hasOwnProperty.call(workhoursByEmployee, id);
                        const unavailable = !!(formData.startTime && formData.endTime && workLoaded && !isSpecialistAvailable(id, effectiveDate, formData.startTime, formData.endTime));
                        const busy = !!(formData.startTime && formData.endTime && specialistHasConflict(id, effectiveDate, formData.startTime, formData.endTime, editingMeeting?.id));
                        let bg = 'bg-indigo-50 hover:bg-indigo-100';
                        let text = 'text-gray-900';
                        if (!workLoaded) { bg = 'bg-gray-50'; text = 'text-gray-500'; }
                        else if (unavailable) { bg = 'bg-gray-100'; text = 'text-gray-400'; }
                        else if (busy) { bg = 'bg-yellow-50 hover:bg-yellow-100'; text = 'text-yellow-800'; }
                        else { bg = 'bg-emerald-50 hover:bg-emerald-100'; text = 'text-emerald-800'; }
                        return (
                          <li key={id} className={`flex items-center justify-between p-2 transition-colors ${bg}`}>
                            <div className="min-w-0 pr-3">
                              <div className={`text-sm font-semibold leading-5 truncate ${text}`}>{`${u.surname} ${u.name}`}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {/* before load show neutral styling, no badge */}
                              {workLoaded && busy && !unavailable && <span className="text-[11px] text-yellow-800 px-2 py-0.5 rounded-full bg-yellow-50 border border-yellow-200">zajęty</span>}
                              {workLoaded && unavailable && <span className="text-[11px] text-gray-500 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">niedostępny</span>}
                              <button type="button" onClick={()=> setFormData(fd=> ({...fd, specialistIds: fd.specialistIds.filter(x=> x!==id)}))} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Usuń specjalistę" title="Usuń" disabled={isEditingPast}>×</button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                {/* Podopieczni (right) */}
                <div className="relative">
                  {/* Toggle buttons positioned above (slightly higher) */}
                  <div className="absolute -top-4 left-28 md:left-32 inline-flex text-[11px] rounded-lg overflow-hidden border border-indigo-300 bg-indigo-50 shadow-sm">
                    <button type="button" onClick={()=> setPatientAssignmentFilter('wszyscy')} className={`px-3 py-1.5 font-medium transition-colors ${patientAssignmentFilter==='wszyscy' ? 'bg-indigo-600 text-white shadow-inner' : 'text-indigo-700 hover:bg-indigo-100'} disabled:opacity-50 disabled:cursor-not-allowed`} disabled={isEditingPast}>Wszyscy</button>
                    <button type="button" onClick={()=> setPatientAssignmentFilter('przypisani')} className={`px-3 py-1.5 font-medium transition-colors border-l border-indigo-300 ${patientAssignmentFilter==='przypisani' ? 'bg-indigo-600 text-white shadow-inner' : 'text-indigo-700 hover:bg-indigo-100'} disabled:opacity-50 disabled:cursor-not-allowed`} disabled={isEditingPast}>Przypisani</button>
                  </div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Podopieczni</label>
                  {patientAssignmentFilter==='przypisani' && (
                    <div className="mb-2">
                      {formData.specialistIds.length===0 ? (
                        <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.598c.75 1.335-.213 2.998-1.742 2.998H3.48c-1.53 0-2.492-1.663-1.743-2.998L8.257 3.1zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-.25-6.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" clipRule="evenodd" /></svg><span>Wybierz specjalistę aby zobaczyć przypisanych</span></div>
                      ) : (filteredPatients.length===0 ? (
                        <div className="text-[10px] px-2 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700">Brak wspólnych przypisanych pacjentów</div>
                      ) : null)}
                    </div>
                  )}
                  {/* Searchable patients input + dropdown (above selected list) */}
                  <div className="relative" ref={patientsMenuRef}>
                    <div className="relative">
                      <input
                        type="text"
                        value={patientsSearch}
                        onChange={(e)=> { setPatientsSearch(e.target.value); if (!(isEditingPast || (patientAssignmentFilter==='przypisani' && formData.specialistIds.length===0))) { setPatientsOpen(true); setRoomsOpen(false); setDateOpen(false); setStartOpen(false); setEndOpen(false); setSpecOpen(false); } }}
                        onFocus={()=> { if (!(isEditingPast || (patientAssignmentFilter==='przypisani' && formData.specialistIds.length===0))) { setPatientsOpen(true); setRoomsOpen(false); setDateOpen(false); setStartOpen(false); setEndOpen(false); setSpecOpen(false); } }}
                        onKeyDown={(e)=> {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setPatientsOpen(false);
                            setPatientsSearch('');
                            (e.currentTarget as HTMLInputElement).blur();
                            return;
                          }
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (isEditingPast || (patientAssignmentFilter==='przypisani' && formData.specialistIds.length===0)) return;
                            const q = patientsSearch.trim().toLowerCase();
                            const base = patientAssignmentFilter==='przypisani' ? filteredPatients : effectivePatients;
                            const candidates = base.filter(p=> !q || (p.name||'').toLowerCase().includes(q) || (p.surname||'').toLowerCase().includes(q));
                            for (const p of candidates) {
                              const idStr = String(p.id);
                              const already = formData.patientIds.includes(idStr);
                              if (!already) {
                                setFormData(fd=> fd.patientIds.includes(idStr) ? fd : {...fd, patientIds:[...fd.patientIds, idStr]});
                                setPatientsOpen(false);
                                setPatientsSearch('');
                                (e.currentTarget as HTMLInputElement).blur();
                                break;
                              }
                            }
                          }
                        }}
                        placeholder="Dodaj podopiecznego..."
                        className="w-full px-3 pr-8 py-2 border border-indigo-200 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-0 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isEditingPast || (patientAssignmentFilter==='przypisani' && formData.specialistIds.length===0)}
                      />
                      <button
                        type="button"
                        onClick={() => { if (isEditingPast || (patientAssignmentFilter==='przypisani' && formData.specialistIds.length===0)) return; setPatientsOpen(o=>{ const next = !o; if (!next) setPatientsSearch(''); return next; }); setRoomsOpen(false); setDateOpen(false); setStartOpen(false); setEndOpen(false); setSpecOpen(false); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                        aria-label="Rozwiń listę podopiecznych"
                        disabled={isEditingPast || (patientAssignmentFilter==='przypisani' && formData.specialistIds.length===0)}
                      >
                        <svg className={`h-4 w-4 text-gray-500 transition-transform ${patientsOpen? 'rotate-180':''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.38a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                      </button>
                    </div>
                    {patientsOpen && !(isEditingPast || (patientAssignmentFilter==='przypisani' && formData.specialistIds.length===0)) && (
                      <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto text-sm">
                        <ul className="py-1">
                          {effectivePatients.length>0 ? (
                            (patientAssignmentFilter==='przypisani' ? filteredPatients : effectivePatients)
                              .filter(p=> { const q = patientsSearch.trim().toLowerCase(); if(!q) return true; return (p.name||'').toLowerCase().includes(q) || (p.surname||'').toLowerCase().includes(q); })
                              .map(p=> {
                                const already = formData.patientIds.includes(String(p.id));
                                const firstName = (p as Patient).name;
                                const lastName = (p as Patient).surname;
                                return (
                                  <li key={p.id}>
                                    <button type="button" disabled={already} onClick={()=> { if (already) return; setFormData(fd=> fd.patientIds.includes(String(p.id)) ? fd : {...fd, patientIds:[...fd.patientIds, String(p.id)]}); setPatientsOpen(false); setPatientsSearch(''); }} className={`w-full text-left px-3 py-2 hover:bg-indigo-50 ${already? 'opacity-40 cursor-not-allowed':''}`}>
                                      {`${lastName} ${firstName}`}{already ? ' (dodany)' : ''}
                                    </button>
                                  </li>
                                );
                              })
                          ) : (
                            <li className="px-3 py-2 text-xs text-gray-400">Brak listy pacjentów z backendu</li>
                          )}
                          {effectivePatients.length>0 && ((patientAssignmentFilter==='przypisani' ? filteredPatients : effectivePatients).filter(p=> { const q = patientsSearch.trim().toLowerCase(); if(!q) return true; return (p.name||'').toLowerCase().includes(q) || (p.surname||'').toLowerCase().includes(q); }).length===0) && (
                            <li className="px-3 py-2 text-xs text-gray-400">{patientAssignmentFilter==='przypisani'? (formData.specialistIds.length? 'Brak przypisanych':'Najpierw wybierz specjalistę') : 'Brak wyników'}</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Selected patients list below input */}
                  <div className="mt-2">
                    <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white max-h-56 overflow-auto">
                      {formData.patientIds.length===0 && (<li className="p-3 text-sm text-gray-400">Brak</li>)}
                      {formData.patientIds.map(pid=>{
                        const p = effectivePatients.find(pp=> String(pp.id) === String(pid));
                        let fullName: string;
                        if (p) {
                          fullName = `${p.surname} ${p.name}`;
                        } else if (editingMeeting?.patientNamesList && editingMeeting.patientIds && editingMeeting.patientIds.length) {
                          const idx = editingMeeting.patientIds.findIndex(x => String(x) === String(pid));
                          fullName = idx >= 0 ? (editingMeeting.patientNamesList[idx] || String(pid)) : String(pid);
                        } else {
                          fullName = String(pid);
                        }
                        return (
                          <li key={pid} className="flex items-center justify-between p-2 transition-colors bg-emerald-50 hover:bg-emerald-100">
                            <div className="min-w-0 pr-3"><div className="text-sm font-semibold leading-5 text-gray-900 truncate">{fullName}</div></div>
                            <button type="button" onClick={()=> setFormData(fd=>({...fd, patientIds: fd.patientIds.filter(x=>x!==pid)}))} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Usuń podopiecznego" title="Usuń" disabled={isEditingPast}>×</button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>

              {isEditingPast && (
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Status</label>
                  <div className="bg-white border border-gray-300 rounded-lg p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="status" value="present" checked={effectiveStatus==='present'} onChange={()=> setFormData({...formData, status: 'present'})} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" disabled={!canEditThis} />
                      <span className="text-sm text-gray-800">Podopieczny obecny</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="status" value="absent" checked={effectiveStatus==='absent'} onChange={()=> setFormData({...formData, status: 'absent'})} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" disabled={!canEditThis} />
                      <span className="text-sm text-gray-800">Podopieczny nieobecny</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="status" value="cancelled" checked={effectiveStatus==='cancelled'} onChange={()=> setFormData({...formData, status: 'cancelled'})} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" disabled={!canEditThis} />
                      <span className="text-sm text-gray-800">Odwołano</span>
                    </label>
                  </div>
                </div>
              )}
              {/* Informational note removed as requested */}
            </div>
          </div> {/* end grid of left + right columns */}

          {/* Guest + statuses row and enlarged notes */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Guest field half width */}
              <div className={!isEditingPast ? '' : ''}>
                <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Gość (opcjonalnie)</label>
                <input type="text" value={formData.guestName} onChange={e=> setFormData({...formData, guestName:e.target.value})} placeholder="Imię i nazwisko" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-0 focus:border-gray-300 disabled:opacity-60 disabled:cursor-not-allowed" disabled={isEditingPast} />
              </div>
              {/* Moved statuses preview (unchanged logic) */}
              <div>
                <div className="text-[11px] font-semibold text-gray-600 uppercase mb-1">Statusy wydarzeń (test)</div>
                <div className="text-[12px] rounded-md border border-gray-200 bg-white p-2 min-h-[36px] max-h-40 overflow-auto">
                  {eventStatusesLoading && <span className="text-gray-500">Ładowanie…</span>}
                  {!eventStatusesLoading && eventStatusesError && <span className="text-red-600">{eventStatusesError}</span>}
                  {!eventStatusesLoading && !eventStatusesError && (
                    eventStatuses.length ? (
                      <div className="flex flex-wrap gap-1">
                        {eventStatuses.map(s => {
                          const isActive = activeStatusId != null && s.id === activeStatusId;
                          const base = isActive
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-gray-100 border-gray-200 text-gray-800';
                          return (
                            <span
                              key={s.id}
                              className={`px-2 py-0.5 text-[11px] rounded-full border ${base}`}
                              title={isActive ? 'Aktualny status' : ''}
                            >
                              {s.name}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-gray-500">Brak danych</span>
                    )
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Notatki</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Cel sesji, materiały, obserwacje..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-0 focus:border-gray-300 disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                disabled={isEditingPast && !canEditThis}
                style={{minHeight: '120px', maxHeight:'120px', overflow: 'auto'}}
              />
            </div>
          </div>
          <div className="flex justify-between items-center gap-3 pt-2">
            {/* Delete button on the left when allowed */}
            <div>
              {canShowDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Usuń
                </button>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button type="button" onClick={handleClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Anuluj</button>
              <button type="submit" disabled={isEditingPast && !canEditThis || unavailableSpecialists.length>0} className="px-6 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 shadow hover:from-indigo-500 hover:to-blue-500 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">{editingMeeting? 'Zapisz zmiany':'Utwórz sesję'}</button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && editingMeeting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-6">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2 text-center">Usunąć to spotkanie?</h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed text-center">
                Ta operacja trwale usunie spotkanie z {editingMeeting.date} ({editingMeeting.startTime}-{editingMeeting.endTime}).
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={() => { onDelete?.(editingMeeting.id); setShowDeleteConfirm(false); handleClose(); }}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  Usuń
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit-time info dialog */}
      {showPastSubmitInfo && !editingMeeting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2 text-center">Nie można utworzyć sesji w przeszłości</h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed text-center">
                Nowe sesje można planować wyłącznie w przyszłych terminach. Wybierz proszę datę i godzinę późniejszą niż obecna i spróbuj ponownie.
              </p>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingForm;