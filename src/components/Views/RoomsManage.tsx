import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { Room } from '../../types';

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
}

const emptyRoom = (): Room => ({ id: '', name: '', capacity: 0, equipment: [], purpose: '', color: ROOM_COLOR_PALETTE[0] });

const RoomsManage: React.FC<RoomsManageProps> = ({ rooms, onRoomsChange, userRole }) => {
  const [editing, setEditing] = useState<Room | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');

  const startAdd = () => { setEditing(emptyRoom()); setShowForm(true); };
  const startEdit = (r: Room) => { setEditing(r); setShowForm(true); };
  const cancel = () => { setEditing(null); setShowForm(false); };

  const saveRoom = () => {
    if(!editing) return;
    if(!editing.name.trim()) return;
    let next: Room[];
    if(editing.id){
      next = rooms.map(r=> r.id===editing.id ? editing : r);
    } else {
      next = [...rooms, { ...editing, id: Date.now().toString() }];
    }
    onRoomsChange(next);
    cancel();
  };

  const removeRoom = (id: string) => {
    if(!confirm('Usuń salę?')) return;
    onRoomsChange(rooms.filter(r=>r.id!==id));
  };

  const updateEditing = (patch: Partial<Room>) => {
    if(!editing) return;
    setEditing({ ...editing, ...patch });
  };

  const filtered = rooms.filter(r=> r.name.toLowerCase().includes(filter.toLowerCase()) || (r.purpose||'').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center gap-4">
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Szukaj po nazwie lub przeznaczeniu..." className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        {userRole==='admin' && <button onClick={startAdd} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Plus className="w-4 h-4"/>Nowa sala</button>}
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {filtered.length===0 && <p className="text-sm text-gray-500">Brak sal.</p>}
        {filtered.map(r=> (
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
                {r.equipment.map(eq=> <span key={eq} className="px-2 py-0.5 bg-gray-100 rounded" title="Wyposażenie">{eq}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-800">{editing.id? 'Edytuj salę':'Nowa sala'}</h2>
              <button onClick={cancel} className="p-2 rounded hover:bg-gray-100"><X className="w-5 h-5 text-gray-500"/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nazwa</label>
                <input value={editing.name} onChange={e=>updateEditing({name:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pojemność</label>
                <input type="number" min={0} value={editing.capacity} onChange={e=>updateEditing({capacity: parseInt(e.target.value)||0})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Kolor (wybierz)</label>
                <div className="grid grid-cols-5 gap-2">
                  {ROOM_COLOR_PALETTE.map(c=>{
                    const selected = editing.color === c;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={()=>updateEditing({color:c})}
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
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Przeznaczenie</label>
                <input value={editing.purpose||''} onChange={e=>updateEditing({purpose:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Wyposażenie (oddziel przecinkami)</label>
                <input value={editing.equipment.join(', ')} onChange={e=>updateEditing({equipment: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={cancel} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">Anuluj</button>
              <button onClick={saveRoom} disabled={!editing.name.trim()} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg">Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsManage;
