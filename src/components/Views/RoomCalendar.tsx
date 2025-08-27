import React, { useState, useEffect, useRef } from 'react';
import CalendarHeader from '../Calendar/CalendarHeader';
import MeetingForm from '../Forms/MeetingForm';
import { generateTimeSlots } from '../../utils/timeSlots';
import { User, Room, Meeting } from '../../types';

const SLOT_HEIGHT = 24;
const SLOT_GAP = 2; // keep in sync with --calendar-slot-gap
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

// Performance throttle refs (rAF batching for mousemove heavy updates)
// Added to reduce state churn during drag / resize operations.
// These are outside component scope? Need inside component; keep here placeholder.
// (actual refs are inside RoomCalendar component below)
const moveFrameRef = { current: null as number | null };
const movePendingRef = { current: null as { slotDelta:number; remainder:number } | null };
const resizeFrameRef = { current: null as number | null };
const resizePendingRef = { current: null as { slotDelta:number; remainder:number } | null };

interface RoomCalendarProps { users: User[]; rooms: Room[]; meetings: Meeting[]; currentUser: User; onMeetingCreate: (m: Omit<Meeting,'id'>) => void; onMeetingUpdate: (id:string, u:Partial<Meeting>)=>void; showWeekends:boolean; startHour:number; endHour:number; }

const RoomCalendar: React.FC<RoomCalendarProps> = ({ users, rooms, meetings, currentUser, onMeetingCreate, onMeetingUpdate, showWeekends, startHour, endHour }) => {
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
  const dynamicSlotHeightRef = useRef(dynamicSlotHeight);
  useEffect(()=>{ dynamicSlotHeightRef.current = dynamicSlotHeight; },[dynamicSlotHeight]);
  const moveGhostSlotDeltaRef = useRef(moveGhostSlotDelta); useEffect(()=>{ moveGhostSlotDeltaRef.current = moveGhostSlotDelta; },[moveGhostSlotDelta]);
  const resizeGhostSlotDeltaRef = useRef(resizeGhostSlotDelta); useEffect(()=>{ resizeGhostSlotDeltaRef.current = resizeGhostSlotDelta; },[resizeGhostSlotDelta]);
  const resizePixelOffsetRef = useRef(resizePixelOffset); useEffect(()=>{ resizePixelOffsetRef.current = resizePixelOffset; },[resizePixelOffset]);
  // Safety: ESC cancels any active drag/resize
  useEffect(()=>{ const onKey=(e:KeyboardEvent)=>{ if(e.key==='Escape'){ setMovingMeetingId(null); setPointerDownMeeting(null); clearResizeState(); setIsSelecting(false); } }; window.addEventListener('keydown', onKey); return ()=> window.removeEventListener('keydown', onKey); },[]);

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
      const t = setTimeout(()=> setConflictMessage(null), 1500);
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
  const startResize = (e:React.MouseEvent, meeting:Meeting, edge:'start'|'end') => { e.stopPropagation(); setPointerDownMeeting(null); // reset stale rAF buffers
    if(resizeFrameRef.current) cancelAnimationFrame(resizeFrameRef.current); resizeFrameRef.current=null; resizePendingRef.current=null;
    const startIdx=timeSlots.indexOf(meeting.startTime); let endIdx=endExclusiveIdx(meeting.endTime); if(startIdx===-1||endIdx===-1) return; setResizingMeetingId(meeting.id); setResizeEdge(edge); setResizeMeta({ startIdx, endIdx, initialMouseY:e.clientY, date:meeting.date, roomId:meeting.roomId }); setResizeGhostSlotDelta(0); setResizePixelOffset(0); };
  const clearResizeState = () => { setResizingMeetingId(null); setResizeEdge(null); setResizeMeta(null); setResizeGhostSlotDelta(0); setResizePixelOffset(0); if(resizeFrameRef.current) cancelAnimationFrame(resizeFrameRef.current); resizeFrameRef.current=null; resizePendingRef.current=null; };

  useEffect(()=>{ const onMove=(e:MouseEvent)=>{ if(!resizingMeetingId || !resizeMeta || !resizeEdge) return; const slotUnit=dynamicSlotHeightRef.current+SLOT_GAP; const deltaY=e.clientY-resizeMeta.initialMouseY; const rawShift=deltaY/slotUnit; let slotDelta = rawShift>0? Math.floor(rawShift): Math.ceil(rawShift); if(resizeEdge==='end'){ slotDelta = Math.max(1-resizeMeta.endIdx+resizeMeta.startIdx, slotDelta); slotDelta = Math.min(slotDelta, timeSlots.length - resizeMeta.endIdx); } else { slotDelta = Math.min(slotDelta, resizeMeta.endIdx-1-resizeMeta.startIdx); slotDelta = Math.max(-resizeMeta.startIdx, slotDelta); } let newStartIdx = resizeMeta.startIdx + (resizeEdge==='start'? slotDelta:0); let newEndIdx = resizeMeta.endIdx + (resizeEdge==='end'? slotDelta:0); if(newStartIdx<0) newStartIdx=0; if(newEndIdx>timeSlots.length) newEndIdx=timeSlots.length; const newStart=timeSlots[newStartIdx]; const newEnd=getEndLabel(newEndIdx); if(newStart && newEnd){ const meetingCurrent = meetings.find(m=>m.id===resizingMeetingId); const roomConflictMeeting = meetings.find(m=> m.roomId===resizeMeta.roomId && m.date===resizeMeta.date && m.id!==resizingMeetingId && !(newEnd<=m.startTime || newStart>=m.endTime)); const specialistConflictMeeting = meetingCurrent ? meetings.find(m=> m.specialistId===meetingCurrent.specialistId && m.date===meetingCurrent.date && m.id!==meetingCurrent.id && !(newEnd<=m.startTime || newStart>=m.endTime)) : undefined; if(roomConflictMeeting || specialistConflictMeeting){ if(specialistConflictMeeting){ setConflictMessage('Konflikt specjalisty: pracownik ma już spotkanie w tym czasie.'); setConflictFlashId(specialistConflictMeeting.id); } else if(roomConflictMeeting){ setConflictFlashId(roomConflictMeeting.id); } return; } }
      const remainder = deltaY - slotDelta*slotUnit; if(resizePendingRef.current && resizePendingRef.current.slotDelta===slotDelta && resizePendingRef.current.remainder===remainder) return; resizePendingRef.current = { slotDelta, remainder }; if(!resizeFrameRef.current){ resizeFrameRef.current = requestAnimationFrame(()=>{ const p = resizePendingRef.current; resizeFrameRef.current=null; if(!p) return; setResizeGhostSlotDelta(p.slotDelta); setResizePixelOffset(p.remainder); }); }
    }; const onUp=()=>{ if(resizingMeetingId && resizeMeta && resizeEdge){ let newStartIdx = resizeMeta.startIdx; let newEndIdx = resizeMeta.endIdx; const ghostDelta = resizeGhostSlotDeltaRef.current; if(resizeEdge==='start'){ newStartIdx = resizeMeta.startIdx + ghostDelta; } else { newEndIdx = resizeMeta.endIdx + ghostDelta; } if(newStartIdx<0) newStartIdx=0; if(newEndIdx>timeSlots.length) newEndIdx=timeSlots.length; if(newEndIdx-newStartIdx>=1){ const newStart=timeSlots[newStartIdx]; const newEnd=getEndLabel(newEndIdx); if(newStart && newEnd){ const m=meetings.find(mm=>mm.id===resizingMeetingId); if(m && (m.startTime!==newStart || m.endTime!==newEnd)){ const roomConflictMeeting = meetings.find(mm=> mm.roomId===m.roomId && mm.date===m.date && mm.id!==m.id && !(newEnd<=mm.startTime || newStart>=mm.endTime)); const specConflictMeeting = meetings.find(mm=> mm.specialistId===m.specialistId && mm.date===m.date && mm.id!==m.id && !(newEnd<=mm.startTime || newStart>=mm.endTime)); if(roomConflictMeeting || specConflictMeeting){ if(specConflictMeeting){ setConflictMessage('Konflikt specjalisty: pracownik ma już spotkanie w tym czasie.'); setConflictFlashId(specConflictMeeting.id); } else if(roomConflictMeeting){ setConflictFlashId(roomConflictMeeting.id); } } else { onMeetingUpdate(resizingMeetingId,{ startTime:newStart, endTime:newEnd }); } } } } } clearResizeState(); }; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); return ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); if(resizeFrameRef.current) cancelAnimationFrame(resizeFrameRef.current); }; },[resizingMeetingId, resizeMeta, resizeEdge, timeSlots, meetings, onMeetingUpdate]);
  // Move (drag whole block) effect with rAF batching
  useEffect(()=>{
    const slotUnitRef=()=> dynamicSlotHeightRef.current + SLOT_GAP;
    const commitMove = () => {
      if(movingMeetingId && moveMeta){ const durationSlots = moveMeta.endIdx - moveMeta.startIdx; const ghostDelta = moveGhostSlotDeltaRef.current; const newStartIdx = moveMeta.startIdx + ghostDelta; const newEndIdx = newStartIdx + durationSlots; const newStart = timeSlots[newStartIdx]; const newEnd = getEndLabel(newEndIdx); if(newStart && newEnd){ const meeting = meetings.find(m=>m.id===movingMeetingId); if(meeting && (meeting.startTime!==newStart || meeting.endTime!==newEnd)){ const roomConflictMeeting = meetings.find(m=> m.id!==movingMeetingId && m.roomId===meeting.roomId && m.date===meeting.date && !(newEnd<=m.startTime || newStart>=m.endTime)); const specConflictMeeting = meetings.find(m=> m.id!==movingMeetingId && m.specialistId===meeting.specialistId && m.date===meeting.date && !(newEnd<=m.startTime || newStart>=m.endTime)); if(roomConflictMeeting || specConflictMeeting){ if(specConflictMeeting){ setConflictMessage('Konflikt specjalisty: pracownik ma już spotkanie w tym czasie.'); setConflictFlashId(specConflictMeeting.id); } else if(roomConflictMeeting){ setConflictFlashId(roomConflictMeeting.id); } } else { onMeetingUpdate(movingMeetingId, { startTime:newStart, endTime:newEnd }); } } } }
      setMovingMeetingId(null);
      setMoveMeta(null);
      setMovePixelOffset(0);
      setMoveGhostSlotDelta(0);
      if(moveFrameRef.current) cancelAnimationFrame(moveFrameRef.current); moveFrameRef.current=null; movePendingRef.current=null;
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
        const slotUnit = slotUnitRef();
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
        const remainder = deltaY - slotDelta * slotUnit;
        if(movePendingRef.current && movePendingRef.current.slotDelta===slotDelta && movePendingRef.current.remainder===remainder) return;
        movePendingRef.current = { slotDelta, remainder };
        if(!moveFrameRef.current){
          moveFrameRef.current = requestAnimationFrame(()=>{ const p=movePendingRef.current; moveFrameRef.current=null; if(!p) return; setMoveGhostSlotDelta(p.slotDelta); setMovePixelOffset(p.remainder); });
        }
      } else if(pointerDownMeeting && !movingMeetingId){
        initiateMoveIfThreshold(e);
      }
    };
    const onUp = () => { commitMove(); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); if(moveFrameRef.current) cancelAnimationFrame(moveFrameRef.current); };
  },[pointerDownMeeting, resizingMeetingId, movingMeetingId, moveMeta, timeSlots, meetings, onMeetingUpdate]);
  // Open meeting only on quick click release (not drag / not resize / not move)
  useEffect(()=>{ const onUp=(e:MouseEvent)=>{ if(pointerDownMeeting && !resizingMeetingId && !movingMeetingId){ const dt=Date.now()-pointerDownMeeting.t; const dy=Math.abs(e.clientY-pointerDownMeeting.y); if(dt < 250 && dy < 6){ const meeting=meetings.find(m=>m.id===pointerDownMeeting.id); if(meeting){ handleTimeSlotClick(pointerDownMeeting.dateStr, meeting.startTime, meeting, meeting.roomId); } } } setPointerDownMeeting(null); }; window.addEventListener('mouseup', onUp); return ()=>window.removeEventListener('mouseup', onUp); },[pointerDownMeeting, resizingMeetingId, movingMeetingId, meetings]);

  // Click handlers
  const handleTimeSlotClick = (date:string, time:string, meeting?:Meeting, roomId?:string) => { if(isSelecting || resizingMeetingId || movingMeetingId) return; if(currentUser.role==='employee' && meeting && meeting.specialistId!==currentUser.id) return; if(meeting){ setEditingMeeting(meeting); setSelectedTime(meeting.startTime); setFormRoomId(meeting.roomId);} else { setEditingMeeting(undefined); setSelectedTime(time); setFormRoomId(roomId);} setCurrentDate(new Date(date)); setShowMeetingForm(true); };
  const handleMeetingFormSubmit = (meetingData: Omit<Meeting,'id'>) => { if(editingMeeting){ onMeetingUpdate(editingMeeting.id, meetingData);} else { onMeetingCreate(meetingData);} setShowMeetingForm(false); setEditingMeeting(undefined); };

  // Week view (day columns, time grid like day view, meetings overlay)
  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const halfHourSlots = timeSlots;
    const slotHeight = dynamicSlotHeight;
    const slotGap = SLOT_GAP;
    const formatHourLabels = halfHourSlots.filter(t=>t.endsWith(':00'));
    const HEADER_OFFSET = 32;
    const dayColumnInnerHeight = (halfHourSlots.length*slotHeight + (halfHourSlots.length-1)*slotGap);
    const timeToIdx = (t:string)=>halfHourSlots.indexOf(t);

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
      <div className={`calendar-shell ${(isSelecting||resizingMeetingId||movingMeetingId)?'calendar-select-none':''}`} onMouseLeave={cancelSelectionIfActive}>
        <div ref={scrollAreaRef} className="calendar-scroll styled-scrollbar">
          <div className="calendar-grid" style={{gridTemplateColumns:`${TIME_COL_WIDTH}px repeat(${weekDays.length},1fr)`}}>
            <div className="calendar-time-col" style={{height:HEADER_OFFSET + dayColumnInnerHeight}}>
              <div className="calendar-time-header">Czas</div>
              {formatHourLabels.map((h,i)=> (
                <div key={h} className="calendar-hour-label" style={{top:HEADER_OFFSET + (i*2)*(slotHeight+slotGap), height:slotHeight*2+slotGap}}>{h}</div>
              ))}
              <div style={{height:dayColumnInnerHeight}} />
            </div>
            {weekDays.map(day=>{
              const dateStr = formatDateForComparison(day);
              const rawDayMeetings = meetings.filter(m=>m.date===dateStr);
              let dayMeetings: Meeting[] = rawDayMeetings.map(m=>m);
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
                const top = info.startIdx*(slotHeight+slotGap);
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
                const conflictOverride = (conflictFlashId===m.id) ? { backgroundColor:'#dc2626', borderColor:'#b91c1c', color:'#fff' } : {};
                return (
                  <div key={m.id+"_orig"}
                    onMouseDown={(e)=>{ e.preventDefault(); if(e.button!==0) return; if(resizingMeetingId) return; setPointerDownMeeting({ id:m.id, y:e.clientY, t:Date.now(), dateStr, roomId:m.roomId }); }}
                    onMouseEnter={(e)=> scheduleTooltip(`${specName}\u00A0\u00A0${m.startTime} - ${m.endTime}`, e.clientX, e.clientY+14)}
                    onMouseMove={(e)=> updateTooltipPosition(e.clientX, e.clientY+14)}
                    onMouseLeave={cancelTooltip}
                    className={`meeting-block group ${paddingClass} ${marginClass} text-[11px] ${(conflictFlashId===m.id)?'conflict-flash':''} ${m.status==='cancelled'?'cancelled':''} ${isShort?'is-short':''}`}
                    style={{top, height, left:`${leftPct}%`, width:`${widthPct}%`, zIndex:5, ...roomStyle, ...conflictOverride }}
                  >
                    <div className="meeting-block__handle" onMouseDown={(e)=>{ e.preventDefault(); startResize(e,m,'end'); }}>
                      <span className="meeting-block__handle-bar" />
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
                  const top = ghostStartIdx*(slotHeight+slotGap);
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
                  interactiveGhost = (
                    <div key={m.id+"_moveGhostLive"} className={`meeting-block meeting-move-ghost ${paddingClass}`} style={{top, height, left:`${leftPct}%`, width:`${widthPct}%`, transform:`translateY(${movePixelOffset}px)`, zIndex:6, ...roomStyle}}>
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
                  const top = (resizeEdge==='start'? ghostStartIdx : resizeMeta.startIdx)*(slotHeight+slotGap);
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
                  interactiveGhost = (
                    <div key={m.id+"_resizeGhostLive"} className={`meeting-block meeting-resize-ghost ${paddingClass}`} style={{top, height, left:`${leftPct}%`, width:`${widthPct}%`, transform, zIndex:6, ...roomStyle}}>
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
                const ghostSlots = to - from; if(ghostSlots < 1) return null;
                const top = from*(slotHeight+slotGap);
                const height = ghostSlots*slotHeight + (ghostSlots-1)*slotGap;
                const endLabel = to>=halfHourSlots.length ? getEndLabel(to) : halfHourSlots[to];
                const range = `${halfHourSlots[from]}-${endLabel}`;
                const isShort = ghostSlots===1;
                return (
                  <div className="meeting-block meeting-ghost" style={{top, height, left:0, right:0, borderColor:'#60a5fa', background:'rgba(147,197,253,0.55)', color:'#1e3a8a', zIndex:50}}>
                    <div className={`pointer-events-none select-none flex ${isShort?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                      <div className={`${isShort?'text-[12px]':'text-[11px]'} font-semibold opacity-80`}>{range}</div>
                    </div>
                  </div>
                );
              })();

              return (
                <div key={dateStr} className="calendar-day-col" style={{height:HEADER_OFFSET + dayColumnInnerHeight}}>
                  <div className="calendar-time-header" style={{flexDirection:'column',lineHeight:1.1}}>
                    <span style={{fontSize:11,fontWeight:600,textTransform:'uppercase'}}>{day.toLocaleDateString('pl-PL',{ weekday:'short'}).replace('.', '').substring(0,3)}</span>
                    <span style={{fontSize:10,fontWeight:400}}>{day.getDate().toString().padStart(2,'0')}.{(day.getMonth()+1).toString().padStart(2,'0')}</span>
                  </div>
                  <div style={{position:'relative', height:dayColumnInnerHeight}}>
                    {halfHourSlots.map(slotTime=>{ const idx = timeToIdx(slotTime); const top = idx*(slotHeight+slotGap); const inDragRange = isSelecting && selectionStart && selectionStart.dayKey===dateStr && selectionCurrentTime && isTimeInRange(slotTime, selectionStart.time, selectionCurrentTime); const occupied = dayMeetings.some(m=>{ const ms=timeToIdx(m.startTime); const me=endExclusiveIdx(m.endTime); return ms!==-1 && me!==-1 && idx>=ms && idx<me; }); return (
                      <div key={slotTime+dateStr} className={`calendar-slot rounded-md border text-[11px] flex items-center px-1 transition-colors ${occupied? 'bg-gray-100 border-gray-300':'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer'} ${inDragRange? 'bg-blue-300 !border-blue-400 text-white':''}`} style={{top, height:slotHeight, zIndex:0}} onMouseDownCapture={(e)=>{ e.preventDefault(); startDragSelection(dateStr, slotTime, undefined, dateStr); }} onMouseEnter={()=>{ updateDragSelection(dateStr, slotTime, undefined, dateStr); }} onClick={()=>{ if(!isSelecting){ handleTimeSlotClick(dateStr, slotTime); } }}>
                        <span className={`pr-1 ${occupied? 'opacity-30':'opacity-40'}`}>{slotTime}</span>
                      </div>
                    ); })}
                    {selectionGhost}
                    {meetingBlocks}
                    {interactiveGhost}
                  </div>
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
    const innerHeight = (halfHourSlots.length*slotHeight + (halfHourSlots.length-1)*slotGap);

    // Pre-build slot layer once
    const slotLayer = halfHourSlots.map(slotTime=>{
      const idx = timeToIdx(slotTime);
      const top = idx*(slotHeight+slotGap);
      return <div key={slotTime} className="calendar-slot" style={{top, height:slotHeight, zIndex:0}} />;
    });

    return (
      <div className={`calendar-shell ${(isSelecting||resizingMeetingId||movingMeetingId)?'calendar-select-none':''}`} onMouseLeave={cancelSelectionIfActive}>
        <div ref={scrollAreaRef} className="calendar-scroll styled-scrollbar">
          <div className="calendar-grid" style={{gridTemplateColumns:`${TIME_COL_WIDTH}px repeat(${rooms.length},1fr)`}}>
            <div className="calendar-time-col" style={{height:HEADER_OFFSET + innerHeight}}>
              <div className="calendar-time-header">Czas</div>
              {formatHourLabels.map((h,i)=>(<div key={h} className="calendar-hour-label" style={{top:HEADER_OFFSET + (i*2)*(slotHeight+slotGap), height:slotHeight*2+slotGap}}>{h}</div>))}
              <div style={{position:'relative', height:innerHeight}}>
                {halfHourSlots.map(slotTime=>{ const idx=timeToIdx(slotTime); const top=idx*(slotHeight+slotGap); return (
                  <div key={slotTime+"_timecol"} className="calendar-slot" style={{top, height:slotHeight, zIndex:0}} />
                ); })}
              </div>
            </div>
            {rooms.map(room=>{
              const roomDayMeetings = dayMeetings.filter(m=>m.roomId===room.id);
              const roomHeaderStyle = (()=>{ const rs = getRoomStyle(room); return { backgroundColor: rs.backgroundColor, color: rs.color, borderBottom: `1px solid ${rs.borderColor}`}; })();
              const timeToIdxLocal = timeToIdx;
              const roomMeetingBlocks = roomDayMeetings.flatMap(m=>{
                 const isResizing = resizingMeetingId===m.id;
                 const isMoving = movingMeetingId===m.id;
                 if(isResizing || isMoving) return []; // hide original while ghost shown
                 const startIdx = timeToIdxLocal(m.startTime);
                 const endIdxExclusive = endExclusiveIdx(m.endTime);
                 if(startIdx===-1||endIdxExclusive===-1) return [];
                 const slots = endIdxExclusive - startIdx;
                 const top = startIdx*(slotHeight+slotGap);
                 const height = slots*slotHeight + (slots-1)*slotGap;
                 const specialist = users.find(u=>u.id===m.specialistId);
                 const specName = specialist?specialist.name:'Specjalista';
                 const timeRange = `${m.startTime}-${m.endTime}`;
                 const roomStyle = getRoomStyle(room);
                 const enlarged = slots>1;
                 const paddingClass = enlarged ? 'px-1.5 py-1' : 'px-1.5';
                 const conflictOverride = (conflictFlashId===m.id) ? { backgroundColor:'#dc2626', borderColor:'#b91c1c', color:'#fff' } : {};
                 return (
                   <div key={m.id+"_orig"} onMouseDown={(e)=>{ e.preventDefault(); if(e.button!==0) return; if(resizingMeetingId) return; setPointerDownMeeting({ id:m.id, y:e.clientY, t:Date.now(), dateStr, roomId: room.id }); }} onMouseEnter={(e)=> scheduleTooltip(`${specName}\u00A0\u00A0${m.startTime} - ${m.endTime}`, e.clientX, e.clientY+14)} onMouseMove={(e)=> updateTooltipPosition(e.clientX, e.clientY+14)} onMouseLeave={cancelTooltip} className={`meeting-block group ${paddingClass} text-[11px] ${(resizingMeetingId===m.id)?'ring-2 ring-blue-400':''} ${conflictFlashId===m.id? 'conflict-flash':''} ${m.status==='cancelled'?'cancelled':''}`} style={{top, height, left:0, right:0, opacity:isResizing||isMoving?0.25:1, zIndex:5, ...roomStyle, ...conflictOverride}}>
                     <div className="meeting-block__handle" onMouseDown={(e)=>{ e.preventDefault(); startResize(e,m,'end'); }}><span className="meeting-block__handle-bar" /></div>
                     <div className={`pointer-events-none select-none flex ${slots===1?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                       <div className={`${slots===1?'text-[12px]':'text-[11px] mb-2'} font-semibold opacity-80`}>{timeRange}</div>
                       <div className="text-[12px] font-semibold uppercase tracking-wide truncate max-w-full">{specName}</div>
                     </div>
                   </div>
                 );
               });

              // Ghost overlay for moving/resizing (day multi-room)
              let interactiveGhost: React.ReactNode = null;
              if(movingMeetingId && moveMeta && moveMeta.roomId===room.id && dateStr===moveMeta.date){
                const m = roomDayMeetings.find(mm=>mm.id===movingMeetingId);
                if(m){
                  const durationSlots = moveMeta.endIdx - moveMeta.startIdx;
                  const ghostStartIdx = moveMeta.startIdx + moveGhostSlotDelta;
                  let gStartIdx = Math.max(0, Math.min(ghostStartIdx, halfHourSlots.length-1));
                  let gEndIdx = gStartIdx + durationSlots; if(gEndIdx>halfHourSlots.length) gEndIdx=halfHourSlots.length;
                  const top = gStartIdx*(slotHeight+slotGap);
                  const height = durationSlots*slotHeight + (durationSlots-1)*slotGap;
                  const ghostStart = halfHourSlots[gStartIdx];
                  const ghostEnd = getEndLabel(gEndIdx);
                  const specialist = users.find(u=>u.id===m.specialistId); const specName = specialist?specialist.name:'Specjalista';
                  const timeRange = `${ghostStart}-${ghostEnd}`; const isShort = durationSlots===1;
                  const roomStyle = getRoomStyle(room);
                  interactiveGhost = (
                    <div key={m.id+"_dayMoveGhost"} className="meeting-block meeting-move-ghost px-1.5 py-1" style={{top, height, left:0, right:0, transform:`translateY(${movePixelOffset}px)`, zIndex:6, ...roomStyle}}>
                      <div className={`pointer-events-none select-none flex ${isShort?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                        <div className={`${isShort?'text-[12px]':'text-[11px] mb-1'} font-semibold opacity-80`}>{timeRange}</div>
                        <div className="text-[10px] font-medium truncate max-w-full opacity-80">{specName}</div>
                      </div>
                    </div>
                  );
                }
              } else if(resizingMeetingId && resizeMeta && resizeEdge && dateStr===resizeMeta.date){
                const m = roomDayMeetings.find(mm=>mm.id===resizingMeetingId);
                if(m){
                  let ghostStartIdx = resizeMeta.startIdx; let ghostEndIdx = resizeMeta.endIdx;
                  if(resizeEdge==='start') ghostStartIdx = resizeMeta.startIdx + resizeGhostSlotDelta; else ghostEndIdx = resizeMeta.endIdx + resizeGhostSlotDelta;
                  if(ghostStartIdx<0) ghostStartIdx=0; if(ghostEndIdx>halfHourSlots.length) ghostEndIdx=halfHourSlots.length;
                  if(ghostEndIdx-ghostStartIdx<1) ghostEndIdx = ghostStartIdx+1;
                  const top = (resizeEdge==='start'? ghostStartIdx : resizeMeta.startIdx)*(slotHeight+slotGap);
                  const slots = ghostEndIdx - ghostStartIdx;
                  const height = slots*slotHeight + (slots-1)*slotGap + (resizeEdge==='end'? resizePixelOffset:0);
                  const ghostStart = halfHourSlots[ghostStartIdx]; const ghostEnd = getEndLabel(ghostEndIdx);
                  const specialist = users.find(u=>u.id===m.specialistId); const specName = specialist?specialist.name:'Specjalista';
                  const timeRange = `${ghostStart}-${ghostEnd}`; const isShort = slots===1; const transform = resizeEdge==='start'? `translateY(${resizePixelOffset}px)`:'none';
                  const room = rooms.find(r=>r.id===m.roomId); const roomStyle = getRoomStyle(room);
                  interactiveGhost = (
                    <div key={m.id+"_dayResizeGhost"} className="meeting-block meeting-resize-ghost px-1.5 py-1" style={{top, height, left:0, right:0, transform, zIndex:6, ...roomStyle}}>
                      <div className={`pointer-events-none select-none flex ${isShort?'flex-row gap-2 px-1':'flex-col'} items-center justify-center leading-tight w-full text-center`}>
                        <div className={`${isShort?'text-[12px]':'text-[11px] mb-1'} font-semibold opacity-80`}>{timeRange}</div>
                        <div className="text-[10px] font-medium truncate max-w-full opacity-80">{specName}</div>
                      </div>
                    </div>
                  );
                }
              }

              return (
                <div key={room.id} className="calendar-day-col" style={{height:HEADER_OFFSET + innerHeight}}>
                  <div className="calendar-time-header" style={{...roomHeaderStyle, fontSize:14,fontWeight:600}}>{room.name}</div>
                  <div style={{position:'relative', height:innerHeight}}>
                    <div style={{position:'absolute', inset:0, pointerEvents:'none'}}>{slotLayer}</div>
                     {/* interactive layer */}
                    {halfHourSlots.map(slotTime=>{ const idx=timeToIdx(slotTime); const top=idx*(slotHeight+slotGap); const occupiedMeeting = roomDayMeetings.find(m=>{ const ms=timeToIdx(m.startTime); const me=endExclusiveIdx(m.endTime); return ms!==-1 && me!==-1 && idx>=ms && idx<me; }); const occupied=!!occupiedMeeting; const isAvailable=!occupied; const inDragRange = isSelecting && selectionStart && selectionStart.roomId===room.id && selectionCurrentTime && isTimeInRange(slotTime, selectionStart.time, selectionCurrentTime); return (
                      <div key={slotTime+room.id}
                        className={`calendar-slot text-[11px] flex items-center px-1 transition-colors ${isAvailable?'cursor-pointer':''} ${inDragRange && isAvailable?'bg-blue-300 text-white':''}`}
                        style={{top, height:slotHeight, zIndex:1}}
                        onMouseDownCapture={(e)=>{ e.preventDefault(); if(isAvailable){ startDragSelection(dateStr, slotTime, room.id); } }}
                        onMouseEnter={()=>{ if(isAvailable){ updateDragSelection(dateStr, slotTime, room.id); } }}
                        onClick={()=>{ if(!isSelecting && isAvailable){ handleTimeSlotClick(dateStr, slotTime, undefined, room.id); } }}
                      >
                        <span className={`pointer-events-none pr-1 ${occupied? 'opacity-30':'opacity-40'}`}>{slotTime}</span>
                      </div>
                    ); })}
                    {roomMeetingBlocks /* render original blocks */}
                     {interactiveGhost}
                  </div>
                </div>
              );
            })}
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
    const startWeekday = (firstOfMonth.getDay()+6)%7; // Monday=0
    const gridStart = new Date(firstOfMonth); gridStart.setDate(firstOfMonth.getDate() - startWeekday);
    const weeks: Date[][] = [];
    for(let w=0; w<6; w++){
      const week: Date[] = [];
      for(let d=0; d<7; d++){ const day = new Date(gridStart); day.setDate(gridStart.getDate() + w*7 + d); week.push(day); }
      weeks.push(week);
      const lastDay = week[6]; if(lastDay.getMonth() !== month && lastDay.getDate() >= 7) break;
    }
    const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const todayStr = formatLocalDate(new Date());
    const meetingsByDay: Record<string, Meeting[]> = {}; meetings.forEach(m=>{ (meetingsByDay[m.date] ||= []).push(m); });
    const weekdayLabels = ['Pon','Wt','Śr','Cz','Pt','So','Nd'];

    return (
      <div className="month-shell">
        <div className="month-weekday-row">
          {weekdayLabels.map(l=> <div key={l} className="month-weekday-cell">{l}</div>)}
        </div>
        <div className="month-weeks" style={{gridTemplateRows:`repeat(${weeks.length},1fr)`}}>
          {weeks.map((week, wi)=>(
            <div key={wi} className="month-week-row">
              {week.map(day=>{
                const dateStr = formatLocalDate(day);
                const inMonth = day.getMonth()===month;
                const isToday = dateStr===todayStr;
                const isWeekend = day.getDay()===0 || day.getDay()===6;
                const dayMeetings = (meetingsByDay[dateStr]||[]).sort((a,b)=> a.startTime.localeCompare(b.startTime));
                return (
                  <div key={dateStr} className="month-day-wrapper">
                    <button className={`month-day-btn ${inMonth?'' :'is-out'} ${isWeekend && inMonth? 'is-weekend':''} ${isToday? 'is-today':''}`}
                      onClick={()=>{ setCurrentDate(day); setViewType('day'); }}
                    >
                      <div className="month-day-head">
                        <span className="month-day-number">{day.getDate()}</span>
                      </div>
                      <div className="month-day-body">
                        <div className="month-meetings-dots">
                          {dayMeetings.slice(0,36).map(m=>{ const room=rooms.find(r=>r.id===m.roomId); const rc=getRoomStyle(room); const specialist=users.find(u=>u.id===m.specialistId); const specName=specialist?specialist.name:'Specjalista'; const lines=[`${m.startTime}-${m.endTime}`, specName, room?room.name:null].filter(Boolean) as string[]; return (
                            <div key={m.id} className="month-dot" style={{background:rc.backgroundColor}} data-cancelled={m.status==='cancelled'}>
                              <div className="month-dot__tooltip">{lines.map((ln,i)=><span key={i} className="month-dot__tooltip-line">{ln}</span>)}</div>
                            </div>
                          ); })}
                          {dayMeetings.length>36 && <span style={{fontSize:10, fontWeight:600, color:'var(--color-text-muted)'}}>+{dayMeetings.length-36}</span>}
                        </div>
                      </div>
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

  // Disable text selection inside interactive calendar (drag/resize)
  useEffect(()=>{ const prevent=(e:Event)=> e.preventDefault(); window.addEventListener('selectstart', prevent, {passive:false}); return ()=> window.removeEventListener('selectstart', prevent); },[]);

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden gap-2 pb-4" style={{userSelect:'none'}}>
      <div className="flex-none"><CalendarHeader currentDate={currentDate} viewType={viewType} onDateChange={setCurrentDate} onViewTypeChange={setViewType} /></div>
      <div className="flex-1 min-h-0">{viewType==='day' && renderDayViewMultiRoom()}{viewType==='week' && renderWeekView()}{viewType==='month' && renderMonthView()}</div>
      <MeetingForm isOpen={showMeetingForm} onClose={()=>{ setShowMeetingForm(false); setEditingMeeting(undefined); setFormRoomId(undefined); }} onSubmit={handleMeetingFormSubmit} users={users} rooms={rooms} meetings={meetings} selectedDate={formatDateForComparison(currentDate)} selectedTime={selectedTime} currentUser={currentUser} editingMeeting={editingMeeting} initialRoomId={formRoomId} selectedEndTime={selectedEndTime} />
      {conflictMessage && (
        <>
          <div className="calendar-conflict-overlay" onClick={()=>setConflictMessage(null)} />
          <div className="calendar-conflict-modal" role="alertdialog" aria-modal="true">
            <div className="calendar-conflict-modal__icon" aria-hidden="true">!</div>
            <div className="calendar-conflict-modal__body">{conflictMessage}</div>
            <button className="btn btn-primary calendar-conflict-modal__close" onClick={()=>setConflictMessage(null)}>OK</button>
          </div>
        </>
      )}
      {hoverTooltip && (
        <div className="calendar-tooltip" style={{ left: hoverTooltip!.x, top: hoverTooltip!.y, transform:'translate(-50%, 6px)' }}>
          {hoverTooltip!.text}
        </div>
      )}
    </div>
  );
};

export default RoomCalendar;