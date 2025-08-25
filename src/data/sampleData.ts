import { User, Room, Meeting } from '../types';

export const sampleUsers: User[] = [
  {
    id: '1',
    name: 'Anna Kowalska',
    role: 'admin',
    specialization: 'Terapeuta'
  },
  {
    id: '2',
    name: 'Piotr Nowak',
    role: 'employee',
    specialization: 'Psycholog'
  },
  {
    id: '3',
    name: 'Maria Wiśniewska',
    role: 'employee',
    specialization: 'Fizjoterapeuta'
  },
  {
    id: '4',
    name: 'Jan Kowalczyk',
    role: 'employee',
    specialization: 'Masażysta'
  }
];

export const sampleRooms: Room[] = [
  {
    id: '1',
    name: 'Gabinet A',
    capacity: 2,
    equipment: ['Łóżko rehabilitacyjne', 'Sprzęt do fizykoterapii'],
    purpose: 'Rehabilitacja',
    color: '#3b82f6'
  },
  {
    id: '2',
    name: 'Sala konsultacyjna',
    capacity: 4,
    equipment: ['Stół konferencyjny', 'Projektor'],
    purpose: 'Konsultacje',
    color: '#6366f1'
  },
  {
    id: '3',
    name: 'Gabinet B',
    capacity: 2,
    equipment: ['Łóżko masażu', 'Aromaty'],
    purpose: 'Masaż',
    color: '#0ea5e9'
  },
  {
    id: '4',
    name: 'Sala grupowa',
    capacity: 8,
    equipment: ['Maty do ćwiczeń', 'Sprzęt fitness'],
    purpose: 'Zajęcia grupowe',
    color: '#10b981'
  }
];

export const sampleMeetings: Meeting[] = [
  {
    id: '1',
    specialistId: '2',
    patientName: 'Jan Nowak',
    roomId: '1',
    date: '2025-01-15',
    startTime: '09:00',
    endTime: '10:00',
    notes: 'Sesja terapeutyczna',
    status: 'present',
    createdBy: '2'
  },
  {
    id: '2',
    specialistId: '3',
    patientName: 'Katarzyna Zielińska',
    guestName: 'Tomasz Zieliński',
    roomId: '2',
    date: '2025-01-15',
    startTime: '10:30',
    endTime: '11:30',
    notes: 'Konsultacja z rodziną',
    status: 'in-progress',
    createdBy: '3'
  },
  {
    id: '3',
    specialistId: '4',
    patientName: 'Marek Kowalski',
    roomId: '3',
    date: '2025-01-15',
    startTime: '14:00',
    endTime: '15:00',
    notes: 'Masaż relaksacyjny',
    status: 'present',
    createdBy: '1'
  },
  {
    id: '4',
    specialistId: '2',
    patientName: 'Anna Nowacka',
    roomId: '1',
    date: '2025-01-16',
    startTime: '11:00',
    endTime: '12:00',
    notes: 'Regularna sesja',
    status: 'cancelled',
    createdBy: '2'
  }
];