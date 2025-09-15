import { useState, useEffect, useMemo, useRef } from 'react';
// Using demo UI shape for patients for now. When backend is ready, map API <-> UI.
import type { PatientDemo } from '../../types';
import { Search } from 'lucide-react';
import { loadMeetings, loadUsers, loadRooms, loadPatients, savePatients, saveTherapistAssignments } from '../../utils/storage';

/*
Backend integration (commented plan):
- API Patient shape (see types.Patient): { id: number; name: string; surname: string; birthDate: string; info?: string | null }
- UI shape used here: PatientDemo { id: string; firstName; lastName; birthDate?; status?; notes?; therapists? }
- Mappers:
  // function mapPatientApiToUi(p: Patient): PatientDemo {
  //   return { id: String(p.id), firstName: p.name, lastName: p.surname, birthDate: p.birthDate || '' };
  // }
  // function mapPatientUiToApi(u: PatientDemo): Partial<Patient> {
  //   return { id: Number(u.id), name: u.firstName, surname: u.lastName, birthDate: u.birthDate || '' };
  // }
- To switch to backend later:
  - Replace loadPatients/savePatients calls with API fetch/post using these mappers.
  - Keep UI types unchanged to avoid refactors in the view.
*/

interface Visit { id: string; patientId: string; date: string; therapists: string[]; room: string; status: 'zrealizowana' | 'odwołana' | 'zaplanowana' | 'nieobecny'; }

const ASSIGN_KEY = 'schedule_therapist_assignments';

export default function Patients(){
  const [patients, setPatients] = useState<PatientDemo[]>(() => loadPatients());
  const [meetings, setMeetings] = useState(() => loadMeetings());
  const [users, setUsers] = useState(() => loadUsers());
  const [rooms, setRooms] = useState(() => loadRooms());

  useEffect(()=>{
    const handler = () => {
      setMeetings(loadMeetings());
      setUsers(loadUsers());
      setRooms(loadRooms());
      setPatients(loadPatients());
    };
    window.addEventListener('focus', handler);
    return ()=> window.removeEventListener('focus', handler);
  },[]);

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    status: 'aktywny',
    therapists: [] as string[],
    notes: ''
  });

  const [therapistAssignments, setTherapistAssignments] = useState<Record<string,string[]>>(()=>{
    try { const raw = localStorage.getItem(ASSIGN_KEY); return raw? JSON.parse(raw): {}; } catch { return {}; }
  });
  const [patientNotes, setPatientNotes] = useState<Record<string,string>>({});
  const [sessionNotes, setSessionNotes] = useState<Record<string,string>>({});
  const [openSessionNotes, setOpenSessionNotes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'info'|'sessions'>('info');

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PatientDemo | null>(null);
  const [statusFilter, setStatusFilter] = useState<'aktywny'|'nieaktywny'|'wszyscy'>('aktywny');
  const [assignmentFilter, setAssignmentFilter] = useState<'wszyscy'|'przypisani'>('wszyscy');

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
    const userMap = new Map(users.map(u=> [u.id, u.name]));
    const roomMap = new Map(rooms.map(r=> [r.id, r.name]));
    const todayStr = new Date().toISOString().split('T')[0];
    return meetings
      .filter(m=> !!m.patientId)
      .map(m=>{
        let status: Visit['status'];
        if(m.status === 'cancelled') status = 'odwołana';
        else if(m.status === 'absent') status = 'nieobecny';
        else if(m.status === 'in-progress') status = 'zaplanowana';
        else status = m.date > todayStr ? 'zaplanowana' : 'zrealizowana';
        const therapistIds = (m.specialistIds && m.specialistIds.length ? m.specialistIds : (m.specialistId ? [m.specialistId] : []));
        const therapists = therapistIds.map(id => userMap.get(id) || id).filter(Boolean);
        return { id:m.id, patientId:m.patientId!, date:m.date, therapists, room: roomMap.get(m.roomId) || m.roomId, status };
      })
      .sort((a,b)=> a.date.localeCompare(b.date));
  },[meetings, users, rooms]);

  useEffect(()=>{
    setSessionNotes(prev => {
      let changed = false; const next = { ...prev };
      meetings.forEach(m=> { if(m.notes && !next[m.id]) { next[m.id] = m.notes; changed = true; }});
      return changed ? next : prev;
    });
  },[meetings]);

  const userIdToName = useMemo(()=>{
    const m: Record<string,string> = {}; users.forEach(u=> m[u.id]=u.name); return m;
  },[users]);

  useEffect(()=>{ try { saveTherapistAssignments(therapistAssignments); } catch {} },[therapistAssignments]);

  useEffect(()=> {
    setTherapistAssignments(prev => {
      if(!Object.keys(prev).length) return prev;
      const employees = users.filter(u=> u.role==='employee');
      const nameToId: Record<string,string> = {}; employees.forEach(e=> nameToId[e.name]=e.id);
      let changed = false; const next: Record<string,string[]> = {};
      Object.entries(prev).forEach(([pid, arr])=> {
        const conv = arr.map(v=> nameToId[v] || v);
        if(conv.some((v,i)=> v!==arr[i])) changed = true;
        next[pid] = Array.from(new Set(conv));
      });
      return changed ? next : prev;
    });
  },[users]);

  useEffect(()=> {
    if(selected){
      setActiveTab('info');
      setEditMode(false);
      setEditForm({
        firstName: selected.firstName || '',
        lastName: selected.lastName || '',
        birthDate: selected.birthDate || '',
        status: selected.status || 'aktywny',
        therapists: therapistAssignments[selected.id] || [],
        notes: patientNotes[selected.id] || ''
      });
    }
  },[selected, therapistAssignments, patientNotes]);

  const normalize = (s:string) => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();

  const filtered = useMemo(()=>{
    let list = patients.filter(p => assignmentFilter==='wszyscy' ? true : (therapistAssignments[p.id]||[]).length>0);
    const q = query.trim();
    if(q){
      const tokens = normalize(q).split(/\s+/).filter(Boolean);
      if(tokens.length){
        list = list.filter(p => {
          const fullName = normalize(`${p.firstName} ${p.lastName}`);
          const therapistNames = (therapistAssignments[p.id]||[]).map(id => normalize(userIdToName[id]||'')).join(' ');
          const searchable = `${fullName} ${therapistNames}`;
          return tokens.every(t => searchable.includes(t));
        });
      }
    }
    if(statusFilter !== 'wszyscy') list = list.filter(p => p.status === statusFilter);
    return list;
  },[patients, assignmentFilter, therapistAssignments, query, statusFilter, userIdToName]);

  const statusBadge = (status?: string) => {
    const isActive = status === 'aktywny';
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[12px] leading-none ${isActive? 'text-green-700 bg-green-50 border-green-200':'text-gray-500 bg-gray-100 border-gray-300'}`}>{status || '—'}</span>;
  };

  // Czytelna etykieta statusu do panelu szczegółów (bez pastylki)
  const statusLabel = (status?: string) => {
    const isActive = status === 'aktywny';
    const text = isActive ? 'aktywny' : (status || '—');
    return (
      <span className={`inline-flex items-center gap-2 font-semibold ${isActive ? 'text-green-700' : 'text-gray-600'}`}>
        <span className="tracking-wide text-sm md:text-base">{text}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} aria-hidden="true" />
      </span>
    );
  };

  // Czytelny status wizyty (bez pastylki) z kropką po prawej
  const visitStatusLabel = (status: Visit['status']) => {
    const color = status === 'zrealizowana' ? 'green' : status === 'odwołana' ? 'red' : status === 'nieobecny' ? 'amber' : 'blue';
    const textColor = color === 'green' ? 'text-green-700' : color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-700' : 'text-blue-700';
    return (
      <span className={`font-semibold capitalize ${textColor}`}>{status}</span>
    );
  };

  const selectedVisits = useMemo(()=> {
    if(!selected) return [] as Visit[];
    return [...visits.filter(v=> v.patientId===selected.id)].sort((a,b)=> b.date.localeCompare(a.date));
  }, [selected, visits]);

  const visitCounts = useMemo(()=> ({
    total: selectedVisits.length,
    zrealizowana: selectedVisits.filter(v=> v.status==='zrealizowana').length,
    odwolana: selectedVisits.filter(v=> v.status==='odwołana').length,
    zaplanowana: selectedVisits.filter(v=> v.status==='zaplanowana').length,
    nieobecny: selectedVisits.filter(v=> v.status==='nieobecny').length
  }),[selectedVisits]);

  const startEdit = () => { if(selected) setEditMode(true); };
  const cancelEdit = () => { if(!selected) return; setEditMode(false); setEditForm({ firstName:selected.firstName, lastName:selected.lastName, birthDate:selected.birthDate||'', status:selected.status||'aktywny', therapists: therapistAssignments[selected.id]||[], notes: patientNotes[selected.id]||'' }); };
  const saveEdit = () => {
    if(!selected) return;
    setPatients(prev => prev.map(p=> p.id===selected.id ? { ...p, firstName:editForm.firstName, lastName:editForm.lastName, birthDate:editForm.birthDate, status: editForm.status } : p));
    setTherapistAssignments(prev => ({ ...prev, [selected.id]: editForm.therapists }));
    setPatientNotes(prev => ({ ...prev, [selected.id]: editForm.notes }));
    setSelected(prev => prev ? { ...prev, firstName:editForm.firstName, lastName:editForm.lastName, birthDate:editForm.birthDate, status: editForm.status } : prev);
    setEditMode(false);
  };

  // Delete currently selected patient (logic only)
  const deleteSelected = () => {
    if(!selected) return;
    const id = selected.id;
    setPatients(prev => prev.filter(p => p.id !== id));
    setTherapistAssignments(prev => {
      if(!(id in prev)) return prev;
      const next = { ...prev }; delete next[id]; return next;
    });
    setPatientNotes(prev => {
      if(!(id in prev)) return prev;
      const next = { ...prev }; delete next[id]; return next;
    });
    setSessionNotes(prev => {
      if(!selectedVisits.length) return prev;
      const next = { ...prev }; selectedVisits.forEach(v => { delete next[v.id]; }); return next;
    });
    setOpenSessionNotes(new Set());
    setSelected(null);
  };

  // Persist patients to storage (prevents unused import and keeps demo data saved)
  useEffect(()=> { try { savePatients(patients); } catch {} },[patients]);

  // Helpers for adding/removing therapists in edit mode (used in JSX)
  const addTherapist = (id:string) => { if(!id || !selected) return; setEditForm(f => f.therapists.includes(id) ? f : { ...f, therapists:[...f.therapists, id] }); };
  const removeTherapist = (id:string) => setEditForm(f => ({ ...f, therapists: f.therapists.filter(t=> t!==id) }));

  // Delete modal logic (open/cancel/confirm)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const emptyNew = { firstName:'', lastName:'', birthDate:'', status:'aktywny', therapists:[] as string[], notes:'' };
  const [newPatientForm, setNewPatientForm] = useState<typeof emptyNew>(emptyNew);
  const [newErrors, setNewErrors] = useState<string[]>([]);

  const validateNew = () => {
    const errs: string[] = [];
    if(!newPatientForm.firstName.trim()) errs.push('Imię jest wymagane');
    if(!newPatientForm.lastName.trim()) errs.push('Nazwisko jest wymagane');
    if(newPatientForm.birthDate && isNaN(new Date(newPatientForm.birthDate).getTime())) errs.push('Nieprawidłowa data urodzenia');
    setNewErrors(errs); return errs.length===0;
  };

  const openAdd = () => { setNewPatientForm(emptyNew); setNewErrors([]); setShowAddModal(true); };
  const cancelAdd = () => { if(creating) return; setShowAddModal(false); };

  const submitAdd = (e:React.FormEvent) => { e.preventDefault(); if(!validateNew()) return; setCreating(true); const id = 'p'+Date.now().toString(36); const patient: PatientDemo = { id, firstName:newPatientForm.firstName.trim(), lastName:newPatientForm.lastName.trim(), birthDate:newPatientForm.birthDate || undefined, status: newPatientForm.status as any, therapists: newPatientForm.therapists, notes: newPatientForm.notes?.trim()||undefined }; setPatients(prev => [...prev, patient]); // persist via effect
    if(newPatientForm.therapists.length){ setTherapistAssignments(prev => ({ ...prev, [id]: [...newPatientForm.therapists] })); }
    if(newPatientForm.notes.trim()){ setPatientNotes(prev => ({ ...prev, [id]: newPatientForm.notes.trim() })); }
    setCreating(false); setShowAddModal(false); setSelected(patient); };
  const toggleNewTherapist = (id:string) => { setNewPatientForm(f => f.therapists.includes(id) ? { ...f, therapists: f.therapists.filter(t=>t!==id) } : { ...f, therapists:[...f.therapists, id] }); };

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
          <input value={query} onChange={e=> setQuery(e.target.value)} placeholder="Szukaj (imię/nazwisko podopiecznego lub terapeuty)" className="flex-1 bg-transparent outline-none text-sm pr-6" />
          {query && <button type="button" onClick={()=> setQuery('')} className="absolute right-3 text-gray-400 hover:text-gray-600" aria-label="Wyczyść">×</button>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
          <select value={statusFilter} onChange={e=> setStatusFilter(e.target.value as any)} className="text-xs bg-transparent outline-none">
            <option value="aktywny">Aktywni</option>
            <option value="nieaktywny">Nieaktywni</option>
            <option value="wszyscy">Wszyscy</option>
          </select>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
          <select value={assignmentFilter} onChange={e=> setAssignmentFilter(e.target.value as any)} className="text-xs bg-transparent outline-none">
            <option value="wszyscy">Wszyscy (bez filtra)</option>
            <option value="przypisani">Tylko z terapeutą</option>
          </select>
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
              {filtered.map(p => (
                <tr
                  key={p.id}
                  onClick={()=> setSelected(p)}
                  className={`cursor-pointer hover:bg-blue-50 transition-colors ${selected?.id===p.id? 'bg-blue-50/80':''}`}
                >
                  <td className="px-3 py-2.5">
                    <div className="min-w-0">
                      <span className={`block truncate text-[16px] leading-tight ${selected?.id===p.id ? 'font-semibold text-blue-900' : 'text-gray-900'}`}>{p.firstName} {p.lastName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[13px] whitespace-nowrap">{statusBadge(p.status)}</td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={2} className="px-3 py-4 text-center text-sm text-gray-500">Brak podopiecznych</td></tr>}
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
                          <input value={editForm.firstName} onChange={e=> setEditForm(f=> ({...f, firstName:e.target.value}))} className="px-2 py-1 text-sm border rounded" />
                          <input value={editForm.lastName} onChange={e=> setEditForm(f=> ({...f, lastName:e.target.value}))} className="px-2 py-1 text-sm border rounded" />
                        </div>
                      ) : `${selected.firstName} ${selected.lastName}`}
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
                            <select
                              value={editForm.status}
                              onChange={e=> setEditForm(f=> ({...f, status:e.target.value}))}
                              className="appearance-none px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white pr-8 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="aktywny">aktywny</option>
                              <option value="nieaktywny">nieaktywny</option>
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.024l3.71-3.793a.75.75 0 111.08 1.04l-4.24 4.336a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
                            </span>
                          </div>
                        ) : statusLabel(selected.status)}
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
                              {editForm.therapists.map(tId => {
                                const name = userIdToName[tId] || tId;
                                return (
                                  <span key={tId} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-900">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-semibold">{(name? name.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()||'').join(''):'?')}</span>
                                    <span className="font-medium">{name}</span>
                                    <button onClick={()=> removeTherapist(tId)} className="ml-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 h-5 w-5 inline-flex items-center justify-center" aria-label={`Usuń terapeutę ${name}`}>×</button>
                                  </span>
                                );
                              })}
                              {editForm.therapists.length===0 && <span className="text-xs text-gray-400">Brak terapeutów</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="relative inline-block">
                                <select
                                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white pr-8 appearance-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  onChange={e=> { addTherapist(e.target.value); e.target.selectedIndex=0; }}
                                >
                                  <option value="">Dodaj terapeutę...</option>
                                  {users.filter(u=> u.role==='employee').filter(u=> !editForm.therapists.includes(u.id)).map(u=> <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.024l3.71-3.793a.75.75 0 111.08 1.04l-4.24 4.336a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd"/></svg>
                                </span>
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
                            <textarea value={editForm.notes} onChange={e=> setEditForm(f=> ({...f, notes:e.target.value}))} className="flex-1 min-h-[160px] max-h-[300px] overflow-y-auto w-full text-sm p-3 border rounded resize-y leading-relaxed" placeholder="Wpisz dodatkowe informacje..." />
                          ) : (
                            <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap min-h-[160px] max-h-[300px] overflow-y-auto p-3 border rounded bg-gray-50">
                              {(patientNotes[selected.id]||'').trim() || <span className="italic text-gray-400">Brak informacji</span>}
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
                  <input ref={firstFieldRef} value={newPatientForm.firstName} onChange={e=> setNewPatientForm(f=> ({...f, firstName:e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Imię" />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Nazwisko</label>
                  <input value={newPatientForm.lastName} onChange={e=> setNewPatientForm(f=> ({...f, lastName:e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Nazwisko" />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Data urodzenia</label>
                  <input type="date" value={newPatientForm.birthDate} onChange={e=> setNewPatientForm(f=> ({...f, birthDate:e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Status</label>
                  <select value={newPatientForm.status} onChange={e=> setNewPatientForm(f=> ({...f, status:e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                    <option value="aktywny">aktywny</option>
                    <option value="nieaktywny">nieaktywny</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Terapeuci</label>
                  <div className="flex flex-wrap gap-2 mb-2 min-h-[34px] p-2 rounded-lg border border-gray-200 bg-gray-50">
                    {newPatientForm.therapists.map(tId=>{ const u=users.find(x=>x.id===tId); return (
                      <span key={tId} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-300">
                        {u? u.name.split(' ').slice(0,2).join(' '): tId}
                        <button type="button" onClick={()=> toggleNewTherapist(tId)} className="hover:text-indigo-900">×</button>
                      </span>
                    );})}
                    {newPatientForm.therapists.length===0 && <span className="text-[11px] text-gray-400">Brak</span>}
                  </div>
                  <select onChange={e=> { const v=e.target.value; if(v){ toggleNewTherapist(v); e.target.selectedIndex=0; } }} value="" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                    <option value="">Dodaj terapeutę...</option>
                    {users.filter(u=>u.role==='employee' && !newPatientForm.therapists.includes(u.id)).map(u=> <option key={u.id} value={u.id}>{u.name} {u.specialization? '– '+u.specialization:''}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Notatki</label>
                  <textarea value={newPatientForm.notes} onChange={e=> setNewPatientForm(f=> ({...f, notes:e.target.value}))} rows={4} placeholder="Historia, zalecenia, obserwacje..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y text-sm" />
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
                <svg className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-700">
                Usuniesz podopiecznego:
                <span className="font-semibold text-gray-900"> {selected?.firstName} {selected?.lastName}</span>.
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
