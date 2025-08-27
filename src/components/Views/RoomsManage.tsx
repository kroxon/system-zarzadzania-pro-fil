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
  userRole: 'admin' | 'employee';
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
    <div className="room-manage">
      <div className="room-manage__header">
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Szukaj po nazwie lub przeznaczeniu..." className="form-input room-manage__filter" />
        {userRole==='admin' && <button onClick={startAdd} className="btn btn-primary btn-small" style={{display:'inline-flex',alignItems:'center',gap:8}}><Plus className="w-4 h-4"/>Nowa sala</button>}
      </div>
      <div className="room-manage__list styled-scrollbar">
        {filtered.length===0 && <p className="small-muted">Brak sal.</p>}
        {filtered.map(r=> (
          <div key={r.id} className="room-item" style={{borderColor: r.color||'var(--color-border)'}}>
            <div className="room-item__top">
              <div className="room-item__meta">
                <div className="room-color" style={{background:r.color||'#3b82f6'}} />
                <h3 style={{fontSize:'var(--text-sm)', fontWeight:600, color:'var(--color-text-secondary)'}}>{r.name}</h3>
                <span className="room-capacity">{r.capacity} os.</span>
              </div>
              {userRole==='admin' && (
                <div className="room-actions">
                  <button onClick={()=>startEdit(r)} className="icon-btn" title="Edytuj"><Pencil className="w-4 h-4 text-gray-600"/></button>
                  <button onClick={()=>removeRoom(r.id)} className="icon-btn icon-btn--danger" title="Usuń"><Trash2 className="w-4 h-4 text-red-600"/></button>
                </div>
              )}
            </div>
            {(r.purpose||r.equipment.length>0) && (
              <div className="room-item__badges">
                {r.purpose && <span className="room-badge">{r.purpose}</span>}
                {r.equipment.map(eq=> <span key={eq} className="room-equip" title="Wyposażenie">{eq}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && editing && (
        <div className="room-form-overlay">
          <div className="room-form styled-scrollbar">
            <div className="room-form__header">
              <h2 style={{fontSize:'var(--text-lg)', fontWeight:600, color:'var(--color-text-secondary)'}}>{editing.id? 'Edytuj salę':'Nowa sala'}</h2>
              <button onClick={cancel} className="icon-btn" aria-label="Zamknij"><X className="w-5 h-5 text-gray-500"/></button>
            </div>
            <div className="room-form__grid">
              <div className="col-span-2">
                <label className="form-label">Nazwa</label>
                <input value={editing.name} onChange={e=>updateEditing({name:e.target.value})} className="form-input" />
              </div>
              <div>
                <label className="form-label">Pojemność</label>
                <input type="number" min={0} value={editing.capacity} onChange={e=>updateEditing({capacity: parseInt(e.target.value)||0})} className="form-input" />
              </div>
              <div className="col-span-2">
                <label className="form-label">Kolor (wybierz)</label>
                <div className="color-palette">
                  {ROOM_COLOR_PALETTE.map(c=>{
                    const selected = editing.color === c;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={()=>updateEditing({color:c})}
                        aria-label={`Kolor ${c}`}
                        className={`color-swatch ${selected? 'selected':''}`}
                        style={{background:c, color:'#fff'}}
                        title={c}
                      >
                        {selected && <span />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="col-span-2">
                <label className="form-label">Przeznaczenie</label>
                <input value={editing.purpose||''} onChange={e=>updateEditing({purpose:e.target.value})} className="form-input" />
              </div>
              <div className="col-span-2">
                <label className="form-label">Wyposażenie (oddziel przecinkami)</label>
                <input value={editing.equipment.join(', ')} onChange={e=>updateEditing({equipment: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="form-input" />
              </div>
            </div>
            <div className="room-form__footer">
              <button onClick={cancel} className="btn btn-secondary">Anuluj</button>
              <button onClick={saveRoom} disabled={!editing.name.trim()} className="btn btn-primary" style={{opacity:!editing.name.trim()?0.6:1}}>Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsManage;
