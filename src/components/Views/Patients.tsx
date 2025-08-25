import { useState, useEffect, useMemo, useRef } from 'react';
import { Patient } from '../../types';
import { Search } from 'lucide-react';
import { loadMeetings, loadUsers, loadRooms, loadPatients, savePatients, saveTherapistAssignments } from '../../utils/storage';

interface Visit { id: string; patientId: string; date: string; therapist: string; room: string; status: 'zrealizowana' | 'odwołana' | 'zaplanowana'; }

const ASSIGN_KEY = 'schedule_therapist_assignments';

export default function Patients(){
  const [patients, setPatients] = useState<Patient[]>(() => loadPatients());
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
  const [selected, setSelected] = useState<Patient | null>(null);
  const [statusFilter, setStatusFilter] = useState<'aktywny'|'nieaktywny'|'wszyscy'>('aktywny');
  const [assignmentFilter, setAssignmentFilter] = useState<'wszyscy'|'przypisani'>('wszyscy');

  const visits: Visit[] = useMemo(()=>{
    const userMap = new Map(users.map(u=> [u.id, u.name]));
    const roomMap = new Map(rooms.map(r=> [r.id, r.name]));
    const todayStr = new Date().toISOString().split('T')[0];
    return meetings
      .filter(m=> !!m.patientId)
      .map(m=>{
        let status: Visit['status'];
        if(m.status === 'cancelled') status = 'odwołana';
        else if(m.status === 'in-progress') status = 'zaplanowana';
        else status = m.date > todayStr ? 'zaplanowana' : 'zrealizowana';
        return { id:m.id, patientId:m.patientId!, date:m.date, therapist: userMap.get(m.specialistId) || m.specialistId, room: roomMap.get(m.roomId) || m.roomId, status };
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
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] leading-none ${isActive? 'text-green-700 bg-green-50 border-green-200':'text-gray-500 bg-gray-100 border-gray-300'}`}>{status || '—'}</span>;
  };

  const calcAge = (birthDate?: string) => {
    if(!birthDate) return '—'; const bd = new Date(birthDate); if(isNaN(bd.getTime())) return '—';
    const now = new Date(); let age = now.getFullYear()-bd.getFullYear(); const m = now.getMonth()-bd.getMonth(); if(m<0 || (m===0 && now.getDate()<bd.getDate())) age--; return age + ' lat';
  };

  const selectedVisits = selected ? visits.filter(v=> v.patientId===selected.id) : [];
  const visitCounts = useMemo(()=> ({
    total: selectedVisits.length,
    zrealizowana: selectedVisits.filter(v=> v.status==='zrealizowana').length,
    odwolana: selectedVisits.filter(v=> v.status==='odwołana').length,
    zaplanowana: selectedVisits.filter(v=> v.status==='zaplanowana').length
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

  useEffect(()=> { try { savePatients(patients); } catch {} },[patients]);

  const addTherapist = (id:string) => { if(!id || !selected) return; setEditForm(f => f.therapists.includes(id) ? f : { ...f, therapists:[...f.therapists, id] }); };
  const removeTherapist = (id:string) => setEditForm(f => ({ ...f, therapists: f.therapists.filter(t=> t!==id) }));

  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const emptyNew = { firstName:'', lastName:'', birthDate:'', status:'aktywny', therapists:[] as string[], notes:'' };
  const [newPatientForm, setNewPatientForm] = useState<typeof emptyNew>(emptyNew);
  const [newErrors, setNewErrors] = useState<string[]>([]);
  // Accessibility refs
  const addBtnRef = useRef<HTMLButtonElement|null>(null);
  const modalRef = useRef<HTMLDivElement|null>(null);
  const firstFieldRef = useRef<HTMLInputElement|null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  const validateNew = () => {
    const errs: string[] = [];
    if(!newPatientForm.firstName.trim()) errs.push('Imię jest wymagane');
    if(!newPatientForm.lastName.trim()) errs.push('Nazwisko jest wymagane');
    if(newPatientForm.birthDate && isNaN(new Date(newPatientForm.birthDate).getTime())) errs.push('Nieprawidłowa data urodzenia');
    setNewErrors(errs); return errs.length===0;
  };

  const openAdd = () => { setNewPatientForm(emptyNew); setNewErrors([]); setShowAddModal(true); };
  const cancelAdd = () => { if(creating) return; setShowAddModal(false); };

  const submitAdd = (e:React.FormEvent) => { e.preventDefault(); if(!validateNew()) return; setCreating(true); const id = 'p'+Date.now().toString(36); const patient: Patient = { id, firstName:newPatientForm.firstName.trim(), lastName:newPatientForm.lastName.trim(), birthDate:newPatientForm.birthDate || undefined, status: newPatientForm.status as any, therapists: newPatientForm.therapists }; setPatients(prev => [...prev, patient]); // persist via effect
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
                <tr key={p.id} onClick={()=> setSelected(p)} className={`cursor-pointer hover:bg-blue-50 ${selected?.id===p.id? 'bg-blue-50/70':''}`}>
                  <td className="px-3 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">{p.firstName} {p.lastName}</td>
                  <td className="px-3 py-1.5 text-[11px]">{statusBadge(p.status)}</td>
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
                      {!editMode && <button onClick={startEdit} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700">Edytuj</button>}
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
                      <p><strong>Data urodzenia:</strong>{' '}
                        {editMode ? (
                          <input type="date" value={editForm.birthDate} onChange={e=> setEditForm(f=> ({...f, birthDate:e.target.value}))} className="ml-2 px-2 py-1 text-xs border rounded" />
                        ) : <><span className="ml-1">{selected.birthDate || '—'}</span> <span className="ml-2 text-gray-500">({calcAge(selected.birthDate)})</span></>}
                      </p>
                      <p className="flex items-center"><strong className="mr-1">Status:</strong>{' '}
                        {editMode ? (
                          <select value={editForm.status} onChange={e=> setEditForm(f=> ({...f, status:e.target.value}))} className="px-2 py-1 text-xs border rounded">
                            <option value="aktywny">aktywny</option>
                            <option value="nieaktywny">nieaktywny</option>
                          </select>
                        ) : statusBadge(selected.status)}
                      </p>
                      <div>
                        <p className="mb-1"><strong>Terapeuci:</strong></p>
                        {!editMode && <div className="flex flex-wrap gap-1">{(therapistAssignments[selected.id]||[]).map(tId => <span key={tId} className="px-2 py-0.5 text-[11px] bg-blue-50 text-blue-700 rounded-full border border-blue-200">{userIdToName[tId] || tId}</span>)}{(therapistAssignments[selected.id]||[]).length===0 && <span className="text-[11px] text-gray-400">Brak</span>}</div>}
                        {editMode && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1">{editForm.therapists.map(tId => <span key={tId} className="px-2 py-0.5 text-[11px] bg-blue-50 text-blue-700 rounded-full border border-blue-200 flex items-center gap-1">{userIdToName[tId]||tId}<button onClick={()=> removeTherapist(tId)} className="text-blue-500 hover:text-blue-700">×</button></span>)}{editForm.therapists.length===0 && <span className="text-[11px] text-gray-400">Brak terapeutów</span>}</div>
                            <div className="flex items-center gap-2">
                              <select className="px-2 py-1 text-xs border rounded" onChange={e=> { addTherapist(e.target.value); e.target.selectedIndex=0; }}>
                                <option value="">Dodaj terapeutę...</option>
                                {users.filter(u=> u.role==='employee').filter(u=> !editForm.therapists.includes(u.id)).map(u=> <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        {visitCounts.total===0 ? <p className="text-[12px] italic text-gray-400">Brak sesji</p> : (
                          <div className="space-y-1">
                            <p className="text-[12px] font-semibold text-gray-700">Sesje łącznie: {visitCounts.total}</p>
                            <div className="flex flex-wrap gap-1 text-[11px]">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">zrealizowane: {visitCounts.zrealizowana}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-yellow-50 text-yellow-700 border-yellow-200">zaplanowane: {visitCounts.zaplanowana}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">odwołane: {visitCounts.odwolana}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 flex flex-col h-full">
                      <div className="flex border-b border-gray-200 mb-3">
                        <button className={`px-4 py-2 text-xs font-medium -mb-px border-b-2 transition-colors ${activeTab==='info' ? 'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={()=> setActiveTab('info')}>Informacje dodatkowe</button>
                        <button className={`px-4 py-2 text-xs font-medium -mb-px border-b-2 transition-colors ${activeTab==='sessions' ? 'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={()=> setActiveTab('sessions')}>Notatki z sesji</button>
                      </div>
                      {activeTab==='info' && (
                        <div className="flex-1 flex flex-col">
                          <label className="text-xs font-semibold text-gray-700 mb-1">Informacje dodatkowe</label>
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
                          {selectedVisits.length===0 && <div className="text-xs text-gray-500 italic">Brak wizyt do wyświetlenia notatek</div>}
                          <ul className="space-y-2">
                            {selectedVisits.map(v=> {
                              const open = openSessionNotes.has(v.id);
                              const toggle = () => setOpenSessionNotes(prev => { const n = new Set(prev); n.has(v.id)? n.delete(v.id): n.add(v.id); return n; });
                              return (
                                <li key={v.id} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                                  <button onClick={toggle} className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50">
                                    <span className="flex items-center gap-2"><span className="text-gray-500">{v.date}</span><span className="text-gray-400">•</span><span>{v.therapist}</span><span className="text-gray-400">•</span><span className="capitalize">{v.status}</span></span>
                                    <span className={`ml-2 inline-flex h-5 w-5 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 shadow-sm transition-transform duration-200 ${open? 'rotate-90':''}`}>
                                      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.293 7.293a1 1 0 011.414 0L11 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </span>
                                  </button>
                                  {open && (
                                    <div className="p-3 border-t border-gray-200 bg-gray-50">
                                      {editMode ? (
                                        <textarea className="w-full text-xs p-2 border rounded resize-y min-h-[80px]" placeholder="Wpisz notatkę z sesji..." value={sessionNotes[v.id]||''} onChange={e=> setSessionNotes(s=> ({...s, [v.id]: e.target.value}))} />
                                      ) : (
                                        <div className="text-xs whitespace-pre-wrap text-gray-700 min-h-[40px]">{(sessionNotes[v.id] || '').trim() || <span className="italic text-gray-400">Brak notatki</span>}</div>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                          {selectedVisits.length>0 && openSessionNotes.size>0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <button onClick={()=> setOpenSessionNotes(new Set())} className="px-3 py-1.5 text-[11px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-300">Zwiń wszystkie notatki</button>
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
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border border-gray-200">
                    <tr className="text-gray-600">
                      <th className="px-3 py-2 text-left font-medium">Data</th>
                      <th className="px-3 py-2 text-left font-medium">Terapeuta</th>
                      <th className="px-3 py-2 text-left font-medium">Sala</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 border border-gray-200 border-t-0">
                    {selectedVisits.map(v=> (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">{v.date}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{v.therapist}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{v.room}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full border ${v.status==='zrealizowana' ? 'bg-green-50 text-green-700 border-green-200' : v.status==='odwołana' ? 'bg-red-50 text-red-600 border-red-200':'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{v.status}</span>
                        </td>
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
    </div>
  );
}
