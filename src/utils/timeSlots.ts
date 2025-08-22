export const generateTimeSlots = (startHour: number = 8, endHour: number = 17): string[] => {
  // endHour traktowane jako godzina zamknięcia (ostatni slot kończy się o endHour)
  const slots: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
};

export const formatTimeSlot = (time: string): string => {
  return time;
};

export const isTimeSlotAvailable = (
  date: string,
  time: string,
  meetings: any[],
  resourceId?: string,
  resourceType?: 'employee' | 'room'
): boolean => {
  return !meetings.some(meeting => {
    const meetingDate = meeting.date;
    const meetingStartTime = meeting.startTime;
    const meetingEndTime = meeting.endTime;
    
    if (meetingDate !== date) return false;
    
    const slotTime = parseInt(time.replace(':', ''));
    const startTime = parseInt(meetingStartTime.replace(':', ''));
    const endTime = parseInt(meetingEndTime.replace(':', ''));
    
    const isTimeConflict = slotTime >= startTime && slotTime < endTime;
    
    if (!isTimeConflict) return false;
    
    if (resourceType === 'employee') {
      return meeting.specialistId === resourceId;
    } else if (resourceType === 'room') {
      return meeting.roomId === resourceId;
    }
    
    return true;
  });
};