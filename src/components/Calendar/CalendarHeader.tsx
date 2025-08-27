import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarHeaderProps {
  currentDate: Date;
  viewType: 'day' | 'week' | 'month';
  onDateChange: (date: Date) => void;
  onViewTypeChange: (viewType: 'day' | 'week' | 'month') => void;
  centerContent?: React.ReactNode; // NEW
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  viewType,
  onDateChange,
  onViewTypeChange,
  centerContent
}) => {
  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('pl-PL', options);
  };
  const formatRangeWeek = (date: Date) => {
    const d = new Date(date); const day = (d.getDay()+6)%7; const start = new Date(d); start.setDate(d.getDate()-day); const end = new Date(start); end.setDate(start.getDate()+6);
    const sameMonth = start.getMonth()===end.getMonth() && start.getFullYear()===end.getFullYear();
    if(sameMonth){ return `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString('pl-PL', { month:'long', year:'numeric'})}`; }
    const startStr = start.toLocaleDateString('pl-PL', { day:'numeric', month:'short' }).replace('.', '');
    const endStr = end.toLocaleDateString('pl-PL', { day:'numeric', month:'long', year:'numeric' });
    return `${startStr} – ${endStr}`;
  };
  const formatMonth = (date: Date) => date.toLocaleDateString('pl-PL', { month:'long', year:'numeric' });
  const displayLabel = viewType==='week' ? formatRangeWeek(currentDate) : viewType==='month' ? formatMonth(currentDate) : formatDate(currentDate);
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    switch (viewType) { case 'day': newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1)); break; case 'week': newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7)); break; case 'month': newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1)); break; }
    onDateChange(newDate);
  };
  const goToToday = () => { onDateChange(new Date()); };

  return (
    <div className="calendar-header">
      <div className="calendar-header__left">
        <div className="btn-group">
          <button onClick={() => navigateDate('prev')} className="icon-btn" aria-label="Poprzedni">
            <ChevronLeft className="icon" />
          </button>
          <button onClick={() => navigateDate('next')} className="icon-btn" aria-label="Następny">
            <ChevronRight className="icon" />
          </button>
        </div>
        <h2 className="calendar-header__title">{displayLabel}</h2>
        <button onClick={goToToday} className="btn btn-outline btn-today">Dziś</button>
      </div>
      {centerContent && <div className="calendar-header__center">{centerContent}</div>}
      <div className="calendar-header__right">
        <div className="segmented">
          {(['day','week','month'] as const).map(type=> (
            <button key={type} onClick={()=>onViewTypeChange(type)} className={`segmented__btn ${viewType===type? 'is-active':''}`}>{type==='day'? 'Dzień' : type==='week'? 'Tydzień':'Miesiąc'}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarHeader;