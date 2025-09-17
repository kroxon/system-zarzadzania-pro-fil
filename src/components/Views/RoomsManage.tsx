import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { Room, RoomAPI, Meeting, Event } from '../../types';
import { getRooms, updateRoom as apiUpdateRoom, deleteRoom as apiDeleteRoom, createRoom as apiCreateRoom } from '../../utils/api/rooms';
import { loadCurrentUser, loadMeetings } from '../../utils/storage';
import { fetchEvents } from '../../utils/api/events';
// import { fetchEmployees } from '../../utils/api/employees';

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

// Helper: convert hex color to rgba string with desired alpha (for faded backgrounds)
const hexToRGBA = (hex: string, alpha = 0.12): string => {
  if (!hex) return `rgba(229, 231, 235, ${alpha})`; // gray-200 fallback
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(229, 231, 235, ${alpha})`;
};

interface RoomsManageProps {
  rooms: Room[];
  onRoomsChange: (rooms: Room[]) => void;
  userRole: 'admin' | 'employee' | 'contact';
  // NEW: callback to refresh global rooms from backend (App-level)
  onBackendRoomsRefresh?: () => void | Promise<void>;
}

const emptyRoom = (): Room => ({ id: '', name: '', hexColor: ROOM_COLOR_PALETTE[0] });

const RoomsManage: React.FC<RoomsManageProps> = ({ rooms, onRoomsChange, userRole, onBackendRoomsRefresh }) => {
  const [editing, setEditing] = useState<Room | null>(null);
  const [showForm, setShowForm] = useState(false);
  // removed search/filter
  // removed Test dialog state
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

  // Removed maps for specialist name resolution (dialog simplified)

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
  await apiCreateRoom({ name: editing.name.trim(), hexColor: editing.hexColor || ROOM_COLOR_PALETTE[0] }, token);
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
        // silently ignore for the main list
      }
    })();
  }, []);

  // Build a set of backend room ids to avoid duplicates in the top (demo) list
  const backendIdSet = useMemo(() => new Set(backendRooms.map(r => String(r.id))), [backendRooms]);

  // Non-filtered lists (search removed)
  const demoRooms: Room[] = backendRooms.length > 0
    ? roomsList.filter((r: Room) => !backendIdSet.has(r.id))
    : roomsList;
  const backendList = backendRooms;

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
        } catch (e) {
          setRelationsError('Nie udało się pobrać wydarzeń z backendu.');
        }
      } else {
        setRelationsError('Brak tokenu uwierzytelnienia dla pobrania wydarzeń.');
      }
      const local = loadMeetings();
      const localRelated = Array.isArray(local) ? local.filter(m => m.roomId === String(roomId)) : [];
      setRelationsBackend(backendEvents);
      setRelationsLocal(localRelated as Meeting[]);
    } finally {
      setRelationsLoading(false);
    }
  };

  // Specialists renderers removed; simplified dialog no longer lists detailed events

  const removeBackendRoom = async (id: number) => {
    console.log('[rooms] Attempting to delete backend room', { id });
    // Note: allow deletion even if there are related meetings; those meetings will no longer be visible w grafiku,
    // but pozostaną dostępne w raportach i historii spotkań (zgodnie z wymaganiami UI).
    const user = loadCurrentUser();
    const token = user?.token;
    if (!token) { setRelationsError('Brak tokenu uwierzytelnienia. Zaloguj się ponownie.'); return; }
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
      setRelationsError(message);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center gap-4">
        {/* removed search input */}
        {userRole==='admin' && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={startAdd} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus className="w-4 h-4"/>Nowa sala</button>
            {/* removed Test button */}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Demo rooms section with header and modern grid */}
        {demoRooms.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Sale lokalne</h3>
            </div>
            <div className="grid auto-rows-[1fr] gap-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
              {demoRooms.map((r: Room)=> (
                <div
                  key={r.id}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200/70 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition"
                  style={{ backgroundColor: hexToRGBA(r.hexColor || '#e5e7eb', 0.12) }}
                >
                  <div className="absolute inset-y-0 left-0 w-1.5" style={{background: r.hexColor||'#e5e7eb'}} />
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate" title={r.name}>{r.name}</h3>
                        </div>
                      </div>
                      {userRole==='admin' && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 translate-y-1 transition group-hover:opacity-100 group-hover:translate-y-0">
                          <button onClick={()=>startEdit(r)} className="p-2 rounded-md bg-transparent hover:bg-transparent transition-transform duration-150 ease-out hover:scale-110" title="Edytuj">
                            <Pencil className="w-4 h-4 text-gray-600"/>
                          </button>
                          <button onClick={()=>removeRoom(r.id)} className="p-2 rounded-md bg-transparent hover:bg-transparent transition-transform duration-150 ease-out hover:scale-110" title="Usuń">
                            <Trash2 className="w-4 h-4 text-red-600"/>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Separator: backend data (only when both sections exist) */}
        {backendList.length > 0 && demoRooms.length > 0 && (
          <div className="my-2 relative">
            <div className="border-t-2 border-red-500" />
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-xs font-semibold text-red-600">backend data</span>
          </div>
        )}

        {/* Backend rooms section with header and modern grid */}
        {backendList.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Sale w siedzibie fundacji</h3>
            </div>
            <div className="grid auto-rows-[1fr] gap-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
              {backendList.map(r => (
                <div
                  key={`api-${r.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200/70 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition"
                  style={{ backgroundColor: hexToRGBA(r.hexColor || '#e5e7eb', 0.12) }}
                >
                  <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: r.hexColor || '#e5e7eb' }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-gray-900 truncate" title={r.name}>{r.name}</span>
                        </div>
                      </div>
                      {userRole==='admin' && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 translate-y-1 transition group-hover:opacity-100 group-hover:translate-y-0">
                          <button onClick={()=>startEditBackendRoom(r)} className="p-2 rounded-md bg-transparent hover:bg-transparent transition-transform duration-150 ease-out hover:scale-110" title="Edytuj">
                            <Pencil className="w-4 h-4 text-gray-600"/>
                          </button>
                          <button onClick={()=>openRelationsDialog(r.id)} className="p-2 rounded-md bg-transparent hover:bg-transparent transition-transform duration-150 ease-out hover:scale-110" title="Usuń">
                            <Trash2 className="w-4 h-4 text-red-600"/>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* removed ID footer */}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Combined empty state: no demo and no backend rooms */}
        {demoRooms.length === 0 && backendList.length === 0 && (
          <p className="text-sm text-gray-500">Brak sal.</p>
        )}
      </div>

      {/* New Room modal (create backend room or edit demo room) */}
      {showForm && editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{editing.id ? 'Edytuj salę' : 'Nowa sala'}</h2>
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
                    const selected = (editing.hexColor || ROOM_COLOR_PALETTE[0]) === c;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={()=>updateEditing({ hexColor: c })}
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
              <div className="w-5 h-5 rounded border" style={{ background: editing.hexColor || ROOM_COLOR_PALETTE[0] }} />
              <span>{editing.hexColor || ROOM_COLOR_PALETTE[0]}</span>
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
                  <h3 className="text-sm font-semibold text-gray-700">Powiązane spotkania</h3>
                  <p className="text-sm text-gray-700">Liczba powiązanych spotkań: <span className="font-semibold">{relationsBackend.length + relationsLocal.length}</span></p>
                  <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-md p-3">
                    Po usunięciu sali istniejące spotkania nie będą widoczne w grafiku, ale pozostaną dostępne w raportach i historii spotkań.
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={()=>setShowRelations(false)} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">Zamknij</button>
              <button
                onClick={()=> relationsRoomId!=null && removeBackendRoom(relationsRoomId)}
                disabled={relationsLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg"
                title="Usuń salę"
              >
                Usuń salę
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsManage;
