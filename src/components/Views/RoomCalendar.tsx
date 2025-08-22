import React, { useState, useEffect, useRef } from 'react';
import CalendarHeader from '../Calendar/CalendarHeader';
import MeetingForm from '../Forms/MeetingForm';
import { generateTimeSlots } from '../../utils/timeSlots';
import { User, Room, Meeting } from '../../types';

const SLOT_HEIGHT = 24;
const SLOT_GAP = 2;

interface RoomCalendarProps { users: User[]; rooms: Room[]; meetings: Meeting[]; currentUser: User; onMeetingCreate: (m: Omit<Meeting,'id'>) => void; onMeetingUpdate: (id:string, u:Partial<Meeting>)=>void; showWeekends:boolean; startHour:number; endHour:number; }

const RoomCalendar: React.FC<RoomCalendarProps> = ({ users, rooms, meetings, currentUser, onMeetingCreate, onMeetingUpdate, showWeekends, startHour, endHour }) => {
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'day'|'week'|'month'>('week');
  const [selectedRoom, setSelectedRoom] = useState('');
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
  const [resizeDraftStart, setResizeDraftStart] = useState<string | null>(null);
  const [resizeDraftEnd, setResizeDraftEnd] = useState<string | null>(null);
  const [resizeMeta, setResizeMeta] = useState<{ startIdx:number; endIdx:number; initialMouseY:number; date:string; roomId:string;} | null>(null);
  // Click (short press) tracking for meetings
  const [pointerDownMeeting, setPointerDownMeeting] = useState<{ id:string; y:number; t:number; dateStr:string; roomId:string } | null>(null);

  // Move (drag whole block)
  const [movingMeetingId, setMovingMeetingId] = useState<string | null>(null);
  const [moveMeta, setMoveMeta] = useState<{ startIdx:number; endIdx:number; initialMouseY:number; date:string; roomId:string;} | null>(null);
  const [movePixelOffset, setMovePixelOffset] = useState(0); // smooth drag remainder
  const [moveGhostSlotDelta, setMoveGhostSlotDelta] = useState(0); // how many slots ghost shifted

  // Time slots
  const timeSlots = generateTimeSlots(startHour, endHour);
  const scrollAreaRef = useRef<HTMLDivElement|null>(null);
  const [dynamicSlotHeight, setDynamicSlotHeight] = useState<number>(SLOT_HEIGHT);

  useEffect(()=>{
    const HEADER_OFFSET_DAY = 32; // sticky room/time header height in day view
    const measure = () => {
      if(!scrollAreaRef.current) return;
      const h = scrollAreaRef.current.clientHeight;
      if(h <= 0) return;
      const effectiveHeight = viewType==='day' ? Math.max(0, h - HEADER_OFFSET_DAY) : h; // subtract header for day view
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
  const startResize = (e:React.MouseEvent, meeting:Meeting, edge:'start'|'end') => { e.stopPropagation(); setPointerDownMeeting(null); const startIdx=timeSlots.indexOf(meeting.startTime); const endIdx=timeSlots.indexOf(meeting.endTime); if(startIdx===-1||endIdx===-1) return; setResizingMeetingId(meeting.id); setResizeEdge(edge); setResizeDraftStart(meeting.startTime); setResizeDraftEnd(meeting.endTime); setResizeMeta({ startIdx, endIdx, initialMouseY:e.clientY, date:meeting.date, roomId:meeting.roomId }); };
  const clearResizeState = () => { setResizingMeetingId(null); setResizeEdge(null); setResizeDraftStart(null); setResizeDraftEnd(null); setResizeMeta(null); };
  const hasConflict = (roomId:string, date:string, start:string, end:string, excludeId:string) => meetings.some(m=> m.roomId===roomId && m.date===date && m.id!==excludeId && !(end<=m.startTime || start>=m.endTime));
  useEffect(()=>{ const onMove=(e:MouseEvent)=>{ if(!resizingMeetingId || !resizeMeta || !resizeEdge) return; const deltaY=e.clientY-resizeMeta.initialMouseY; const slotUnit=dynamicSlotHeight+SLOT_GAP; const slotDelta=Math.round(deltaY/slotUnit); let newStartIdx=resizeMeta.startIdx; let newEndIdx=resizeMeta.endIdx; if(resizeEdge==='end'){ newEndIdx=Math.min(Math.max(resizeMeta.startIdx+1, resizeMeta.endIdx+slotDelta), timeSlots.length); } else { newStartIdx=Math.max(0, Math.min(resizeMeta.startIdx+slotDelta, resizeMeta.endIdx-1)); } const newStart=timeSlots[newStartIdx]; const newEnd=timeSlots[newEndIdx]; if(newStart && newEnd){ setResizeDraftStart(newStart); setResizeDraftEnd(newEnd);} }; const onUp=()=>{ if(resizingMeetingId && resizeMeta && resizeDraftStart && resizeDraftEnd){ if(!hasConflict(resizeMeta.roomId, resizeMeta.date, resizeDraftStart, resizeDraftEnd, resizingMeetingId)){ const m=meetings.find(mm=>mm.id===resizingMeetingId); if(m && (m.startTime!==resizeDraftStart || m.endTime!==resizeDraftEnd)){ onMeetingUpdate(resizingMeetingId,{ startTime:resizeDraftStart, endTime:resizeDraftEnd }); } } } clearResizeState(); }; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); return ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }; },[resizingMeetingId, resizeMeta, resizeEdge, resizeDraftStart, resizeDraftEnd, timeSlots, meetings, onMeetingUpdate, dynamicSlotHeight]);

  // Move (drag whole block) effect
  useEffect(()=>{
    const slotUnit = dynamicSlotHeight + SLOT_GAP;
    const commitMove = () => {
      if(movingMeetingId && moveMeta){
        const durationSlots = moveMeta.endIdx - moveMeta.startIdx;
        const newStartIdx = moveMeta.startIdx + moveGhostSlotDelta;
        const newEndIdx = newStartIdx + durationSlots;
        const newStart = timeSlots[newStartIdx];
        const newEnd = timeSlots[newEndIdx];
        if(newStart && newEnd){
          const meeting = meetings.find(m=>m.id===movingMeetingId);
            if(meeting && (meeting.startTime!==newStart || meeting.endTime!==newEnd)){
              // conflict check
              const hasConflict = meetings.some(m=> m.id!==movingMeetingId && m.roomId===meeting.roomId && m.date===meeting.date && !(newEnd<=m.startTime || newStart>=m.endTime));
              if(!hasConflict){
                onMeetingUpdate(movingMeetingId, { startTime:newStart, endTime:newEnd });
              }
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
        const endIdx = timeSlots.indexOf(meeting.endTime);
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
        // clamp shift
        slotDelta = Math.max(0 - moveMeta.startIdx, Math.min(slotDelta, timeSlots.length - durationSlots - moveMeta.startIdx));
        // collision clamp
        const newStartIdx = moveMeta.startIdx + slotDelta;
        const newEndIdx = newStartIdx + durationSlots;
        const newStart = timeSlots[newStartIdx];
        const newEnd = timeSlots[newEndIdx];
        if(newStart && newEnd){
          const meeting = meetings.find(m=>m.id===movingMeetingId);
          if(meeting){
            if(meetings.some(m=> m.id!==meeting.id && m.roomId===meeting.roomId && m.date===meeting.date && !(newEnd<=m.startTime || newStart>=m.endTime))){
              // cannot move into conflict: do not update slotDelta or remainder
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
  const getRoomMeetings = () => { if(!selectedRoom) return [] as Meeting[]; return meetings.filter(m=>m.roomId===selectedRoom); };

  // Week view
  const renderWeekView = () => { /* unchanged setup */ const weekDays=getWeekDays(currentDate); const roomMeetings=getRoomMeetings(); const halfHourSlots=timeSlots; const slotHeight=dynamicSlotHeight; const slotGap=SLOT_GAP; const formatHourLabels=halfHourSlots.filter(t=>t.endsWith(':00')); const timeToIdx=(t:string)=>halfHourSlots.indexOf(t); const minutes=(t:string)=>{const [h,m]=t.split(':').map(Number); return h*60+m;}; const statusStyles=(status:Meeting['status'])=> status==='present'? 'bg-green-300 border-green-500 text-green-900' : status==='in-progress'? 'bg-yellow-300 border-yellow-500 text-yellow-900' : status==='cancelled'? 'bg-red-300 border-red-500 text-red-900 line-through' : 'bg-gray-300 border-gray-500 text-gray-800'; const dayColumnTotalHeight=halfHourSlots.length*slotHeight + (halfHourSlots.length-1)*slotGap; return (<div className={`bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full ${(isSelecting||resizingMeetingId||movingMeetingId)?'select-none':''}`} onMouseLeave={cancelSelectionIfActive}> <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto styled-scrollbar" style={{scrollbarGutter:'stable'}}> <div className="grid" style={{gridTemplateColumns:`120px repeat(${weekDays.length},1fr)`}}><div className="relative border-r border-gray-200">{formatHourLabels.map((h,i)=>(<div key={h} className="flex items-start justify-center text-[14px] font-medium text-gray-600 bg-gray-50" style={{position:'absolute', top:i*(slotHeight*2+slotGap*2), height:slotHeight*2+slotGap, left:0,right:0,paddingTop:4}}>{h}</div>))}<div style={{height:dayColumnTotalHeight}} /></div>{weekDays.map(day=>{ const dateStr=formatDateForComparison(day); const dayMeetings=roomMeetings.filter(m=>m.date===dateStr); const meetingBlocks=dayMeetings.flatMap(m=>{ const isResizing=resizingMeetingId===m.id; const isMoving=movingMeetingId===m.id; const startTime=m.startTime; const endTime=m.endTime; const startIdx=timeToIdx(startTime); const endIdxExclusive=timeToIdx(endTime); if(startIdx===-1||endIdxExclusive===-1) return []; const slots=endIdxExclusive-startIdx; const top=startIdx*(slotHeight+slotGap); const height=slots*slotHeight + (slots-1)*slotGap; const baseOpacity=((resizingMeetingId && !isResizing)||(movingMeetingId && !isMoving))?0.4:1; const originalBlock=(<div key={m.id+"_orig"} onMouseDown={(e)=>{ if(e.button!==0) return; if(resizingMeetingId) return; setPointerDownMeeting({ id:m.id, y:e.clientY, t:Date.now(), dateStr, roomId: m.roomId }); }} className={`group absolute left-1 right-1 border rounded-md px-1.5 pt-2 pb-1 text-[11px] shadow-sm cursor-pointer overflow-hidden hover:brightness-95 transition-opacity ${statusStyles(m.status)} ${(isResizing)?'ring-2 ring-blue-400':''}`} style={{top,height, opacity:isMoving?0.25:baseOpacity}} title={`${m.patientName} (${startTime}-${endTime})`}>{/* handles */}<div onMouseDown={(e)=>startResize(e,m,'start')} className="absolute top-0 left-0 right-0 h-3 cursor-n-resize flex items-start justify-center group/handleStart"><span className="w-8 h-0.5 rounded bg-blue-500/40 mt-[3px] group-hover/handleStart:bg-blue-500 transition" /></div><div onMouseDown={(e)=>startResize(e,m,'end')} className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-end justify-center group/handleEnd"><span className="w-8 h-0.5 rounded bg-blue-500/40 mb-[3px] group-hover/handleEnd:bg-blue-500 transition" /></div><div className="font-semibold truncate pb-0.5">{m.patientName}</div><div className="text-[12px] opacity-80">{startTime}-{endTime}</div></div>); if(!isMoving) return [originalBlock]; // ghost only when moving
 const durationSlots=endIdxExclusive-startIdx; const ghostStartIdx=moveMeta? moveMeta.startIdx + moveGhostSlotDelta : startIdx; const ghostTop=ghostStartIdx*(slotHeight+slotGap); const ghostHeight=height; const ghost=(<div key={m.id+"_ghost"} className={`absolute left-1 right-1 border rounded-md px-1.5 pt-2 pb-1 text-[11px] shadow-lg cursor-grabbing overflow-hidden ring-2 ring-blue-400 bg-blue-200/70 border-blue-400 text-blue-900`} style={{top:ghostTop, height:ghostHeight, transform:`translateY(${movePixelOffset}px)`, transition:'none', zIndex:50}}>{m.patientName}<div className="text-[12px] opacity-80 mt-1">{timeSlots[ghostStartIdx]}-{timeSlots[ghostStartIdx+durationSlots]}</div></div>); return [originalBlock, ghost]; }).filter(Boolean); return (<div key={dateStr} className="relative border-r last:border-r-0 border-gray-200" style={{height:dayColumnTotalHeight}}>{halfHourSlots.map(slotTime=>{ const inDragRange=isSelecting && selectionStart && selectionStart.dayKey===dateStr && selectionCurrentTime && isTimeInRange(slotTime, selectionStart.time, selectionCurrentTime); const occupiedMeeting=dayMeetings.find(m=>{ let s=m.startTime; let e=m.endTime; if(resizingMeetingId===m.id){ if(resizeDraftStart) s=resizeDraftStart; if(resizeDraftEnd) e=resizeDraftEnd; } return minutes(slotTime)>=minutes(s) && minutes(slotTime)<minutes(e); }); const occupied=!!occupiedMeeting; const isAvailable=!occupied; return (<div key={slotTime} className={`absolute left-0 right-0 rounded-md border text-[11px] flex items-center justify-start px-1 cursor-pointer transition-colors ${isAvailable?'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300':'bg-transparent border-transparent pointer-events-none'} ${inDragRange && isAvailable?'bg-blue-300 !border-blue-400 text-white':''}`} style={{top:(timeToIdx(slotTime))*(slotHeight+slotGap), height:slotHeight, zIndex:1}} onMouseDownCapture={()=>{ if(isAvailable){ startDragSelection(dateStr, slotTime, selectedRoom||undefined, dateStr);} }} onMouseEnter={()=>{ if(isAvailable){ updateDragSelection(dateStr, slotTime, selectedRoom||undefined, dateStr);} }} onClick={()=>{ if(!isSelecting && isAvailable){ handleTimeSlotClick(dateStr, slotTime, undefined, selectedRoom||undefined);} }}>{!occupied && <span className="opacity-40 pr-1">{slotTime}</span>}</div>); })}{meetingBlocks}</div>); })}</div></div></div>); };

  // Day multi-room view
  const renderDayViewMultiRoom = () => {
    const HEADER_OFFSET = 32;
    const dateStr = formatDateForComparison(currentDate);
    const dayMeetings = meetings.filter(m=>m.date===dateStr);
    const halfHourSlots = timeSlots;
    const slotHeight = dynamicSlotHeight; // now dynamic
    const slotGap = SLOT_GAP;
    const formatHourLabels = halfHourSlots.filter(t=>t.endsWith(':00'));
    const timeToIdx = (t:string)=>halfHourSlots.indexOf(t);
    const minutes = (t:string)=>{ const [h,m]=t.split(':').map(Number); return h*60+m; };
    const dayColumnTotalHeight = HEADER_OFFSET + (halfHourSlots.length*slotHeight + (halfHourSlots.length-1)*slotGap);
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden ${(isSelecting||resizingMeetingId||movingMeetingId)?'select-none':''}`} onMouseLeave={cancelSelectionIfActive}>
        <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto styled-scrollbar" style={{scrollbarGutter:'stable'}}>
          <div className="grid" style={{gridTemplateColumns:`120px repeat(${rooms.length},1fr)`}}>
            <div className="relative border-r border-gray-200 bg-gray-50" style={{height:dayColumnTotalHeight}}>
              <div className="sticky top-0 z-30 h-8 bg-white/80 backdrop-blur-sm border-b border-gray-200 flex items-center justify-center text-[14px] font-medium text-gray-500">Czas</div>
              {formatHourLabels.map((h,i)=>(<div key={h} className="flex items-start justify-center text-[14px] font-medium text-gray-600" style={{position:'absolute', top:HEADER_OFFSET + i*(slotHeight*2+slotGap*2), height:slotHeight*2+slotGap, left:0,right:0,paddingTop:4}}>{h}</div>))}
            </div>
            {rooms.map(room=>{
              const roomDayMeetings = dayMeetings.filter(m=>m.roomId===room.id);
              const meetingBlocks = roomDayMeetings.flatMap(m=>{
                const isResizing = resizingMeetingId===m.id;
                const isMoving = movingMeetingId===m.id;
                const startTime = m.startTime;
                const endTime = m.endTime;
                const startIdx = timeToIdx(startTime);
                const endIdxExclusive = timeToIdx(endTime);
                if(startIdx===-1||endIdxExclusive===-1) return [];
                const slots = endIdxExclusive-startIdx;
                const top = HEADER_OFFSET + startIdx*(slotHeight+slotGap);
                const height = slots*slotHeight + (slots-1)*slotGap;
                const originalBlock=(<div key={m.id+"_orig"} onMouseDown={(e)=>{ if(e.button!==0) return; if(resizingMeetingId) return; setPointerDownMeeting({ id:m.id, y:e.clientY, t:Date.now(), dateStr, roomId: room.id }); }} className={`group absolute left-1 right-1 border rounded-md px-1.5 pt-2 pb-1 text-[11px] shadow-sm cursor-pointer overflow-hidden hover:brightness-95 transition-opacity ${ m.status==='present'?'bg-green-300 border-green-500 text-green-900' : m.status==='in-progress'?'bg-yellow-300 border-yellow-500 text-yellow-900' : m.status==='cancelled'?'bg-red-300 border-red-500 text-red-900 line-through' : 'bg-gray-300 border-gray-500 text-gray-800' } ${(isResizing)?'ring-2 ring-blue-400':''}`} style={{top,height, opacity:isMoving?0.25:1}} title={`${m.patientName} (${startTime}-${endTime})`}><div onMouseDown={(e)=>startResize(e,m,'start')} className="absolute top-0 left-0 right-0 h-3 cursor-n-resize flex items-start justify-center group/handleStart"><span className="w-8 h-0.5 rounded bg-blue-500/40 mt-[3px] group-hover/handleStart:bg-blue-500 transition" /></div><div onMouseDown={(e)=>startResize(e,m,'end')} className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-end justify-center group/handleEnd"><span className="w-8 h-0.5 rounded bg-blue-500/40 mb-[3px] group-hover/handleEnd:bg-blue-500 transition" /></div><div className="font-semibold truncate pb-0.5">{m.patientName}</div><div className="text-[12px] opacity-80">{startTime}-{endTime}</div></div>);
                if(!isMoving) return [originalBlock];
                const durationSlots = slots;
                const ghostStartIdx = moveMeta? moveMeta.startIdx + moveGhostSlotDelta : startIdx;
                const ghostTop = HEADER_OFFSET + ghostStartIdx*(slotHeight+slotGap);
                const ghostBlock=(<div key={m.id+"_ghost"} className="absolute left-1 right-1 border rounded-md px-1.5 pt-2 pb-1 text-[11px] shadow-lg cursor-grabbing overflow-hidden ring-2 ring-blue-400 bg-blue-200/70 border-blue-400 text-blue-900" style={{top:ghostTop, height, transform:`translateY(${movePixelOffset}px)`, transition:'none', zIndex:60}}>{m.patientName}<div className="text-[12px] opacity-80 mt-1">{timeSlots[ghostStartIdx]}-{timeSlots[ghostStartIdx+durationSlots]}</div></div>);
                return [originalBlock, ghostBlock];
              }).filter(Boolean);
              return (
                <div key={room.id} className="relative border-r last:border-r-0 border-gray-200" style={{height:dayColumnTotalHeight}}>
                  <div className="sticky top-0 z-30 h-8 bg-white/80 backdrop-blur-sm border-b border-gray-200 flex items-center justify-center text-[14px] font-semibold text-gray-700">{room.name}</div>
                  {halfHourSlots.map(slotTime=>{
                    const inDragRange = isSelecting && selectionStart && selectionStart.roomId===room.id && selectionCurrentTime && isTimeInRange(slotTime, selectionStart.time, selectionCurrentTime);
                    const occupiedMeeting = roomDayMeetings.find(m=>{ let s=m.startTime; let e=m.endTime; if(resizingMeetingId===m.id){ if(resizeDraftStart) s=resizeDraftStart; if(resizeDraftEnd) e=resizeDraftEnd; } return minutes(slotTime)>=minutes(s) && minutes(slotTime)<minutes(e); });
                    const occupied = !!occupiedMeeting;
                    const isAvailable = !occupied;
                    return (
                      <div
                        key={slotTime}
                        className={`absolute left-0 right-0 rounded-md border text-[11px] flex items-center justify-start px-1 cursor-pointer transition-colors ${isAvailable?'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300':'bg-transparent border-transparent pointer-events-none'} ${inDragRange && isAvailable?'bg-blue-300 !border-blue-400 text-white':''}`}
                        style={{top:HEADER_OFFSET + (timeToIdx(slotTime))*(slotHeight+slotGap), height:slotHeight, zIndex:1}}
                        onMouseDownCapture={()=>{ if(isAvailable){ startDragSelection(dateStr, slotTime, room.id); } }}
                        onMouseEnter={()=>{ if(isAvailable){ updateDragSelection(dateStr, slotTime, room.id); } }}
                        onClick={()=>{ if(!isSelecting && isAvailable){ handleTimeSlotClick(dateStr, slotTime, undefined, room.id); } }}
                      >
                        {!occupied && <span className="opacity-40 pr-1">{slotTime}</span>}
                      </div>
                    );
                  })}
                  {meetingBlocks}
                  <div className="absolute top-0 left-0 right-0 pointer-events-none select-none text-center text-[11px] font-medium text-gray-700 bg-white/60 backdrop-blur-sm py-1 shadow-sm">{room.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (<div className={`flex flex-col flex-1 h-full min-h-0 overflow-hidden ${viewType==='day'?'gap-2':'space-y-6'} pb-4`}>{/* full height inside parent */}
    {viewType!=='day' && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-none">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Wybierz salę (dla widoku tygodnia)</label>
            <select value={selectedRoom} onChange={(e)=>setSelectedRoom(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Wszystkie</option>
              {rooms.map(r=> <option key={r.id} value={r.id}>{r.name} (pojemność: {r.capacity} os.)</option>)}
            </select>
          </div>
          {selectedRoom && (
            <div className="space-y-2">{(()=>{ const selectedRoomData=rooms.find(r=>r.id===selectedRoom); return selectedRoomData ? (
              <div className="text-sm text-gray-600">
                <p><strong>Pojemność:</strong> {selectedRoomData.capacity} osób</p>
                <p><strong>Wyposażenie:</strong> {selectedRoomData.equipment.join(', ')}</p>
                <p><strong>Rezerwacji dziś:</strong> {meetings.filter(m=>m.roomId===selectedRoom && m.date===formatDateForComparison(new Date())).length}</p>
              </div>) : null; })()}</div>
          )}
        </div>
      </div>
    )}
    <div className="flex-none"><CalendarHeader currentDate={currentDate} viewType={viewType} onDateChange={setCurrentDate} onViewTypeChange={setViewType} centerContent={<div className="flex items-center gap-8 text-xs text-gray-600"><div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-gray-50 border border-gray-300" /> Dostępny</div><div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-red-50 border border-red-300" /> Niedostępny</div></div>} /></div>
    <div className="flex-1 min-h-0">{viewType==='day' && renderDayViewMultiRoom()}{viewType==='week' && (selectedRoom ? renderWeekView() : <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-gray-500 text-center h-full flex items-center justify-center">Wybierz salę aby zobaczyć widok tygodnia</div>)}{viewType==='month' && (<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full"><p className="text-gray-500 text-center py-8">Widok miesięczny będzie dostępny w przyszłych wersjach</p></div>)}</div>
    <MeetingForm isOpen={showMeetingForm} onClose={()=>{ setShowMeetingForm(false); setEditingMeeting(undefined); setFormRoomId(undefined); }} onSubmit={handleMeetingFormSubmit} users={users} rooms={rooms} meetings={meetings} selectedDate={formatDateForComparison(currentDate)} selectedTime={selectedTime} currentUser={currentUser} editingMeeting={editingMeeting} initialRoomId={formRoomId} selectedEndTime={selectedEndTime} />
  </div>);
};

export default RoomCalendar;