import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Hash } from 'lucide-react';
import { Meeting, User, Room, Patient } from '../../types';
import { loadPatients } from '../../utils/storage';

const ASSIGN_KEY = 'schedule_therapist_assignments';

interface MeetingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (meeting: Omit<Meeting, 'id'>) => void;
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

  // load therapistAssignments (single source of truth)
  const therapistAssignments: Record<string,string[]> = React.useMemo(()=> {
    try { const raw = localStorage.getItem(ASSIGN_KEY); return raw? JSON.parse(raw): {}; } catch { return {}; }
  }, [isOpen]);

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
      return effectivePatients.filter(p => assignedPatientIds.has(p.id));
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
    const newErrors: string[] = [];
    if (!formData.specialistIds.length) newErrors.push('Wybierz co najmniej jednego specjalistę');
    if (!formData.patientIds.length) newErrors.push('Wybierz co najmniej jednego podopiecznego');
    if (!formData.roomId) newErrors.push('Wybierz salę');
    if (!formData.startTime || !formData.endTime) newErrors.push('Określ godziny spotkania');
    if (formData.startTime && formData.endTime) {
      const startM = toMin(formData.startTime); const endM = toMin(formData.endTime);
      if (endM <= startM) newErrors.push('Godzina zakończenia musi być późniejsza niż rozpoczęcia');
    }
    // conflict per specialist and room
    formData.specialistIds.forEach(id => {
      if (specialistHasConflict(id, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id)) newErrors.push(`Specjalista (${users.find(u=>u.id===id)?.name||id}) jest zajęty`);
    });
    if (roomHasConflict(formData.roomId, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id)) newErrors.push('Sala jest zajęta w tym przedziale czasu');
    setErrors(newErrors); return newErrors.length===0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const primarySpec = formData.specialistIds[0];
    const primaryPatientId = formData.patientIds[0];
    const patientNamesList = formData.patientIds.map(id => {
      const p = patients.find(pp=> pp.id===id); return p ? `${p.firstName} ${p.lastName}` : id;
    });
    onSubmit({
      specialistId: primarySpec,
      patientName: patientNamesList[0] || formData.patientName,
      patientId: primaryPatientId,
      guestName: formData.guestName,
      roomId: formData.roomId,
      date: selectedDate,
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="meetingFormTitle">
      <div ref={dialogRef} className="modal">
        <div className="modal__header">
          <h2 id="meetingFormTitle" className="modal__title">
            <span className="modal__icon"><Hash className="h-4 w-4" /></span>
            {editingMeeting ? 'Edytuj sesję' : 'Nowa sesja'}
          </h2>
          <button onClick={onClose} className="icon-btn" aria-label="Zamknij">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal__body">
          {errors.length>0 && (
            <div className="alert" aria-live="assertive">
              <div className="alert__title"><AlertCircle className="h-5 w-5" />Błędy formularza:</div>
              <ul className="alert__list">
                {errors.map((e,i)=>(<li key={i}>{e}</li>))}
              </ul>
            </div>
          )}
          <div className="two-col">
            <div className="space-y-6">
              <div>
                <label className="form-label" style={{textTransform:'uppercase', fontSize:11, letterSpacing:'.05em'}}>Specjaliści</label>
                <div className="tags-container">
                  {formData.specialistIds.map(id=> {
                    const u = users.find(us=>us.id===id);
                    if(!u) return null;
                    const busy = !!(formData.startTime && formData.endTime && specialistHasConflict(id, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id));
                    return (
                      <span
                        key={id}
                        className={`pill ${busy? 'pill--busy':'pill--ok'}`}
                        title={busy? 'Ten specjalista jest zajęty w tym czasie':'Specjalista dodany'}
                      >
                        {u.name.split(' ').slice(0,2).join(' ')}
                        <button
                          type="button"
                          onClick={()=> setFormData(fd=> ({...fd, specialistIds: fd.specialistIds.filter(x=> x!==id)}))}
                          className="pill-remove"
                          aria-label="Usuń specjalistę"
                        >×</button>
                      </span>
                    );
                  })}
                  {formData.specialistIds.length===0 && (
                    <span className="tags-empty">Brak wybranych specjalistów</span>
                  )}
                </div>
                <select onChange={(e)=>{ const v=e.target.value; if(v) setFormData(fd=> fd.specialistIds.includes(v)? fd : {...fd, specialistIds:[...fd.specialistIds, v]}); e.target.selectedIndex=0; }} value="" className="select">
                  <option value="">Dodaj specjalistę...</option>
                  {users.filter(u=>u.role==='employee').map(u=> {
                    const busy = !!(formData.startTime && formData.endTime && specialistHasConflict(u.id, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id));
                    const already = formData.specialistIds.includes(u.id);
                    return <option key={u.id} value={u.id} disabled={busy || already}>{u.name}{u.specialization? ' – '+u.specialization: ''}{already ? ' (wybrany)' : busy ? ' (zajęty)' : ''}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="form-label" style={{textTransform:'uppercase', fontSize:11, letterSpacing:'.05em'}}>Podopieczni</label>
                <div className="mb-1">
                  <div className="toggle-group">
                    <button type="button" onClick={()=> setPatientAssignmentFilter('wszyscy')} className={patientAssignmentFilter==='wszyscy' ? 'active' : ''}>Wszyscy</button>
                    <button type="button" onClick={()=> setPatientAssignmentFilter('przypisani')} className={patientAssignmentFilter==='przypisani' ? 'active' : ''}>Przypisani</button>
                  </div>
                </div>
                {patientAssignmentFilter==='przypisani' && (
                  <div className="mb-2">
                    {formData.specialistIds.length===0 ? (
                      <div className="helper-box helper-box--warn">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width={14} height={14}><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.598c.75 1.335-.213 2.998-1.742 2.998H3.48c-1.53 0-2.492-1.663-1.743-2.998L8.257 3.1zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-.25-6.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" clipRule="evenodd" /></svg>
                        <span>Wybierz specjalistę aby zobaczyć przypisanych</span>
                      </div>
                    ) : (filteredPatients.length===0 ? (
                      <div className="helper-box helper-box--info">Brak wspólnych przypisanych pacjentów</div>
                    ) : null)}
                  </div>
                )}
                <div className="patient-tags">
                  {formData.patientIds.map(pid=>{
                    const p = effectivePatients.find(pp=>pp.id===pid); if(!p) return null;
                    return <span key={pid} className="patient-tag">{p.firstName} {p.lastName}<button type="button" onClick={()=> setFormData(fd=>({...fd, patientIds: fd.patientIds.filter(x=>x!==pid)}))} aria-label="Usuń podopiecznego">×</button></span>;
                  })}
                  {formData.patientIds.length===0 && <span className="tags-empty">Brak</span>}
                </div>
                <select onChange={(e)=>{ const v=e.target.value; if(v) setFormData(fd=> fd.patientIds.includes(v)? fd : {...fd, patientIds:[...fd.patientIds, v]}); e.target.selectedIndex=0; }} value="" className="select" disabled={patientAssignmentFilter==='przypisani' && formData.specialistIds.length===0}>
                  <option value="">Dodaj podopiecznego...</option>
                  {filteredPatients.map(p=> {
                    const selected = formData.patientIds.includes(p.id);
                    return <option key={p.id} value={p.id} disabled={selected}>{p.firstName} {p.lastName}{selected ? ' (dodany)':''}</option>;
                  })}
                  {filteredPatients.length===0 && <option value="" disabled>{patientAssignmentFilter==='przypisani'? (formData.specialistIds.length? 'Brak przypisanych':'Najpierw wybierz specjalistę') : 'Brak wyników'}</option>}
                </select>
                {effectivePatients.length===0 && (
                  <p className="small-muted" style={{marginTop:4,color:'var(--color-danger)'}}>Brak zarejestrowanych podopiecznych – dodaj w module Pacjenci.</p>
                )}
              </div>
              <div>
                <label className="form-label" style={{textTransform:'uppercase', fontSize:11, letterSpacing:'.05em'}}>Sala</label>
                <div className="dropdown">
                  <button type="button" onClick={()=> setRoomsOpen(o=>!o)} className="dropdown-toggle">
                    {formData.roomId ? (
                      <span style={{display:'flex', alignItems:'center', gap:8}}>
                        {(() => { const rc = rooms.find(r=>r.id===formData.roomId); const col = rc?.color || '#9ca3af'; return <span style={{ backgroundColor: col }} className="inline-block" aria-hidden="true" />; })()}
                        <span>{rooms.find(r=>r.id===formData.roomId)?.name}</span>
                      </span>
                    ) : <span style={{color:'var(--color-text-subtle)'}}>Wybierz salę</span>}
                    <svg style={{width:16, height:16, transform: roomsOpen? 'rotate(180deg)':'none', transition:'transform var(--transition-fast)'}} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.38a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                  </button>
                  {roomsOpen && (
                    <div className="dropdown-menu">
                      <ul>
                        {rooms.map(r => {
                          const disabledOpt = !!(formData.startTime && formData.endTime && roomHasConflict(r.id, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id) && r.id!==formData.roomId);
                          const selectedRoom = formData.roomId === r.id;
                          const col = r.color || '#9ca3af';
                          return (
                            <li key={r.id}>
                              <button
                                type="button"
                                disabled={disabledOpt}
                                onClick={()=> { setFormData(fd=> ({...fd, roomId:r.id})); setRoomsOpen(false);} }
                                className={`dropdown-item ${disabledOpt? 'disabled':''} ${selectedRoom? 'active':''}`}
                              >
                                <span style={{ backgroundColor: col, width:10, height:10, borderRadius:'50%', boxShadow:'0 0 0 1px #fff' }} />
                                <span style={{flex:1}}>{r.name}</span>
                                {disabledOpt && <span style={{fontSize:10, color:'var(--color-danger)'}}>zajęta</span>}
                                {selectedRoom && !disabledOpt && <span style={{fontSize:10, color:'var(--color-primary)'}}>wybrana</span>}
                              </button>
                            </li>
                          );
                        })}
                        {rooms.length===0 && (
                          <li className="dropdown-empty">Brak sal</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="two-col" style={{gap:24}}>
                <div>
                  <label className="form-label" style={{textTransform:'uppercase', fontSize:11, letterSpacing:'.05em'}}>Start</label>
                  <input type="time" value={formData.startTime} onChange={e=> setFormData({...formData, startTime:e.target.value})} className="form-input" />
                </div>
                <div>
                  <label className="form-label" style={{textTransform:'uppercase', fontSize:11, letterSpacing:'.05em'}}>Koniec</label>
                  <input type="time" value={formData.endTime} onChange={e=> setFormData({...formData, endTime:e.target.value})} className="form-input" />
                </div>
              </div>
              <div className="two-col" style={{gap:24}}>
                <div>
                  <label className="form-label" style={{textTransform:'uppercase', fontSize:11, letterSpacing:'.05em'}}>Status</label>
                  <select value={formData.status} onChange={e=> setFormData({...formData, status: e.target.value as any})} className="select">
                    <option value="present">Obecny</option>
                    <option value="in-progress">W toku</option>
                    <option value="cancelled">Odwołany</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{textTransform:'uppercase', fontSize:11, letterSpacing:'.05em'}}>Gość (opcjonalnie)</label>
                  <input type="text" value={formData.guestName} onChange={e=> setFormData({...formData, guestName:e.target.value})} placeholder="Imię i nazwisko" className="form-input" />
                </div>
              </div>
              <div>
                <label className="form-label" style={{textTransform:'uppercase', fontSize:11, letterSpacing:'.05em'}}>Notatki</label>
                <textarea value={formData.notes} onChange={e=> setFormData({...formData, notes:e.target.value})} rows={4} placeholder="Cel sesji, materiały, obserwacje..." className="form-input" style={{resize:'vertical', padding:'12px 16px'}} />
              </div>
              <div className="note-box">
                Sesja musi zawierać przynajmniej jednego specjalistę i jednego podopiecznego. Konflikty czasowe są sprawdzane automatycznie.
              </div>
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Anuluj</button>
            <button type="submit" className="btn btn-gradient">{editingMeeting? 'Zapisz zmiany':'Utwórz sesję'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingForm;