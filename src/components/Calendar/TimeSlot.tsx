import React from 'react';
import { Meeting } from '../../types';

interface TimeSlotProps {
  time: string;
  isAvailable: boolean;
  meeting?: Meeting;
  onClick: () => void;
  className?: string;
  compact?: boolean; // new prop
  onMouseDownCapture?: (e: React.MouseEvent) => void; // NEW
  onMouseEnter?: (e: React.MouseEvent) => void; // FIX rename
}

const TimeSlot: React.FC<TimeSlotProps> = ({
  time,
  isAvailable,
  meeting,
  onClick,
  className = '',
  compact = false,
  onMouseDownCapture,
  onMouseEnter
}) => {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'in-progress':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-600';
    }
  };

  const baseClasses = `
    min-h-[30px] p-2 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md select-none
    ${className}
  `;

  if (!isAvailable && meeting) {
    return (
      <div className={`${baseClasses} ${getStatusColor(meeting.status)} ${compact ? 'p-1 min-h-[20px]' : ''}`}
           onClick={onClick}
           onMouseDownCapture={onMouseDownCapture}
           onMouseEnter={onMouseEnter}>
        <div className="text-[10px] font-medium mb-0.5">{time}</div>
        {!compact && (
          <>
            <div className="text-sm font-semibold">{meeting.patientName}</div>
            {meeting.notes && (
              <div className="text-xs mt-1 opacity-80">{meeting.notes}</div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${compact ? 'p-1 min-h-[20px]' : ''} ${
        isAvailable
          ? 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-300'
          : 'bg-red-50 border-red-200'
      }`}
      onClick={onClick}
      onMouseDownCapture={onMouseDownCapture}
      onMouseEnter={onMouseEnter}
    >
      <div className="text-[10px] text-gray-500">{time}</div>
      {!compact && (
        isAvailable ? (
          <div className="text-xs text-gray-400 mt-1">Dostępne</div>
        ) : (
          <div className="text-xs text-red-500 mt-1">Zajęte</div>
        )
      )}
    </div>
  );
};

export default TimeSlot;