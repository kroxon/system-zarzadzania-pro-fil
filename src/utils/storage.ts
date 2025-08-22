import { Meeting, User } from '../types';

const STORAGE_KEYS = {
  MEETINGS: 'schedule_meetings',
  CURRENT_USER: 'schedule_current_user',
};

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