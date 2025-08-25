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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center p-6 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="meetingFormTitle">
      <div ref={dialogRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-100">
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-2xl">
          <h2 id="meetingFormTitle" className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-100 text-indigo-600"><Hash className="h-4 w-4" /></span>
            {editingMeeting ? 'Edytuj sesję' : 'Nowa sesja'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/70 rounded-lg transition-colors" aria-label="Zamknij">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
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
                {/* Selected specialists only */}
                <div className="flex flex-wrap gap-1 mb-2 min-h-[32px]">
                  {formData.specialistIds.map(id=> {
                    const u = users.find(us=>us.id===id);
                    if(!u) return null;
                    const busy = !!(formData.startTime && formData.endTime && specialistHasConflict(id, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id));
                    return (
                      <span
                        key={id}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border flex items-center gap-1 ${busy? 'bg-red-100 text-red-700 border-red-300':'bg-indigo-100 text-indigo-700 border-indigo-300'}`}
                        title={busy? 'Ten specjalista jest zajęty w tym czasie':'Specjalista dodany'}
                      >
                        {u.name.split(' ').slice(0,2).join(' ')}
                        <button
                          type="button"
                          onClick={()=> setFormData(fd=> ({...fd, specialistIds: fd.specialistIds.filter(x=> x!==id)}))}
                          className="hover:opacity-80"
                          aria-label="Usuń specjalistę"
                        >×</button>
                      </span>
                    );
                  })}
                  {formData.specialistIds.length===0 && (
                    <span className="text-[11px] text-gray-400">Brak wybranych specjalistów</span>
                  )}
                </div>
                <select onChange={(e)=>{ const v=e.target.value; if(v) setFormData(fd=> fd.specialistIds.includes(v)? fd : {...fd, specialistIds:[...fd.specialistIds, v]}); e.target.selectedIndex=0; }} value="" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="">Dodaj specjalistę...</option>
                  {users.filter(u=>u.role==='employee').map(u=> {
                    const busy = !!(formData.startTime && formData.endTime && specialistHasConflict(u.id, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id));
                    const already = formData.specialistIds.includes(u.id);
                    return <option key={u.id} value={u.id} disabled={busy || already}>{u.name}{u.specialization? ' – '+u.specialization: ''}{already ? ' (wybrany)' : busy ? ' (zajęty)' : ''}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Podopieczni</label>
                <div className="mb-1 flex items-center gap-3">
                  <div className="inline-flex text-[11px] rounded-lg overflow-hidden border border-indigo-300 bg-indigo-50">
                    <button type="button"
                      onClick={()=> setPatientAssignmentFilter('wszyscy')}
                      className={`px-3 py-1.5 font-medium transition-colors ${patientAssignmentFilter==='wszyscy' ? 'bg-indigo-600 text-white shadow-inner' : 'text-indigo-700 hover:bg-indigo-100'}`}>Wszyscy</button>
                    <button type="button"
                      onClick={()=> setPatientAssignmentFilter('przypisani')}
                      className={`px-3 py-1.5 font-medium transition-colors border-l border-indigo-300 ${patientAssignmentFilter==='przypisani' ? 'bg-indigo-600 text-white shadow-inner' : 'text-indigo-700 hover:bg-indigo-100'}`}>Przypisani</button>
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
                <div className="flex flex-wrap gap-1 mb-2 max-h-28 overflow-y-auto pr-1">
                  {formData.patientIds.map(pid=>{
                    const p = effectivePatients.find(pp=>pp.id===pid); if(!p) return null;
                    return <span key={pid} className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-medium flex items-center gap-1">{p.firstName} {p.lastName}<button type="button" onClick={()=> setFormData(fd=>({...fd, patientIds: fd.patientIds.filter(x=>x!==pid)}))} className="hover:text-emerald-900" aria-label="Usuń podopiecznego">×</button></span>;
                  })}
                  {formData.patientIds.length===0 && <span className="text-[11px] text-gray-400">Brak</span>}
                </div>
                <select onChange={(e)=>{ const v=e.target.value; if(v) setFormData(fd=> fd.patientIds.includes(v)? fd : {...fd, patientIds:[...fd.patientIds, v]}); e.target.selectedIndex=0; }} value="" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60" disabled={patientAssignmentFilter==='przypisani' && formData.specialistIds.length===0}>
                  <option value="">Dodaj podopiecznego...</option>
                  {filteredPatients.map(p=> {
                    const selected = formData.patientIds.includes(p.id);
                    return <option key={p.id} value={p.id} disabled={selected}>{p.firstName} {p.lastName}{selected ? ' (dodany)':''}</option>;
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
                  <button type="button" onClick={()=> setRoomsOpen(o=>!o)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent">
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
                          const disabledOpt = !!(formData.startTime && formData.endTime && roomHasConflict(r.id, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id) && r.id!==formData.roomId);
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
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Start</label>
                  <input type="time" value={formData.startTime} onChange={e=> setFormData({...formData, startTime:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Koniec</label>
                  <input type="time" value={formData.endTime} onChange={e=> setFormData({...formData, endTime:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Status</label>
                  <select value={formData.status} onChange={e=> setFormData({...formData, status: e.target.value as any})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                    <option value="present">Obecny</option>
                    <option value="in-progress">W toku</option>
                    <option value="cancelled">Odwołany</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Gość (opcjonalnie)</label>
                  <input type="text" value={formData.guestName} onChange={e=> setFormData({...formData, guestName:e.target.value})} placeholder="Imię i nazwisko" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Notatki</label>
                <textarea value={formData.notes} onChange={e=> setFormData({...formData, notes:e.target.value})} rows={4} placeholder="Cel sesji, materiały, obserwacje..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y" />
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500 leading-relaxed">
                Sesja musi zawierać przynajmniej jednego specjalistę i jednego podopiecznego. Konflikty czasowe są sprawdzane automatycznie.
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Anuluj</button>
            <button type="submit" className="px-6 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 shadow hover:from-indigo-500 hover:to-blue-500 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">{editingMeeting? 'Zapisz zmiany':'Utwórz sesję'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingForm;