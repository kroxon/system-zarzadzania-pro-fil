// Utility to check specialist availability for a given time range
// Returns true if specialist is available, false otherwise
// Uses the same localStorage key as EmployeeCalendar
export interface AvailabilityRange {
  id: string;
  specialistId: string;
  start: string; // ISO string
  end: string;   // ISO string
}

const AVAIL_KEY = 'schedule_availabilities';

export function isSpecialistAvailable(specialistId: string, date: string, startTime: string, endTime: string): boolean {
  // date: 'YYYY-MM-DD', startTime/endTime: 'HH:mm'
  const raw = localStorage.getItem(AVAIL_KEY);
  if (!raw) return false;
  const all: AvailabilityRange[] = JSON.parse(raw);
  // Find all availabilities for this specialist on this date
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);
  const ranges = all.filter(a => a.specialistId === specialistId && new Date(a.start) <= dayEnd && new Date(a.end) >= dayStart);
  if (!ranges.length) return false;
  // Check if the requested time is fully within any available range
  const reqStart = new Date(`${date}T${startTime}`);
  const reqEnd = new Date(`${date}T${endTime}`);
  return ranges.some(r => {
    const availStart = new Date(r.start);
    const availEnd = new Date(r.end);
    return reqStart >= availStart && reqEnd <= availEnd;
  });
}
