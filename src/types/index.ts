export interface User {
  id: string;
  name: string;
  role: 'admin' | 'employee';
  specialization?: string;
  employmentStart?: string; // YYYY-MM-DD
  employmentEnd?: string;   // YYYY-MM-DD
  notes?: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string; // YYYY-MM-DD
  status?: string; // placeholder status (e.g., 'aktywny')
  notes?: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  equipment: string[];
}

export interface Meeting {
  id: string;
  specialistId: string;
  patientName: string;
  guestName?: string;
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  status: 'present' | 'cancelled' | 'in-progress';
  createdBy: string;
}

export interface CalendarView {
  type: 'day' | 'week' | 'month';
  date: Date;
}

export interface TimeSlot {
  hour: string;
  isAvailable: boolean;
  meeting?: Meeting;
}