import React from 'react';

interface DayOff {
  id: string;
  specialistId: string;
  date: string;
  note?: string;
  groupId?: string;
}

interface MonthCalendarProps {
  currentDate: Date;
  dayOffs: DayOff[];
  monthDrag: any;
  buildDateRange: (a: string, b: string) => string[];
  formatLocalDate: (d: Date) => string;
}

const MonthCalendar: React.FC<MonthCalendarProps> = ({
  currentDate,
  dayOffs,
  monthDrag,
  buildDateRange,
  formatLocalDate
}) => {
  // Dynamic tile height (przeniesione z EmployeeCalendar)
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [tileHeight, setTileHeight] = React.useState<number>(90);
  React.useEffect(() => {
    const recalc = () => {
      if(!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const bottomMargin = 36;
      const available = viewportH - rect.top - bottomMargin;
      const headerRowHeight = 28;
      const verticalPadding = 16; // p-4 approx
      const gapY = 10;
      const rows = 6;
      const totalGaps = (rows - 1) * gapY;
      const inner = available - headerRowHeight - verticalPadding - totalGaps;
      const rawTile = inner / rows;
      const clamped = Math.max(64, Math.min(140, Math.floor(rawTile)));
      if(!Number.isNaN(clamped)) setTileHeight(clamped);
    };
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [currentDate]);

  // Helper: miesiąc (6 tygodni) start poniedziałek
  const getMonthGrid = (date: Date): Date[] => {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const isoDow = first.getDay() === 0 ? 7 : first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - (isoDow - 1));
    const days: Date[] = [];
    for(let i=0;i<42;i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    return days;
  };

  return (
    <div ref={containerRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col mb-4">
      <div className="grid grid-cols-7 gap-px bg-gray-200 rounded overflow-hidden text-[11px] font-medium text-gray-600 mb-2">
        {['Pon','Wt','Śr','Czw','Pt','Sob','Nd'].map(d=> <div key={d} className="bg-white py-1 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-[10px] flex-1">
        {getMonthGrid(currentDate).map((d: Date, i: number)=> {
          const inMonth = d.getMonth() === currentDate.getMonth();
          const dateStr = formatLocalDate(d);
          const dayOffEntry = dayOffs.find(off=> off.date === dateStr);
          const isDayOff = !!dayOffEntry;
          const groupId = dayOffEntry?.groupId;
          const todayStr = formatLocalDate(new Date());
          const isToday = dateStr === todayStr;
          const dragDates = monthDrag.active && monthDrag.moved ? buildDateRange(monthDrag.start, monthDrag.current) : [];
          const selectedDrag = monthDrag.active && monthDrag.moved && dragDates.includes(dateStr);
          const weekdayIdx = ((d.getDay()===0?7:d.getDay())-1);
          const prevDate = new Date(d); prevDate.setDate(prevDate.getDate()-1);
          const prevStr = formatLocalDate(prevDate);
          const prevWeekdayIdx = ((prevDate.getDay()===0?7:prevDate.getDay())-1);
          const prevSameRow = prevWeekdayIdx < weekdayIdx;
          const prevEntry = dayOffs.find(off=> off.date===prevStr);
          const leftConnected = !!(groupId && prevSameRow && prevEntry && prevEntry.groupId===groupId);
          const nextDate = new Date(d); nextDate.setDate(nextDate.getDate()+1);
          const nextStr = formatLocalDate(nextDate);
          const nextWeekdayIdx = ((nextDate.getDay()===0?7:nextDate.getDay())-1);
          const nextSameRow = nextWeekdayIdx > weekdayIdx;
          const nextEntry = dayOffs.find(off=> off.date===nextStr);
          const rightConnected = !!(groupId && nextSameRow && nextEntry && nextEntry.groupId===groupId);
          const groupShapeClasses = isDayOff ? (
            leftConnected && rightConnected ? 'rounded-none border-l-0' :
            leftConnected ? 'rounded-r-md rounded-l-none border-l-0' :
            rightConnected ? 'rounded-l-md rounded-r-none' : 'rounded-md'
          ) : 'rounded-lg';

          return (
            <div key={i} style={{ height: tileHeight }}
              className={`relative flex flex-col justify-start p-1.5 text-[11px] font-medium h-full transition-colors border ${inMonth? '' : 'opacity-40'} ${isDayOff? 'bg-red-100 text-red-800 border-red-200' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'} ${selectedDrag? 'ring-2 ring-blue-400 ring-offset-1' : ''} ${groupShapeClasses}`}
            >
              {isDayOff && leftConnected && <div className="absolute top-0 left-[-8px] h-full w-8 bg-red-100 pointer-events-none z-0" />}
              {isDayOff && rightConnected && <div className="absolute top-0 right-[-8px] h-full w-8 bg-red-100 pointer-events-none z-0" />}
              {isDayOff && dayOffEntry?.note && (
                <div className="absolute bottom-1 left-1 right-1 text-[10px] text-red-700 opacity-80 truncate pointer-events-none">{dayOffEntry.note}</div>
              )}
              {selectedDrag && !isDayOff && (
                <div className="absolute inset-0 bg-blue-100/60 rounded-md pointer-events-none z-10" />
              )}
              <span className={`z-10 relative ${isToday ? 'border border-blue-400 rounded-full px-1 py-0.5 bg-blue-50' : ''}`}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthCalendar;
