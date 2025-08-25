import { Meeting, User } from '../types';
import { Room } from '../types';

const STORAGE_KEYS = {
  MEETINGS: 'schedule_meetings',
  CURRENT_USER: 'schedule_current_user',
  ROOMS: 'schedule_rooms',
  USERS: 'schedule_users',
  PATIENTS: 'schedule_patients',
  DEMO_FLAG: 'schedule_demo_loaded',
  ASSIGNMENTS: 'schedule_therapist_assignments'
};

// Meetings persistence
export const saveMeetings = (meetings: Meeting[]): void => {
  localStorage.setItem(STORAGE_KEYS.MEETINGS, JSON.stringify(meetings));
};

export const loadMeetings = (): Meeting[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.MEETINGS);
  return stored ? JSON.parse(stored) : [];
};

export const saveCurrentUser = (user: User): void => {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
};

export const loadCurrentUser = (): User | null => {
  const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return stored ? JSON.parse(stored) : null;
};

export const addMeeting = (meeting: Meeting): Meeting[] => {
  const meetings = loadMeetings();
  const newMeetings = [...meetings, meeting];
  saveMeetings(newMeetings);
  return newMeetings;
};

export const updateMeeting = (meetingId: string, updates: Partial<Meeting>): Meeting[] => {
  const meetings = loadMeetings();
  const updatedMeetings = meetings.map(meeting =>
    meeting.id === meetingId ? { ...meeting, ...updates } : meeting
  );
  saveMeetings(updatedMeetings);
  return updatedMeetings;
};

export const deleteMeeting = (meetingId: string): Meeting[] => {
  const meetings = loadMeetings();
  const filteredMeetings = meetings.filter(meeting => meeting.id !== meetingId);
  saveMeetings(filteredMeetings);
  return filteredMeetings;
};

// Rooms persistence
export const saveRooms = (rooms: Room[]): void => {
  localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
};

export const loadRooms = (): Room[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.ROOMS);
  return stored ? JSON.parse(stored) : [];
};

export const addRoom = (room: Room): Room[] => {
  const rooms = loadRooms();
  const newRooms = [...rooms, room];
  saveRooms(newRooms);
  return newRooms;
};

export const updateRoom = (roomId: string, updates: Partial<Room>): Room[] => {
  const rooms = loadRooms();
  const updated = rooms.map(r => r.id === roomId ? { ...r, ...updates } : r);
  saveRooms(updated);
  return updated;
};

export const deleteRoom = (roomId: string): Room[] => {
  const rooms = loadRooms();
  const filtered = rooms.filter(r => r.id !== roomId);
  saveRooms(filtered);
  return filtered;
};

export const clearAllData = () => {
  Object.values(STORAGE_KEYS).forEach(k=> localStorage.removeItem(k));
};

// Users persistence (demo override only)
export const saveUsers = (users: User[]) => localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
export const loadUsers = (): User[] => { const s=localStorage.getItem(STORAGE_KEYS.USERS); return s? JSON.parse(s): []; };

// Patients persistence
import type { Patient } from '../types';
export const savePatients = (patients: Patient[]) => localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
export const loadPatients = (): Patient[] => { const s=localStorage.getItem(STORAGE_KEYS.PATIENTS); return s? JSON.parse(s): []; };

export const markDemoLoaded = () => localStorage.setItem(STORAGE_KEYS.DEMO_FLAG,'1');
export const isDemoLoaded = () => !!localStorage.getItem(STORAGE_KEYS.DEMO_FLAG);

// Therapist assignments persistence
export const saveTherapistAssignments = (map: Record<string,string[]>) => {
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(map));
};
export const loadTherapistAssignments = (): Record<string,string[]> => {
  const s = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS); return s? JSON.parse(s): {};
};