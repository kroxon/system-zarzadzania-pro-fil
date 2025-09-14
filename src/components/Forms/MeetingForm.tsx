// ...existing code...
import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Trash2, Calendar, Clock } from 'lucide-react';
import { Meeting, User, Room, Patient } from '../../types';
import { loadPatients } from '../../utils/storage';
import { generateTimeSlots } from '../../utils/timeSlots';
import { isSpecialistAvailable } from '../../utils/specialistAvailability';

const ASSIGN_KEY = 'schedule_therapist_assignments';

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
    patientIds: []
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [patientAssignmentFilter, setPatientAssignmentFilter] = useState<'wszyscy'|'przypisani'>('wszyscy'); // filter patients
  const effectivePatients = patients.length ? patients : loadPatients();
  const [showPastSubmitInfo, setShowPastSubmitInfo] = useState(false);

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

  // load therapistAssignments (single source of truth)
  const therapistAssignments: Record<string,string[]> = React.useMemo(()=> {
    try { const raw = localStorage.getItem(ASSIGN_KEY); return raw? JSON.parse(raw): {}; } catch { return {}; }
  }, []);

  // UNION pacjentów przypisanych do któregokolwiek z wybranych specjalistów (therapistAssignments: patientId -> [therapistIds])
  const assignedPatientIds = React.useMemo(()=>{
    if(!formData.specialistIds.length) return new Set<string>();
    const set = new Set<string>();
    const raw: Record<string,string[]> = therapistAssignments;
    Object.entries(raw).forEach(([patientId, specIds])=> {
      if(specIds.some(s => formData.specialistIds.includes(s))) set.add(patientId);
    });
    return set;
  }, [formData.specialistIds, therapistAssignments]);

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
        patientIds: editingMeeting.patientIds || (editingMeeting.patientId ? [editingMeeting.patientId] : [])
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
        patientIds: []
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
      if (specialistHasConflict(id, effectiveDate, formData.startTime, formData.endTime, editingMeeting?.id)) newErrors.push(`Specjalista (${users.find(u=>u.id===id)?.name||id}) jest zajęty`);
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
  const p = effectivePatients.find(pp=> pp.id===id);
  if (!p) return id;
  // Support both PatientDemo and Patient
  const firstName = 'firstName' in p ? p.firstName : p.name;
  const lastName = 'lastName' in p ? p.lastName : p.surname;
  return `${firstName} ${lastName}`;
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
      patientNamesList
    });
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
  const timeOptions = React.useMemo(()=> generateTimeSlots(7, 20), []);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  // Inline computed validations for live feedback on time and collisions
  const startEndInvalid = React.useMemo(() => {
    if (!formData.startTime || !formData.endTime) return false;
    return toMin(formData.endTime) <= toMin(formData.startTime);
  }, [formData.startTime, formData.endTime]);


  // Sprawdź dostępność specjalistów (czy są dostępni wg EmployeeCalendar)
  const unavailableSpecialists = React.useMemo(() => {
    if (!formData.startTime || !formData.endTime) return [] as string[];
    return formData.specialistIds.filter(id =>
      !isSpecialistAvailable(id, effectiveDate, formData.startTime, formData.endTime)
    );
  }, [formData.specialistIds, formData.startTime, formData.endTime, effectiveDate]);

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
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <div>
                <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Specjaliści</label>
                {/* Select first, then selected specialists list */}
                <select
                  onChange={(e)=>{ const v=e.target.value; if(v) setFormData(fd=> fd.specialistIds.includes(v)? fd : {...fd, specialistIds:[...fd.specialistIds, v]}); e.target.selectedIndex=0; }}
                  value=""
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isEditingPast}
                >
                  <option value="">Dodaj specjalistę...</option>
                  {users.filter(u=>u.role==='employee').map(u=> {
                    const busy = !!(formData.startTime && formData.endTime && specialistHasConflict(u.id, effectiveDate, formData.startTime, formData.endTime, editingMeeting?.id));
                    const unavailable = !!(formData.startTime && formData.endTime && !isSpecialistAvailable(u.id, effectiveDate, formData.startTime, formData.endTime));
                    const already = formData.specialistIds.includes(u.id);
                    let label = u.name + (u.specialization ? ' – ' + u.specialization : '');
                    if (already) label += ' (wybrany)';
                    else if (busy) label += ' (zajęty)';
                    else if (unavailable) label += ' (niedostępny)';
                    let style = {};
                    if (busy) style = { color: '#b45309', backgroundColor: '#fef9c3' };
                    else if (unavailable) style = { color: '#a3a3a3', backgroundColor: '#f3f4f6' };
                    else style = { color: '#047857', backgroundColor: '#d1fae5' };
                    // Blokuj wybór jeśli zajęty lub niedostępny lub już wybrany
                    return <option key={u.id} value={u.id} disabled={busy || unavailable || already} style={style}>{label}</option>;
                  })}
                </select>
                <div className="mt-2">
                  <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white max-h-40 overflow-auto">
                    {formData.specialistIds.length===0 && (
                      <li className="p-3 text-sm text-gray-400">Brak wybranych specjalistów</li>
                    )}
                    {formData.specialistIds.map(id=> {
                      const u = users.find(us=>us.id===id);
                      if(!u) return null;
                      const unavailable = !!(formData.startTime && formData.endTime && !isSpecialistAvailable(id, effectiveDate, formData.startTime, formData.endTime));
                      const busy = !!(formData.startTime && formData.endTime && specialistHasConflict(id, effectiveDate, formData.startTime, formData.endTime, editingMeeting?.id));
                      let bg = 'bg-indigo-50 hover:bg-indigo-100';
                      let text = 'text-gray-900';
                      if (unavailable) {
                        bg = 'bg-gray-100';
                        text = 'text-gray-400';
                      } else if (busy) {
                        bg = 'bg-yellow-50 hover:bg-yellow-100';
                        text = 'text-yellow-800';
                      } else {
                        bg = 'bg-emerald-50 hover:bg-emerald-100';
                        text = 'text-emerald-800';
                      }
                      return (
                        <li
                          key={id}
                          className={`flex items-center justify-between p-2.5 transition-colors ${bg}`}
                        >
                          <div className="min-w-0 pr-3">
                            <div className={`text-sm font-semibold leading-5 truncate ${text}`}>{u.name}</div>
                            <div className="text-xs text-gray-600 truncate">{u.specialization || 'Specjalista'}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {busy && !unavailable && <span className="text-[11px] text-yellow-800 px-2 py-0.5 rounded-full bg-yellow-50 border border-yellow-200">zajęty</span>}
                            {unavailable && <span className="text-[11px] text-gray-500 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">niedostępny</span>}
                            <button
                              type="button"
                              onClick={()=> setFormData(fd=> ({...fd, specialistIds: fd.specialistIds.filter(x=> x!==id)}))}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Usuń specjalistę"
                              title="Usuń"
                              disabled={isEditingPast}
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Podopieczni</label>
                <div className="mb-1 flex items-center gap-3">
                  <div className="inline-flex text-[11px] rounded-lg overflow-hidden border border-indigo-300 bg-indigo-50">
                    <button type="button"
                      onClick={()=> setPatientAssignmentFilter('wszyscy')}
                      className={`px-3 py-1.5 font-medium transition-colors ${patientAssignmentFilter==='wszyscy' ? 'bg-indigo-600 text-white shadow-inner' : 'text-indigo-700 hover:bg-indigo-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      disabled={isEditingPast}
                    >Wszyscy</button>
                    <button type="button"
                      onClick={()=> setPatientAssignmentFilter('przypisani')}
                      className={`px-3 py-1.5 font-medium transition-colors border-l border-indigo-300 ${patientAssignmentFilter==='przypisani' ? 'bg-indigo-600 text-white shadow-inner' : 'text-indigo-700 hover:bg-indigo-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      disabled={isEditingPast}
                    >Przypisani</button>
                  </div>
                </div>
                {patientAssignmentFilter==='przypisani' && (
                  <div className="mb-2">
                    {formData.specialistIds.length===0 ? (
                      <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.598c.75 1.335-.213 2.998-1.742 2.998H3.48c-1.53 0-2.492-1.663-1.743-2.998L8.257 3.1zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-.25-6.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" clipRule="evenodd" /></svg>
                        <span>Wybierz specjalistę aby zobaczyć przypisanych</span>
                      </div>
                    ) : (filteredPatients.length===0 ? (
                      <div className="text-[10px] px-2 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700">Brak wspólnych przypisanych pacjentów</div>
                    ) : null)}
                  </div>
                )}
                {/* Selected patients list first, then select below it */}
                <div className="mt-2">
                  <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white max-h-44 overflow-auto">
                    {formData.patientIds.length===0 && (
                      <li className="p-3 text-sm text-gray-400">Brak</li>
                    )}
                    {formData.patientIds.map(pid=>{
                      const p = effectivePatients.find(pp=>pp.id===pid); if(!p) return null;
                      const firstName = 'firstName' in p ? p.firstName : p.name;
                      const lastName = 'lastName' in p ? p.lastName : p.surname;
                      const fullName = `${firstName} ${lastName}`;
                      return (
                        <li
                          key={pid}
                          className="flex items-center justify-between p-2.5 transition-colors bg-emerald-50 hover:bg-emerald-100"
                        >
                          <div className="min-w-0 pr-3">
                            <div className="text-sm font-semibold leading-5 text-gray-900 truncate">{fullName}</div>
                          </div>
                          <button
                            type="button"
                            onClick={()=> setFormData(fd=>({...fd, patientIds: fd.patientIds.filter(x=>x!==pid)}))}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Usuń podopiecznego"
                            title="Usuń"
                            disabled={isEditingPast}
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {/* Select moved below list */}
                <select
                  onChange={(e)=>{ const v=e.target.value; if(v) setFormData(fd=> fd.patientIds.includes(v)? fd : {...fd, patientIds:[...fd.patientIds, v]}); e.target.selectedIndex=0; }}
                  value=""
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isEditingPast || (patientAssignmentFilter==='przypisani' && formData.specialistIds.length===0)}
                >
                  <option value="">Dodaj podopiecznego...</option>
                  {filteredPatients.map(p=> {
                    const selected = formData.patientIds.includes(String(p.id));
                    const firstName = 'firstName' in p ? p.firstName : p.name;
                    const lastName = 'lastName' in p ? p.lastName : p.surname;
                    return <option key={p.id} value={p.id} disabled={selected}>{firstName} {lastName}{selected ? ' (dodany)':''}</option>;
                  })}
                  {filteredPatients.length===0 && <option value="" disabled>{patientAssignmentFilter==='przypisani'? (formData.specialistIds.length? 'Brak przypisanych':'Najpierw wybierz specjalistę') : 'Brak wyników'}</option>}
                </select>
                {effectivePatients.length===0 && (
                  <p className="mt-1 text-[11px] text-red-500">Brak zarejestrowanych podopiecznych – dodaj w module Pacjenci.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Sala</label>
                <div className="relative">
                  <button type="button" onClick={()=> setRoomsOpen(o=>!o)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed" disabled={isEditingPast}>
                    {formData.roomId ? (
                      <span className="flex items-center gap-2">
                        {(() => { const rc = rooms.find(r=>r.id===formData.roomId); const col = rc?.color || '#9ca3af'; return <span style={{ backgroundColor: col }} className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white shadow" />; })()}
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
                          const col = r.color || '#9ca3af';
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
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {/* Modern date + time picker (custom popovers) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Date picker */}
                <div className="relative min-w-0">
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Data</label>
                  <button type="button" disabled={isEditingPast} onClick={()=> setDateOpen(o=>!o)} className="relative w-full pl-11 pr-3 py-2.5 border border-indigo-200 rounded-lg bg-white text-left shadow-sm hover:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed truncate">
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
                        {calendarDays.map(({d,inMonth},i)=>{
                          const ymd = toYMD(d);
                          const isSelected = ymd === effectiveDate;
                          const todayYMD = toYMD(new Date());
                          const isPastDay = ymd < todayYMD;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={()=> { if (!editingMeeting && isPastDay) { setShowPastSubmitInfo(true); setDateOpen(false); return; } setLocalDate(ymd); setDateOpen(false); }}
                              aria-disabled={!editingMeeting && isPastDay}
                              className={`text-sm py-1.5 rounded text-center ${inMonth? '':'text-gray-400'} ${isSelected? 'bg-indigo-600 text-white':'hover:bg-gray-100'} ${(!editingMeeting && isPastDay && !isSelected) ? 'text-gray-300 cursor-not-allowed' : ''}`}
                            >
                              {d.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Start time picker */}
                <div className="relative min-w-0">
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Start</label>
                  <button type="button" disabled={isEditingPast} onClick={()=> { setStartOpen(o=>!o); setEndOpen(false); }} className="relative w-full pl-11 pr-3 py-2.5 border border-indigo-200 rounded-lg bg-white text-left shadow-sm hover:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed truncate">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"><Clock className="h-3.5 w-3.5" /></span>
                    {formData.startTime || 'Wybierz...'}
                  </button>
                  {startOpen && !isEditingPast && (
                    <div className="absolute z-20 mt-2 w-44 max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-xl">
                      <ul className="py-1 text-sm">
                        {timeOptions.map(t=> {
                          const disabledOpt = isCreateToday && toMin(t) <= nowMinutes;
                          return (
                            <li key={t}>
                              <button
                                type="button"
                                disabled={disabledOpt}
                                onClick={()=> { if(disabledOpt) return; setFormData(fd=> ({...fd, startTime:t, endTime: (fd.endTime && toMin(fd.endTime) > toMin(t)) ? fd.endTime : computeDefaultEnd(t)})); setStartOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 ${disabledOpt ? 'opacity-40 cursor-not-allowed' : 'hover:bg-indigo-50'}`}
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
                  <button type="button" disabled={isEditingPast} onClick={()=> { setEndOpen(o=>!o); setStartOpen(false); }} className="relative w-full pl-11 pr-3 py-2.5 border border-indigo-200 rounded-lg bg-white text-left shadow-sm hover:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed truncate">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"><Clock className="h-3.5 w-3.5" /></span>
                    {formData.endTime || 'Wybierz...'}
                  </button>
                  {endOpen && !isEditingPast && (
                    <div className="absolute z-20 mt-2 w-44 max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-xl">
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
                                  className={`w-full text-left px-3 py-1.5 ${disabledOpt ? 'opacity-40 cursor-not-allowed' : 'hover:bg-indigo-50'}`}
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

              {/* Live validation hints for time and collisions */}
              {!restrictPastEdit && (
                <div className="mt-1 space-y-1">
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
              <div className="grid grid-cols-2 gap-6">
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
                <div className={!isEditingPast ? 'col-span-2' : ''}>
                   <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Gość (opcjonalnie)</label>
                   <input type="text" value={formData.guestName} onChange={e=> setFormData({...formData, guestName:e.target.value})} placeholder="Imię i nazwisko" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed" disabled={isEditingPast} />
                 </div>
               </div>
               <div>
                 <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Notatki</label>
                 <textarea
                   value={formData.notes}
                   onChange={e => setFormData({ ...formData, notes: e.target.value })}
                   onInput={e => {
                     const ta = e.currentTarget;
                     ta.style.height = 'auto';
                     ta.style.height = ta.scrollHeight + 'px';
                   }}
                   rows={1}
                   placeholder="Cel sesji, materiały, obserwacje..."
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                   disabled={isEditingPast && !canEditThis}
                   style={{overflow: 'hidden', minHeight: '40px'}}
                 />
               </div>
               <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500 leading-relaxed">
                 Sesja musi zawierać przynajmniej jednego specjalistę. Podopieczny jest opcjonalny. Konflikty czasowe są sprawdzane automatycznie.
               </div>
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