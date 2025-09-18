// Zamiana boolean isActive na etykietę statusu
function getPatientStatusLabel(isActive: boolean): 'aktywny' | 'nieaktywny' {
  return isActive ? 'aktywny' : 'nieaktywny';
}
import { useState, useEffect, useMemo, useRef } from 'react';
// Using demo UI shape for patients for now. When backend is ready, map API <-> UI.
import { fetchPatients } from '../../utils/api/patients';
import {Patient, User, Meeting} from '../../types/index'
import { Search } from 'lucide-react';

/*
// Całość przełączona na typ Patient z backendu. Usunięto PatientDemo, mappersy i demo storage.
*/

interface Visit {
  id: string;
  patientId: string;
  date: string;
  therapists: string[];
  room: string;
  status: 'zrealizowana' | 'odwołana' | 'zaplanowana' | 'nieobecny'; }

// Brak localStorage dla przypisań terapeutów – stan tylko w pamięci

export default function Patients(){
  // Pacjenci z backendu
  const [patients, setPatients] = useState<Patient[]>([]);
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
}, []);

useEffect(() => {
  console.log('Patients state:', patients);
}, [patients]);
  const meetings = useMemo<Meeting[]>(() => [], []);
  const users = useMemo<User[]>(() => [], []);
  const rooms = useMemo<{ id: string; name: string }[]>(() => [], []);

  // Brak odczytów lokalnych — te listy będą puste lub zasilone backendem w przyszłości

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    surname: '',
    birthDate: '',
    isActive: true,
    assignedEmployeesIds: [] as number[],
    info: ''
  });

  const [therapistAssignments, setTherapistAssignments] = useState<Record<string,string[]>>({});
  const [patientNotes, setPatientNotes] = useState<Record<string,string>>({});
  const [sessionNotes, setSessionNotes] = useState<Record<string,string>>({});
  const [openSessionNotes, setOpenSessionNotes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'info'|'sessions'>('info');

  const [query, setQuery] = useState('');
  // Nie można wybrać żadnego pacjenta
  const [selected, setSelected] = useState<Patient | null>(null);
  const [statusFilter, setStatusFilter] = useState<'aktywny'|'nieaktywny'|'wszyscy'>('aktywny');
  // Replace generic assignment filter with a specialist single-select filter
  const [specialistFilter, setSpecialistFilter] = useState<'wszyscy' | string>('wszyscy');
  // Custom dropdown state/refs for filters
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showSpecialistMenu, setShowSpecialistMenu] = useState(false);
  const statusBtnRef = useRef<HTMLButtonElement|null>(null);
  const statusMenuRef = useRef<HTMLDivElement|null>(null);
  const specialistBtnRef = useRef<HTMLButtonElement|null>(null);
  const specialistMenuRef = useRef<HTMLDivElement|null>(null);
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
  // Focus refs for dialogs
  const datePickerOverlayRef = useRef<HTMLDivElement|null>(null);
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
  const openDatePicker = () => {
    const base = editForm.birthDate ? new Date(editForm.birthDate) : new Date();
    const m = new Date(base.getFullYear(), base.getMonth(), 1);
    setDpMonth(m);
    setShowDatePicker(true);
  };
  const closeDatePicker = () => setShowDatePicker(false);

  // When date picker opens, focus overlay so ESC works
  useEffect(()=>{
    if(showDatePicker){
      requestAnimationFrame(()=> datePickerOverlayRef.current?.focus());
    }
  }, [showDatePicker]);

  const visits: Visit[] = useMemo(()=>{
    const userMap = new Map<string, string>(users.map((u: User)=> [u.id, u.name]));
    const roomMap = new Map<string, string>(rooms.map((r: {id:string; name:string})=> [r.id, r.name]));
    const todayStr = new Date().toISOString().split('T')[0];
    return meetings
      .filter((m: Meeting)=> !!m.patientId)
      .map((m: Meeting)=>{
        let status: Visit['status'];
        if(m.status === 'cancelled') status = 'odwołana';
        else if(m.status === 'absent') status = 'nieobecny';
        else if(m.status === 'in-progress') status = 'zaplanowana';
        else status = m.date > todayStr ? 'zaplanowana' : 'zrealizowana';
        const therapistIds = (m.specialistIds && m.specialistIds.length ? m.specialistIds : (m.specialistId ? [m.specialistId] : []));
        const therapists = therapistIds.map((id: string) => userMap.get(id) || id).filter(Boolean) as string[];
        return { id:m.id, patientId:m.patientId!, date:m.date, therapists, room: roomMap.get(m.roomId) || m.roomId, status };
      })
      .sort((a: Visit,b: Visit)=> a.date.localeCompare(b.date));
  },[meetings, users, rooms]);

  useEffect(()=>{
    setSessionNotes(prev => {
      let changed = false; const next = { ...prev };
      meetings.forEach((m: Meeting)=> { if(m.notes && !next[m.id]) { next[m.id] = m.notes; changed = true; }});
      return changed ? next : prev;
    });
  },[meetings]);

  const userIdToName = useMemo(()=>{
    const m: Record<string,string> = {}; users.forEach((u: User)=> { m[u.id]=u.name; }); return m;
  },[users]);

  const getStatusLabel = (v: 'aktywny'|'nieaktywny'|'wszyscy') => v==='aktywny' ? 'Aktywni' : v==='nieaktywny' ? 'Nieaktywni' : 'Wszyscy';

  // Precompute sorted employees: label "Nazwisko Imię" and sort by last name then first name (case/diacritics insensitive)
  const employeesSorted = useMemo(()=>{
    const strip = (s:string)=> s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
    return users
      .filter((u: User)=> u.role==='employee')
      .map((u: User)=> {
        const parts = (u.name||'').trim().split(/\s+/).filter(Boolean);
        const last = parts.length>1 ? parts[parts.length-1] : '';
        const first = parts.length>1 ? parts.slice(0,-1).join(' ') : (parts[0]||'');
        const label = last ? `${last} ${first}` : first;
        const sortKey = `${strip(last)} ${strip(first)}`;
        return { id: u.id, label, sortKey };
      })
      .sort((a: {id:string; label:string; sortKey:string},b: {id:string; label:string; sortKey:string})=> a.sortKey.localeCompare(b.sortKey));
  },[users]);

  // Disabled persistence of therapist assignments to localStorage


  // Close dropdowns on outside click
  useEffect(()=>{
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if(showStatusMenu && !statusMenuRef.current?.contains(t) && !statusBtnRef.current?.contains(t)) setShowStatusMenu(false);
      if(showSpecialistMenu && !specialistMenuRef.current?.contains(t) && !specialistBtnRef.current?.contains(t)) setShowSpecialistMenu(false);
      // Edit-mode dropdowns
      if(showEditStatusMenu && !editStatusMenuRef.current?.contains(t) && !editStatusBtnRef.current?.contains(t)) setShowEditStatusMenu(false);
      if(showEditTherMenu && !editTherMenuRef.current?.contains(t) && !editTherBtnRef.current?.contains(t)) setShowEditTherMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStatusMenu, showSpecialistMenu, showEditStatusMenu, showEditTherMenu]);

  // Normalization for search (diacritics-insensitive)
  const normalize = (s: string) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

  // Filtered patients list for the left panel
  // Lista pacjentów zawsze pusta
  // Przywrócona logika filtrowania pacjentów
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
      const assigned = therapistAssignments[p.id] || [];
      return assigned.includes(String(specialistFilter));
    });
    // sort by last name, then first name
    return bySpecialist.sort((a,b)=> {
      const lnA = normalize(a.surname); const lnB = normalize(b.surname);
      if(lnA!==lnB) return lnA.localeCompare(lnB);
      return normalize(a.name).localeCompare(normalize(b.name));
    });
  }, [patients, query, statusFilter, specialistFilter, therapistAssignments]);

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

  // const statusBadge = (isActive?: string): JSX.Element => {
  //   const st = (isActive as 'aktywny'|'nieaktywny'|undefined) || 'aktywny';
  //   const color = st==='aktywny' ? 'bg-green-500' : 'bg-gray-400';
  //   return (
  //     <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
  //       <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
  //       <span className="capitalize">{st}</span>
  //     </span>
  //   );
  // };

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

  // Selected patient's visits (newest first)
  const selectedVisits = useMemo(()=>{
    if(!selected) return [] as Visit[];
    return visits.filter(v => Number(v.patientId) === selected.id).sort((a,b)=> b.date.localeCompare(a.date));
  }, [visits, selected]);

  // Session tiles counts
  const visitCounts = useMemo(()=>{
    if(!selected) return { total: 0, zrealizowana: 0, odwolana: 0, nieobecny: 0, zaplanowana: 0 };
    const vs = visits.filter(v => Number(v.patientId) === selected.id);
    const acc = { total: vs.length, zrealizowana: 0, odwolana: 0, nieobecny: 0, zaplanowana: 0 };
    vs.forEach(v => {
      if(v.status==='zrealizowana') acc.zrealizowana++;
      else if(v.status==='odwołana') acc.odwolana++;
      else if(v.status==='nieobecny') acc.nieobecny++;
      else acc.zaplanowana++;
    });
    return acc;
  }, [visits, selected]);

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

  const saveEdit = () => {
    if(!selected) return;
    const updated: Patient = {
      ...selected,
      name: editForm.name.trim(),
      surname: editForm.surname.trim(),
      birthDate: editForm.birthDate || '',
      isActive: !!editForm.isActive,
      assignedEmployeesIds: Array.isArray(editForm.assignedEmployeesIds) ? editForm.assignedEmployeesIds.map(Number) : [],
      info: editForm.info?.trim() || ''
    };
    setPatients(prev => prev.map(p => p.id === selected.id ? updated : p));
    // Persist therapist assignments
    setTherapistAssignments(prev => {
      const next = { ...prev };
      const unique = Array.from(new Set(editForm.assignedEmployeesIds));
      if(unique.length) next[selected.id] = unique.map(String); else delete next[selected.id];
      return next;
    });
    // Persist patient notes map
    setPatientNotes(prev => {
      const next = { ...prev };
      const txt = (editForm.info || '').trim();
      if(txt) next[selected.id] = txt; else delete next[selected.id];
      return next;
    });
    setSelected(updated);
    setEditMode(false);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setShowDatePicker(false);
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Delete selected patient and related data
  const deleteSelected = () => {
    if(!selected) return;
    const id = selected.id;
    // Remove patient
    setPatients(prev => prev.filter(p => p.id !== id));
    // Remove therapist assignments
    setTherapistAssignments(prev => { const n = { ...prev }; delete n[id]; return n; });
    // Remove patient notes
    setPatientNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
    // Remove session notes for this patient's visits
    const vIds = visits.filter(v => Number(v.patientId) === selected.id).map(v => v.id);
    setSessionNotes(prev => { const n = { ...prev }; vIds.forEach(vid => { delete n[vid]; }); return n; });
    // Reset selection and open notes
    setSelected(null);
    setOpenSessionNotes(new Set());
  };

  const openDeleteModal = () => { if(selected) setShowDeleteModal(true); };
  const cancelDelete = () => { if(deleting) return; setShowDeleteModal(false); };
  const confirmDelete = () => {
    if(!selected) return;
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

  const submitAdd = (e:React.FormEvent) => {
    e.preventDefault();
    if(!validateNew()) return;
    setCreating(true);
    const token = localStorage.getItem('token') || '';
    const payload = {
      name: newPatientForm.name.trim(),
      surname: newPatientForm.surname.trim(),
      birthDate: newPatientForm.birthDate || '',
      isActive: !!newPatientForm.isActive,
      assignedEmployeesIds: Array.isArray(newPatientForm.assignedEmployeesIds) ? newPatientForm.assignedEmployeesIds.map(Number) : [],
      info: newPatientForm.info?.trim() || ''
    };
    import('../../utils/api/patients').then(api => {
      api.createPatient(payload, token)
        .then(() => {
          api.fetchPatients(token).then(data => setPatients(data));
          setShowAddModal(false);
        })
        .catch(err => {
          setNewErrors([err.message || 'Błąd dodawania pacjenta']);
        })
        .finally(() => setCreating(false));
    });
  };
  const toggleNewTherapist = (id:number) => {
    setNewPatientForm(f => f.assignedEmployeesIds.includes(id) ? { ...f, assignedEmployeesIds: f.assignedEmployeesIds.filter(t=>t!==id) } : { ...f, assignedEmployeesIds:[...f.assignedEmployeesIds, id] });
  };

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
          onClick={openAdd}
          ref={addBtnRef}
          className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow hover:from-indigo-500 hover:to-blue-500 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <span className="text-lg leading-none">＋</span> Dodaj
        </button>
      </div>

      <div className="flex items-start gap-6">
        <div className="w-72 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Imię i nazwisko</th>
                <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={2} className="px-3 py-4 text-center text-sm text-gray-500">Brak podopiecznych</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(p)}>
                    <td className="px-3 py-2 whitespace-nowrap">{p.name} {p.surname}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{statusLabel(getPatientStatusLabel(p.isActive))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex-1 min-h-[400px] bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {!selected && <div className="h-full flex items-center justify-center text-gray-400 text-sm">Wybierz podopiecznego z listy po lewej</div>}
          {selected && (
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
                          <button onClick={openDeleteModal} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100">Usuń</button>
                          <button onClick={startEdit} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700">Edytuj</button>
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
                              onClick={openDatePicker}
                              className="ml-2 inline-flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              <span>{editForm.birthDate || 'Wybierz datę'}</span>
                            </button>
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
                                  <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-200">
                                    <button
                                      type="button"
                                      onClick={()=> setDpMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
                                      className="p-2 rounded-lg text-gray-600 hover:bg-white/70"
                                      aria-label="Poprzedni miesiąc"
                                    >
                                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
                                    </button>
                                    <div className="text-sm font-semibold text-gray-800">
                                      {monthNames[dpMonth.getMonth()]} {dpMonth.getFullYear()}
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
                                        const selected = !!editForm.birthDate && formatDateYMD(d) === editForm.birthDate;
                                        return (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={()=> { setEditForm(f=> ({...f, birthDate: formatDateYMD(d)})); closeDatePicker(); }}
                                            className={
                                              `h-9 rounded-lg text-sm `+
                                              (selected ? 'bg-blue-600 text-white font-semibold shadow' : current ? 'text-gray-800 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-50')
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
                                    {editForm.birthDate && (
                                      <button type="button" onClick={()=> { setEditForm(f=> ({...f, birthDate: ''})); closeDatePicker(); }} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100">Wyczyść</button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
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
                            {(therapistAssignments[selected.id]||[]).length===0 ? (
                              <span className="text-xs text-gray-400">Brak przypisanych terapeutów</span>
                            ) : (
                              <ul className="space-y-2">
                                {(therapistAssignments[selected.id]||[]).map(tId => {
                                  const name = userIdToName[tId] || tId;
                                  return (
                                    <li key={tId} className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2">
                                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-semibold">{(name? name.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()||'').join(''):'?')}</span>
                                      <span className="text-sm font-medium text-blue-900">{name}</span>
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
                                const name = userIdToName[tId] || tId;
                                return (
                                  <span key={tId} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-900">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-semibold">{(typeof name === 'string' ? name.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()||'').join('') : '?')}</span>
                                    <span className="font-medium">{name}</span>
                                    <button onClick={()=> removeTherapist(tId)} className="ml-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 h-5 w-5 inline-flex items-center justify-center" aria-label={`Usuń terapeutę ${name}`}>×</button>
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
                                  onClick={()=> setShowEditTherMenu(v=>!v)}
                                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl bg-white border border-gray-300 shadow-sm hover:bg-gray-50 min-w-[14rem] justify-between"
                                  aria-haspopup="listbox"
                                  aria-expanded={showEditTherMenu}
                                >
                                  <span className="truncate text-gray-700">Dodaj terapeutę...</span>
                                  <svg className={`h-4 w-4 text-gray-400 transition-transform ${showEditTherMenu?'rotate-180':''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.02l3.71-3.79a.75.75 0 111.08 1.04l-4.24 4.34a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
                                </button>
                                {showEditTherMenu && (
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
                              <div className="text-[10px] font-medium text-green-700 tracking-wide uppercase leading-none">Zrealizowane</div>
                              <div className="mt-1 text-base font-bold text-green-800 leading-none">{visitCounts.zrealizowana}</div>
                            </div>
                            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-center">
                              <div className="text-[10px] font-medium text-red-700 tracking-wide uppercase leading-none">Odwołane</div>
                              <div className="mt-1 text-base font-bold text-red-700 leading-none">{visitCounts.odwolana}</div>
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center">
                              <div className="text-[10px] font-medium text-amber-700 tracking-wide uppercase leading-none">Nieobecny</div>
                              <div className="mt-1 text-base font-bold text-amber-700 leading-none">{visitCounts.nieobecny}</div>
                            </div>
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-center">
                              <div className="text-[10px] font-medium text-blue-700 tracking-wide uppercase leading-none">Zaplanowane</div>
                              <div className="mt-1 text-base font-bold text-blue-800 leading-none">{visitCounts.zaplanowana}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 flex flex-col h-full">
                      <div className="flex border-b border-gray-200 mb-3">
                        <button className={`px-4 py-2 text-sm md:text-[0.95rem] font-medium -mb-px border-b-2 transition-colors ${activeTab==='info' ? 'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={()=> setActiveTab('info')}>Informacje dodatkowe</button>
                        <button className={`px-4 py-2 text-sm md:text-[0.95rem] font-medium -mb-px border-b-2 transition-colors ${activeTab==='sessions' ? 'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={()=> setActiveTab('sessions')}>Notatki z sesji</button>
                      </div>
                      {activeTab==='info' && (
                        <div className="flex-1 flex flex-col">
                          <label className="text-[0.95rem] font-semibold text-gray-800 mb-1">Informacje dodatkowe</label>
                          {editMode ? (
                            <textarea value={editForm.info} onChange={e=> setEditForm(f=> ({...f, info:e.target.value}))} className="flex-1 min-h-[160px] max-h-[300px] overflow-y-auto w-full text-sm p-3 border rounded resize-y leading-relaxed" placeholder="Wpisz dodatkowe informacje..." />
                          ) : (
                            <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap min-h-[160px] max-h-[300px] overflow-y-auto p-3 border rounded bg-gray-50">
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
                                      {editMode ? (
                                        <textarea className="w-full text-sm p-2 border rounded resize-y min-h-[80px]" placeholder="Wpisz notatkę z sesji..." value={sessionNotes[v.id]||''} onChange={e=> setSessionNotes(s=> ({...s, [v.id]: e.target.value}))} />
                                      ) : (
                                        <div className="text-sm whitespace-pre-wrap text-gray-700 min-h-[40px]">{(sessionNotes[v.id] || '').trim() || <span className="italic text-gray-400">Brak notatki</span>}</div>
                                      )}
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
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {selected && (
            <div className="border-t border-gray-200 pt-4 mt-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Historia wizyt</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border border-gray-200">
                    <tr className="text-gray-600">
                      <th className="px-3 py-2 text-left font-medium text-[0.95rem]">Data</th>
                      <th className="px-3 py-2 text-left font-medium text-[0.95rem]">Specjaliści</th>
                      <th className="px-3 py-2 text-left font-medium text-[0.95rem]">Sala</th>
                      <th className="px-3 py-2 text-left font-medium text-[0.95rem]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 border border-gray-200 border-t-0">
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
                  <input type="date" value={newPatientForm.birthDate} onChange={e=> setNewPatientForm(f=> ({...f, birthDate:e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Status</label>
                  <select value={getPatientStatusLabel(newPatientForm.isActive)} onChange={e=> setNewPatientForm(f=> ({...f, isActive: e.target.value==='aktywny'}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                    <option value="aktywny">aktywny</option>
                    <option value="nieaktywny">nieaktywny</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Terapeuci</label>
                  <div className="flex flex-wrap gap-2 mb-2 min-h-[34px] p-2 rounded-lg border border-gray-200 bg-gray-50">
                    {newPatientForm.assignedEmployeesIds.map((tId:number)=>{ const u=users.find((x: User)=>Number(x.id) === Number(tId)); return (
                      <span key={tId} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-300">
                        {u? u.name.split(' ').slice(0,2).join(' '): tId}
                        <button type="button" onClick={()=> toggleNewTherapist(tId)} className="hover:text-indigo-900">×</button>
                      </span>
                    );})}
                    {newPatientForm.assignedEmployeesIds.length===0 && <span className="text-[11px] text-gray-400">Brak</span>}
                  </div>
                  <select onChange={e=> { const v=e.target.value; if(v){ toggleNewTherapist(Number(v)); e.target.selectedIndex=0; } }} value="" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                    <option value="">Dodaj terapeutę...</option>
                    {users.filter((u: User)=>u.role==='employee' && !newPatientForm.assignedEmployeesIds.includes(Number(u.id))).map((u: User)=> <option key={u.id} value={u.id}>{u.name} {u.specialization? '– '+u.specialization:''}</option>)}
                  </select>
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
                  <li>Przypisania terapeutów ({selected ? (therapistAssignments[selected.id]||[]).length : 0})</li>
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
    </div>
  );
}
