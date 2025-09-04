export interface User {
  id: string;
  name: string;
  surname: string;
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
  therapists?: string[]; // przypisani specjaliści (tylko ID pracowników)
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  equipment: string[];
  // NEW optional extended attributes
  purpose?: string;
  color?: string; // hex color used for UI accents
}

export interface Meeting {
  id: string;
  // Legacy single specialist & patient (kept for backward compatibility)
  specialistId: string; // primary specialist (first of specialistIds)
  patientName: string; // primary patient full name (first of patientNames)
  patientId?: string; // primary patient id
  guestName?: string;
  // NEW multi-participant support
  specialistIds?: string[]; // all participating specialists
  patientIds?: string[];    // all participating patients
  patientNamesList?: string[]; // cached full names for display (order corresponds to patientIds)
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  status: 'present' | 'cancelled' | 'in-progress';
  createdBy: string;
}

export interface PatientVisit {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  specialistId: string;
  roomId: string;
  startTime: string;
  endTime: string;
  status: 'planned' | 'done' | 'cancelled';
  notes?: string;
}

export interface Availability {
  id: string;
  specialistId: string; // ID specjalisty do którego przypisana jest dostępność
  startDate: string; // YYYY-MM-DD HH:mm (data i godzina rozpoczęcia dostępności)
  endDate: string;   // YYYY-MM-DD HH:mm (data i godzina zakończenia dostępności)
  notes?: string;    // opcjonalne notatki dotyczące dostępności
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