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
    return <span className={`status-badge ${isActive? 'status-badge--active':'status-badge--inactive'}`}>{status || '—'}</span>;
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
    <div className="patients">
      <div className="patients-toolbar">
        <div className="patients-search">
          <Search className="patients-search__icon" />
          <input value={query} onChange={e=> setQuery(e.target.value)} placeholder="Szukaj (imię/nazwisko podopiecznego lub terapeuty)" />
          {query && <button type="button" onClick={()=> setQuery('')} className="patients-search__clear" aria-label="Wyczyść">×</button>}
        </div>
        <div className="patients-filter">
          <select value={statusFilter} onChange={e=> setStatusFilter(e.target.value as any)}>
            <option value="aktywny">Aktywni</option>
            <option value="nieaktywny">Nieaktywni</option>
            <option value="wszyscy">Wszyscy</option>
          </select>
        </div>
        <div className="patients-filter">
          <select value={assignmentFilter} onChange={e=> setAssignmentFilter(e.target.value as any)}>
            <option value="wszyscy">Wszyscy (bez filtra)</option>
            <option value="przypisani">Tylko z terapeutą</option>
          </select>
        </div>
        <button type="button" onClick={openAdd} ref={addBtnRef} className="btn-gradient">
          <span style={{fontSize:'18px', lineHeight:1}}>＋</span> Dodaj
        </button>
      </div>

      <div className="patients-main">
        <div className="patients-list">
          <table>
            <thead>
              <tr>
                <th>Imię i nazwisko</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} onClick={()=> setSelected(p)} className={selected?.id===p.id? 'is-selected':''}>
                  <td>{p.firstName} {p.lastName}</td>
                  <td>{statusBadge(p.status)}</td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={2} className="patients-empty">Brak podopiecznych</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="patients-detail">
          {!selected && <div className="patients-detail__placeholder">Wybierz podopiecznego z listy po lewej</div>}
          {selected && (
            <div style={{display:'flex', flexDirection:'column', gap:'1.5rem'}}>
              <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between'}}>
                    <h2 style={{fontSize:'1.25rem', fontWeight:600, color:'#111827'}}>
                      {editMode ? (
                        <div style={{display:'flex', gap:'0.5rem'}}>
                          <input value={editForm.firstName} onChange={e=> setEditForm(f=> ({...f, firstName:e.target.value}))} style={{padding:'0.25rem 0.5rem', fontSize:14, border:'1px solid #d1d5db', borderRadius:6}} />
                          <input value={editForm.lastName} onChange={e=> setEditForm(f=> ({...f, lastName:e.target.value}))} style={{padding:'0.25rem 0.5rem', fontSize:14, border:'1px solid #d1d5db', borderRadius:6}} />
                        </div>
                      ) : `${selected.firstName} ${selected.lastName}`}
                    </h2>
                    <div className="patients-actions" style={{display:'flex', alignItems:'center', gap:'0.5rem', marginLeft:'1rem'}}>
                      {!editMode && <button onClick={startEdit} className="btn btn-blue">Edytuj</button>}
                      {editMode && (
                        <>
                          <button onClick={saveEdit} className="btn btn-green">Zapisz</button>
                          <button onClick={cancelEdit} className="btn btn-gray">Anuluj</button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="patients-meta-grid">
                    <div className="patients-meta-section">
                      <p><span className="patients-label">Data urodzenia:</span> {editMode ? (
                        <input type="date" value={editForm.birthDate} onChange={e=> setEditForm(f=> ({...f, birthDate:e.target.value}))} style={{marginLeft:8, padding:'0.25rem 0.5rem', fontSize:12, border:'1px solid #d1d5db', borderRadius:4}} />
                      ) : <><span style={{marginLeft:4}}>{selected.birthDate || '—'}</span> <span className="patients-age">({calcAge(selected.birthDate)})</span></>}
                      </p>
                      <p style={{display:'flex', alignItems:'center'}}><span className="patients-label" style={{marginRight:4}}>Status:</span> {editMode ? (
                        <select value={editForm.status} onChange={e=> setEditForm(f=> ({...f, status:e.target.value}))} style={{padding:'0.25rem 0.5rem', fontSize:12, border:'1px solid #d1d5db', borderRadius:4}}>
                          <option value="aktywny">aktywny</option>
                          <option value="nieaktywny">nieaktywny</option>
                        </select>
                      ) : statusBadge(selected.status)}
                      </p>
                      <div>
                        <p style={{marginBottom:4}}><span className="patients-label">Terapeuci:</span></p>
                        {!editMode && <div style={{display:'flex', flexWrap:'wrap', gap:4}}>{(therapistAssignments[selected.id]||[]).map(tId => <span key={tId} className="pill pill-blue">{userIdToName[tId] || tId}</span>)}{(therapistAssignments[selected.id]||[]).length===0 && <span style={{fontSize:11, color:'#9ca3af'}}>Brak</span>}</div>}
                        {editMode && (
                          <div style={{display:'flex', flexDirection:'column', gap:8}}>
                            <div style={{display:'flex', flexWrap:'wrap', gap:4}}>{editForm.therapists.map(tId => <span key={tId} className="pill pill-blue" style={{display:'inline-flex', alignItems:'center', gap:4}}>{userIdToName[tId]||tId}<button onClick={()=> removeTherapist(tId)} style={{border:0, background:'transparent', cursor:'pointer', color:'#2563eb'}}>×</button></span>)}{editForm.therapists.length===0 && <span style={{fontSize:11, color:'#9ca3af'}}>Brak terapeutów</span>}</div>
                            <div style={{display:'flex', alignItems:'center', gap:8}}>
                              <select style={{padding:'0.25rem 0.5rem', fontSize:12, border:'1px solid #d1d5db', borderRadius:4}} onChange={e=> { addTherapist(e.target.value); e.target.selectedIndex=0; }}>
                                <option value="">Dodaj terapeutę...</option>
                                {users.filter(u=> u.role==='employee').filter(u=> !editForm.therapists.includes(u.id)).map(u=> <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid #e5e7eb'}}>
                        {visitCounts.total===0 ? <p style={{fontSize:12, fontStyle:'italic', color:'#9ca3af'}}>Brak sesji</p> : (
                          <div style={{display:'flex', flexDirection:'column', gap:4}}>
                            <p style={{fontSize:12, fontWeight:600, color:'#475569'}}>Sesje łącznie: {visitCounts.total}</p>
                            <div style={{display:'flex', flexWrap:'wrap', gap:4, fontSize:11}}>
                              <span className="pill pill-green">zrealizowane: {visitCounts.zrealizowana}</span>
                              <span className="pill pill-yellow">zaplanowane: {visitCounts.zaplanowana}</span>
                              <span className="pill pill-red">odwołane: {visitCounts.odwolana}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{gridColumn:'span 2', display:'flex', flexDirection:'column', height:'100%'}}>
                      <div className="patients-tabbar">
                        <button className={`patients-tab ${activeTab==='info'?'is-active':''}`} onClick={()=> setActiveTab('info')}>Informacje dodatkowe</button>
                        <button className={`patients-tab ${activeTab==='sessions'?'is-active':''}`} onClick={()=> setActiveTab('sessions')}>Notatki z sesji</button>
                      </div>
                      {activeTab==='info' && (
                        <div className="patients-notes-edit">
                          <label style={{fontSize:11, fontWeight:600, color:'#374151', marginBottom:4}}>Informacje dodatkowe</label>
                          {editMode ? (
                            <textarea value={editForm.notes} onChange={e=> setEditForm(f=> ({...f, notes:e.target.value}))} className="form-textarea" placeholder="Wpisz dodatkowe informacje..." />
                          ) : (
                            <div className="patients-notes-view box">
                              {(patientNotes[selected.id]||'').trim() || <span style={{fontStyle:'italic', color:'#9ca3af'}}>Brak informacji</span>}
                            </div>
                          )}
                        </div>
                      )}
                      {activeTab==='sessions' && (
                        <div className="sessions-list">
                          {selectedVisits.length===0 && <div style={{fontSize:11, color:'#6b7280', fontStyle:'italic'}}>Brak wizyt do wyświetlenia notatek</div>}
                          <ul className="sessions-items">
                            {selectedVisits.map(v=> { const open=openSessionNotes.has(v.id); const toggle=()=> setOpenSessionNotes(prev=>{ const n=new Set(prev); n.has(v.id)? n.delete(v.id): n.add(v.id); return n; }); return (
                              <li key={v.id} className="session-item">
                                <button onClick={toggle} className="session-item__toggle">
                                  <span style={{display:'flex', alignItems:'center', gap:8}}><span style={{color:'#6b7280'}}>{v.date}</span><span style={{color:'#94a3b8'}}>•</span><span>{v.therapist}</span><span style={{color:'#94a3b8'}}>•</span><span style={{textTransform:'capitalize'}}>{v.status}</span></span>
                                  <span className={`session-item__icon ${open?'is-open':''}`}><svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.293 7.293a1 1 0 011.414 0L11 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></span>
                                </button>
                                {open && (
                                  <div className="session-item__body">
                                    {editMode ? (
                                      <textarea className="w-full" placeholder="Wpisz notatkę z sesji..." value={sessionNotes[v.id]||''} onChange={e=> setSessionNotes(s=> ({...s, [v.id]: e.target.value}))} />
                                    ) : (
                                      <div>{(sessionNotes[v.id] || '').trim() || <span style={{fontStyle:'italic', color:'#9ca3b8'}}>Brak notatki</span>}</div>
                                    )}
                                  </div>
                                )}
                              </li>
                            ); })}
                          </ul>
                          {selectedVisits.length>0 && openSessionNotes.size>0 && (
                            <div className="sessions-collapse-all">
                              <button onClick={()=> setOpenSessionNotes(new Set())}>Zwiń wszystkie notatki</button>
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
            <div className="visit-history">
              <h3>Historia wizyt</h3>
              <div className="table-scroll">
                <table className="visit-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Terapeuta</th>
                      <th>Sala</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedVisits.map(v=> (
                      <tr key={v.id}>
                        <td>{v.date}</td>
                        <td>{v.therapist}</td>
                        <td>{v.room}</td>
                        <td>
                          <span className={`badge-status ${v.status==='zrealizowana' ? 'badge-status--done' : v.status==='odwołana' ? 'badge-status--cancel' : 'badge-status--planned'}`}>{v.status}</span>
                        </td>
                      </tr>
                    ))}
                    {selectedVisits.length===0 && <tr><td colSpan={4} className="visit-table-empty">Brak wizyt</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay"
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
          <div ref={modalRef} className="modal">
            <div className="modal-header">
              <h3 id="addPatientTitle" className="modal-title">Nowy podopieczny</h3>
              <button onClick={cancelAdd} className="modal-close" disabled={creating} aria-label="Zamknij">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <form onSubmit={submitAdd} className="modal-body">
              {newErrors.length>0 && (
                <div className="error-box" aria-live="assertive">
                  <ul>
                    {newErrors.map((e,i)=>(<li key={i}>{e}</li>))}
                  </ul>
                </div>
              )}
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Imię</label>
                  <input ref={firstFieldRef} value={newPatientForm.firstName} onChange={e=> setNewPatientForm(f=> ({...f, firstName:e.target.value}))} className="form-input" placeholder="Imię" />
                </div>
                <div className="form-field">
                  <label className="form-label">Nazwisko</label>
                  <input value={newPatientForm.lastName} onChange={e=> setNewPatientForm(f=> ({...f, lastName:e.target.value}))} className="form-input" placeholder="Nazwisko" />
                </div>
                <div className="form-field">
                  <label className="form-label">Data urodzenia</label>
                  <input type="date" value={newPatientForm.birthDate} onChange={e=> setNewPatientForm(f=> ({...f, birthDate:e.target.value}))} className="form-input" />
                </div>
                <div className="form-field">
                  <label className="form-label">Status</label>
                  <select value={newPatientForm.status} onChange={e=> setNewPatientForm(f=> ({...f, status:e.target.value}))} className="form-select">
                    <option value="aktywny">aktywny</option>
                    <option value="nieaktywny">nieaktywny</option>
                  </select>
                </div>
                <div className="form-field" style={{gridColumn:'1 / -1'}}>
                  <label className="form-label">Terapeuci</label>
                  <div className="chips">
                    {newPatientForm.therapists.map(tId=>{ const u=users.find(x=>x.id===tId); return (
                      <span key={tId} className="chip">
                        {u? u.name.split(' ').slice(0,2).join(' '): tId}
                        <button type="button" onClick={()=> toggleNewTherapist(tId)}>×</button>
                      </span>
                    );})}
                    {newPatientForm.therapists.length===0 && <span style={{fontSize:11, color:'#9ca3af'}}>Brak</span>}
                  </div>
                  <select onChange={e=> { const v=e.target.value; if(v){ toggleNewTherapist(v); e.target.selectedIndex=0; } }} value="" className="form-select" style={{marginTop:8}}>
                    <option value="">Dodaj terapeutę...</option>
                    {users.filter(u=>u.role==='employee' && !newPatientForm.therapists.includes(u.id)).map(u=> <option key={u.id} value={u.id}>{u.name} {u.specialization? '– '+u.specialization:''}</option>)}
                  </select>
                </div>
                <div className="form-field" style={{gridColumn:'1 / -1'}}>
                  <label className="form-label">Notatki</label>
                  <textarea value={newPatientForm.notes} onChange={e=> setNewPatientForm(f=> ({...f, notes:e.target.value}))} rows={4} placeholder="Historia, zalecenia, obserwacje..." className="form-textarea" />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" onClick={cancelAdd} disabled={creating} className="btn-secondary">Anuluj</button>
                <button type="submit" disabled={creating} className="btn-primary">{creating? 'Zapisywanie...':'Utwórz'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
