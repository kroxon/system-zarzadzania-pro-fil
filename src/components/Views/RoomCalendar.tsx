import React, { useState, useEffect, useRef } from 'react';
import CalendarHeader from '../Calendar/CalendarHeader';
import MeetingForm from '../Forms/MeetingForm';
import { generateTimeSlots } from '../../utils/timeSlots';
import { User, Room, Meeting } from '../../types';

const SLOT_HEIGHT = 24;
const SLOT_GAP = 2;
const TIME_COL_WIDTH = 60; // minimal width to fit HH:MM without wrapping

// Utility: derive lighter background + contrast text from base room color
function deriveRoomColors(hex?: string){
  const base = (hex||'#94a3b8').replace('#','');
  if(!/^([0-9a-fA-F]{6})$/.test(base)) return { bg:'#e5e7eb', border:'#9ca3af', text:'#1f2937'};
  const r=parseInt(base.slice(0,2),16), g=parseInt(base.slice(2,4),16), b=parseInt(base.slice(4,6),16);
  const lf = 0.18; // vivid lighten factor
  const lr = Math.round(r + (255-r)*lf);
  const lg = Math.round(g + (255-g)*lf);
  const lb = Math.round(b + (255-b)*lf);
  const toHex = (n:number)=> n.toString(16).padStart(2,'0');
  const bg = `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
  const bf = 0.15; const br=Math.round(lr*bf + r*(1-bf)); const bg2=Math.round(lg*bf + g*(1-bf)); const bb=Math.round(lb*bf + b*(1-bf));
  const border = `#${toHex(br)}${toHex(bg2)}${toHex(bb)}`;
  // luminance helper (linearized sRGB)
  const srgbToLin = (c:number)=>{ const cs=c/255; return cs<=0.03928? cs/12.92 : Math.pow((cs+0.055)/1.055,2.4); };
  const lumBg = 0.2126*srgbToLin(lr)+0.7152*srgbToLin(lg)+0.0722*srgbToLin(lb);
  const whiteLum = 1;
  const darkHex = '#111827';
  const dr=0x11, dg=0x18, db=0x27; // 17,24,39
  const lumDark = 0.2126*srgbToLin(dr)+0.7152*srgbToLin(dg)+0.0722*srgbToLin(db);
  const contrast = (l1:number,l2:number)=> (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
  const contrastWhite = contrast(lumBg, whiteLum);
  const contrastDark = contrast(lumBg, lumDark);
  const text = contrastWhite >= contrastDark ? '#ffffff' : darkHex;
  return { bg, border, text };
}

function getRoomStyle(room: Room | undefined){
  if(!room) return { backgroundColor:'#e5e7eb', borderColor:'#9ca3af', color:'#1f2937' };
  const { bg, border, text } = deriveRoomColors(room.color);
  return { backgroundColor: bg, borderColor: border, color: text };
}

interface RoomCalendarProps { users: User[]; rooms: Room[]; meetings: Meeting[]; currentUser: User; onMeetingCreate: (m: Omit<Meeting,'id'>) => void; onMeetingUpdate: (id:string, u:Partial<Meeting>)=>void; onMeetingDelete?: (id:string)=>void; showWeekends:boolean; startHour:number; endHour:number; }

const RoomCalendar: React.FC<RoomCalendarProps> = ({ users, rooms, meetings, currentUser, onMeetingCreate, onMeetingUpdate, onMeetingDelete, showWeekends, startHour, endHour }) => {
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'day'|'week'|'month'>('week');
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedEndTime, setSelectedEndTime] = useState<string | undefined>(undefined);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | undefined>();
  const [formRoomId, setFormRoomId] = useState<string | undefined>(undefined);

  // Drag select
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ date:string; time:string; roomId?:string; dayKey?:string;} | null>(null);
  const [selectionCurrentTime, setSelectionCurrentTime] = useState<string | null>(null);

  // Resize
  const [resizingMeetingId, setResizingMeetingId] = useState<string | null>(null);
  const [resizeEdge, setResizeEdge] = useState<'start' | 'end' | null>(null);
  // remove draft start/end live mutation -> use ghost overlay instead
  const [resizeMeta, setResizeMeta] = useState<{ startIdx:number; endIdx:number; initialMouseY:number; date:string; roomId:string;} | null>(null);
  const [resizeGhostSlotDelta, setResizeGhostSlotDelta] = useState(0);
  const [resizePixelOffset, setResizePixelOffset] = useState(0);
  // Click (short press) tracking for meetings
  const [pointerDownMeeting, setPointerDownMeeting] = useState<{ id:string; y:number; t:number; dateStr:string; roomId:string } | null>(null);

  // Move (drag whole block)
  const [movingMeetingId, setMovingMeetingId] = useState<string | null>(null);
  const [moveMeta, setMoveMeta] = useState<{ startIdx:number; endIdx:number; initialMouseY:number; date:string; roomId:string;} | null>(null);
  const [movePixelOffset, setMovePixelOffset] = useState(0); // smooth drag remainder
  const [moveGhostSlotDelta, setMoveGhostSlotDelta] = useState(0); // how many slots ghost shifted
  const [conflictMessage, setConflictMessage] = useState<string|null>(null);
  const [conflictFlashId, setConflictFlashId] = useState<string|null>(null);
  // tooltip state (global, cursor-follow)
  const [hoverTooltip, setHoverTooltip] = useState<{ x:number; y:number; text:string }|null>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const pendingTooltipRef = useRef<{ text:string; x:number; y:number } | null>(null);
  const scheduleTooltip = (text:string, x:number, y:number) => {
    if(tooltipTimerRef.current) window.clearTimeout(tooltipTimerRef.current);
    pendingTooltipRef.current = { text, x, y };
    tooltipTimerRef.current = window.setTimeout(()=>{
      if(pendingTooltipRef.current){
        const { text, x, y } = pendingTooltipRef.current;
        setHoverTooltip({ text, x, y });
      }
    },500);
  };
  const updateTooltipPosition = (x:number, y:number) => {
    if(hoverTooltip){
      setHoverTooltip(prev=> prev? { ...prev, x, y }: prev);
    } else if(pendingTooltipRef.current){
      pendingTooltipRef.current.x = x;
      pendingTooltipRef.current.y = y;
    }
  };
  const cancelTooltip = () => {
    if(tooltipTimerRef.current){ window.clearTimeout(tooltipTimerRef.current); tooltipTimerRef.current=null; }
    pendingTooltipRef.current = null;
    setHoverTooltip(null);
  };
  useEffect(()=>()=>{ if(tooltipTimerRef.current) window.clearTimeout(tooltipTimerRef.current); },[]);

  // Time slots
  const timeSlots = generateTimeSlots(startHour, endHour);
  const scrollAreaRef = useRef<HTMLDivElement|null>(null);
  const [dynamicSlotHeight, setDynamicSlotHeight] = useState<number>(SLOT_HEIGHT);

  // Helper to get end label (supports exclusive index == timeSlots.length)
  const getEndLabel = (endIdx:number) => {
    if(endIdx < timeSlots.length) return timeSlots[endIdx];
    if(timeSlots.length===0) return '';
    const last = timeSlots[timeSlots.length-1];
    const [lh,lm] = last.split(':').map(Number);
    const total = lh*60+lm+30; // add 30 minutes beyond last start slot
    const eh = String(Math.floor(total/60)).padStart(2,'0');
    const em = String(total%60).padStart(2,'0');
    return `${eh}:${em}`;
  };
  // Map stored meeting endTime (which may equal closing boundary) to exclusive index
  const endExclusiveIdx = (endTime:string) => {
    const idx = timeSlots.indexOf(endTime);
    if(idx !== -1) return idx; // normal case (end label exists as slot start)
    const closing = getEndLabel(timeSlots.length); // synthetic closing label
    if(endTime === closing) return timeSlots.length; // closing boundary
    return -1; // unknown
  };

  // Auto-hide conflict UI after 1 second
  useEffect(()=>{
    if(conflictMessage){
      const t = setTimeout(()=> setConflictMessage(null), 1000);
      return ()=> clearTimeout(t);
    }
  },[conflictMessage]);
  useEffect(()=>{
    if(conflictFlashId){
      const t = setTimeout(()=> setConflictFlashId(null), 1000);
      return ()=> clearTimeout(t);
    }
  },[conflictFlashId]);

  useEffect(()=>{
    const HEADER_OFFSET_DAY = 32; // sticky room/time header height in day & week view
    const measure = () => {
      if(!scrollAreaRef.current) return;
      const h = scrollAreaRef.current.clientHeight;
      if(h <= 0) return;
      const effectiveHeight = (viewType==='day' || viewType==='week') ? Math.max(0, h - HEADER_OFFSET_DAY) : h; // subtract header for day & week
      const gaps = (timeSlots.length - 1) * SLOT_GAP;
      const newHeight = Math.max(24, Math.floor((effectiveHeight - gaps) / timeSlots.length));
      if(newHeight !== dynamicSlotHeight) setDynamicSlotHeight(newHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if(scrollAreaRef.current) ro.observe(scrollAreaRef.current);
    window.addEventListener('resize', measure);
    return ()=>{ window.removeEventListener('resize', measure); ro.disconnect(); };
  },[timeSlots.length, viewType, dynamicSlotHeight]);

  // Helpers
  const formatDateForComparison = (date: Date) => date.toISOString().split('T')[0];
  const getWeekDays = (date: Date) => { const week: Date[] = []; const startOfWeek = new Date(date); startOfWeek.setDate(date.getDate() - date.getDay() + 1); for(let i=0;i<7;i++){ const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate()+i); if(!showWeekends){ const dow = d.getDay(); if(dow===0||dow===6) continue; } week.push(d);} return week; };
  const timeToMinutes = (t:string) => { const [h,m]=t.split(':').map(Number); return h*60+m; };
  const normalizeRange = (a:string,b:string):[string,string] => timeToMinutes(a)<=timeToMinutes(b)?[a,b]:[b,a];
  const isTimeInRange = (t:string,a:string,b:string) => { const [s,e]=normalizeRange(a,b); return timeToMinutes(t)>=timeToMinutes(s) && timeToMinutes(t)<timeToMinutes(e)+30; };

  // Selection finalization
  useEffect(()=>{ const up=()=>{ if(isSelecting && selectionStart && selectionCurrentTime){ const [startT,endT]=normalizeRange(selectionStart.time, selectionCurrentTime); const endMinutes=timeToMinutes(endT)+30; const endH=String(Math.floor(endMinutes/60)).padStart(2,'0'); const endM=String(endMinutes%60).padStart(2,'0'); const finalEnd=`${endH}:${endM}`; if(timeToMinutes(finalEnd)>timeToMinutes(startT)){ setEditingMeeting(undefined); setSelectedTime(startT); setSelectedEndTime(finalEnd); setFormRoomId(selectionStart.roomId); setCurrentDate(new Date(selectionStart.date)); setShowMeetingForm(true);} } setIsSelecting(false); setSelectionStart(null); setSelectionCurrentTime(null); }; window.addEventListener('mouseup', up); return ()=>window.removeEventListener('mouseup', up); },[isSelecting, selectionStart, selectionCurrentTime]);

  const startDragSelection = (dateStr:string, time:string, roomId?:string, dayKey?:string) => { setIsSelecting(true); setSelectionStart({ date:dateStr, time, roomId, dayKey }); setSelectionCurrentTime(time); };
  const updateDragSelection = (dateStr:string, time:string, contextRoomId?:string, dayKey?:string) => { if(!isSelecting||!selectionStart) return; if((selectionStart.roomId && selectionStart.roomId!==contextRoomId) || (selectionStart.dayKey && selectionStart.dayKey!==dayKey) || selectionStart.date!==dateStr) return; setSelectionCurrentTime(time); };
  const cancelSelectionIfActive = () => { if(isSelecting){ setIsSelecting(false); setSelectionStart(null); setSelectionCurrentTime(null);} };

  // Resize helpers
  const startResize = (e:React.MouseEvent, meeting:Meeting, edge:'start'|'end') => { e.stopPropagation(); setPointerDownMeeting(null); const startIdx=timeSlots.indexOf(meeting.startTime); let endIdx=endExclusiveIdx(meeting.endTime); if(startIdx===-1||endIdx===-1) return; setResizingMeetingId(meeting.id); setResizeEdge(edge); setResizeMeta({ startIdx, endIdx, initialMouseY:e.clientY, date:meeting.date, roomId:meeting.roomId }); setResizeGhostSlotDelta(0); setResizePixelOffset(0); };
  const clearResizeState = () => { setResizingMeetingId(null); setResizeEdge(null); setResizeMeta(null); setResizeGhostSlotDelta(0); setResizePixelOffset(0); };

  useEffect(()=>{ const onMove=(e:MouseEvent)=>{ if(!resizingMeetingId || !resizeMeta || !resizeEdge) return; const slotUnit=dynamicSlotHeight+SLOT_GAP; const deltaY=e.clientY-resizeMeta.initialMouseY; const rawShift=deltaY/slotUnit; let slotDelta = rawShift>0? Math.floor(rawShift): Math.ceil(rawShift); if(resizeEdge==='end'){ slotDelta = Math.max(1-resizeMeta.endIdx+resizeMeta.startIdx, slotDelta); slotDelta = Math.min(slotDelta, timeSlots.length - resizeMeta.endIdx); } else { slotDelta = Math.min(slotDelta, resizeMeta.endIdx-1-resizeMeta.startIdx); slotDelta = Math.max(-resizeMeta.startIdx, slotDelta); } let newStartIdx = resizeMeta.startIdx + (resizeEdge==='start'? slotDelta:0); let newEndIdx = resizeMeta.endIdx + (resizeEdge==='end'? slotDelta:0); if(newStartIdx<0) newStartIdx=0; if(newEndIdx>timeSlots.length) newEndIdx=timeSlots.length; const newStart=timeSlots[newStartIdx]; const newEnd=getEndLabel(newEndIdx); if(newStart && newEnd){ const meetingCurrent = meetings.find(m=>m.id===resizingMeetingId); const roomConflictMeeting = meetings.find(m=> m.roomId===resizeMeta.roomId && m.date===resizeMeta.date && m.id!==resizingMeetingId && !(newEnd<=m.startTime || newStart>=m.endTime)); const specialistConflictMeeting = meetingCurrent ? meetings.find(m=> m.specialistId===meetingCurrent.specialistId && m.date===meetingCurrent.date && m.id!==meetingCurrent.id && !(newEnd<=m.startTime || newStart>=m.endTime)) : undefined; if(roomConflictMeeting || specialistConflictMeeting){ if(specialistConflictMeeting){ setConflictMessage('Konflikt specjalisty: pracownik ma już spotkanie w tym czasie.'); setConflictFlashId(specialistConflictMeeting.id); } else if(roomConflictMeeting){ setConflictFlashId(roomConflictMeeting.id); } return; } } setResizeGhostSlotDelta(slotDelta); const remainder = deltaY - slotDelta*slotUnit; setResizePixelOffset(remainder); }; const onUp=()=>{ if(resizingMeetingId && resizeMeta && resizeEdge){ let newStartIdx = resizeMeta.startIdx; let newEndIdx = resizeMeta.endIdx; if(resizeEdge==='start'){ newStartIdx = resizeMeta.startIdx + resizeGhostSlotDelta; } else { newEndIdx = resizeMeta.endIdx + resizeGhostSlotDelta; } if(newStartIdx<0) newStartIdx=0; if(newEndIdx>timeSlots.length) newEndIdx=timeSlots.length; if(newEndIdx-newStartIdx>=1){ const newStart=timeSlots[newStartIdx]; const newEnd=getEndLabel(newEndIdx); if(newStart && newEnd){ const m=meetings.find(mm=>mm.id===resizingMeetingId); if(m && (m.startTime!==newStart || m.endTime!==newEnd)){ const roomConflictMeeting = meetings.find(mm=> mm.roomId===m.roomId && mm.date===m.date && mm.id!==m.id && !(newEnd<=mm.startTime || newStart>=mm.endTime)); const specConflictMeeting = meetings.find(mm=> mm.specialistId===m.specialistId && mm.date===m.date && mm.id!==m.id && !(newEnd<=mm.startTime || newStart>=mm.endTime)); if(roomConflictMeeting || specConflictMeeting){ if(specConflictMeeting){ setConflictMessage('Konflikt specjalisty: pracownik ma już spotkanie w tym czasie.'); setConflictFlashId(specConflictMeeting.id); } else if(roomConflictMeeting){ setConflictFlashId(roomConflictMeeting.id); } } else { onMeetingUpdate(resizingMeetingId,{ startTime:newStart, endTime:newEnd }); } } } } } clearResizeState(); }; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); return ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }; },[resizingMeetingId, resizeMeta, resizeEdge, timeSlots, meetings, onMeetingUpdate, dynamicSlotHeight, resizeGhostSlotDelta]);

  // Move (drag whole block) effect
  useEffect(()=>{
    const slotUnit = dynamicSlotHeight + SLOT_GAP;
    const commitMove = () => {
      if(movingMeetingId && moveMeta){
        const durationSlots = moveMeta.endIdx - moveMeta.startIdx;
        const newStartIdx = moveMeta.startIdx + moveGhostSlotDelta;
        const newEndIdx = newStartIdx + durationSlots;
        const newStart = timeSlots[newStartIdx];
        const newEnd = getEndLabel(newEndIdx);
        if(newStart && newEnd){
          const meeting = meetings.find(m=>m.id===movingMeetingId);
          if(meeting && (meeting.startTime!==newStart || meeting.endTime!==newEnd)){
            const roomConflictMeeting = meetings.find(m=> m.id!==movingMeetingId && m.roomId===meeting.roomId && m.date===meeting.date && !(newEnd<=m.startTime || newStart>=m.endTime));
            const specConflictMeeting = meetings.find(m=> m.id!==movingMeetingId && m.specialistId===meeting.specialistId && m.date===meeting.date && !(newEnd<=m.startTime || newStart>=m.endTime));
            if(roomConflictMeeting || specConflictMeeting){ if(specConflictMeeting){ setConflictMessage('Konflikt specjalisty: pracownik ma już spotkanie w tym czasie.'); setConflictFlashId(specConflictMeeting.id); } else if(roomConflictMeeting){ setConflictFlashId(roomConflictMeeting.id); } } else { onMeetingUpdate(movingMeetingId, { startTime:newStart, endTime:newEnd }); }
          }
        }
      }
      setMovingMeetingId(null);
      setMoveMeta(null);
      setMovePixelOffset(0);
      setMoveGhostSlotDelta(0);
    };
    const initiateMoveIfThreshold = (e:MouseEvent) => {
      if(!pointerDownMeeting || resizingMeetingId || movingMeetingId || (e.buttons & 1)===0) return;
      const dy = Math.abs(e.clientY - pointerDownMeeting.y);
      if(dy > 6){
        const meeting = meetings.find(m=>m.id===pointerDownMeeting.id);
        if(!meeting) return;
        const startIdx = timeSlots.indexOf(meeting.startTime);
        const endIdx = endExclusiveIdx(meeting.endTime); // use exclusive end index (supports closing boundary)
        if(startIdx===-1||endIdx===-1) return;
        setMovingMeetingId(meeting.id);
        setMoveMeta({ startIdx, endIdx, initialMouseY:pointerDownMeeting.y, date:meeting.date, roomId:meeting.roomId });
        setMovePixelOffset(0);
        setMoveGhostSlotDelta(0);
      }
    };
    const onMove = (e:MouseEvent) => {
      if(movingMeetingId && moveMeta){
        if((e.buttons & 1)===0){ commitMove(); return; }
        const durationSlots = moveMeta.endIdx - moveMeta.startIdx;
        const deltaY = e.clientY - moveMeta.initialMouseY;
        const rawShift = deltaY / slotUnit;
        let slotDelta = rawShift > 0 ? Math.floor(rawShift) : Math.ceil(rawShift);
        slotDelta = Math.max(0 - moveMeta.startIdx, Math.min(slotDelta, timeSlots.length - durationSlots - moveMeta.startIdx));
        const newStartIdx = moveMeta.startIdx + slotDelta;
        const newEndIdx = newStartIdx + durationSlots;
        const newStart = timeSlots[newStartIdx];
        const newEnd = getEndLabel(newEndIdx);
        if(newStart && newEnd){
          const meeting = meetings.find(m=>m.id===movingMeetingId);
          if(meeting){
            const roomConflictMeeting = meetings.find(m=> m.id!==meeting.id && m.roomId===meeting.roomId && m.date===meeting.date && !(newEnd<=m.startTime || newStart>=m.endTime));
            const specialistConflictMeeting = meetings.find(m=> m.id!==meeting.id && m.specialistId===meeting.specialistId && m.date===meeting.date && !(newEnd<=m.startTime || newStart>=m.endTime));
            if(roomConflictMeeting || specialistConflictMeeting){
              if(specialistConflictMeeting){ setConflictMessage('Konflikt specjalisty: pracownik ma już spotkanie w tym czasie.'); setConflictFlashId(specialistConflictMeeting.id); }
              else if(roomConflictMeeting){ setConflictFlashId(roomConflictMeeting.id); }
              return;
            }
          }
        }
        setMoveGhostSlotDelta(slotDelta);
        const remainder = deltaY - slotDelta * slotUnit;
        setMovePixelOffset(remainder);
      } else if(pointerDownMeeting && !movingMeetingId){
        initiateMoveIfThreshold(e);
      }
    };
    const onUp = () => { commitMove(); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  },[pointerDownMeeting, resizingMeetingId, movingMeetingId, moveMeta, timeSlots, meetings, onMeetingUpdate, dynamicSlotHeight, moveGhostSlotDelta]);

  // Open meeting only on quick click release (not drag / not resize / not move)
  useEffect(()=>{ const onUp=(e:MouseEvent)=>{ if(pointerDownMeeting && !resizingMeetingId && !movingMeetingId){ const dt=Date.now()-pointerDownMeeting.t; const dy=Math.abs(e.clientY-pointerDownMeeting.y); if(dt < 250 && dy < 6){ const meeting=meetings.find(m=>m.id===pointerDownMeeting.id); if(meeting){ handleTimeSlotClick(pointerDownMeeting.dateStr, meeting.startTime, meeting, meeting.roomId); } } } setPointerDownMeeting(null); }; window.addEventListener('mouseup', onUp); return ()=>window.removeEventListener('mouseup', onUp); },[pointerDownMeeting, resizingMeetingId, movingMeetingId, meetings]);

  // Click handlers
  const handleTimeSlotClick = (date:string, time:string, meeting?:Meeting, roomId?:string) => { if(isSelecting || resizingMeetingId || movingMeetingId) return; if(currentUser.role==='employee' && meeting && meeting.specialistId!==currentUser.id) return; if(meeting){ setEditingMeeting(meeting); setSelectedTime(meeting.startTime); setFormRoomId(meeting.roomId);} else { setEditingMeeting(undefined); setSelectedTime(time); setFormRoomId(roomId);} setCurrentDate(new Date(date)); setShowMeetingForm(true); };
  const handleMeetingFormSubmit = (meetingData: Omit<Meeting,'id'>) => { if(editingMeeting){ onMeetingUpdate(editingMeeting.id, meetingData);} else { onMeetingCreate(meetingData);} setShowMeetingForm(false); setEditingMeeting(undefined); };
  const handleMeetingDelete = (meetingId: string) => { onMeetingDelete?.(meetingId); setShowMeetingForm(false); setEditingMeeting(undefined); setFormRoomId(undefined); };
  
  // Week view (day columns, time grid like day view, meetings overlay)
  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const halfHourSlots = timeSlots;
    const slotHeight = dynamicSlotHeight;
    const slotGap = SLOT_GAP;
    const formatHourLabels = halfHourSlots.filter(t=>t.endsWith(':00'));
    // unify header offset naming (fix runtime ReferenceError when code referenced HEADER_OFFSET)
    const HEADER_OFFSET = 32; // sticky header height
    const HEADER_OFFSET_WEEK = HEADER_OFFSET; // backward compatibility
    const dayColumnTotalHeight = HEADER_OFFSET_WEEK + (halfHourSlots.length*slotHeight + (halfHourSlots.length-1)*slotGap);
    const timeToIdx = (t:string)=>halfHourSlots.indexOf(t);

    // Lane assignment (interval graph coloring per day)
    const computeLayout = (dayMeetings:Meeting[]) => {
      const items = dayMeetings.map(m=>({ m, startIdx: timeToIdx(m.startTime), endIdx: endExclusiveIdx(m.endTime), lane:-1, groupId:-1 }));
      const valid = items.filter(i=>i.startIdx!==-1 && i.endIdx!==-1);
      valid.sort((a,b)=> a.startIdx-b.startIdx || (b.endIdx-b.startIdx)-(a.endIdx-a.startIdx));
      let group=0; for(let i=0;i<valid.length;i++){ if(valid[i].groupId!==-1) continue; valid[i].groupId=group; const q=[valid[i]]; while(q.length){ const cur=q.shift()!; for(const o of valid){ if(o.groupId!==-1) continue; if(!(cur.endIdx<=o.startIdx || cur.startIdx>=o.endIdx)){ o.groupId=group; q.push(o);} } } group++; }
      const groups:Record<number, typeof valid> = {}; valid.forEach(v=>{ (groups[v.groupId] ||= []).push(v); });
      Object.values(groups).forEach(g=>{ g.sort((a,b)=> a.startIdx-b.startIdx || (a.endIdx-a.startIdx)-(b.endIdx-b.startIdx)); const laneEnds:number[]=[]; g.forEach(it=>{ let placed=false; for(let li=0; li<laneEnds.length; li++){ if(laneEnds[li] <= it.startIdx){ it.lane=li; laneEnds[li]=it.endIdx; placed=true; break; } } if(!placed){ it.lane=laneEnds.length; laneEnds.push(it.endIdx);} }); const laneCount=Math.max(1,...g.map(x=>x.lane+1)); g.forEach(x=> (x as any).lanes=laneCount); });
      return valid;
    };

    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full ${(isSelecting||resizingMeetingId||movingMeetingId)?'select-none':''}`} onMouseLeave={cancelSelectionIfActive}>
        <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto styled-scrollbar" style={{scrollbarGutter:'stable'}}>
          <div className="grid" style={{gridTemplateColumns:`${TIME_COL_WIDTH}px repeat(${weekDays.length},1fr)`}}>
            {/* Time labels column */}
            <div className="relative border-r border-gray-200 bg-gray-50" style={{height:dayColumnTotalHeight}}>
              <div className="sticky top-0 z-30 h-8 bg-white/80 backdrop-blur-sm border-b border-gray-200 flex items-center justify-center text-[12px] font-medium text-gray-500 whitespace-nowrap px-1">Czas</div>
              {formatHourLabels.map((h,i)=>(
                <div key={h} className="flex items-start justify-center text-[12px] font-medium text-gray-600 whitespace-nowrap px-1" style={{position:'absolute', top:HEADER_OFFSET + i*(slotHeight*2+slotGap*2), height:slotHeight*2+slotGap, left:0,right:0,paddingTop:4}}>{h}</div>
              ))}
              <div style={{height:dayColumnTotalHeight}} />
            </div>
            {weekDays.map(day=>{
              const dateStr = formatDateForComparison(day);
              const dayMeetingsRaw = meetings.filter(m=>m.date===dateStr);
              let dayMeetings: Meeting[] = dayMeetingsRaw.map(m=>m);
              if(movingMeetingId && moveMeta && dateStr===moveMeta.date){
                const m = dayMeetings.find(mm=>mm.id===movingMeetingId);
                if(m){
                  const durationSlots = moveMeta.endIdx - moveMeta.startIdx;
                  const ghostStartIdx = moveMeta.startIdx + moveGhostSlotDelta;
                  let gStartIdx = Math.max(0, Math.min(ghostStartIdx, timeSlots.length-1));
                  let gEndIdx = gStartIdx + durationSlots; if(gEndIdx>timeSlots.length) gEndIdx=timeSlots.length;
                  const ghostStart = timeSlots[gStartIdx];
                  const ghostEnd = getEndLabel(gEndIdx);
                  dayMeetings = dayMeetings.map(mm=> mm.id===movingMeetingId ? { ...mm, startTime: ghostStart || mm.startTime, endTime: ghostEnd || mm.endTime } : mm);
                }
              } else if(resizingMeetingId && resizeMeta && resizeEdge && dateStr===resizeMeta.date){
                const m = dayMeetings.find(mm=>mm.id===resizingMeetingId);
                if(m){
                  let newStartIdx = resizeMeta.startIdx;
                  let newEndIdx = resizeMeta.endIdx;
                  if(resizeEdge==='start') newStartIdx = Math.max(0, resizeMeta.startIdx + resizeGhostSlotDelta); else newEndIdx = Math.min(timeSlots.length, resizeMeta.endIdx + resizeGhostSlotDelta);
                  if(newEndIdx - newStartIdx < 1){ newEndIdx = newStartIdx+1; }
                  const ghostStart = timeSlots[newStartIdx];
                  const ghostEnd = getEndLabel(newEndIdx);
                  dayMeetings = dayMeetings.map(mm=> mm.id===resizingMeetingId ? { ...mm, startTime: ghostStart || mm.startTime, endTime: ghostEnd || mm.endTime } : mm);
                }
              }
              const layout = computeLayout(dayMeetings);
              const laneMap: Record<string,{lane:number; lanes:number; startIdx:number; endIdx:number}> = {};
              layout.forEach(it=>{ laneMap[it.m.id] = { lane: (it as any).lane, lanes: (it as any).lanes, startIdx: (it as any).startIdx, endIdx: (it as any).endIdx }; });

              const meetingBlocks = layout.flatMap(item=>{
                const { m } = item as any;
                const info = laneMap[m.id];
                const isMoving = movingMeetingId===m.id;
                const isResizing = resizingMeetingId===m.id;
                if(isMoving || isResizing) return [];
                const slots = info.endIdx - info.startIdx;
                const isShort = slots===1;
                const top = HEADER_OFFSET + info.startIdx*(slotHeight+slotGap);
                const height = slots*slotHeight + (slots-1)*slotGap;
                const widthPct = 100/info.lanes;
                const leftPct = info.lane*widthPct;
                const specialist = users.find(u=>u.id===m.specialistId);
                const specName = specialist? specialist.name : 'Specjalista';
                const timeRange = `${m.startTime}-${m.endTime}`;
                const room = rooms.find(r=>r.id===m.roomId);
                const roomStyle = getRoomStyle(room);
                const enlarged = slots>1 || info.lanes>1;
                const nameFontClass = enlarged ? (isShort ? 'text-[12px]' : 'text-[12px]') : 'text-[10px]';
                const paddingClass = enlarged ? 'px-1.5 py-1' : 'px-1.5';
                const marginClass = enlarged ? 'm-0.5' : '';
                return (
                  <div key={m.id+"_orig"}
                    onMouseDown={(e)=>{ if(e.button!==0) return; if(resizingMeetingId) return; setPointerDownMeeting({ id:m.id, y:e.clientY, t:Date.now(), dateStr, roomId:m.roomId }); }}
                    onMouseEnter={(e)=> scheduleTooltip(`${specName}\u00A0\u00A0${m.startTime} - ${m.endTime}`, e.clientX, e.clientY+14)}
                    onMouseMove={(e)=> updateTooltipPosition(e.clientX, e.clientY+14)}
                    onMouseLeave={cancelTooltip}
                    className={`group absolute rounded-md ${paddingClass} ${marginClass} text-[11px] shadow-sm cursor-pointer overflow-visible hover:brightness-95 transition-opacity flex items-center justify-center border ${(conflictFlashId===m.id)?'!ring-4 !ring-red-500 !border-red-500 animate-pulse':''} ${m.status==='cancelled'?'line-through opacity-70':''}`}
                    style={{top, height, left:`${leftPct}%`, width:`${widthPct}%`, ...roomStyle }}
                  >
                    <div className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-end justify-center" onMouseDown={(e)=>startResize(e,m,'end')}>
                      <span className="w-8 h-0.5 rounded bg-black/20 mb-[3px] group-hover:bg-black/40 transition" />
                    </div>
                    <div className={`pointer-events-none select-none flex ${isShort?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                      <div className={`${isShort?'text-[12px]':'text-[11px] mb-1'} font-semibold drop-shadow-sm`}>{timeRange}</div>
                      <div className={`${nameFontClass} font-medium truncate max-w-full drop-shadow-sm`}>{specName}</div>
                    </div>
                  </div>
                );
              }).filter(Boolean);

              let interactiveGhost: React.ReactNode = null;
              if(movingMeetingId && moveMeta && dateStr===moveMeta.date){
                const info = laneMap[movingMeetingId];
                if(info){
                  const durationSlots = moveMeta.endIdx - moveMeta.startIdx;
                  const ghostStartIdx = moveMeta.startIdx + moveGhostSlotDelta;
                  const top = HEADER_OFFSET + ghostStartIdx*(slotHeight+slotGap);
                  const height = durationSlots*slotHeight + (durationSlots-1)*slotGap;
                  const widthPct = 100/info.lanes; const leftPct = info.lane*widthPct;
                  const m = meetings.find(mm=>mm.id===movingMeetingId)!;
                  const ghostStart = timeSlots[ghostStartIdx];
                  const ghostEnd = getEndLabel(ghostStartIdx+durationSlots);
                  const specialist = users.find(u=>u.id===m.specialistId); const specName = specialist?specialist.name:'Specjalista';
                  const timeRange = `${ghostStart}-${ghostEnd}`;
                  const isShort = durationSlots===1;
                  const room = rooms.find(r=>r.id===m.roomId); const roomStyle = getRoomStyle(room);
                  const enlarged = durationSlots>1 || info.lanes>1;
                  const paddingClass = enlarged ? 'px-1.5 py-1' : 'px-1.5';
                  const marginClass = enlarged ? 'm-0.5' : '';
                  interactiveGhost = (
                    <div key={m.id+"_moveGhostLive"} className={`absolute rounded-md ${paddingClass} ${marginClass} text-[11px] shadow-lg cursor-grabbing overflow-hidden flex items-center justify-center`} style={{top, height, left:`${leftPct}%`, width:`${widthPct}%`, transform:`translateY(${movePixelOffset}px)`, transition:'none', zIndex:65, ...roomStyle}}>
                      <div className={`pointer-events-none select-none flex ${isShort?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                        <div className={`${isShort?'text-[12px]':'text-[11px] mb-1'} font-semibold opacity-80`}>{timeRange}</div>
                        <div className="text-[10px] font-medium truncate max-w-full opacity-80">{specName}</div>
                      </div>
                    </div>
                  );
                }
              } else if(resizingMeetingId && resizeMeta && resizeEdge && dateStr===resizeMeta.date){
                const info = laneMap[resizingMeetingId];
                if(info){
                  let ghostStartIdx = resizeMeta.startIdx; let ghostEndIdx = resizeMeta.endIdx;
                  if(resizeEdge==='start') ghostStartIdx = resizeMeta.startIdx + resizeGhostSlotDelta; else ghostEndIdx = resizeMeta.endIdx + resizeGhostSlotDelta;
                  const top = HEADER_OFFSET + (resizeEdge==='start'? ghostStartIdx : resizeMeta.startIdx)*(slotHeight+slotGap);
                  const slots = ghostEndIdx - ghostStartIdx;
                  const height = slots*slotHeight + (slots-1)*slotGap + (resizeEdge==='end'? resizePixelOffset:0);
                  const widthPct = 100/info.lanes; const leftPct = info.lane*widthPct;
                  const m = meetings.find(mm=>mm.id===resizingMeetingId)!;
                  const ghostStart = timeSlots[ghostStartIdx]; const ghostEnd = getEndLabel(ghostEndIdx);
                  const specialist = users.find(u=>u.id===m.specialistId); const specName = specialist?specialist.name:'Specjalista';
                  const timeRange = `${ghostStart}-${ghostEnd}`; const isShort = slots===1;
                  const transform = resizeEdge==='start'? `translateY(${resizePixelOffset}px)`:'none';
                  const room = rooms.find(r=>r.id===m.roomId); const roomStyle = getRoomStyle(room);
                  const enlarged = slots>1 || info.lanes>1;
                  const paddingClass = enlarged ? 'px-1.5 py-1' : 'px-1.5';
                  const marginClass = enlarged ? 'm-0.5' : '';
                  interactiveGhost = (
                    <div key={m.id+"_resizeGhostLive"} className={`absolute rounded-md ${paddingClass} ${marginClass} text-[11px] shadow-lg cursor-ns-resize overflow-hidden flex items-center justify-center border`} style={{top, height, left:`${leftPct}%`, width:`${widthPct}%`, transform, zIndex:70, ...roomStyle}}>
                      <div className={`pointer-events-none select-none flex ${isShort?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                        <div className={`${isShort?'text-[12px]':'text-[11px] mb-1'} font-semibold opacity-80`}>{timeRange}</div>
                        <div className="text-[10px] font-medium truncate max-w-full opacity-80">{specName}</div>
                      </div>
                    </div>
                  );
                }
              }

              const selectionGhost = (()=>{
                if(!(isSelecting && selectionStart && selectionCurrentTime && selectionStart.dayKey===dateStr)) return null;
                const sIdx = timeToIdx(selectionStart.time); const cIdx = timeToIdx(selectionCurrentTime);
                if(sIdx===-1 || cIdx===-1) return null;
                let from = Math.min(sIdx,cIdx); let to = Math.max(sIdx,cIdx)+1;
                const ghostSlots = to - from;
                if(ghostSlots < 1) return null;
                const top = HEADER_OFFSET + from*(slotHeight+slotGap);
                const height = ghostSlots*slotHeight + (ghostSlots-1)*slotGap;
                const endLabel = to>=halfHourSlots.length ? getEndLabel(to) : halfHourSlots[to];
                const range = `${halfHourSlots[from]}-${endLabel}`;
                const isShort = ghostSlots===1;
                return (
                  <div className="absolute left-0 right-0 border rounded-md px-1.5 text-[11px] shadow-lg overflow-hidden ring-2 ring-blue-400 bg-blue-200/70 border-blue-400 text-blue-900 flex items-center justify-center pointer-events-none" style={{top, height, zIndex:50}}>
                    <div className={`pointer-events-none select-none flex ${isShort?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                      <div className={`${isShort?'text-[12px]':'text-[11px]'} font-semibold opacity-80`}>{range}</div>
                    </div>
                  </div>
                );
              })();

              return (
                <div key={dateStr} className="relative border-r last:border-r-0 border-gray-200" style={{height:dayColumnTotalHeight}}>
                  <div className="sticky top-0 z-30 h-8 bg-white/80 backdrop-blur-sm border-b border-gray-200 flex flex-col items-center justify-center text-[11px] font-semibold text-gray-700 leading-tight">
                    <span className="uppercase tracking-wide">{day.toLocaleDateString('pl-PL',{ weekday:'short'}).replace('.', '').substring(0,3)}</span>
                    <span className="text-[10px] font-normal">{day.getDate().toString().padStart(2,'0')}.{(day.getMonth()+1).toString().padStart(2,'0')}</span>
                  </div>
                  {halfHourSlots.map(slotTime=>{
                    const idx = timeToIdx(slotTime); const top = HEADER_OFFSET + idx*(slotHeight+slotGap);
                    const inDragRange = isSelecting && selectionStart && selectionStart.dayKey===dateStr && selectionCurrentTime && isTimeInRange(slotTime, selectionStart.time, selectionCurrentTime);
                    const occupied = dayMeetings.some(m=>{ const ms=timeToIdx(m.startTime); const me=endExclusiveIdx(m.endTime); return ms!==-1 && me!==-1 && idx>=ms && idx<me; });
                    return (
                      <div key={slotTime+dateStr}
                        className={`absolute left-0 right-0 rounded-md border text-[11px] flex items-center px-1 transition-colors ${occupied? 'bg-gray-100 border-gray-300':'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer'} ${inDragRange? 'bg-blue-300 !border-blue-400 text-white':''}`}
                        style={{top, height:slotHeight, zIndex:0}}
                        onMouseDownCapture={()=>{ startDragSelection(dateStr, slotTime, undefined, dateStr); }}
                        onMouseEnter={()=>{ updateDragSelection(dateStr, slotTime, undefined, dateStr); }}
                        onClick={()=>{ if(!isSelecting){ handleTimeSlotClick(dateStr, slotTime); } }}>
                        <span className={`pr-1 ${occupied? 'opacity-30':'opacity-40'}`}>{slotTime}</span>
                      </div>
                    );
                  })}
                  {selectionGhost}
                  {meetingBlocks}
                  {interactiveGhost}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Day multi-room view
  const renderDayViewMultiRoom = () => {
    const HEADER_OFFSET = 32;
    const dateStr = formatDateForComparison(currentDate);
    const dayMeetings = meetings.filter(m=>m.date===dateStr);
    const halfHourSlots = timeSlots;
    const slotHeight = dynamicSlotHeight; // dynamic
    const slotGap = SLOT_GAP;
    const formatHourLabels = halfHourSlots.filter(t=>t.endsWith(':00'));
    const timeToIdx = (t:string)=>halfHourSlots.indexOf(t);
    const dayColumnTotalHeight = HEADER_OFFSET + (halfHourSlots.length*slotHeight + (halfHourSlots.length-1)*slotGap);
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden ${(isSelecting||resizingMeetingId||movingMeetingId)?'select-none':''}`} onMouseLeave={cancelSelectionIfActive}>
        <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto styled-scrollbar" style={{scrollbarGutter:'stable'}}>
          <div className="grid" style={{gridTemplateColumns:`${TIME_COL_WIDTH}px repeat(${rooms.length},1fr)`}}>
            <div className="relative border-r border-gray-200 bg-gray-50" style={{height:dayColumnTotalHeight}}>
              <div className="sticky top-0 z-30 h-8 bg-white/80 backdrop-blur-sm border-b border-gray-200 flex items-center justify-center text-[12px] font-medium text-gray-500 whitespace-nowrap px-1">Czas</div>
              {formatHourLabels.map((h,i)=>(<div key={h} className="flex items-start justify-center text-[12px] font-medium text-gray-600 whitespace-nowrap px-1" style={{position:'absolute', top:HEADER_OFFSET + i*(slotHeight*2+slotGap*2), height:slotHeight*2+slotGap, left:0,right:0,paddingTop:4}}>{h}</div>))}
            </div>
            {rooms.map(room=>{
              const roomDayMeetings = dayMeetings.filter(m=>m.roomId===room.id);
              const roomHeaderStyle = (()=>{ const rs = getRoomStyle(room); return { backgroundColor: rs.backgroundColor, color: rs.color, borderBottom: `1px solid ${rs.borderColor}`}; })();
              const meetingBlocks = roomDayMeetings.flatMap(m=>{
                const isResizing = resizingMeetingId===m.id;
                const isMoving = movingMeetingId===m.id;
                const startIdx = timeToIdx(m.startTime);
                const endIdxExclusive = endExclusiveIdx(m.endTime);
                if(startIdx===-1||endIdxExclusive===-1) return [];
                const slots = endIdxExclusive - startIdx;
                const isShort = slots===1;
                const top = HEADER_OFFSET + startIdx*(slotHeight+slotGap);
                const height = slots*slotHeight + (slots-1)*slotGap;
                const specialist = users.find(u=>u.id===m.specialistId);
                const specName = specialist?specialist.name:'Specjalista';
                const timeRange = `${m.startTime}-${m.endTime}`;
                const content = (
                  <div className={`pointer-events-none select-none flex ${isShort?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                    <div className={`${isShort?'text-[12px]':'text-[11px] mb-2'} font-semibold opacity-80`}>{timeRange}</div>
                    <div className="text-[12px] font-semibold uppercase tracking-wide truncate max-w-full">{specName}</div>
                  </div>
                );
                const roomStyle = getRoomStyle(room);
                const enlarged = slots>1; // w widoku dnia nie ma lanes, więc tylko slots>1
                const paddingClass = enlarged ? 'px-1.5 py-1' : 'px-1.5';
                const marginClass = enlarged ? 'm-0.5' : '';
                const originalBlock = (
                  <div key={m.id+"_orig"}
                    onMouseDown={(e)=>{ if(e.button!==0) return; if(resizingMeetingId) return; setPointerDownMeeting({ id:m.id, y:e.clientY, t:Date.now(), dateStr, roomId: room.id }); }}
                    onMouseEnter={(e)=> scheduleTooltip(`${specName}\u00A0\u00A0${m.startTime} - ${m.endTime}`, e.clientX, e.clientY+14)}
                    onMouseMove={(e)=> updateTooltipPosition(e.clientX, e.clientY+14)}
                    onMouseLeave={cancelTooltip}
                    className={`group absolute left-1 right-1 rounded-md ${paddingClass} ${marginClass} text-[11px] shadow-sm cursor-pointer overflow-visible hover:brightness-95 transition-opacity flex items-center justify-center border ${(isResizing)?'ring-2 ring-blue-400':''} ${conflictFlashId===m.id? '!ring-4 !ring-red-500 !border-red-500 animate-pulse':''} ${m.status==='cancelled'?'line-through opacity-70':''}`}
                    style={{top,height, opacity:isResizing||isMoving?0.25:1, ...roomStyle}}>
                    <div onMouseDown={(e)=>startResize(e,m,'end')} className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-end justify-center group/handleEnd">
                      <span className="w-8 h-0.5 rounded bg-black/20 mb-[3px] group-hover/handleEnd:bg-black/40 transition" />
                    </div>
                    {content}
                  </div>
                );
                const blocks = [originalBlock];
                if(isMoving && moveMeta && moveMeta.startIdx===startIdx && moveMeta.endIdx===endIdxExclusive){
                  const ghostStartIdx = moveMeta.startIdx + moveGhostSlotDelta;
                  const ghostTop = HEADER_OFFSET + ghostStartIdx*(slotHeight+slotGap);
                  const ghostSlots = slots;
                  const ghostEndIdx = ghostStartIdx + ghostSlots;
                  const ghostIsShort = ghostSlots===1;
                  const ghostTimeRange = `${timeSlots[ghostStartIdx]}-${getEndLabel(ghostEndIdx)}`;
                  const ghostContent = (
                    <div className={`pointer-events-none select-none flex ${ghostIsShort?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                      <div className={`${ghostIsShort?'text-[12px]':'text-[11px] mb-2'} font-semibold opacity-80`}>{ghostTimeRange}</div>
                      <div className="text-[12px] font-semibold uppercase tracking-wide truncate max-w-full">{specName}</div>
                    </div>
                  );
                  const ghostHeight = ghostSlots*slotHeight + (ghostSlots-1)*slotGap;
                  const ghostEnlarged = ghostSlots>1;
                  const ghostPaddingClass = ghostEnlarged ? 'px-1.5 py-1' : 'px-1.5';
                  const ghostMarginClass = ghostEnlarged ? 'm-0.5' : '';
                  const moveGhost = (
                    <div key={m.id+"_moveGhost"} className={`absolute left-1 right-1 rounded-md ${ghostPaddingClass} ${ghostMarginClass} text-[11px] shadow-lg cursor-grabbing overflow-hidden flex items-center justify-center border`} style={{top:ghostTop, height:ghostHeight, transform:`translateY(${movePixelOffset}px)`, transition:'none', zIndex:65, ...roomStyle}}>
                      {ghostContent}
                    </div>
                  );
                  blocks.push(moveGhost);
                }
                if(isResizing && resizeMeta && resizeEdge && resizeMeta.startIdx===startIdx && resizeMeta.endIdx===endIdxExclusive){
                  let ghostStartIdx = resizeMeta.startIdx;
                  let ghostEndIdx = resizeMeta.endIdx;
                  if(resizeEdge==='start') ghostStartIdx = resizeMeta.startIdx + resizeGhostSlotDelta; else ghostEndIdx = resizeMeta.endIdx + resizeGhostSlotDelta;
                  const ghostSlots = ghostEndIdx - ghostStartIdx;
                  const ghostIsShort = ghostSlots===1;
                  const ghostTop = HEADER_OFFSET + (resizeEdge==='start'? ghostStartIdx : resizeMeta.startIdx)*(slotHeight+slotGap);
                  const ghostHeight = ghostSlots*slotHeight + (ghostSlots-1)*slotGap + (resizeEdge==='end'? resizePixelOffset:0);
                  const transform = resizeEdge==='start'? `translateY(${resizePixelOffset}px)`:'none';
                  const ghostTimeRange = `${timeSlots[ghostStartIdx]}-${getEndLabel(ghostEndIdx)}`;
                  const ghostContent = (
                    <div className={`pointer-events-none select-none flex ${ghostIsShort?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                      <div className={`${ghostIsShort?'text-[12px]':'text-[11px] mb-2'} font-semibold opacity-80`}>{ghostTimeRange}</div>
                      <div className="text-[12px] font-semibold uppercase tracking-wide truncate max-w-full">{specName}</div>
                    </div>
                  );
                  const resizeEnlarged = ghostSlots>1;
                  const resizePaddingClass = resizeEnlarged ? 'px-1.5 py-1' : 'px-1.5';
                  const resizeMarginClass = resizeEnlarged ? 'm-0.5' : '';
                  const ghost = (
                    <div key={m.id+"_resizeGhost"} className={`absolute left-1 right-1 rounded-md ${resizePaddingClass} ${resizeMarginClass} text-[11px] shadow-lg cursor-ns-resize overflow-hidden flex items-center justify-center border`} style={{top:ghostTop, height:ghostHeight, transform, zIndex:70, ...roomStyle}}>
                      {ghostContent}
                    </div>
                  );
                  blocks.push(ghost);
                }
                return blocks;
              }).filter(Boolean);

              // Selection ghost for new reservation (same visual style as move ghost)
              const selectionGhost = (()=>{
                if(!(isSelecting && selectionStart && selectionCurrentTime && selectionStart.roomId===room.id)) return null;
                const sIdx = timeToIdx(selectionStart.time);
                const cIdx = timeToIdx(selectionCurrentTime);
                if(sIdx===-1 || cIdx===-1) return null;
                let from = Math.min(sIdx, cIdx);
                let toExclusive = Math.max(sIdx, cIdx) + 1; // target exclusive end
                // stop before first occupied slot inside range
                for(let i=from; i<toExclusive; i++){
                  const occupied = roomDayMeetings.some(m=>{ const ms=timeToIdx(m.startTime); const me=endExclusiveIdx(m.endTime); return i>=ms && i<me; });
                  if(occupied){ toExclusive = i; break; }
                }
                if(toExclusive - from < 1) return null;
                const ghostSlots = toExclusive - from;
                const top = HEADER_OFFSET + from*(slotHeight+slotGap);
                const height = ghostSlots*slotHeight + (ghostSlots-1)*slotGap;
                // compute end label safely (toExclusive may equal length)
                let endLabel: string;
                if(toExclusive >= timeSlots.length){
                  const last = timeSlots[timeSlots.length-1];
                  const [lh,lm]=last.split(':').map(Number);
                  const total = lh*60+lm+30; // add 30min
                  const eh = String(Math.floor(total/60)).padStart(2,'0');
                  const em = String(total%60).padStart(2,'0');
                  endLabel = `${eh}:${em}`;
                } else {
                  endLabel = timeSlots[toExclusive];
                }
                const ghostTimeRange = `${timeSlots[from]}-${endLabel}`;
                const isShort = ghostSlots===1;
                return (
                  <div className="absolute left-1 right-1 border rounded-md px-1.5 text-[11px] shadow-lg overflow-hidden ring-2 ring-blue-400 bg-blue-200/70 border-blue-400 text-blue-900 flex items-center justify-center pointer-events-none" style={{top, height, zIndex:50}}>
                    <div className={`pointer-events-none select-none flex ${isShort?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                      <div className={`${isShort?'text-[12px]':'text-[11px]'} font-semibold opacity-80`}>{ghostTimeRange}</div>
                    </div>
                  </div>
                );
              })();

              return (
                <div key={room.id} className="relative border-r last:border-r-0 border-gray-200" style={{height:dayColumnTotalHeight}}>
                  <div className="sticky top-0 z-30 h-8 flex items-center justify-center text-[14px] font-semibold tracking-wide rounded-md px-2 py-1" style={roomHeaderStyle}>{room.name}</div>
                  {halfHourSlots.map(slotTime=>{ const inDragRange = isSelecting && selectionStart && selectionStart.roomId===room.id && selectionCurrentTime && isTimeInRange(slotTime, selectionStart.time, selectionCurrentTime); const occupiedMeeting = roomDayMeetings.find(m=>{ let s=m.startTime; let e=m.endTime; const ms=timeToIdx(s); const me=endExclusiveIdx(e); return ms!==-1 && me!==-1 && timeToIdx(slotTime)>=ms && timeToIdx(slotTime)<me; }); const occupied = !!occupiedMeeting; const isAvailable = !occupied; return (<div key={slotTime} className={`absolute left-0 right-0 rounded-md border text-[11px] flex items-center justify-start px-1 cursor-pointer transition-colors ${isAvailable?'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300':'bg-transparent border-transparent pointer-events-none'} ${inDragRange && isAvailable?'bg-blue-300 !border-blue-400 text-white':''}`} style={{top:HEADER_OFFSET + (timeToIdx(slotTime))*(slotHeight+slotGap), height:slotHeight, zIndex:0}} onMouseDownCapture={()=>{ if(isAvailable){ startDragSelection(dateStr, slotTime, room.id); } }} onMouseEnter={()=>{ if(isAvailable){ updateDragSelection(dateStr, slotTime, room.id); } }} onClick={()=>{ if(!isSelecting && isAvailable){ handleTimeSlotClick(dateStr, slotTime, undefined, room.id); } }}>{!occupied && <span className="opacity-40 pr-1">{slotTime}</span>}</div>); })}
                  {selectionGhost}
                  {meetingBlocks}
                </div>
              ); })}
          </div>
        </div>
      </div>
    );
  };

  // Month view (calendar grid)
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = (firstOfMonth.getDay()+6)%7; // convert Sunday=0 to Monday=6 wrap
    // Start date for grid (Monday before or on first)
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - startWeekday);
    const weeks: Date[][] = [];
    for(let w=0; w<6; w++){ // up to 6 weeks
      const week: Date[] = [];
      for(let d=0; d<7; d++){
        const day = new Date(gridStart);
        day.setDate(gridStart.getDate() + w*7 + d);
        week.push(day);
      }
      weeks.push(week);
      // stop early if last week entirely next month
      const lastDay = week[6];
      if(lastDay.getMonth() !== month && lastDay.getDate() >= 7) break;
    }
    // Use local time for today and for all date comparisons (avoid UTC off-by-one)
    const formatLocalDate = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    };
    const now = new Date();
    const todayStr = formatLocalDate(now);

    const dayMeetingsMap: Record<string, Meeting[]> = {};
    meetings.forEach(m => { (dayMeetingsMap[m.date] ||= []).push(m); });

    const weekdayLabels = ['Pon','Wt','Śr','Cz','Pt','So','Nd'];

    return (
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/70 text-[11px] font-medium text-gray-600">
          {weekdayLabels.map(l => (
            <div key={l} className="px-2 py-2 text-center uppercase tracking-wide">{l}</div>
          ))}
        </div>
        <div className="flex-1 grid gap-px bg-gray-200" style={{gridTemplateRows:`repeat(${weeks.length},1fr)`}}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-px bg-gray-200">
              {week.map(day => {
                const dateStr = formatLocalDate(day);
                const inMonth = day.getMonth() === month;
                const isToday = dateStr === todayStr;
                const isWeekend = day.getDay()===0 || day.getDay()===6;
                const dayMeetings = (dayMeetingsMap[dateStr]||[]).sort((a,b)=> a.startTime.localeCompare(b.startTime));
                return (
                  <div key={dateStr} style={{margin: 5}}>
                    <button
                      onClick={()=>{ setCurrentDate(day); setViewType('day'); }}
                      className={`group relative flex flex-col items-stretch overflow-hidden text-left transition focus:outline-none focus:z-10 rounded-md
                        w-full h-full
                        ${inMonth? 'bg-white':'bg-gray-50/70 text-gray-400'}
                        ${isWeekend && inMonth? 'bg-gray-50':''}
                        ${isToday
                          ? 'ring-2 ring-blue-500/90 shadow-lg bg-blue-50/80 border border-blue-500'
                          : 'shadow-sm border border-transparent'}
                        hover:shadow-md hover:bg-blue-50/40
                      `}
                      style={{minHeight: 64, minWidth: 64, padding: 0}}
                    >
                      <div className="flex items-center justify-between mb-1 px-2 pt-2">
                        <span className={`text-[11px] font-medium ${!inMonth?'opacity-60':''}`}>{day.getDate()}</span>
                        {/* Removed 'D' badge for today, only border remains */}
                      </div>
                      <div className="flex-1 px-2 pb-2">
                        <div className="flex flex-row flex-wrap gap-1 items-start content-start">
                          {dayMeetings.map(m=>{ const room = rooms.find(r=> r.id===m.roomId); const rc = getRoomStyle(room); const specialist = users.find(u=>u.id===m.specialistId); const specName = specialist?specialist.name:'Specjalista'; const tooltipTxt = `${m.startTime}-${m.endTime}\n${specName}\n${room?room.name:''}`; return (
                            <span key={m.id+"_dot"}
                              onMouseEnter={(e)=> scheduleTooltip(tooltipTxt, e.clientX, e.clientY+16)}
                              onMouseMove={(e)=> updateTooltipPosition(e.clientX, e.clientY+16)}
                              onMouseLeave={cancelTooltip}
                              onClick={(e)=>{ e.stopPropagation(); handleTimeSlotClick(m.date, m.startTime, m, m.roomId); }}
                              className="w-6 h-6 rounded-full border shadow-sm shrink-0 cursor-pointer hover:brightness-110 transition"
                              style={{backgroundColor: rc.backgroundColor, borderColor: rc.borderColor}}
                              title=""
                              aria-label={tooltipTxt.replace(/\n/g,' ')}
                            />
                          ); })}
                        </div>
                      </div>
                      {!inMonth && !isToday && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] pointer-events-none" />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (<div className={`flex flex-col flex-1 h-full min-h-0 overflow-hidden ${viewType==='month'?'space-y-6':'gap-2'} pb-4`}>
    {/* Removed month view top panel (room dropdown) per request */}
    <div className="flex-none"><CalendarHeader currentDate={currentDate} viewType={viewType} onDateChange={setCurrentDate} onViewTypeChange={setViewType} /></div>
    <div className="flex-1 min-h-0">{viewType==='day' && renderDayViewMultiRoom()}{viewType==='week' && renderWeekView()}{viewType==='month' && renderMonthView()}</div>
    <MeetingForm isOpen={showMeetingForm} onClose={()=>{ setShowMeetingForm(false); setEditingMeeting(undefined); setFormRoomId(undefined); }} onSubmit={handleMeetingFormSubmit} onDelete={handleMeetingDelete} users={users} rooms={rooms} meetings={meetings} selectedDate={formatDateForComparison(currentDate)} selectedTime={selectedTime} currentUser={currentUser} editingMeeting={editingMeeting} initialRoomId={formRoomId} selectedEndTime={selectedEndTime} />
    {conflictMessage && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl text-sm z-[100] max-w-sm text-center animate-in fade-in">{conflictMessage}</div>}
    {hoverTooltip && (
      <div className="fixed z-[200] pointer-events-none -translate-x-1/2" style={{ left: hoverTooltip!.x, top: hoverTooltip!.y }}>
        <div className="bg-white text-black text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-[0_10px_28px_-4px_rgba(0,0,0,0.45),0_4px_10px_-2px_rgba(0,0,0,0.35)] border border-gray-300/80 ring-1 ring-black/5 whitespace-pre-line leading-tight">{hoverTooltip!.text}</div>
      </div>
    )}
  </div>);
};

export default RoomCalendar;