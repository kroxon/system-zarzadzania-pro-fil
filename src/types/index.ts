import { isInternalThread } from "worker_threads";

// Employee zgodny z API
export interface Employee {
  id: number;
  name: string;
  surname: string;
  email: string;
  occupationId: number;
  occupationName: string;
  info?: string;
  roles: string[]; // np. ['Admin', 'Employee']
}
export interface User {
  id: string;
  name: string;
  role: 'admin' | 'employee' | 'contact';
  surname: string;
  specialization?: string;
  employmentStart?: string; // YYYY-MM-DD
  employmentEnd?: string;   // YYYY-MM-DD
  notes?: string;
  token?: string;
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
  status: 'present' | 'absent' | 'cancelled' | 'in-progress';
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

//admin

export type Role = 'Admin' | 'FirstContact' | 'Employee';

export interface PendingUser {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: Role; //tutaj będzie kluczowa zmiana w przyszłości, role zamienia sie na occupation
}

export interface ApproveUser{
  role: Role;
}


//logowanie
export interface LoginRequest {
  email: string;
  password: string;
}

//logowanie odpowiedź
export interface LoginResponse{
  token: string;
  employeeId: string | number;
}

//occupations
export interface Occupation{
  id: number;
  name: string;
}

//register
export interface RegisterRequest{
  name: string;
  surname : string;
  email: string;
  password: string;
  occupationId: number
}

//events
export interface Event{
  id: number;
  name: string;
  start: string; //ISO date-time format
  end: string; //ISO date-time format
  participantIds: number[];
  statusId: number;
  roomId?: number | null;
  info?: string | null;
  guest?: string | null;
}