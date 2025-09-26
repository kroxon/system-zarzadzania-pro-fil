// Zamiana boolean isActive na etykietę statusu
function getPatientStatusLabel(isActive: boolean): 'aktywny' | 'nieaktywny' {
  return isActive ? 'aktywny' : 'nieaktywny';
}
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FileText } from 'lucide-react';
// Backend API functions
import { fetchPatients, fetchPatientReport, createPatient as apiCreatePatient, updatePatient as apiUpdatePatient } from '../../utils/api/patients';
import { fetchEmployees, assignPatientsToEmployee, unassignPatientsFromEmployee } from '../../utils/api/employees';
import { fetchEvents } from '../../utils/api/events';
import { getRooms } from '../../utils/api/rooms';
import { getAllEventStatuses } from '../../utils/api/eventStatuses';
import {Patient, Meeting, Employee, User} from '../../types/index'
import { Search } from 'lucide-react';

interface Visit {
  id: string;
  patientId: string;
  date: string;
  therapists: string[];
  room: string;
  status: 'zrealizowana' | 'odwołana' | 'zaplanowana' | 'nieobecny'; }


export default function Patients(){
  // Pacjenci z backendu
  const [patients, setPatients] = useState<Patient[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  // Bieżący użytkownik z localStorage (zapisywany przez App.tsx)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('schedule_current_user');
      setCurrentUser(raw ? JSON.parse(raw) as User : null);
    } catch {
      setCurrentUser(null);
    }
  }, []);
useEffect(() => {
  const token = localStorage.getItem('token');
  if (!token) return;
  fetchPatients(token)
    .then(data => {
      console.log('fetchPatients result:', data);
      setPatients(data);
    })
    .catch((err) => {
      console.error('fetchPatients error:', err);
      setPatients([]);
    });
  fetchEmployees(token)
    .then(data => setEmployees(data))
    .catch(err => {
      console.error('fetchEmployees error:', err);
      setEmployees([]);
    });
}, []);

useEffect(() => {
  console.log('Patients state:', patients);
}, [patients]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  // Uprawnienia wynikające z roli i przypisań
  const isAdmin = (currentUser?.role === 'admin');
  const currentEmployeeId = useMemo(() => currentUser?.id ? Number(currentUser.id) : NaN, [currentUser?.id]);
  const currentEmployee = useMemo(() => employees.find(e => Number(e.id) === currentEmployeeId), [employees, currentEmployeeId]);
  const isPatientAssignedToCurrent = useCallback((p: Patient | null | undefined) => {
    if (!p) return false;
    if (isAdmin) return true; // admin zawsze ma dostęp
    const myId = Number(currentEmployee?.id ?? currentEmployeeId);
    const byPatientSide = Array.isArray(p.assignedEmployeesIds) && p.assignedEmployeesIds.map(Number).includes(myId);
    const byEmployeeSide = currentEmployee ? (Array.isArray(currentEmployee.assignedPatientsIds) && currentEmployee.assignedPatientsIds.map(Number).includes(Number(p.id))) : false;
    return !!(byPatientSide || byEmployeeSide);
  }, [isAdmin, currentEmployee, currentEmployeeId]);
  const canCreatePatient = isAdmin;
  const canDeletePatient = isAdmin;
  const canEditAssignments = isAdmin; // tylko admin może edytować przypisanych specjalistów
  // Uwaga: zależne od 'selected' obliczenia przeniesione poniżej deklaracji 'selected'

  // Fetch events and rooms when employees/patients are available (needed to split participantIds)
  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    if (!token) return;
    // Need employees and patients to build classification sets
    if (!employees.length || !patients.length) return;
    let cancelled = false;
    (async () => {
      try {
        const [apiEvents, statuses, apiRooms] = await Promise.all([
          fetchEvents(token),
          getAllEventStatuses(token).catch(() => [] as any[]),
          getRooms(token).catch(() => [] as any[])
        ]);
        if (cancelled) return;
        const statusMap: Record<number, string> = {};
        (statuses as any[]).forEach((s: any) => { if (s && typeof s.id === 'number') statusMap[s.id] = String(s.name || ''); });
        const normalizeStatus = (statusId?: number): 'present' | 'absent' | 'cancelled' | 'in-progress' => {
          const name = statusId ? (statusMap[statusId] || '') : '';
          const s = name.toLowerCase();
          if (/(cancel|odwo)/.test(s)) return 'cancelled';
          if (/(absent|nieobec)/.test(s)) return 'absent';
          if (/(progress|w toku)/.test(s)) return 'in-progress';
          return 'present';
        };
        const toLocalParts = (iso: string) => {
          const d = new Date(iso);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          return { date: `${y}-${m}-${dd}`, time: `${hh}:${mm}` };
        };
        const employeeIdSet = new Set<number>(employees.map(e => Number(e.id)).filter(n => Number.isFinite(n)));
        const patientIdSet = new Set<number>(patients.map(p => Number(p.id)).filter(n => Number.isFinite(n)));
        const mappedRooms = (apiRooms as any[]).map((r: any) => ({ id: String(r.id), name: String(r.name || '') }));
        setRooms(mappedRooms);
        const mappedMeetings: Meeting[] = (apiEvents as any[]).map((ev: any) => {
          const parts = Array.isArray(ev?.participantIds) ? ev.participantIds as number[] : [];
          const specNum: number[] = [];
          const patNum: number[] = [];
          parts.forEach(pid => {
            if (employeeIdSet.has(pid)) specNum.push(pid);
            else if (patientIdSet.has(pid)) patNum.push(pid);
          });
          const start = toLocalParts(String(ev.start));
          const end = toLocalParts(String(ev.end));
          return {
            id: `bevt-${ev.id}`,
            specialistId: specNum[0] != null ? String(specNum[0]) : '',
            name: String(ev.name || ''),
            patientName: '',
            patientId: patNum[0] != null ? String(patNum[0]) : undefined,
            guestName: ev.guest || undefined,
            specialistIds: specNum.length ? specNum.map(n => String(n)) : undefined,
            patientIds: patNum.length ? patNum.map(n => String(n)) : undefined,
            roomId: ev.roomId != null ? String(ev.roomId) : '',
            date: start.date,
            startTime: start.time,
            endTime: end.time,
            notes: ev.info || undefined,
            statusId: typeof ev.statusId === 'number' ? ev.statusId : undefined,
            status: normalizeStatus(ev.statusId),
            createdBy: 'backend',
          } as Meeting;
        });
        setMeetings(mappedMeetings);
      } catch (e) {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [employees, patients]);

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    surname: '',
    birthDate: '',
    isActive: true,
    assignedEmployeesIds: [] as number[],
    info: ''
  });

  const [patientNotes, setPatientNotes] = useState<Record<string,string>>({});
  const [sessionNotes, setSessionNotes] = useState<Record<string,string>>({});
  const [openSessionNotes, setOpenSessionNotes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'info'|'sessions'>('info');
  const [showNotesModal, setShowNotesModal] = useState(false);
  // Notes modal filters
  const [notesSearch, setNotesSearch] = useState('');
  const [notesStatus, setNotesStatus] = useState<'all' | Visit['status']>('all');
  const [onlyWithNotes, setOnlyWithNotes] = useState(true);

  const [query, setQuery] = useState('');
  // Nie można wybrać żadnego pacjenta
  const [selected, setSelected] = useState<Patient | null>(null);
  // Teraz można bezpiecznie wyliczyć booleany zależne od 'selected'
  const canSeeSelectedDetails = useMemo(() => isPatientAssignedToCurrent(selected), [isPatientAssignedToCurrent, selected]);
  const canEditSelectedPatient = useMemo(() => {
    if (!selected) return false;
    if (isAdmin) return true;
    // contact/employee: edycja tylko gdy przypisany
    return canSeeSelectedDetails;
  }, [selected, isAdmin, canSeeSelectedDetails]);
  const [statusFilter, setStatusFilter] = useState<'aktywny'|'nieaktywny'|'wszyscy'>('aktywny');
  // Replace generic assignment filter with a specialist single-select filter
  const [specialistFilter, setSpecialistFilter] = useState<'wszyscy' | number>('wszyscy');
  // Custom dropdown state/refs for filters
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showSpecialistMenu, setShowSpecialistMenu] = useState(false);
  const statusBtnRef = useRef<HTMLButtonElement|null>(null);
  const statusMenuRef = useRef<HTMLDivElement|null>(null);
  const specialistBtnRef = useRef<HTMLButtonElement|null>(null);
  const specialistMenuRef = useRef<HTMLDivElement|null>(null);
  // Add-modal dropdowns (status and therapists)
  const [showNewStatusMenu, setShowNewStatusMenu] = useState(false);
  const newStatusBtnRef = useRef<HTMLButtonElement|null>(null);
  const newStatusMenuRef = useRef<HTMLDivElement|null>(null);
  const [showNewTherMenu, setShowNewTherMenu] = useState(false);
  const newTherBtnRef = useRef<HTMLButtonElement|null>(null);
  const newTherMenuRef = useRef<HTMLDivElement|null>(null);
  // Edit-mode dropdowns (status and therapists)
  const [showEditStatusMenu, setShowEditStatusMenu] = useState(false);
  const editStatusBtnRef = useRef<HTMLButtonElement|null>(null);
  const editStatusMenuRef = useRef<HTMLDivElement|null>(null);
  const [showEditTherMenu, setShowEditTherMenu] = useState(false);
  const editTherBtnRef = useRef<HTMLButtonElement|null>(null);
  const editTherMenuRef = useRef<HTMLDivElement|null>(null);

  // Date picker state and helpers (modern dialog)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dpMonth, setDpMonth] = useState<Date>(new Date());
  const [dateTarget, setDateTarget] = useState<'edit'|'new'|null>(null);
  // Focus refs for dialogs
  const datePickerOverlayRef = useRef<HTMLDivElement|null>(null);
  // Year dropdown for the date picker
  const [showYearMenu, setShowYearMenu] = useState(false);
  const yearBtnRef = useRef<HTMLButtonElement|null>(null);
  const yearMenuRef = useRef<HTMLDivElement|null>(null);
  const yearsList = useMemo(()=> {
    const current = new Date().getFullYear();
    const minYear = 1900;
    const list: number[] = [];
    for(let y=current; y>=minYear; y--) list.push(y);
    return list;
  }, []);
  const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  const daysOfWeek = ['Pn','Wt','Śr','Cz','Pt','So','Nd'];
  const formatDateYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const getMonthGrid = (month: Date) => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({length: 42}, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { d, current: d.getMonth() === month.getMonth() };
    });
  };
  const openDatePickerFor = (target: 'edit'|'new') => {
    setDateTarget(target);
    const baseStr = target==='edit' ? editForm.birthDate : newPatientForm.birthDate;
    const base = baseStr ? new Date(baseStr) : new Date();
    const m = new Date(base.getFullYear(), base.getMonth(), 1);
    setDpMonth(m);
    setShowDatePicker(true);
  };
  const closeDatePicker = () => { setShowDatePicker(false); setDateTarget(null); setShowYearMenu(false); };

  // When date picker opens, focus overlay so ESC works
  useEffect(()=>{
    if(showDatePicker){
      requestAnimationFrame(()=> datePickerOverlayRef.current?.focus());
    }
  }, [showDatePicker]);

  // Note syncing: keep sessionNotes prefilled from meeting notes
  // (independent from selected patient filtering)

  useEffect(()=>{
    setSessionNotes(prev => {
      let changed = false; const next = { ...prev };
      meetings.forEach((m: Meeting)=> { if(m.notes && !next[m.id]) { next[m.id] = m.notes; changed = true; }});
      return changed ? next : prev;
    });
  },[meetings]);

  const employeeIdToName = useMemo(()=>{
    const m: Record<number,string> = {};
    employees.forEach(e => { m[e.id] = `${e.name} ${e.surname}`.trim(); });
    return m;
  },[employees]);

  const getStatusLabel = (v: 'aktywny'|'nieaktywny'|'wszyscy') => v==='aktywny' ? 'Aktywni' : v==='nieaktywny' ? 'Nieaktywni' : 'Wszyscy';

  // Precompute sorted employees: label "Nazwisko Imię" and sort by last name then first name (case/diacritics insensitive)
  const employeesSorted = useMemo(()=>{
    const strip = (s:string)=> s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
    return employees
      .map((e: Employee)=> {
        const first = (e.name||'').trim();
        const last = (e.surname||'').trim();
        const label = last ? `${last} ${first}` : first;
        const sortKey = `${strip(last)} ${strip(first)}`;
        return { id: e.id, label, sortKey };
      })
      .sort((a, b)=> a.sortKey.localeCompare(b.sortKey));
  },[employees]);

  // Close dropdowns on outside click
  useEffect(()=>{
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if(showStatusMenu && !statusMenuRef.current?.contains(t) && !statusBtnRef.current?.contains(t)) setShowStatusMenu(false);
      if(showSpecialistMenu && !specialistMenuRef.current?.contains(t) && !specialistBtnRef.current?.contains(t)) setShowSpecialistMenu(false);
      // Add-modal dropdowns
      if(showNewStatusMenu && !newStatusMenuRef.current?.contains(t) && !newStatusBtnRef.current?.contains(t)) setShowNewStatusMenu(false);
      if(showNewTherMenu && !newTherMenuRef.current?.contains(t) && !newTherBtnRef.current?.contains(t)) setShowNewTherMenu(false);
      // Edit-mode dropdowns
      if(showEditStatusMenu && !editStatusMenuRef.current?.contains(t) && !editStatusBtnRef.current?.contains(t)) setShowEditStatusMenu(false);
      if(showEditTherMenu && !editTherMenuRef.current?.contains(t) && !editTherBtnRef.current?.contains(t)) setShowEditTherMenu(false);
      // Date picker year menu
      if(showYearMenu && !yearMenuRef.current?.contains(t) && !yearBtnRef.current?.contains(t)) setShowYearMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStatusMenu, showSpecialistMenu, showNewStatusMenu, showNewTherMenu, showEditStatusMenu, showEditTherMenu, showYearMenu]);

  // Normalization for search (diacritics-insensitive)
  const normalize = (s: string) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

  // Filtered patients list for the left panel
  const filtered = useMemo(() => {
    const q = normalize(query);
    const list = patients.slice();
    const byText = list.filter(p => {
      const fn = normalize(p.name);
      const ln = normalize(p.surname);
      const full1 = `${fn} ${ln}`;
      const full2 = `${ln} ${fn}`;
      return !q || fn.includes(q) || ln.includes(q) || full1.includes(q) || full2.includes(q);
    });
    const byStatus = byText.filter(p => {
      const st = p.isActive ? 'aktywny' : 'nieaktywny';
      return statusFilter==='wszyscy' ? true : st===statusFilter;
    });
    const bySpecialist = byStatus.filter(p => {
      if(specialistFilter==='wszyscy') return true;
      const assigned = Array.isArray(p.assignedEmployeesIds) ? p.assignedEmployeesIds.map(Number) : [];
      return assigned.includes(Number(specialistFilter));
    });
    // sort by last name, then first name
    return bySpecialist.sort((a,b)=> {
      const lnA = normalize(a.surname); const lnB = normalize(b.surname);
      if(lnA!==lnB) return lnA.localeCompare(lnB);
      return normalize(a.name).localeCompare(normalize(b.name));
    });
  }, [patients, query, statusFilter, specialistFilter]);

  const statusLabel = (status?: string): JSX.Element => {
    const st = (status as 'aktywny'|'nieaktywny'|undefined) || 'aktywny';
    const color = st==='aktywny' ? 'bg-green-500' : 'bg-gray-400';
    return (
      <span className="inline-flex items-center gap-2 text-sm text-gray-800">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />
        <span className="capitalize">{st}</span>
      </span>
    );
  };

  const visitStatusLabel = (status: Visit['status']): JSX.Element => {
    const map: Record<Visit['status'], { color: string; text: string }> = {
      'zrealizowana': { color: 'text-green-700', text: 'zrealizowana' },
      'odwołana': { color: 'text-red-700', text: 'odwołana' },
      'zaplanowana': { color: 'text-blue-700', text: 'zaplanowana' },
      'nieobecny': { color: 'text-amber-700', text: 'nieobecny' }
    };
    const dot: Record<Visit['status'], string> = {
      'zrealizowana': 'bg-green-500',
      'odwołana': 'bg-red-500',
      'zaplanowana': 'bg-blue-500',
      'nieobecny': 'bg-amber-400'
    };
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs ${map[status].color}`}>
        <span className={`inline-block h-2 w-2 rounded-full ${dot[status]}`} aria-hidden="true" />
        <span className="capitalize">{map[status].text}</span>
      </span>
    );
  };

  // Status-specific UI accents (consistent with project palette)
  const getStatusStyles = (status: Visit['status']) => {
    switch (status) {
      case 'zrealizowana':
        return {
          cardBorder: 'border-green-200',
          badgeBg: 'bg-green-50',
          badgeText: 'text-green-800',
          link: 'text-green-700 hover:text-green-900'
        };
      case 'odwołana':
        return {
          cardBorder: 'border-red-200',
          badgeBg: 'bg-red-50',
          badgeText: 'text-red-800',
          link: 'text-red-700 hover:text-red-900'
        };
      case 'nieobecny':
        return {
          cardBorder: 'border-amber-200',
          badgeBg: 'bg-amber-50',
          badgeText: 'text-amber-800',
          link: 'text-amber-700 hover:text-amber-900'
        };
      case 'zaplanowana':
      default:
        return {
          cardBorder: 'border-blue-200',
          badgeBg: 'bg-blue-50',
          badgeText: 'text-blue-800',
          link: 'text-blue-700 hover:text-blue-900'
        };
    }
  };

  // Selected patient's visits (newest first), include only meetings with a room and where selected patient participates
  const selectedVisits = useMemo(()=>{
    if(!selected) return [] as Visit[];
    const employeeMap = new Map<number, string>(employees.map((e: Employee)=> [e.id, `${e.name} ${e.surname}`]));
    const roomMap = new Map<string, string>(rooms.map((r: {id:string; name:string})=> [r.id, r.name]));
    const todayStr = new Date().toISOString().split('T')[0];
    const pid = Number(selected.id);
    return meetings
      .filter(m => !!m.roomId)
      .filter(m => {
        const pids = (m.patientIds || (m.patientId ? [m.patientId] : [])).map(id => Number(id));
        return pids.includes(pid);
      })
      .map((m: Meeting) => {
        let status: Visit['status'];
        if(m.status === 'cancelled') status = 'odwołana';
        else if(m.status === 'absent') status = 'nieobecny';
        else if(m.status === 'in-progress') status = 'zaplanowana';
        else status = m.date > todayStr ? 'zaplanowana' : 'zrealizowana';
        const therapistIds = (m.specialistIds && m.specialistIds.length ? m.specialistIds : (m.specialistId ? [m.specialistId] : []));
        const therapists = therapistIds.map((id) => employeeMap.get(Number(id)) || String(id)).filter(Boolean) as string[];
        return { id: m.id, patientId: String(selected.id), date: m.date, therapists, room: (roomMap.get(m.roomId) || m.roomId) as string, status } as Visit;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [meetings, employees, rooms, selected]);

  // Session tiles counts
  const visitCounts = useMemo(()=>{
    if(!selected) return { total: 0, zrealizowana: 0, odwolana: 0, nieobecny: 0, zaplanowana: 0 };
    const vs = selectedVisits;
    const acc = { total: vs.length, zrealizowana: 0, odwolana: 0, nieobecny: 0, zaplanowana: 0 } as any;
    vs.forEach(v => {
      if(v.status==='zrealizowana') acc.zrealizowana++;
      else if(v.status==='odwołana') acc.odwolana++;
      else if(v.status==='nieobecny') acc.nieobecny++;
      else acc.zaplanowana++;
    });
    return acc as { total: number, zrealizowana: number, odwolana: number, nieobecny: number, zaplanowana: number };
  }, [selectedVisits, selected]);

  const addTherapist = (id: number) => {
    if(!id) return;
    setEditForm(f => f.assignedEmployeesIds.includes(id) ? f : { ...f, assignedEmployeesIds: [...f.assignedEmployeesIds, id] });
  };
  const removeTherapist = (id: number) => {
    setEditForm(f => ({ ...f, assignedEmployeesIds: f.assignedEmployeesIds.filter(t => t !== id) }));
  };

  const startEdit = () => {
    if(!selected) return;
    setEditForm({
      name: selected.name || '',
      surname: selected.surname || '',
      birthDate: selected.birthDate || '',
      isActive: !!selected.isActive,
      assignedEmployeesIds: Array.isArray(selected.assignedEmployeesIds) ? selected.assignedEmployeesIds.map(Number) : [],
      info: (patientNotes[selected.id] ?? selected.info ?? '')
    });
    setEditMode(true);
  };

  const handleGenerate = () => {
    if(!selected) return;
  const token = localStorage.getItem('token') || '';
    fetchPatientReport(selected.id, token)
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `raport_pacjenta_${selected.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(err => {
        // Możesz dodać powiadomienie o błędzie
        console.error('Błąd pobierania raportu:', err);
      });
  }

  const saveEdit = async () => {
    if(!selected) return;
    const token = localStorage.getItem('token') || '';
    // Jeżeli użytkownik nie ma prawa do edycji przypisań, wymuś brak zmian w przypisaniach
    const nextAssignedRaw = Array.isArray(editForm.assignedEmployeesIds) ? editForm.assignedEmployeesIds.map(Number) : [];
    const currentAssigned = Array.isArray(selected.assignedEmployeesIds) ? selected.assignedEmployeesIds.map(Number) : [];
    const nextAssigned = canEditAssignments ? nextAssignedRaw : currentAssigned.slice();
    const toAdd = canEditAssignments ? nextAssigned.filter(id => !currentAssigned.includes(id)) : [];
    const toRemove = canEditAssignments ? currentAssigned.filter(id => !nextAssigned.includes(id)) : [];

    // Update patient core fields first
    await apiUpdatePatient(selected.id, {
      name: editForm.name.trim(),
      surname: editForm.surname.trim(),
      birthDate: editForm.birthDate || '',
      isActive: !!editForm.isActive,
      info: editForm.info?.trim() || ''
    }, token);

    // Then apply assignments via employees endpoints
    if (canEditAssignments) {
      await Promise.all([
        ...toAdd.map(empId => assignPatientsToEmployee(empId, { patientIds: [selected.id] }, token)),
        ...toRemove.map(empId => unassignPatientsFromEmployee(empId, { patientIds: [selected.id] }, token))
      ]);
    }

    // Optionally update local notes mirror
    setPatientNotes(prev => {
      const next = { ...prev };
      const txt = (editForm.info || '').trim();
      if(txt) next[selected.id] = txt; else delete next[selected.id];
      return next;
    });

    // Refetch patients and update selection
    const refreshed = await fetchPatients(token).catch(()=>patients);
    setPatients(refreshed);
    const updatedSel = refreshed.find(p => p.id === selected.id) || null;
    setSelected(updatedSel);
    setEditMode(false);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setShowDatePicker(false);
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Delete selected patient and related data
  const deleteSelected = async () => {
    if(!selected) return;
    const token = localStorage.getItem('token') || '';
    const id = selected.id;
    try {
      // Call backend delete
      const { deletePatient } = await import('../../utils/api/patients');
      await deletePatient(id, token);
    } catch (e) {
      // even if backend fails, proceed with local removal to keep UI responsive
      console.error('deletePatient failed, removing locally', e);
    }
    // Local cleanup
    setPatients(prev => prev.filter(p => p.id !== id));
    setPatientNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
    const vIds = meetings
      .filter(m => !!m.roomId)
      .filter(m => {
        const pids = (m.patientIds || (m.patientId ? [m.patientId] : [])).map(id => Number(id));
        return pids.includes(id);
      })
      .map(m => m.id);
    setSessionNotes(prev => { const n = { ...prev }; vIds.forEach(vid => { delete n[vid]; }); return n; });
    setSelected(null);
    setOpenSessionNotes(new Set());
  };

  const openDeleteModal = () => { if(selected && canDeletePatient) setShowDeleteModal(true); };
  const cancelDelete = () => { if(deleting) return; setShowDeleteModal(false); };
  const confirmDelete = () => {
    if(!selected || !canDeletePatient) return;
    setDeleting(true);
    deleteSelected();
    setDeleting(false);
    setShowDeleteModal(false);
  };

  // Accessibility refs
  const addBtnRef = useRef<HTMLButtonElement|null>(null);
  const modalRef = useRef<HTMLDivElement|null>(null);
  const firstFieldRef = useRef<HTMLInputElement|null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const deleteModalRef = useRef<HTMLDivElement|null>(null);
  const notesModalRef = useRef<HTMLDivElement|null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const emptyNew = { name:'', surname:'', birthDate:'', isActive:true, assignedEmployeesIds:[] as number[], info:'' };
  const [newPatientForm, setNewPatientForm] = useState<typeof emptyNew>(emptyNew);
  const [newErrors, setNewErrors] = useState<string[]>([]);

  const validateNew = () => {
    const errs: string[] = [];
    if(!newPatientForm.name.trim()) errs.push('Imię jest wymagane');
    if(!newPatientForm.surname.trim()) errs.push('Nazwisko jest wymagane');
    if(newPatientForm.birthDate && isNaN(new Date(newPatientForm.birthDate).getTime())) errs.push('Nieprawidłowa data urodzenia');
    setNewErrors(errs); return errs.length===0;
  };

  const openAdd = () => { setNewPatientForm(emptyNew); setNewErrors([]); setShowAddModal(true); };
  const cancelAdd = () => { if(creating) return; setShowAddModal(false); };

  const submitAdd = async (e:React.FormEvent) => {
    e.preventDefault();
    if(!validateNew()) return;
    setCreating(true);
    const token = localStorage.getItem('token') || '';
    try {
      // Create patient (without assignments)
      const created = await apiCreatePatient({
        name: newPatientForm.name.trim(),
        surname: newPatientForm.surname.trim(),
        birthDate: newPatientForm.birthDate || '',
        isActive: !!newPatientForm.isActive,
        info: newPatientForm.info?.trim() || ''
      }, token);

      // Assign to selected employees via employees endpoints
      const ids = Array.isArray(newPatientForm.assignedEmployeesIds) ? newPatientForm.assignedEmployeesIds.map(Number) : [];
      if(created && ids.length){
        await Promise.all(ids.map(empId => assignPatientsToEmployee(empId, { patientIds: [created.id] }, token)));
      }

      // Refresh list and focus new patient
      const refreshed = await fetchPatients(token);
      setPatients(refreshed);
      const sel = created ? refreshed.find(p => p.id === created.id) || null : null;
      setSelected(sel);
      setShowAddModal(false);
    } catch (err: any) {
      setNewErrors([err?.message || 'Błąd dodawania pacjenta']);
    } finally {
      setCreating(false);
    }
  };
  const toggleNewTherapist = (id:number) => {
    setNewPatientForm(f => f.assignedEmployeesIds.includes(id) ? { ...f, assignedEmployeesIds: f.assignedEmployeesIds.filter(t=>t!==id) } : { ...f, assignedEmployeesIds:[...f.assignedEmployeesIds, id] });
  };

  // History table dynamic height so only it scrolls
  const historyRef = useRef<HTMLDivElement|null>(null);
  const [historyMax, setHistoryMax] = useState<number>(0);
  const recalcHistoryMax = () => {
    const el = historyRef.current;
    if(!el) return;
    const top = el.getBoundingClientRect().top; // distance from viewport top
    const marginBottom = 72; // safe space under tabelą (unikamy scrolla strony)
    const max = Math.max(160, Math.floor(window.innerHeight - top - marginBottom));
    setHistoryMax(max);
  };
  useEffect(()=>{
    // initial + on resize
    requestAnimationFrame(recalcHistoryMax);
    window.addEventListener('resize', recalcHistoryMax);
    window.addEventListener('scroll', recalcHistoryMax, { passive: true });
    return () => { window.removeEventListener('resize', recalcHistoryMax); window.removeEventListener('scroll', recalcHistoryMax); };
  }, []);
  // Recalculate when layout above can change height
  useEffect(()=>{ requestAnimationFrame(recalcHistoryMax); }, [selected, editMode, activeTab]);

  // Ensure no page-level scroll while this view is active
  useEffect(()=>{
    const html = document.documentElement;
    const prev = html.style.overflowY;
    html.style.overflowY = 'hidden';
    return () => { html.style.overflowY = prev; };
  }, []);

  useEffect(()=> {
    if(showAddModal){
      prevFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      // autofocus disabled per user request
    } else {
      document.body.style.overflow = '';
      addBtnRef.current?.focus();
      prevFocusRef.current?.focus?.();
    }
  }, [showAddModal]);

  // Match delete modal behavior with other dialogs (scroll lock + focus restore)
  useEffect(()=>{
    if(showDeleteModal){
      prevFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      // focus container so ESC/Tab trapping works
      requestAnimationFrame(()=> deleteModalRef.current?.focus());
    } else {
      document.body.style.overflow = '';
      prevFocusRef.current?.focus?.();
    }
  }, [showDeleteModal]);

  // Notes modal behavior (scroll lock + focus restore)
  useEffect(()=>{
    if(showNotesModal){
      prevFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(()=> notesModalRef.current?.focus());
    } else {
      document.body.style.overflow = '';
      prevFocusRef.current?.focus?.();
    }
  }, [showNotesModal]);

  return (
    <div className="space-y-6">
      <div className="flex items-center flex-wrap gap-3">
        <div className="flex-1 max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex items-center space-x-2 relative">
          <Search className="h-4 w-4 text-gray-400" />
          <input value={query} onChange={e=> setQuery(e.target.value)} placeholder="Szukaj podopiecznego (imię lub nazwisko)" className="flex-1 bg-transparent outline-none text-sm pr-6" />
          {query && <button type="button" onClick={()=> setQuery('')} className="absolute right-3 text-gray-400 hover:text-gray-600" aria-label="Wyczyść">×</button>}
        </div>
        {/* Status filter dropdown */}
        <div className="relative">
          <button
            ref={statusBtnRef}
            type="button"
            onClick={()=> setShowStatusMenu(v=>!v)}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50"
            aria-haspopup="listbox"
            aria-expanded={showStatusMenu}
          >
            <span className="text-gray-700">{getStatusLabel(statusFilter)}</span>
            <svg className={`h-4 w-4 text-gray-400 transition-transform ${showStatusMenu?'rotate-180':''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.02l3.71-3.79a.75.75 0 111.08 1.04l-4.24 4.34a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
          </button>
          {showStatusMenu && (
            <div
              ref={statusMenuRef}
              role="listbox"
              tabIndex={-1}
              onKeyDown={(e)=> { if(e.key==='Escape'){ e.preventDefault(); setShowStatusMenu(false); statusBtnRef.current?.focus(); } }}
              className="absolute z-50 mt-2 w-48 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-gray-100"
            >
              {(['aktywny','nieaktywny','wszyscy'] as const).map(opt => (
                <button
                  type="button"
                  key={opt}
                  onClick={()=> { setStatusFilter(opt); setShowStatusMenu(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50 ${statusFilter===opt? 'bg-indigo-50 text-indigo-700':'text-gray-700'}`}
                  role="option"
                  aria-selected={statusFilter===opt}
                >
                  <span>{getStatusLabel(opt)}</span>
                  {statusFilter===opt && (
                    <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.75 11.836l6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Specialist filter dropdown */}
        <div className="relative">
          <button
            ref={specialistBtnRef}
            type="button"
            onClick={()=> setShowSpecialistMenu(v=>!v)}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50 min-w-[14rem] justify-between"
            aria-haspopup="listbox"
            aria-expanded={showSpecialistMenu}
          >
            <span className="truncate text-gray-700">{specialistFilter==='wszyscy' ? 'Wszyscy specjaliści' : (employeesSorted.find((e: any)=> e.id===specialistFilter)?.label || '—')}</span>
            <svg className={`h-4 w-4 text-gray-400 transition-transform ${showSpecialistMenu?'rotate-180':''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.02l3.71-3.79a.75.75 0 111.08 1.04l-4.24 4.34a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
          </button>
          {showSpecialistMenu && (
            <div
              ref={specialistMenuRef}
              role="listbox"
              tabIndex={-1}
              onKeyDown={(e)=> { if(e.key==='Escape'){ e.preventDefault(); setShowSpecialistMenu(false); specialistBtnRef.current?.focus(); } }}
              className="absolute z-50 mt-2 w-72 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-gray-100"
            >
              <div className="max-h-64 overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={()=> { setSpecialistFilter('wszyscy'); setShowSpecialistMenu(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${specialistFilter==='wszyscy'? 'bg-indigo-50 text-indigo-700':'text-gray-700'}`}
                  role="option"
                  aria-selected={specialistFilter==='wszyscy'}
                >
                  <span>Wszyscy specjaliści</span>
                  {specialistFilter==='wszyscy' && (
                    <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.75 11.836l6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  )}
                </button>
                <div className="my-1 border-t border-gray-100" />
                {employeesSorted.map((emp: any) => (
                  <button
                    type="button"
                    key={emp.id}
                    onClick={()=> { setSpecialistFilter(emp.id); setShowSpecialistMenu(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${specialistFilter===emp.id? 'bg-indigo-50 text-indigo-700':'text-gray-700'}`}
                    role="option"
                    aria-selected={specialistFilter===emp.id}
                  >
                    <span className="truncate">{emp.label}</span>
                    {specialistFilter===emp.id && (
                      <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.75 11.836l6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={canCreatePatient ? openAdd : undefined}
          ref={addBtnRef}
          className={`inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-lg shadow focus:ring-2 focus:ring-offset-2 ${canCreatePatient ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 focus:ring-indigo-500' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
          disabled={!canCreatePatient}
          title={canCreatePatient ? undefined : 'Tylko administrator może dodawać podopiecznych'}
        >
          <span className="text-lg leading-none">＋</span> Dodaj
        </button>
      </div>

      <div className="flex items-start gap-6">
        <div className="w-72 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Nazwisko i imię</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={2} className="px-3 py-4 text-center text-sm text-gray-500">Brak podopiecznych</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(p)}>
                    <td className="px-3 py-2 whitespace-nowrap">{p.surname} {p.name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{statusLabel(getPatientStatusLabel(p.isActive))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex-1 min-h-[400px] bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {!selected && <div className="h-full flex items-center justify-center text-gray-400 text-sm">Wybierz podopiecznego z listy po lewej</div>}
          {selected && !canSeeSelectedDetails && !isAdmin && (
            <div className="h-full flex items-center justify-center">
              <div className="max-w-md w-full text-center bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
                  <svg className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.25a.75.75 0 011.5 0v1.5a.75.75 0 01-1.5 0v-1.5zM10 6a1 1 0 00-1 1v4a1 1 0 102 0V7a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Podopieczny nie jest przypisany do Twojego konta</h3>
                <p className="text-sm text-gray-600">Aby zobaczyć szczegóły, poproś administratora o przypisanie Ci tego podopiecznego.</p>
              </div>
            </div>
          )}
          {selected && (canSeeSelectedDetails || isAdmin) && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {editMode ? (
                        <div className="flex gap-2">
                          <input value={editForm.name} onChange={e=> setEditForm(f=> ({...f, name:e.target.value}))} className="px-2 py-1 text-sm border rounded" />
                          <input value={editForm.surname} onChange={e=> setEditForm(f=> ({...f, surname:e.target.value}))} className="px-2 py-1 text-sm border rounded" />
                        </div>
                      ) : `${selected.name} ${selected.surname}`}
                    </h2>
                    <div className="flex items-center gap-2 ml-4">
                      {!editMode && (
                        <>
                          <button
                            onClick={canDeletePatient ? openDeleteModal : undefined}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${canDeletePatient ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'}`}
                            disabled={!canDeletePatient}
                            title={canDeletePatient ? undefined : 'Usuwanie dostępne tylko dla administratora'}
                          >
                            Usuń
                          </button>
                          <button
                            onClick={canEditSelectedPatient ? startEdit : undefined}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${canEditSelectedPatient ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`}
                            disabled={!canEditSelectedPatient}
                            title={canEditSelectedPatient ? undefined : 'Edycja dostępna dla przypisanych użytkowników'}
                          >
                            Edytuj
                          </button>
                          <button onClick={handleGenerate} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-white" />
                            Generuj raport
                          </button>
                        </>
                      )}
                      {editMode && (
                        <>
                          <button onClick={saveEdit} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700">Zapisz</button>
                          <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300">Anuluj</button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-6 items-start">
                    <div className="space-y-2 text-sm text-gray-600 col-span-1">
                      <p><strong className="text-[0.95rem] font-semibold text-gray-800">Data urodzenia:</strong>{' '}
                        {editMode ? (
                          // Birth date picker trigger + dialog
                          <>
                            <button
                              type="button"
                              onClick={()=> openDatePickerFor('edit')}
                              className="ml-2 inline-flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              <span>{editForm.birthDate || 'Wybierz datę'}</span>
                            </button>
                            {/* Date picker overlay rendered once below; opened with openDatePickerFor('edit') */}
                          </>
                        ) : <>
                              <span className="ml-1">{selected.birthDate || '—'}</span>
                              <span className="ml-2 text-gray-500">{(() => { if(!selected.birthDate) return '(—)'; const bd = new Date(selected.birthDate); if(isNaN(bd.getTime())) return '(—)'; const now = new Date(); let age = now.getFullYear() - bd.getFullYear(); const m = now.getMonth() - bd.getMonth(); if(m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--; return `(${age} lat)`; })()}</span>
                            </>}
                      </p>
                      <p className="flex items-center"><strong className="mr-1 text-[0.95rem] font-semibold text-gray-800">Status:</strong>{' '}
                        {editMode ? (
                          <div className="relative inline-block">
                            <button
                              ref={editStatusBtnRef}
                              type="button"
                              onClick={()=> setShowEditStatusMenu(v=>!v)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xl bg-white border border-gray-300 shadow-sm hover:bg-gray-50"
                              aria-haspopup="listbox"
                              aria-expanded={showEditStatusMenu}
                            >
                              <span className="capitalize text-gray-700">{getPatientStatusLabel(editForm.isActive)}</span>
                              <svg className={`h-4 w-4 text-gray-400 transition-transform ${showEditStatusMenu?'rotate-180':''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.024l3.71-3.793a.75.75 0 111.08 1.04l-4.24 4.336a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
                            </button>
                            {showEditStatusMenu && (
                              <div
                                ref={editStatusMenuRef}
                                role="listbox"
                                tabIndex={-1}
                                onKeyDown={(e)=> { if(e.key==='Escape'){ e.preventDefault(); setShowEditStatusMenu(false); editStatusBtnRef.current?.focus(); } }}
                                className="absolute z-50 mt-2 w-44 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-gray-100"
                              >
                                {(['aktywny','nieaktywny'] as const).map(opt => (
                                  <button
                                    type="button"
                                    key={opt}
                                    onClick={()=> { setEditForm(f=> ({...f, isActive: opt==='aktywny'})); setShowEditStatusMenu(false); }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50 ${getPatientStatusLabel(editForm.isActive)===opt? 'bg-indigo-50 text-indigo-700':'text-gray-700'}`}
                                    role="option"
                                    aria-selected={getPatientStatusLabel(editForm.isActive)===opt}
                                  >
                                    <span className="capitalize">{opt}</span>
                                    {getPatientStatusLabel(editForm.isActive)===opt && (
                                      <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.75 11.836l6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : statusLabel(getPatientStatusLabel(selected.isActive))}
                      </p>
                      <div>
                        <p className="mb-1"><strong className="text-[0.95rem] font-semibold text-gray-800">Terapeuci:</strong></p>
                        {!editMode && (
                          <>
                            {(selected.assignedEmployeesIds||[]).length===0 ? (
                              <span className="text-xs text-gray-400">Brak przypisanych terapeutów</span>
                            ) : (
                              <ul className="grid grid-cols-2 gap-2 w-full">
                                {selected.assignedEmployeesIds.map(tId => {
                                  const name = employeeIdToName[Number(tId)] || String(tId);
                                  return (
                                    <li key={tId} className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-sm text-blue-900 font-medium">
                                      {name}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </>
                        )}
                        {editMode && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {editForm.assignedEmployeesIds.map(tId => {
                                const name = employeeIdToName[Number(tId)] || String(tId);
                                return (
                                  <span key={tId} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-900">
                                    <span className="font-medium">{name}</span>
                                    <button
                                      onClick={canEditAssignments ? (()=> removeTherapist(tId)) : undefined}
                                      className={`ml-1 rounded-full h-5 w-5 inline-flex items-center justify-center ${canEditAssignments ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                      aria-label={`Usuń terapeutę ${name}`}
                                      disabled={!canEditAssignments}
                                      title={canEditAssignments ? undefined : 'Edycja przypisań dostępna tylko dla administratora'}
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                              {editForm.assignedEmployeesIds.length===0 && <span className="text-xs text-gray-400">Brak terapeutów</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="relative inline-block">
                                <button
                                  ref={editTherBtnRef}
                                  type="button"
                                  onClick={canEditAssignments ? (()=> setShowEditTherMenu(v=>!v)) : undefined}
                                  className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl min-w-[14rem] justify-between ${canEditAssignments ? 'bg-white border border-gray-300 shadow-sm hover:bg-gray-50' : 'bg-gray-100 border border-gray-200 text-gray-500 cursor-not-allowed'}`}
                                  aria-haspopup="listbox"
                                  aria-expanded={showEditTherMenu}
                                  disabled={!canEditAssignments}
                                  title={canEditAssignments ? undefined : 'Edycja przypisań dostępna tylko dla administratora'}
                                >
                                  <span className="truncate text-gray-700">Dodaj terapeutę...</span>
                                  <svg className={`h-4 w-4 text-gray-400 transition-transform ${showEditTherMenu?'rotate-180':''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.02l3.71-3.79a.75.75 0 111.08 1.04l-4.24 4.34a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
                                </button>
                                {showEditTherMenu && canEditAssignments && (
                                  <div
                                    ref={editTherMenuRef}
                                    role="listbox"
                                    tabIndex={-1}
                                    onKeyDown={(e)=> { if(e.key==='Escape'){ e.preventDefault(); setShowEditTherMenu(false); editTherBtnRef.current?.focus(); } }}
                                    className="absolute z-50 mt-2 w-72 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-gray-100"
                                  >
                                    <div className="max-h-64 overflow-y-auto py-1">
                                      {employeesSorted.filter((emp: any) => !editForm.assignedEmployeesIds.includes(Number(emp.id))).map((emp: any) => (
                                        <button
                                          type="button"
                                          key={emp.id}
                                          onClick={()=> { addTherapist(Number(emp.id)); setShowEditTherMenu(false); }}
                                          className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                                          role="option"
                                        >
                                          <span className="truncate">{emp.label}</span>
                                          <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/></svg>
                                        </button>
                                      ))}
                                      {employeesSorted.filter((emp: any) => !editForm.assignedEmployeesIds.includes(Number(emp.id))).length===0 && (
                                        <div className="px-3 py-2 text-sm text-gray-500">Wszyscy terapeuci są już dodani</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        <p className="mb-1"><strong className="text-[0.95rem] font-semibold text-gray-800">Sesje:</strong></p>
                        {visitCounts.total===0 ? (
                          <p className="text-sm italic text-gray-500">Brak sesji</p>
                        ) : (
                          <div className="grid grid-cols-4 gap-2">
                            <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-center">
                              <div className="text-[9px] font-medium text-green-700 tracking-wide uppercase leading-none">Zrealizowane</div>
                              <div className="mt-1 text-sm font-semibold text-green-800 leading-none">{visitCounts.zrealizowana}</div>
                            </div>
                            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-center">
                              <div className="text-[9px] font-medium text-red-700 tracking-wide uppercase leading-none">Odwołane</div>
                              <div className="mt-1 text-sm font-semibold text-red-700 leading-none">{visitCounts.odwolana}</div>
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center">
                              <div className="text-[9px] font-medium text-amber-700 tracking-wide uppercase leading-none">Nieobecny</div>
                              <div className="mt-1 text-sm font-semibold text-amber-700 leading-none">{visitCounts.nieobecny}</div>
                            </div>
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-center">
                              <div className="text-[9px] font-medium text-blue-700 tracking-wide uppercase leading-none">Zaplanowane</div>
                              <div className="mt-1 text-sm font-semibold text-blue-800 leading-none">{visitCounts.zaplanowana}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 flex flex-col h-full">
                      <div className="flex border-b border-gray-200 mb-3">
                        <button className={`px-4 py-2 text-sm md:text-[0.95rem] font-medium -mb-px border-b-2 transition-colors ${activeTab==='info' ? 'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={()=> { setActiveTab('info'); }}>Informacje dodatkowe</button>
                        <button className={`px-4 py-2 text-sm md:text-[0.95rem] font-medium -mb-px border-b-2 transition-colors ${activeTab==='sessions' ? 'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={()=> { setActiveTab('sessions'); if(!editMode) setShowNotesModal(true); }}>Notatki z sesji</button>
                      </div>
                      {activeTab==='info' && (
                        <div className="flex-1 flex flex-col">
                          <label className="text-[0.95rem] font-semibold text-gray-800 mb-1">Informacje dodatkowe</label>
                          {editMode ? (
                            <textarea value={editForm.info} onChange={e=> setEditForm(f=> ({...f, info:e.target.value}))} className="flex-1 min-h-[160px] max-h-[300px] overflow-y-auto w-full text-sm p-3 border rounded resize-y leading-relaxed" placeholder="Wpisz dodatkowe informacje..." />
                          ) : (
                            <div className="flex-1 border rounded-lg border-gray-200 bg-white text-gray-800 text-sm p-4 whitespace-pre-wrap leading-relaxed min-h-[160px]">
                              {(
                                (patientNotes[selected.id] && patientNotes[selected.id].trim()) ||
                                (selected.info && selected.info.trim()) ||
                                <span className="italic text-gray-400">Brak informacji</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {activeTab==='sessions' && (
                        <div className="flex-1 flex flex-col min-h-[160px] max-h-[300px] overflow-y-auto">
                          {editMode ? (
                            <>
                              {selectedVisits.length===0 && <div className="text-sm text-gray-600 italic">Brak wizyt do wyświetlenia notatek</div>}
                              <ul className="space-y-2">
                                {selectedVisits.map(v=> {
                                  const open = openSessionNotes.has(v.id);
                                  const toggle = () => setOpenSessionNotes(prev => { const n = new Set(prev); n.has(v.id)? n.delete(v.id): n.add(v.id); return n; });
                                  return (
                                    <li key={v.id} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                                      <button onClick={toggle} className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
                                        <span className="flex items-center gap-3">
                                          <span className="text-gray-600">{v.date}</span>
                                          {v.therapists.length>0 && (
                                            <span className="text-gray-700 truncate">{v.therapists.join(', ')}</span>
                                          )}
                                          {visitStatusLabel(v.status)}
                                        </span>
                                        <span className={`ml-2 inline-flex h-5 w-5 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 shadow-sm transition-transform duration-200 ${open? 'rotate-90':''}`}>
                                          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.293 7.293a1 1 0 011.414 0L11 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        </span>
                                      </button>
                                      {open && (
                                        <div className="p-3 border-t border-gray-200 bg-gray-50">
                                          <textarea className="w-full text-sm p-2 border rounded resize-y min-h-[80px]" placeholder="Wpisz notatkę z sesji..." value={sessionNotes[v.id]||''} onChange={e=> setSessionNotes(s=> ({...s, [v.id]: e.target.value}))} />
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                              {selectedVisits.length>0 && openSessionNotes.size>0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <button onClick={()=> setOpenSessionNotes(new Set())} className="px-3 py-1.5 text-xs md:text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-300">Zwiń wszystkie notatki</button>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex-1 grid place-items-center border border-dashed rounded-lg border-gray-300/70 bg-gray-50 text-gray-600 text-sm p-6">
                              <div className="text-center space-y-2">
                                <p>Notatki z sesji są wyświetlane w oknie dialogowym.</p>
                                <button type="button" onClick={()=> setShowNotesModal(true)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-300 shadow-sm hover:bg-gray-50">Otwórz okno</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {selected && (canSeeSelectedDetails || isAdmin) && (
            <div className="border-t border-gray-200 pt-4 mt-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Historia wizyt</h3>
              <div className="overflow-x-auto">
                <div ref={historyRef} className="overflow-y-auto overscroll-contain rounded-lg border border-gray-200" style={{ maxHeight: historyMax ? historyMax : undefined }}>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                      <tr className="text-gray-600">
                        <th className="px-3 py-2 text-left font-medium text-[0.95rem]">Data</th>
                        <th className="px-3 py-2 text-left font-medium text-[0.95rem]">Specjaliści</th>
                        <th className="px-3 py-2 text-left font-medium text-[0.95rem]">Sala</th>
                        <th className="px-3 py-2 text-left font-medium text-[0.95rem]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedVisits.map(v=> (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">{v.date}</td>
                          <td className="px-3 py-2">
                            <div className="text-sm text-gray-800 whitespace-normal leading-snug">{v.therapists.join(', ') || '—'}</div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{v.room}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{visitStatusLabel(v.status)}</td>
                        </tr>
                      ))}
                      {selectedVisits.length===0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">Brak wizyt</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/40 backdrop-blur-sm overflow-y-auto"
          onKeyDown={(e)=> {
            if(e.key==='Escape'){ e.stopPropagation(); cancelAdd(); }
            if(e.key==='Tab' && modalRef.current){
              const focusables = Array.from(modalRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"))
                .filter(el => !el.hasAttribute('disabled'));
              if(!focusables.length) return;
              const first = focusables[0];
              const last = focusables[focusables.length-1];
              if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
              else if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
            }
          }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="addPatientTitle"
        >
          <div
            ref={modalRef}
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-2xl">
              <h3 id="addPatientTitle" className="text-lg font-semibold text-gray-800">Nowy podopieczny</h3>
              <button onClick={cancelAdd} className="p-2 rounded-lg hover:bg-white/70" disabled={creating} aria-label="Zamknij">
                <svg className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <form onSubmit={submitAdd} className="px-6 py-6 space-y-6">
              {newErrors.length>0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700" aria-live="assertive">
                  <ul className="list-disc list-inside space-y-0.5">
                    {newErrors.map((e,i)=>(<li key={i}>{e}</li>))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Imię</label>
                  <input ref={firstFieldRef} value={newPatientForm.name} onChange={e=> setNewPatientForm(f=> ({...f, name:e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Imię" />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Nazwisko</label>
                  <input value={newPatientForm.surname} onChange={e=> setNewPatientForm(f=> ({...f, surname:e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Nazwisko" />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Data urodzenia</label>
                  <button
                    type="button"
                    onClick={()=> openDatePickerFor('new')}
                    className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <span className="inline-flex items-center gap-2 text-gray-700">
                      <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {newPatientForm.birthDate || 'Wybierz datę'}
                    </span>
                    <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.02l3.71-3.79a.75.75 0 111.08 1.04l-4.24 4.34a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Status</label>
                  <div className="relative">
                    <button
                      ref={newStatusBtnRef}
                      type="button"
                      onClick={()=> setShowNewStatusMenu(v=>!v)}
                      className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg bg-white border border-gray-300 shadow-sm hover:bg-gray-50"
                      aria-haspopup="listbox"
                      aria-expanded={showNewStatusMenu}
                    >
                      <span className="capitalize text-gray-700">{getPatientStatusLabel(newPatientForm.isActive)}</span>
                      <svg className={`h-4 w-4 text-gray-400 transition-transform ${showNewStatusMenu?'rotate-180':''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.024l3.71-3.793a.75.75 0 111.08 1.04l-4.24 4.336a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
                    </button>
                    {showNewStatusMenu && (
                      <div
                        ref={newStatusMenuRef}
                        role="listbox"
                        tabIndex={-1}
                        onKeyDown={(e)=> { if(e.key==='Escape'){ e.preventDefault(); setShowNewStatusMenu(false); newStatusBtnRef.current?.focus(); } }}
                        className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-gray-100"
                      >
                        {(['aktywny','nieaktywny'] as const).map(opt => (
                          <button
                            type="button"
                            key={opt}
                            onClick={()=> { setNewPatientForm(f=> ({...f, isActive: opt==='aktywny'})); setShowNewStatusMenu(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50 ${getPatientStatusLabel(newPatientForm.isActive)===opt? 'bg-indigo-50 text-indigo-700':'text-gray-700'}`}
                            role="option"
                            aria-selected={getPatientStatusLabel(newPatientForm.isActive)===opt}
                          >
                            <span className="capitalize">{opt}</span>
                            {getPatientStatusLabel(newPatientForm.isActive)===opt && (
                              <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.75 11.836l6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Terapeuci</label>
                  <div className="flex flex-wrap gap-2 mb-2 min-h-[34px] p-2 rounded-lg border border-gray-200 bg-gray-50">
                    {newPatientForm.assignedEmployeesIds.map((tId:number)=>{ const u=employees.find((x: Employee)=>Number(x.id) === Number(tId)); const fullName = u? `${u.name} ${u.surname}`.trim() : String(tId); return (
                      <span key={tId} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-300">
                        {u? fullName : tId}
                        <button type="button" onClick={()=> toggleNewTherapist(tId)} className="hover:text-indigo-900">×</button>
                      </span>
                    );})}
                    {newPatientForm.assignedEmployeesIds.length===0 && <span className="text-[11px] text-gray-400">Brak</span>}
                  </div>
                  <div className="relative">
                    <button
                      ref={newTherBtnRef}
                      type="button"
                      onClick={()=> setShowNewTherMenu(v=>!v)}
                      className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg bg-white border border-gray-300 shadow-sm hover:bg-gray-50"
                      aria-haspopup="listbox"
                      aria-expanded={showNewTherMenu}
                    >
                      <span className="truncate text-gray-700">Dodaj terapeutę...</span>
                      <svg className={`h-4 w-4 text-gray-400 transition-transform ${showNewTherMenu?'rotate-180':''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.02l3.71-3.79a.75.75 0 111.08 1.04l-4.24 4.34a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
                    </button>
                    {showNewTherMenu && (
                      <div
                        ref={newTherMenuRef}
                        role="listbox"
                        tabIndex={-1}
                        onKeyDown={(e)=> { if(e.key==='Escape'){ e.preventDefault(); setShowNewTherMenu(false); newTherBtnRef.current?.focus(); } }}
                        className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-gray-100"
                      >
                        <div className="max-h-64 overflow-y-auto py-1">
                          {employeesSorted.filter((emp: any)=> !newPatientForm.assignedEmployeesIds.includes(Number(emp.id))).map((emp: any)=> (
                            <button
                              type="button"
                              key={emp.id}
                              onClick={()=> { toggleNewTherapist(Number(emp.id)); setShowNewTherMenu(false); }}
                              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                              role="option"
                            >
                              <span className="truncate">{emp.label}</span>
                              <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/></svg>
                            </button>
                          ))}
                          {employeesSorted.filter((emp: any)=> !newPatientForm.assignedEmployeesIds.includes(Number(emp.id))).length===0 && (
                            <div className="px-3 py-2 text-sm text-gray-500">Wszyscy terapeuci są już dodani</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Notatki</label>
                  <textarea value={newPatientForm.info} onChange={e=> setNewPatientForm(f=> ({...f, info:e.target.value}))} rows={4} placeholder="Historia, zalecenia, obserwacje..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={cancelAdd} disabled={creating} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-60">Anuluj</button>
                <button type="submit" disabled={creating} className="px-6 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 shadow hover:from-indigo-500 hover:to-blue-500 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60">{creating? 'Zapisywanie...':'Utwórz'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/40 backdrop-blur-sm overflow-y-auto"
          onKeyDown={(e)=> {
            if(e.key==='Escape'){ e.stopPropagation(); cancelDelete(); }
            if(e.key==='Tab' && deleteModalRef.current){
              const focusables = Array.from(deleteModalRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"))
                .filter(el => !el.hasAttribute('disabled'));
              if(!focusables.length) return;
              const first = focusables[0];
              const last = focusables[focusables.length-1];
              if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
              else if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
            }
          }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="deletePatientTitle"
        >
          <div
            ref={deleteModalRef}
            tabIndex={-1}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-red-200 bg-gradient-to-r from-red-50 to-rose-50 rounded-t-2xl">
              <h3 id="deletePatientTitle" className="text-lg font-semibold text-red-800 flex items-center gap-2">
                <svg className="h-5 w-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                Usuń podopiecznego
              </h3>
              <button onClick={cancelDelete} className="p-2 rounded-lg hover:bg-white/70" aria-label="Zamknij">
                <svg className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10  8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-700">
                Usuniesz podopiecznego:
                <span className="font-semibold text-gray-900"> {selected?.name} {selected?.surname}</span>.
              </p>
              <div className="text-sm text-gray-700">
                <p className="font-medium text-gray-800 mb-1">Dodatkowo zostaną trwale usunięte:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Przypisania terapeutów ({selected ? (selected.assignedEmployeesIds?.length || 0) : 0})</li>
                  <li>Notatki podopiecznego</li>
                  <li>Notatki z sesji ({selectedVisits.length})</li>
                </ul>
                <p className="mt-2 text-[13px] text-red-700">Tej operacji nie można cofnąć.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={cancelDelete} className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">Anuluj</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white shadow hover:bg-red-700 focus:ring-2 focus:ring-offset-2 focus:ring-red-500" disabled={deleting}>
                {deleting ? 'Usuwanie...' : 'Usuń'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotesModal && selected && !editMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
          onKeyDown={(e)=> {
            if(e.key==='Escape'){
              e.stopPropagation();
              setShowNotesModal(false);
            }
            if(e.key==='Tab' && notesModalRef.current){
              const focusables = Array.from(notesModalRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"))
                .filter(el => !el.hasAttribute('disabled'));
              if(!focusables.length) return;
              const first = focusables[0];
              const last = focusables[focusables.length-1];
              if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
              else if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
            }
          }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="notesDialogTitle"
          onClick={()=> setShowNotesModal(false)}
        >
          <div
            ref={notesModalRef}
            tabIndex={-1}
            className="bg-white w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl border border-gray-100"
            onClick={(e)=> e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-2xl">
              <h3 id="notesDialogTitle" className="text-lg font-semibold text-gray-800">Notatki z sesji</h3>
              <button onClick={()=> setShowNotesModal(false)} className="p-2 rounded-lg hover:bg-white/70" aria-label="Zamknij">
                <svg className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[70vh]">
              {/* Filters */}
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div className="flex-1 max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex items-center gap-2">
                  <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8.5 3a5.5 5.5 0 013.916 9.416l3.084 3.084a1 1 0 01-1.414 1.414l-3.084-3.084A5.5 5.5 0 118.5 3zm0 2a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" clipRule="evenodd"/></svg>
                  <input value={notesSearch} onChange={e=> setNotesSearch(e.target.value)} placeholder="Szukaj w notatkach" className="flex-1 bg-transparent outline-none text-sm" />
                </div>
                <div className="flex items-center gap-3">
                  <select value={notesStatus} onChange={e=> setNotesStatus(e.target.value as any)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
                    <option value="all">Wszystkie statusy</option>
                    <option value="zrealizowana">Zrealizowane</option>
                    <option value="odwołana">Odwołane</option>
                    <option value="zaplanowana">Zaplanowane</option>
                    <option value="nieobecny">Nieobecny</option>
                  </select>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
                    <input type="checkbox" className="h-4 w-4" checked={onlyWithNotes} onChange={e=> setOnlyWithNotes(e.target.checked)} />
                    Tylko z notatkami
                  </label>
                </div>
              </div>
              {/* List */}
              {(() => {
                const q = normalize(notesSearch);
                const list = selectedVisits.filter(v => {
                  if(notesStatus !== 'all' && v.status !== notesStatus) return false;
                  const note = (sessionNotes[v.id] || '').trim();
                  if(onlyWithNotes && !note) return false;
                  if(q) return normalize(note).includes(q);
                  return true;
                });
                if(list.length===0){
                  return <div className="text-sm text-gray-600 italic">Brak wizyt spełniających kryteria</div>;
                }
                return (
                  <ul className="space-y-2">
                    {list.map(v=> {
                      const open = openSessionNotes.has(v.id);
                      const toggle = () => setOpenSessionNotes(prev => { const n = new Set(prev); n.has(v.id)? n.delete(v.id): n.add(v.id); return n; });
                      const noteText = (sessionNotes[v.id] || '').trim();
                      const tooLong = noteText.length > 280;
                      const shown = open || !tooLong ? noteText : noteText.slice(0, 280) + '…';
                      const styles = getStatusStyles(v.status);
                      return (
                        <li key={v.id} className={`border rounded-lg bg-white px-3 py-2 ${styles.cardBorder}`}>
                          <div className="flex items-start gap-4">
                            <div className="shrink-0 w-28">
                              <div className={`w-fit px-2 py-1 rounded-md text-xs font-medium ${styles.badgeBg} ${styles.badgeText}`}>{v.date}</div>
                              <div className="mt-1">{visitStatusLabel(v.status)}</div>
                            </div>
                            <div className="flex-1">
                              <div className="text-[0.95rem] leading-relaxed text-gray-900 whitespace-pre-wrap min-h-[38px]">
                                {noteText ? shown : <span className="italic text-gray-400">Brak notatki</span>}
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-xs text-gray-500 truncate">{v.therapists.join(', ') || '—'}</div>
                                {noteText && tooLong && (
                                  <button onClick={toggle} className={`text-xs font-medium ${styles.link}`}>
                                    {open ? 'Zwiń' : 'Pokaż więcej'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
              {selectedVisits.length>0 && openSessionNotes.size>0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <button onClick={()=> setOpenSessionNotes(new Set())} className="px-3 py-1.5 text-xs md:text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-300">Zwiń wszystkie rozwinięte</button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={()=> setShowNotesModal(false)}
                className="px-5 py-2 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-indigo-600 to-blue-600 shadow hover:from-indigo-500 hover:to-blue-500 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {showDatePicker && (
        <div
          ref={datePickerOverlayRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={closeDatePicker}
          onKeyDown={(e)=> { if(e.key==='Escape'){ e.stopPropagation(); closeDatePicker(); } }}
          role="dialog"
          aria-modal="true"
          aria-label="Wybierz datę urodzenia"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
            onClick={e=> e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-200 relative">
              <button
                type="button"
                onClick={()=> setDpMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
                className="p-2 rounded-lg text-gray-600 hover:bg-white/70"
                aria-label="Poprzedni miesiąc"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-gray-800">{monthNames[dpMonth.getMonth()]}</div>
                <div className="relative">
                  <button
                    ref={yearBtnRef}
                    type="button"
                    onClick={()=> setShowYearMenu(v=>!v)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-white border border-gray-300 shadow-sm hover:bg-gray-50"
                    aria-haspopup="listbox"
                    aria-expanded={showYearMenu}
                  >
                    <span className="text-gray-800">{dpMonth.getFullYear()}</span>
                    <svg className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showYearMenu?'rotate-180':''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.02l3.71-3.79a.75.75 0 111.08 1.04l-4.24 4.34a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
                  </button>
                  {showYearMenu && (
                    <div
                      ref={yearMenuRef}
                      role="listbox"
                      tabIndex={-1}
                      onKeyDown={(e)=> { if(e.key==='Escape'){ e.preventDefault(); setShowYearMenu(false); yearBtnRef.current?.focus(); } }}
                      className="absolute z-50 mt-2 w-28 max-h-60 overflow-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-gray-100"
                    >
                      {yearsList.map(y => (
                        <button
                          key={y}
                          type="button"
                          onClick={()=> { setDpMonth(m => new Date(y, m.getMonth(), 1)); setShowYearMenu(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${dpMonth.getFullYear()===y? 'bg-indigo-50 text-indigo-700':'text-gray-700'}`}
                          role="option"
                          aria-selected={dpMonth.getFullYear()===y}
                        >
                          <span>{y}</span>
                          {dpMonth.getFullYear()===y && (
                            <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L8.75 11.836l6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={()=> setDpMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
                className="p-2 rounded-lg text-gray-600 hover:bg-white/70"
                aria-label="Następny miesiąc"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1 text-[11px] text-gray-500 mb-1">
                {daysOfWeek.map(d=> (<div key={d} className="text-center py-1">{d}</div>))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getMonthGrid(dpMonth).map(({d, current}, idx)=>{
                  const isSelected = dateTarget==='edit'
                    ? (!!editForm.birthDate && formatDateYMD(d) === editForm.birthDate)
                    : (!!newPatientForm.birthDate && formatDateYMD(d) === newPatientForm.birthDate);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={()=> {
                        if(dateTarget==='edit') setEditForm(f=> ({...f, birthDate: formatDateYMD(d)}));
                        else if(dateTarget==='new') setNewPatientForm(f=> ({...f, birthDate: formatDateYMD(d)}));
                        closeDatePicker();
                      }}
                      className={
                        `h-9 rounded-lg text-sm `+
                        (isSelected ? 'bg-blue-600 text-white font-semibold shadow' : current ? 'text-gray-800 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-50')
                      }
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
              <button type="button" onClick={closeDatePicker} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100">Anuluj</button>
              {dateTarget==='edit' && editForm.birthDate && (
                <button type="button" onClick={()=> { setEditForm(f=> ({...f, birthDate: ''})); closeDatePicker(); }} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100">Wyczyść</button>
              )}
              {dateTarget==='new' && newPatientForm.birthDate && (
                <button type="button" onClick={()=> { setNewPatientForm(f=> ({...f, birthDate: ''})); closeDatePicker(); }} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100">Wyczyść</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
