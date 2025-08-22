import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

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
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('pl-PL', options);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    switch (viewType) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  return (
    <div className="flex items-center justify-between mb-6 gap-4">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={() => navigateDate('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900">{formatDate(currentDate)}</h2>
        
        <button
          onClick={goToToday}
          className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
        >
          Dziś
        </button>
      </div>
      {centerContent && (
        <div className="hidden md:flex items-center justify-center gap-8 flex-1">
          {centerContent}
        </div>
      )}
      <div className="flex items-center space-x-2">
        {(['day', 'week', 'month'] as const).map((type) => (
          <button
            key={type}
            onClick={() => onViewTypeChange(type)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              viewType === type
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {type === 'day' ? 'Dzień' : type === 'week' ? 'Tydzień' : 'Miesiąc'}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CalendarHeader;