import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { Room, RoomAPI, Meeting, Event } from '../../types';
import { getRooms, updateRoom as apiUpdateRoom, deleteRoom as apiDeleteRoom, createRoom as apiCreateRoom } from '../../utils/api/rooms';
import { loadCurrentUser, loadMeetings, loadUsers } from '../../utils/storage';
import { fetchEvents } from '../../utils/api/events';
import { fetchEmployees } from '../../utils/api/employees';

// Distinct, broader-spectrum high-contrast palette (20 colors)
const ROOM_COLOR_PALETTE = [
  '#0D3B66', // deep navy
  '#EF476F', // pink red
  '#FFD166', // warm yellow
  '#06D6A0', // mint
  '#118AB2', // teal blue
  '#8E44AD', // purple
  '#E67E22', // orange
  '#2ECC71', // green
  '#C0392B', // red
  '#F1C40F', // gold
  '#16A085', // jade
  '#2980B9', // medium blue
  '#D81B60', // magenta
  '#7B1FA2', // deep purple
  '#F4511E', // orange red
  '#00ACC1', // cyan
  '#9E9D24', // olive
  '#34495E', // slate
  '#FF6F91', // light magenta
  '#52B788'  // soft green
];

interface RoomsManageProps {
  rooms: Room[];
  onRoomsChange: (rooms: Room[]) => void;
  userRole: 'admin' | 'employee' | 'contact';
  // NEW: callback to refresh global rooms from backend (App-level)
  onBackendRoomsRefresh?: () => void | Promise<void>;
}

const emptyRoom = (): Room => ({ id: '', name: '', capacity: 0, equipment: [], purpose: '', color: ROOM_COLOR_PALETTE[0] });

const RoomsManage: React.FC<RoomsManageProps> = ({ rooms, onRoomsChange, userRole, onBackendRoomsRefresh }) => {
  const [editing, setEditing] = useState<Room | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  // Test dialog state for backend rooms
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [apiRooms, setApiRooms] = useState<RoomAPI[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // Persistent backend rooms section (below demo rooms)
  const [backendRooms, setBackendRooms] = useState<RoomAPI[]>([]);
  // Backend edit modal state
  const [showBackendEdit, setShowBackendEdit] = useState(false);
  const [backendEditing, setBackendEditing] = useState<RoomAPI | null>(null);
  const [backendEditName, setBackendEditName] = useState('');
  const [backendEditColor, setBackendEditColor] = useState('#000000');
  const [backendSaveLoading, setBackendSaveLoading] = useState(false);
  const [backendActionError, setBackendActionError] = useState<string | null>(null);
  // Create new backend room saving state
  const [createSaving, setCreateSaving] = useState(false);
  // NEW: relations modal state when trying to delete a backend room
  const [showRelations, setShowRelations] = useState(false);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [relationsError, setRelationsError] = useState<string | null>(null);
  const [relationsBackend, setRelationsBackend] = useState<Event[]>([]);
  const [relationsLocal, setRelationsLocal] = useState<Meeting[]>([]);
  const [relationsRoomId, setRelationsRoomId] = useState<number | null>(null);

  // Maps to resolve specialist names
  const [employeesById, setEmployeesById] = useState<Record<number, string>>({});
  const [localUsersById, setLocalUsersById] = useState<Record<string, string>>({});

  // Resolve room name for relations header
  const relationsRoom = useMemo(() => (
    relationsRoomId != null ? backendRooms.find(r => r.id === relationsRoomId) ?? null : null
  ), [backendRooms, relationsRoomId]);

  // Safe fallback if rooms prop is undefined/null
  const roomsList: Room[] = Array.isArray(rooms) ? rooms : [];

  const startAdd = () => { setEditing(emptyRoom()); setShowForm(true); };
  const startEdit = (r: Room) => { setEditing(r); setShowForm(true); };
  const cancel = () => { setEditing(null); setShowForm(false); };

  const saveRoom = async () => {
    if(!editing) return;
    if(!editing.name.trim()) return;
    // Editing existing demo room -> keep local behavior
    if(editing.id){
      const next = roomsList.map((r: Room)=> r.id===editing.id ? editing : r);
      onRoomsChange(next);
      cancel();
      return;
    }
    // Creating new room -> send to backend
    const user = loadCurrentUser();
    const token = user?.token;
    if (!token) { alert('Brak tokenu uwierzytelnienia. Zaloguj się ponownie.'); return; }
    setCreateSaving(true);
    try {
      await apiCreateRoom({ name: editing.name.trim(), hexColor: editing.color || ROOM_COLOR_PALETTE[0] }, token);
      const data = await getRooms(token);
      setBackendRooms(data);
      // inform App to refresh global rooms so MeetingForm sees updates
      onBackendRoomsRefresh && onBackendRoomsRefresh();
      cancel();
    } catch (e) {
      alert('Nie udało się utworzyć sali.');
    } finally {
      setCreateSaving(false);
    }
  };

  const removeRoom = (id: string) => {
    if(!confirm('Usuń salę?')) return;
    onRoomsChange(roomsList.filter((r: Room)=>r.id!==id));
  };

  const updateEditing = (patch: Partial<Room>) => {
    if(!editing) return;
    setEditing({ ...editing, ...patch });
  };

  // Open/close Test dialog and fetch rooms from backend
  const openTestDialog = async () => {
    setShowTestDialog(true);
    setApiLoading(true);
    setApiError(null);
    try {
      const user = loadCurrentUser();
      const token = user?.token;
      if (!token) throw new Error('Brak tokenu uwierzytelnienia. Zaloguj się ponownie.');
      const data = await getRooms(token);
      setApiRooms(data);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Nieznany błąd podczas pobierania sal.');
    } finally {
      setApiLoading(false);
    }
  };
  const closeTestDialog = () => setShowTestDialog(false);

  // Fetch backend rooms once (for the main list below demo rooms)
  useEffect(() => {
    const user = loadCurrentUser();
    const token = user?.token;
    if (!token) return; // not logged in, skip
    (async () => {
      try {
        const data = await getRooms(token);
        setBackendRooms(data);
      } catch {
        // silently ignore for the main list; user can still use Test dialog to see errors
      }
    })();
  }, []);

  // Build a set of backend room ids to avoid duplicates in the top (demo) list
  const backendIdSet = useMemo(() => new Set(backendRooms.map(r => String(r.id))), [backendRooms]);

  // Base filter by name/purpose
  const baseFiltered: Room[] = roomsList
    .filter((r: Room) => r.name.toLowerCase().includes(filter.toLowerCase()) || (r.purpose || '').toLowerCase().includes(filter.toLowerCase()));

  // Filtered demo (local + globally merged). If backendRooms are loaded, exclude backend ones to prevent duplicates.
  // If backendRooms are not available (e.g., token issue), show all rooms so the list is not empty.
  const filteredDemo: Room[] = backendRooms.length > 0
    ? baseFiltered.filter((r: Room) => !backendIdSet.has(r.id))
    : baseFiltered;

  const backendFiltered = backendRooms.filter((r: RoomAPI) => r.name.toLowerCase().includes(filter.toLowerCase()));

  // Backend actions
  const startEditBackendRoom = (r: RoomAPI) => {
    setBackendEditing(r);
    setBackendEditName(r.name);
    setBackendEditColor(ROOM_COLOR_PALETTE.includes(r.hexColor) ? r.hexColor : ROOM_COLOR_PALETTE[0]);
    setBackendActionError(null);
    setShowBackendEdit(true);
  };
  const cancelBackendEdit = () => {
    setShowBackendEdit(false);
    setBackendEditing(null);
  };
  // remove hex validation; using palette-only selection
  const saveBackendEdit = async () => {
    if (!backendEditing) return;
    const user = loadCurrentUser();
    const token = user?.token;
    if (!token) { setBackendActionError('Brak tokenu uwierzytelnienia. Zaloguj się ponownie.'); return; }
    if (!backendEditName.trim()) { setBackendActionError('Nazwa nie może być pusta.'); return; }
    setBackendSaveLoading(true);
    try {
      await apiUpdateRoom(backendEditing.id, { name: backendEditName.trim(), hexColor: backendEditColor.toUpperCase() }, token);
      const data = await getRooms(token);
      setBackendRooms(data);
      setShowBackendEdit(false);
      setBackendEditing(null);
      // inform App to refresh global rooms so MeetingForm sees updates
      onBackendRoomsRefresh && onBackendRoomsRefresh();
    } catch (err) {
      setBackendActionError(err instanceof Error ? err.message : 'Nie udało się zapisać zmian.');
    } finally {
      setBackendSaveLoading(false);
    }
  };

  // NEW: open relations modal before attempting backend delete
  const openRelationsDialog = async (roomId: number) => {
    setRelationsRoomId(roomId);
    setShowRelations(true);
    setRelationsLoading(true);
    setRelationsError(null);
    try {
      const user = loadCurrentUser();
      const token = user?.token;
      let backendEvents: Event[] = [];
      if (token) {
        try {
          const all = await fetchEvents(token);
          backendEvents = all.filter(ev => ev.roomId === roomId);
          // Fetch employees to resolve participant names
          try {
            const emps = await fetchEmployees(token);
            const map: Record<number, string> = {};
            emps.forEach(e => { map[e.id] = `${e.name} ${e.surname}`.trim(); });
            setEmployeesById(map);
          } catch {
            // ignore employees fetch failure; we'll fallback to IDs
          }
        } catch (e) {
          setRelationsError('Nie udało się pobrać wydarzeń z backendu.');
        }
      } else {
        setRelationsError('Brak tokenu uwierzytelnienia dla pobrania wydarzeń.');
      }
      const local = loadMeetings();
      const localRelated = Array.isArray(local) ? local.filter(m => m.roomId === String(roomId)) : [];
      // Load local demo users to resolve specialist names in local meetings
      try {
        const demoUsers = loadUsers();
        const map: Record<string, string> = {};
        demoUsers.forEach(u => { map[u.id] = `${u.name} ${u.surname}`.trim(); });
        setLocalUsersById(map);
      } catch {
        setLocalUsersById({});
      }
      setRelationsBackend(backendEvents);
      setRelationsLocal(localRelated as Meeting[]);
    } finally {
      setRelationsLoading(false);
    }
  };

  // Helper to render specialists list
  const renderBackendSpecialists = (ids: number[] = []) => {
    if (!ids || ids.length === 0) return '—';
    const names = ids.map(id => employeesById[id] || `ID ${id}`);
    return names.join(', ');
  };
  const renderLocalSpecialists = (m: Meeting) => {
    const ids = (m.specialistIds && m.specialistIds.length > 0) ? m.specialistIds : (m.specialistId ? [m.specialistId] : []);
    if (!ids || ids.length === 0) return '—';
    const names = ids.map(sid => {
      const nId = Number(sid);
      if (!Number.isNaN(nId) && employeesById[nId]) return employeesById[nId];
      return localUsersById[String(sid)] || `ID ${sid}`;
    });
    return names.join(', ');
  };

  const removeBackendRoom = async (id: number) => {
    if (!confirm('Usuń salę (backend)?')) return;
    console.log('[rooms] Attempting to delete backend room', { id });
    // Pre-check: if there are meetings for this room in local data, block with a helpful message
    try {
      const localMeetings = loadMeetings();
      const count = Array.isArray(localMeetings) ? localMeetings.filter(m => m.roomId === String(id)).length : 0;
      console.log('[rooms] Local meetings linked to this room before delete', { id, count });
      if (count > 0) {
        alert('Nie można usunąć sali, która ma przypisane spotkania. Najpierw usuń lub przenieś te spotkania.');
        return;
      }
    } catch (preErr) {
      console.warn('[rooms] Pre-check meetings failed (non-blocking)', preErr);
    }
    const user = loadCurrentUser();
    const token = user?.token;
    if (!token) { alert('Brak tokenu uwierzytelnienia. Zaloguj się ponownie.'); return; }
    console.log('[rooms] Sending DELETE request', { url: `${import.meta.env.VITE_API_URL}/api/rooms/${id}` });
    try {
      await apiDeleteRoom(id, token);
      console.log('[rooms] Backend room deleted successfully', { id });
      setBackendRooms(prev => prev.filter(r => r.id !== id));
      // inform App to refresh global rooms so MeetingForm sees updates
      onBackendRoomsRefresh && onBackendRoomsRefresh();
      setShowRelations(false);
      setRelationsBackend([]);
      setRelationsLocal([]);
      setRelationsRoomId(null);
    } catch (err) {
      console.error('[rooms] Delete backend room failed', { id, error: err });
      const message = err instanceof Error ? err.message : 'Nie udało się usunąć sali.';
      alert(message);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center gap-4">
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Szukaj po nazwie lub przeznaczeniu..." className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        {userRole==='admin' && (
          <div className="flex items-center gap-2">
            <button onClick={startAdd} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus className="w-4 h-4"/>Nowa sala</button>
            <button onClick={openTestDialog} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm hover:bg-gray-200">Test</button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Demo rooms grid (excluding backend duplicates) */}
        {filteredDemo.length === 0 ? (
          <p className="text-sm text-gray-500">Brak sal.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredDemo.map((r: Room)=> (
              <div key={r.id} className="border rounded-lg p-4 flex flex-col gap-2 relative" style={{borderColor: r.color||'#e5e7eb'}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded" style={{background:r.color||'#3b82f6'}} />
                    <h3 className="font-semibold text-gray-800">{r.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{r.capacity} os.</span>
                  </div>
                  {userRole==='admin' && (
                    <div className="flex items-center gap-2">
                      <button onClick={()=>startEdit(r)} className="p-2 rounded hover:bg-gray-100" title="Edytuj"><Pencil className="w-4 h-4 text-gray-600"/></button>
                      <button onClick={()=>removeRoom(r.id)} className="p-2 rounded hover:bg-gray-100" title="Usuń"><Trash2 className="w-4 h-4 text-red-600"/></button>
                    </div>
                  )}
                </div>
                {(r.purpose||r.equipment.length>0) && (
                  <div className="text-xs text-gray-600 flex flex-wrap gap-2">
                    {r.purpose && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">{r.purpose}</span>}
                    {r.equipment.map((eq: string)=> <span key={eq} className="px-2 py-0.5 bg-gray-100 rounded" title="Wyposażenie">{eq}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Separator: backend data (only when both sections exist) */}
        {backendFiltered.length > 0 && filteredDemo.length > 0 && (
          <div className="my-2 relative">
            <div className="border-t-2 border-red-500" />
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-xs font-semibold text-red-600">backend data</span>
          </div>
        )}

        {/* Backend rooms grid */}
        {backendFiltered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {backendFiltered.map(r => (
              <div key={`api-${r.id}`} className="border rounded-lg p-4 flex items-center justify-between" style={{ borderColor: r.hexColor || '#e5e7eb' }}>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded" style={{ background: r.hexColor || '#3b82f6' }} />
                  <span className="font-semibold text-gray-800">{r.name}</span>
                </div>
                {userRole==='admin' && (
                  <div className="flex items-center gap-2">
                    <button onClick={()=>startEditBackendRoom(r)} className="p-2 rounded hover:bg-gray-100" title="Edytuj"><Pencil className="w-4 h-4 text-gray-600"/></button>
                    <button onClick={()=>openRelationsDialog(r.id)} className="p-2 rounded hover:bg-gray-100" title="Usuń"><Trash2 className="w-4 h-4 text-red-600"/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Room modal (create backend room or edit demo room) */}
      {showForm && editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{editing.id ? 'Edytuj salę' : 'Nowa sala (backend)'}</h2>
              <button onClick={cancel} className="p-2 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-500"/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nazwa</label>
                <input value={editing.name} onChange={e=>updateEditing({ name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Kolor (wybierz)</label>
                <div className="grid grid-cols-5 gap-2">
                  {ROOM_COLOR_PALETTE.map(c => {
                    const selected = (editing.color || ROOM_COLOR_PALETTE[0]) === c;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={()=>updateEditing({ color: c })}
                        aria-label={`Kolor ${c}`}
                        className={`h-8 rounded-md border flex items-center justify-center relative transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${selected? 'ring-2 ring-blue-500 border-blue-600':'border-gray-300 hover:border-gray-500'}`}
                        style={{background:c, color:'#fff'}}
                        title={c}
                      >
                        {selected && <span className="w-2 h-2 rounded-full bg-white/90" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="w-5 h-5 rounded border" style={{ background: editing.color || ROOM_COLOR_PALETTE[0] }} />
              <span>{editing.color || ROOM_COLOR_PALETTE[0]}</span>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={cancel} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">Anuluj</button>
              <button onClick={saveRoom} disabled={createSaving || !editing.name.trim()} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg">
                {createSaving ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>Zapisuję...</span></>) : (editing.id ? 'Zapisz' : 'Utwórz')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backend edit modal */}
      {showBackendEdit && backendEditing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Edytuj salę (backend)</h2>
              <button onClick={cancelBackendEdit} className="p-2 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-500"/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nazwa</label>
                <input value={backendEditName} onChange={e=>setBackendEditName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Kolor (wybierz)</label>
                <div className="grid grid-cols-5 gap-2">
                  {ROOM_COLOR_PALETTE.map(c=>{
                    const selected = backendEditColor === c;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={()=>setBackendEditColor(c)}
                        aria-label={`Kolor ${c}`}
                        className={`h-8 rounded-md border flex items-center justify-center relative transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${selected? 'ring-2 ring-blue-500 border-blue-600':'border-gray-300 hover:border-gray-500'}`}
                        style={{background:c, color:'#fff'}}
                        title={c}
                      >
                        {selected && <span className="w-2 h-2 rounded-full bg-white/90" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {backendActionError && <p className="text-sm text-red-600">{backendActionError}</p>}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="w-5 h-5 rounded border" style={{ background: backendEditColor }} />
              <span>{backendEditColor}</span>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={cancelBackendEdit} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">Anuluj</button>
              <button onClick={saveBackendEdit} disabled={backendSaveLoading || !backendEditName.trim()} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg">
                {backendSaveLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>Zapisywanie...</span></>) : 'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Relations modal */}
      {showRelations && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                Powiązania sali {relationsRoom ? `„${relationsRoom.name}”` : (relationsRoomId != null ? `Sala #${relationsRoomId}` : 'Sala')}
              </h2>
              <button onClick={()=>setShowRelations(false)} className="p-2 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-500"/></button>
            </div>
            {relationsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="w-4 h-4 animate-spin"/>Ładowanie powiązań...</div>
            ) : (
              <div className="space-y-4">
                {relationsError && <p className="text-sm text-red-600">{relationsError}</p>}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Powiązane wydarzenia ({relationsBackend.length + relationsLocal.length})</h3>
                  {relationsBackend.length + relationsLocal.length === 0 ? (
                    <p className="text-sm text-gray-500">Brak powiązanych wydarzeń.</p>
                  ) : (
                    <ul className="max-h-72 overflow-auto divide-y divide-gray-200 border rounded-md">
                      {[
                        ...relationsBackend.map(ev => ({
                          key: `b-${ev.id}`,
                          id: String(ev.id),
                          title: ev.name,
                          when: `${ev.start} → ${ev.end}`,
                          specialists: renderBackendSpecialists(ev.participantIds)
                        })),
                        ...relationsLocal.map(m => ({
                          key: `l-${m.id}`,
                          id: String(m.id),
                          title: (m as any).name || m.patientName || 'Spotkanie',
                          when: `${m.date} ${m.startTime} → ${m.endTime}`,
                          specialists: renderLocalSpecialists(m)
                        }))
                      ].map(item => (
                        <li key={item.key} className="p-2 text-sm flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800">{item.title}</span>
                            <span className="text-xs text-gray-500">ID: {item.id}</span>
                          </div>
                          <div className="text-xs text-gray-600">{item.when}</div>
                          <div className="text-xs text-gray-600"><span className="text-gray-500">Specjaliści:</span> {item.specialists}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-xs text-gray-500">Aby usunąć salę, najpierw usuń lub zaktualizuj wydarzenia, które ją referencjonują.</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={()=>setShowRelations(false)} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">Zamknij</button>
              <button
                onClick={()=> relationsRoomId!=null && removeBackendRoom(relationsRoomId)}
                disabled={relationsLoading || (relationsBackend.length > 0)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg"
                title={relationsBackend.length>0 ? 'Usuń/zmień powiązane wydarzenia, aby móc usunąć salę' : 'Usuń salę'}
              >
                Usuń salę
              </button>
            </div>
          </div>
        </div>
      )}

      {showTestDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-800">Test: Sale z backendu</h2>
              <button onClick={closeTestDialog} className="p-2 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-500"/></button>
            </div>
            {apiLoading && <p className="text-sm text-gray-600">Ładowanie...</p>}
            {apiError && !apiLoading && <p className="text-sm text-red-600">{apiError}</p>}
            {!apiLoading && !apiError && (
              <ul className="divide-y divide-gray-200">
                {apiRooms.length === 0 ? (
                  <li className="py-2 text-sm text-gray-500">Brak sal.</li>
                ) : (
                  apiRooms.map((r)=> (
                    <li key={r.id} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded-sm border border-gray-300"
                          style={{ background: r.hexColor || '#e5e7eb' }}
                          title={r.hexColor || 'brak koloru'}
                          aria-label={`Kolor sali ${r.name}`}
                        />
                        <span className="font-medium text-gray-800">{r.name}</span>
                        {r.hexColor && (
                          <span className="text-xs text-gray-500">{r.hexColor}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">ID: {r.id}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
            <div className="flex justify-end pt-2">
              <button onClick={closeTestDialog} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsManage;
