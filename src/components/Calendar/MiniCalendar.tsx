import React from 'react';

interface MiniCalendarProps {
  year: number;
  month: number; // 0-based
  highlightedDays: number[]; // days of month (1-based)
  onSelectDay?: (day: number) => void;
}

const daysShort = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

export const MiniCalendar: React.FC<MiniCalendarProps> = ({ year, month, highlightedDays, onSelectDay }) => {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);

  return (
    <div className="inline-block p-2 rounded-lg border bg-white shadow">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {daysShort.map(d => (
          <div key={d} className="text-xs text-center font-semibold text-gray-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => d ? (
          <button
            key={i}
            className={`w-7 h-7 rounded-full text-xs font-medium text-center transition
              ${highlightedDays.includes(d) ? 'bg-blue-500 text-white shadow' : 'text-gray-700 hover:bg-blue-100'}
            `}
            onClick={() => onSelectDay?.(d)}
          >
            {d}
          </button>
        ) : (
          <div key={i} className="w-7 h-7" />
        ))}
      </div>
    </div>
  );
};
