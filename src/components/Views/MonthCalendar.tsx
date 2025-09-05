import React from 'react';
import { loadMeetings, saveMeetings } from '../../utils/storage';
import { Meeting } from '../../types';

const DAY_OFF_KEY = 'schedule_day_offs';
const DAYOFF_MEETING_PREFIX = 'dayoff-';

interface DayOff { id: string; specialistId: string; date: string; note?: string; groupId?: string; }
interface EmployeeLite { id: string; name: string; }
interface MonthCalendarProps { currentDate: Date; dayOffs: DayOff[]; buildDateRange: (a: string,b: string)=> string[]; formatLocalDate: (d: Date)=> string; employees?: EmployeeLite[]; defaultEmployeeId?: string; onPendingStateChange?: (hasChanges: boolean, actions: { save: ()=>void; discard: ()=>void })=> void; }

// Helpers
const formatDisplayDate = (iso: string) => { if(!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };
// Use local time instead of UTC to avoid off-by-one day issues in date picker
const formatISO = (d: Date) => { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; };

const MonthCalendar: React.FC<MonthCalendarProps> = ({ currentDate, dayOffs, buildDateRange, formatLocalDate, employees = [], defaultEmployeeId, onPendingStateChange }) => {
  // Dynamic tile height
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [tileHeight, setTileHeight] = React.useState<number>(90);
  React.useEffect(()=> { const recalc=()=>{ if(!containerRef.current) return; const rect=containerRef.current.getBoundingClientRect(); const viewportH=window.innerHeight; const bottomMargin=36; const available=viewportH-rect.top-bottomMargin; const headerRowHeight=28; const verticalPadding=16; const gapY=10; const rows=6; const totalGaps=(rows-1)*gapY; const inner=available-headerRowHeight-verticalPadding-totalGaps; const rawTile=inner/rows; const clamped=Math.max(64, Math.min(140, Math.floor(rawTile))); if(!Number.isNaN(clamped)) setTileHeight(clamped); }; recalc(); window.addEventListener('resize', recalc); return ()=> window.removeEventListener('resize', recalc); }, [currentDate]);

  // Staging
  const [localDayOffs, setLocalDayOffs] = React.useState<DayOff[]>([]); // new / edited
  const [replacedGroupIds, setReplacedGroupIds] = React.useState<string[]>([]); // edited groups hidden from baseline
  const [deletedGroupIds, setDeletedGroupIds] = React.useState<string[]>([]); // deleted groups hidden from baseline
  const hasPendingChanges = localDayOffs.length>0 || replacedGroupIds.length>0 || deletedGroupIds.length>0;

  // Baseline from storage (SOURCE OF TRUTH for month display instead of props dayOffs)
  const [baselineDayOffs, setBaselineDayOffs] = React.useState<DayOff[]>([]);
  const loadBaseline = React.useCallback(()=> { try { const raw=localStorage.getItem(DAY_OFF_KEY); setBaselineDayOffs(raw? JSON.parse(raw): []);} catch { setBaselineDayOffs([]);} }, []);
  React.useEffect(()=> { loadBaseline(); }, [loadBaseline, currentDate]);
  // If parent somehow updates dayOffs prop (external refresh), reflect that by reloading baseline (avoid unused prop lint too)
  React.useEffect(()=> { loadBaseline(); }, [dayOffs, loadBaseline]);

  // Combined (baseline minus replaced/deleted) + staging
  const existingGlobalForCollision = React.useMemo(()=> { const base = baselineDayOffs.filter(d=> !(d.groupId && (replacedGroupIds.includes(d.groupId) || deletedGroupIds.includes(d.groupId)))); return [...base, ...localDayOffs]; }, [baselineDayOffs, localDayOffs, replacedGroupIds, deletedGroupIds]);
  const allDayOffs = existingGlobalForCollision; // for edit modal open
  const displayDayOffs = React.useMemo(()=> allDayOffs.filter(d=> !defaultEmployeeId || d.specialistId === defaultEmployeeId), [allDayOffs, defaultEmployeeId]);

  // Drag create
  const [dragSelecting, setDragSelecting] = React.useState(false);
  const [dragStart, setDragStart] = React.useState<string | null>(null);
  const [dragCurrent, setDragCurrent] = React.useState<string | null>(null);
  const [showRangeModal, setShowRangeModal] = React.useState(false);
  const [rangeDates, setRangeDates] = React.useState<string[]>([]);
  const [rangeNote, setRangeNote] = React.useState('');

  // Edit modal
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editingInitialDates, setEditingInitialDates] = React.useState<string[]>([]);
  const [editingInitialNote, setEditingInitialNote] = React.useState('');
  const [editingInitialEmployees, setEditingInitialEmployees] = React.useState<string[]>([]);

  // Replace previous mouseup listener with a single robust handler that reads the end date under the cursor
  React.useEffect(()=> { const up=(e: MouseEvent)=> { setDragSelecting(prev=> { if(!prev) return prev; const start=dragStart; const getDateFromPoint = (evt: MouseEvent): string | null => { const el = document.elementFromPoint(evt.clientX, evt.clientY) as HTMLElement | null; let node: HTMLElement | null = el; while (node) { const ds = (node as HTMLElement).dataset as any; if (ds && ds.date) return ds.date as string; node = node.parentElement; } return null; }; const hovered = getDateFromPoint(e); const end = dragCurrent || hovered || start; if(start && end){ const dates=buildDateRange(start, end); if(dates.length){ setRangeDates(dates); setShowRangeModal(true);} } return false; }); setDragStart(null); setDragCurrent(null); }; window.addEventListener('mouseup', up); return ()=> window.removeEventListener('mouseup', up); }, [dragStart, dragCurrent, buildDateRange]);
  const selectedDragDates = (dragSelecting && dragStart && dragCurrent)? buildDateRange(dragStart, dragCurrent): [];
  const selectedDragSet = React.useMemo(()=> new Set(selectedDragDates), [selectedDragDates]);

  const getMonthGrid = (date: Date): Date[] => { const first=new Date(date.getFullYear(), date.getMonth(),1); const isoDow= first.getDay()===0?7:first.getDay(); const gridStart=new Date(first); gridStart.setDate(first.getDate()-(isoDow-1)); const days: Date[]=[]; for(let i=0;i<42;i++){ const d=new Date(gridStart); d.setDate(gridStart.getDate()+i); days.push(d);} return days; };

  interface EnhancedDayOffModalProps { startDatesInit: string[]; onClose: ()=> void; employees: {id:string; name:string;}[]; defaultEmployeeId?: string; initialNote: string; onSave: (dates:string[], note:string, employeeIds:string[])=> void; existingGlobal: DayOff[]; buildDateRange: (a:string,b:string)=> string[]; formatLocalDate: (d:Date)=> string; mode?: 'create'|'edit'; editingGroupId?: string | null; initialEmployees?: string[]; onDelete?: (groupId:string)=> void; }

  const CalendarPopover: React.FC<{anchorRef: React.RefObject<HTMLButtonElement>; open: boolean; onClose: ()=>void; value: string; onSelect: (iso:string)=> void; constraint?: { min?: string; max?: string; }; highlightRange?: { start?: string; end?: string; };}> = ({ anchorRef, open, onClose, value, onSelect, constraint, highlightRange }) => {
    const popRef = React.useRef<HTMLDivElement | null>(null);
    const base = value? new Date(value): new Date();
    const [month, setMonth] = React.useState(new Date(base.getFullYear(), base.getMonth(), 1));
    React.useEffect(()=> { if(value){ const v=new Date(value); setMonth(new Date(v.getFullYear(), v.getMonth(),1)); } }, [value]);
    React.useEffect(()=> { if(!open) return; const handler=(e:MouseEvent)=> { if(popRef.current?.contains(e.target as Node)) return; if(anchorRef.current?.contains(e.target as Node)) return; onClose(); }; window.addEventListener('mousedown', handler); return ()=> window.removeEventListener('mousedown', handler); }, [open,onClose,anchorRef]);
    if(!open) return null;
    const days = (()=> { const firstDow=(month.getDay()||7); const start=new Date(month); start.setDate(1-(firstDow-1)); const arr:Date[]=[]; for(let i=0;i<42;i++){ const d=new Date(start); d.setDate(start.getDate()+i); arr.push(d);} return arr; })();
    const monthLabel = month.toLocaleDateString('pl-PL',{month:'long', year:'numeric'});
    const isInRange = (iso:string)=> { if(!highlightRange?.start || !highlightRange?.end) return false; return iso>=highlightRange.start && iso<=highlightRange.end; };
    const isDisabled = (iso:string)=> { if(constraint?.min && iso<constraint.min) return true; if(constraint?.max && iso>constraint.max) return true; return false; };
    return (
      <div ref={popRef} className="absolute z-[60] mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-3 animate-fade-in" style={{left:0}}>
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={()=> setMonth(m=> new Date(m.getFullYear(), m.getMonth()-1,1))} className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600" aria-label="Poprzedni miesiąc">‹</button>
          <div className="text-sm font-semibold capitalize">{monthLabel}</div>
          <button type="button" onClick={()=> setMonth(m=> new Date(m.getFullYear(), m.getMonth()+1,1))} className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600" aria-label="Następny miesiąc">›</button>
        </div>
        <div className="grid grid-cols-7 text-[10px] font-medium text-gray-500 mb-1 select-none">{['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d=> <div key={d} className="text-center py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {days.map((d,i)=> { const iso=formatISO(d); const inMonth=d.getMonth()===month.getMonth(); const selected=value && iso===value; const disabled=isDisabled(iso); const inRange=isInRange(iso)&&!selected; const today=formatISO(new Date())===iso; return (
            <button key={i} type="button" disabled={disabled} onClick={()=> { if(disabled) return; onSelect(iso); onClose(); }} className={`h-8 rounded-md flex items-center justify-center font-medium transition relative ${disabled? 'text-gray-300 cursor-not-allowed': selected? 'bg-blue-600 text-white shadow':'hover:bg-blue-50 text-gray-700'} ${!inMonth && !selected? 'opacity-40':''}`}>{
              <span className={`relative ${today && !selected? 'after:absolute after:-inset-1 after:rounded-md after:ring-1 after:ring-blue-300':''}`}>{d.getDate()}</span>
            }{inRange && <span className="absolute inset-0 bg-blue-200/40 rounded-md -z-10" />}</button>
          ); })}
        </div>
      </div>
    );
  };

  const EnhancedDayOffModal: React.FC<EnhancedDayOffModalProps> = ({ startDatesInit, onClose, employees, defaultEmployeeId, initialNote, onSave, existingGlobal, buildDateRange, mode='create', editingGroupId, initialEmployees = [], onDelete }) => {
    const [start, setStart] = React.useState(startDatesInit[0] || '');
    const [end, setEnd] = React.useState(startDatesInit[startDatesInit.length-1] || '');
    const [note, setNote] = React.useState(initialNote);
    const [pickerOpen, setPickerOpen] = React.useState<null | 'start' | 'end'>(null);
    const startBtnRef = React.useRef<HTMLButtonElement | null>(null); const endBtnRef = React.useRef<HTMLButtonElement | null>(null);
    const [selected, setSelected] = React.useState<string[]>(() => { if(mode==='edit' && initialEmployees.length) return [...initialEmployees]; return defaultEmployeeId? [defaultEmployeeId]: []; });
    const [touched, setTouched] = React.useState(false);

    React.useEffect(()=> { if(start && end && start > end) setEnd(start); }, [start]);
    React.useEffect(()=> { if(start && end && end < start) setStart(end); }, [end]);

    const dates = (start && end) ? buildDateRange(start, end) : [];
    const globalForCollision = React.useMemo(()=> { if(mode==='edit' && editingGroupId) return existingGlobal.filter(e=> e.groupId !== editingGroupId); return existingGlobal; }, [existingGlobal, mode, editingGroupId]);
    const collisionMap: Record<string, string[]> = {};
    if(dates.length && selected.length){ selected.forEach(emp => { dates.forEach(d => { if(globalForCollision.some(x=> x.specialistId===emp && x.date===d)){ (collisionMap[emp] ||= []).push(d); } }); }); }
    Object.keys(collisionMap).forEach(k=> { collisionMap[k] = Array.from(new Set(collisionMap[k])).sort(); });
    const hasCollisions = Object.keys(collisionMap).length>0;
    const toggleEmp = (id:string)=> setSelected(prev=> prev.includes(id)? prev.filter(x=> x!==id): [...prev,id]);
    const disabledSave = !dates.length || !selected.length || hasCollisions;
    const handleSave = () => { if(disabledSave) return; const uniqueSelected = Array.from(new Set(selected)); onSave(dates, note, uniqueSelected); };
    const openPicker = (which:'start'|'end')=> { setTouched(true); setPickerOpen(which); };

    return (
      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-2xl w-full max-w-5xl border border-gray-100 overflow-hidden animate-fade-in-up">
        <div className="relative px-8 pt-8 pb-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500" />
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-lg ring-4 ring-blue-500/20">{mode==='edit'? 'ED':'ND'}</div>
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 tracking-tight">{mode==='edit'? 'Edytuj niedostępność':'Nowa niedostępność'}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{mode==='edit'? 'Aktualizuj zakres, pracowników i notatkę':'Zdefiniuj zakres dat oraz pracowników'}</p>
              </div>
            </div>
            <button onClick={onClose} className="self-start text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1" aria-label="Zamknij">✕</button>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-2 space-y-5">
              <div className="space-y-3 relative">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Zakres dat</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <button ref={startBtnRef} type="button" onClick={()=> openPicker('start')} className="w-full rounded-lg border border-gray-300 bg-white/80 px-3 py-2.5 text-left text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition flex items-center justify-between">
                      <span className={start? 'text-gray-900':'text-gray-400'}>{start? formatDisplayDate(start): 'DD/MM/RRRR'}</span>
                      <span className="text-gray-400">📅</span>
                    </button>
                    <CalendarPopover anchorRef={startBtnRef} open={pickerOpen==='start'} onClose={()=> setPickerOpen(p=> p==='start'? null: p)} value={start} onSelect={(iso)=> { setStart(iso); if(end && iso > end) setEnd(iso); }} highlightRange={{ start, end }} constraint={{ max: end || undefined }} />
                  </div>
                  <div className="text-gray-400 text-sm font-medium">→</div>
                  <div className="flex-1 relative">
                    <button ref={endBtnRef} type="button" onClick={()=> openPicker('end')} className="w-full rounded-lg border border-gray-300 bg-white/80 px-3 py-2.5 text-left text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition flex items-center justify-between">
                      <span className={end? 'text-gray-900':'text-gray-400'}>{end? formatDisplayDate(end): 'DD/MM/RRRR'}</span>
                      <span className="text-gray-400">📅</span>
                    </button>
                    <CalendarPopover anchorRef={endBtnRef} open={pickerOpen==='end'} onClose={()=> setPickerOpen(p=> p==='end'? null: p)} value={end} onSelect={(iso)=> { setEnd(iso); if(start && start > iso) setStart(iso); }} highlightRange={{ start, end }} constraint={{ min: start || undefined }} />
                  </div>
                </div>
                <div className="flex gap-4 text-[11px] text-gray-500"><div><span className="font-semibold text-gray-700">Dni:</span> {dates.length || '—'}</div><div><span className="font-semibold text-gray-700">Pracownicy:</span> {selected.length}</div></div>
                {hasCollisions && <div className="mt-2 rounded-md bg-red-50 border border-red-200 p-2 text-[11px] text-red-700">Kolizje – usuń lub odznacz konflikty aby zapisać.</div>}
              </div>
              <div className="space-y-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Pracownicy</label>
                {employees.length ? (
                  <div className="flex flex-wrap gap-2">
                    {employees.map(emp=> { const active=selected.includes(emp.id); const empConflict=collisionMap[emp.id]?.length; return (
                      <button key={emp.id} type="button" onClick={()=> toggleEmp(emp.id)} className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 flex items-center gap-2 ${active? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-500':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} ${empConflict? 'ring-2 ring-red-400/70': ''}`}> <span>{emp.name}</span>{empConflict && <span className="bg-red-600 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full" title={`Kolizje: ${collisionMap[emp.id].join(', ')}`}>{empConflict}</span>} </button>
                    ); })}
                  </div>
                ) : <div className="text-xs text-gray-500 italic">Brak listy pracowników</div>}
                {hasCollisions && (
                  <ul className="pl-4 list-disc text-[11px] text-red-700 space-y-0.5">
                    {Object.entries(collisionMap).map(([emp, ds])=> { const name=employees.find(e=> e.id===emp)?.name || emp; return <li key={emp}><span className="font-semibold">{name}:</span> {ds.join(', ')}</li>; })}
                  </ul>
                )}
              </div>
            </div>
            <div className="md:col-span-3 flex flex-col">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Notatka (opcjonalnie)</label>
              <div className="relative flex-1">
                <textarea value={note} onChange={e=> setNote(e.target.value)} className="w-full h-full min-h-[200px] rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-sm leading-relaxed focus:border-violet-500 focus:ring-4 focus:ring-violet-500/30 resize-y shadow-inner transition placeholder:text-gray-400" placeholder="Powód / dodatkowe informacje" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/70 to-transparent rounded-b-xl" />
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-[11px] text-gray-500 min-h-[14px]">{touched && !dates.length && 'Wybierz prawidłowy zakres dat.'}{hasCollisions && ' Usuń kolizje aby zapisać.'}</div>
            <div className="flex gap-3 justify-end flex-wrap">
              {mode==='edit' && editingGroupId && onDelete && <button type="button" onClick={()=> { onDelete(editingGroupId); }} className="px-5 py-2.5 text-sm font-medium rounded-lg border border-red-300 bg-white text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 transition">Usuń</button>}
              <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium rounded-lg border border-gray-300 bg-white/80 backdrop-blur hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition">Anuluj</button>
              <button type="button" disabled={disabledSave} onClick={handleSave} className={`relative px-6 py-2.5 text-sm font-semibold rounded-lg text-white shadow focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed transition ${disabledSave? 'bg-gray-300':'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500'}`}>{mode==='edit'? 'Zapisz zmiany':'Zapisz'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const openEditGroup = (groupId: string) => {
    try {
      const raw=localStorage.getItem(DAY_OFF_KEY);
      const all: DayOff[] = raw? JSON.parse(raw): [];
      const groupEntries = all.filter(d=> d.groupId===groupId);
      const entries = groupEntries.length? groupEntries : allDayOffs.filter(d=> d.groupId===groupId);
      if(!entries.length) return;
      const uniqueDates = Array.from(new Set(entries.map(e=> e.date))).sort();
      const uniqueEmployees = Array.from(new Set(entries.map(e=> e.specialistId)));
      const note = entries[0]?.note || '';
      setEditingGroupId(groupId);
      setEditingInitialDates(uniqueDates);
      setEditingInitialEmployees(uniqueEmployees);
      setEditingInitialNote(note);
      setShowEditModal(true);
    } catch {}
  };

  const saveDayOffChanges = React.useCallback(()=> {
    try {
      const raw = localStorage.getItem(DAY_OFF_KEY);
      const existing: DayOff[] = raw? JSON.parse(raw): [];
      const next = existing.filter(d=> !(d.groupId && (replacedGroupIds.includes(d.groupId) || deletedGroupIds.includes(d.groupId))));
      const finalData = [...next, ...localDayOffs];
      localStorage.setItem(DAY_OFF_KEY, JSON.stringify(finalData));

      // Additionally, mirror day-offs as meetings without a room
      const currentMeetings: Meeting[] = loadMeetings();
      const meetingsWithoutDayOffs = currentMeetings.filter(m=> !m.id.startsWith(DAYOFF_MEETING_PREFIX));
      const dayoffMeetings: Meeting[] = finalData.map(off => ({
        id: `${DAYOFF_MEETING_PREFIX}${off.groupId || 'single'}-${off.specialistId}-${off.date}`,
        specialistId: off.specialistId,
        patientName: 'Niedostępność',
        roomId: '', // no room assigned
        date: off.date,
        startTime: '00:00',
        endTime: '23:59',
        notes: off.note || '',
        status: 'cancelled',
        createdBy: 'system',
        // optional multi-specialist cache fields kept empty/not used
      } as Meeting));
      saveMeetings([...meetingsWithoutDayOffs, ...dayoffMeetings]);

      setLocalDayOffs([]); setReplacedGroupIds([]); setDeletedGroupIds([]); loadBaseline();
    } catch(e){ console.warn('Save dayOff staged changes failed', e); }
  }, [localDayOffs, replacedGroupIds, deletedGroupIds, loadBaseline]);

  const discardDayOffChanges = React.useCallback(()=> { setLocalDayOffs([]); setReplacedGroupIds([]); setDeletedGroupIds([]); loadBaseline(); }, [loadBaseline]);

  React.useEffect(()=> { if(onPendingStateChange) onPendingStateChange(hasPendingChanges, { save: saveDayOffChanges, discard: discardDayOffChanges }); }, [hasPendingChanges, onPendingStateChange, saveDayOffChanges, discardDayOffChanges]);

  return (
    <div ref={containerRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col mb-4">
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded overflow-hidden text-[11px] font-medium text-gray-600 mb-2">{['Pon','Wt','Śr','Czw','Pt','Sob','Nd'].map(d=> <div key={d} className="bg-white py-1 text-center">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-[10px] flex-1 select-none">
        {getMonthGrid(currentDate).map((d,i)=> {
          const inMonth = d.getMonth()===currentDate.getMonth();
          const dateStr = formatLocalDate(d);
          const dayOffEntry = displayDayOffs.find(off=> off.date===dateStr);
          const isDayOff = !!dayOffEntry;
          const groupId = dayOffEntry?.groupId;
          const todayStr = formatLocalDate(new Date());
          const isToday = dateStr===todayStr;
          const weekdayIdx = ((d.getDay()===0?7:d.getDay())-1);
          const prevDate=new Date(d); prevDate.setDate(prevDate.getDate()-1); const prevStr=formatLocalDate(prevDate); const prevWeekdayIdx=((prevDate.getDay()===0?7:prevDate.getDay())-1); const prevSameRow= prevWeekdayIdx < weekdayIdx; const prevEntry=displayDayOffs.find(off=> off.date===prevStr); const prevEntrySameGroup = !!(prevEntry && prevEntry.groupId===groupId);
          const leftConnected=!!(groupId && prevSameRow && prevEntry && prevEntry.groupId===groupId);
          const nextDate=new Date(d); nextDate.setDate(nextDate.getDate()+1); const nextStr=formatLocalDate(nextDate); const nextWeekdayIdx=((nextDate.getDay()===0?7:nextDate.getDay())-1); const nextSameRow= nextWeekdayIdx > weekdayIdx; const nextEntry=displayDayOffs.find(off=> off.date===nextStr); const rightConnected=!!(groupId && nextSameRow && nextEntry && nextEntry.groupId===groupId);
          const groupShapeClasses = isDayOff ? (leftConnected && rightConnected? 'rounded-none border-l-0': leftConnected? 'rounded-r-md rounded-l-none border-l-0': rightConnected? 'rounded-l-md rounded-r-none':'rounded-md') : 'rounded-lg';
          const isInDragSelection = selectedDragSet.has(dateStr) && !isDayOff;
          const isFirstOfGroup = isDayOff && !prevEntrySameGroup;
          return (
            <div key={i} style={{height:tileHeight}} data-date={dateStr} className={`relative flex flex-col justify-start p-1.5 text-[11px] font-medium h-full transition-colors border ${inMonth? '' : 'opacity-40'} ${isDayOff? 'bg-red-200 text-red-900 border-red-300 cursor-pointer':'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'} ${isInDragSelection? 'ring-2 ring-red-400 ring-offset-1 bg-red-50':''} ${groupShapeClasses}`}
              onMouseDown={(e)=> { if(e.button!==0) return; if(isDayOff && groupId){ e.stopPropagation(); openEditGroup(groupId); return; } setDragSelecting(true); setDragStart(dateStr); setDragCurrent(dateStr); }}
              onMouseEnter={()=> { if(dragSelecting) setDragCurrent(dateStr); }}>
              {isDayOff && leftConnected && <div className="absolute top-0 left-[-8px] h-full w-8 bg-red-200 pointer-events-none z-0" />}
              {isDayOff && rightConnected && <div className="absolute top-0 right-[-8px] h-full w-8 bg-red-200 pointer-events-none z-0" />}
              {isFirstOfGroup && dayOffEntry?.note && (<div className="absolute bottom-1 left-1 right-1 text-[10px] text-red-700 opacity-80 truncate pointer-events-none">{dayOffEntry.note}</div>)}
              <span className={`z-10 relative ${isToday? 'border border-blue-400 rounded-full px-1 py-0.5 bg-blue-50':''}`}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      {showRangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <EnhancedDayOffModal
            startDatesInit={rangeDates}
            onClose={()=> { setShowRangeModal(false); setRangeDates([]); setRangeNote(''); }}
            employees={employees}
            defaultEmployeeId={defaultEmployeeId}
            initialNote={rangeNote}
            existingGlobal={existingGlobalForCollision}
            buildDateRange={buildDateRange}
            formatLocalDate={formatLocalDate}
            onSave={(dates,note,empIds)=> { if(!dates.length || !empIds.length) return; const unique = Array.from(new Set(empIds)); const groupId='grp-'+Date.now(); const newEntries: DayOff[]=[]; unique.forEach(emp=> dates.forEach(dt=> newEntries.push({ id: groupId+'-'+emp+'-'+dt, specialistId: emp, date: dt, note, groupId }))); setLocalDayOffs(p=> [...p, ...newEntries]); setShowRangeModal(false); setRangeNote(''); setRangeDates([]); }}
            mode="create"
          />
        </div>
      )}
      {showEditModal && editingGroupId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <EnhancedDayOffModal
            startDatesInit={editingInitialDates}
            onClose={()=> { setShowEditModal(false); setEditingGroupId(null); }}
            employees={employees}
            defaultEmployeeId={defaultEmployeeId}
            initialNote={editingInitialNote}
            initialEmployees={editingInitialEmployees}
            existingGlobal={existingGlobalForCollision}
            buildDateRange={buildDateRange}
            formatLocalDate={formatLocalDate}
            onSave={(dates,note,empIds)=> { if(!editingGroupId) return; if(!dates.length || !empIds.length){ setShowEditModal(false); setEditingGroupId(null); return; } const entries=empIds.flatMap(emp=> dates.map(dt=> ({ id: editingGroupId+'-'+emp+'-'+dt, specialistId: emp, date: dt, note, groupId: editingGroupId }))); setLocalDayOffs(prev=> prev.filter(d=> d.groupId !== editingGroupId).concat(entries)); setReplacedGroupIds(prev=> prev.includes(editingGroupId)? prev : [...prev, editingGroupId]); setShowEditModal(false); setEditingGroupId(null); }}
            mode="edit"
            editingGroupId={editingGroupId}
            onDelete={(gid)=> { if(!gid) return; setReplacedGroupIds(p=> p.includes(gid)? p : [...p,gid]); setDeletedGroupIds(p=> p.includes(gid)? p : [...p,gid]); setLocalDayOffs(p=> p.filter(d=> d.groupId !== gid)); setShowEditModal(false); setEditingGroupId(null); }}
          />
        </div>
      )}
    </div>
  );
};

export default MonthCalendar;
