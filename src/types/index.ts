// Employee zgodny z API
export interface Employee {
  id: number;
  name: string;
  surname: string;
  email: string;
  occupationId: number;
  occupationName: string; //np. terapeuta 
  info?: string | null;
  roles: string[]; // admin, contact, employee
}

export interface UpdateEmployee {
  name: string;
  surname: string;
  info?: string | null;
  email: string;
  occupationId: number;
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

// export interface PatientDemo {
//   id: string;
//   firstName: string;
//   lastName: string;
//   birthDate?: string; // YYYY-MM-DD
//   status?: string; // placeholder status (e.g., 'aktywny')
//   notes?: string;
//   therapists?: string[]; // przypisani specjaliści (tylko ID pracowników)
// }

export interface Room {
  id: string;
  name: string;
  hexColor: string; // hex color used for UI accents
}

export interface Meeting {
  id: string;
  // Legacy single specialist & patient (kept for backward compatibility)
  specialistId: string; // primary specialist (first of specialistIds)
  // Optional meeting title/name (maps from backend Event.name)
  name?: string;
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

export interface ApproveUser {
  role: Role;
}


//logowanie
export interface LoginRequest {
  email: string;
  password: string;
}

//logowanie odpowiedź
export interface LoginResponse {
  token: string;
  employeeId: string | number;
}

//register
export interface RegisterRequest {
  name: string;
  surname: string;
  email: string;
  password: string;
  occupationId: number
}

//forgot password

export interface ForgotPasswordRequest {
  email: string;
}


//reset password

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}


//occupations
export interface Occupation {
  id: number;
  name: string;
}

export interface CreateOccupation {
  name: string;
}

export interface UpdateOccupation {
  name: string;
}




//events
export interface Event {
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

export interface CreateEvent {
  name: string;
  start: string; // ISO date-time
  end: string;   // ISO date-time
  participantIds: number[];
  roomId?: number | null;
  info?: string | null;
}

export interface PatchEventPersons {
  addPersonsIds?: number[];
  removePersonsIds?: number[];
}


//event statuses
export interface EventStatus {
  id: number;
  name: string;
}

//patients
export interface Patient {
  id: number;
  name: string;
  surname: string;
  info?: string | null;
  birthDate: string;
  assignedEmployeesIds: number[];
  isActive: boolean;
}


export interface CreatePatient {
  name: string;
  surname: string;
  info?: string | null;
  birthDate: string;
}

export interface UpdatePatient {
  name: string;
  surname: string;
  info?: string | null;
  birthDate: string;
}



export type PatientStatus = 'aktywny' | 'nieaktywny';

//rooms

export interface RoomAPI {
  id: number;
  name: string;
  hexColor: string; 
}

export interface CreateRoom {
  name: string;
  hexColor: string;

}

export interface UpdateRoom {
  name: string;
  hexColor: string;
}


//workhours

export interface WorkHours {
  id: number;
  start: string;
  end: string;
  employeeId: number;
}

export interface CreateWorkHours {
  start: string;
  end: string;
  employeeId: number;
}

export interface UpdateWorkHours {
  start: string;
  end: string;
  employeeId: number;
}

//tasks
export interface EmployeeTask{
  id: number;
  name: string;
  isCompleted: boolean;
  dueDate: string;
  assignedEmployeesIds: number[]
};

export interface CreateEmployeeTask {
  name: string;
  isCompleted: boolean;
  dueDate: string;
  assignedEmployeesIds: number[];
}

export interface UpdateEmployeeTask {
  name: string;
  isCompleted: boolean;
  dueDate: string;
  assignedEmployeesIds: number[];
}