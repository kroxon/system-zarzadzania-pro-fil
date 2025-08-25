import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Meeting, User, Room } from '../../types';

interface MeetingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (meeting: Omit<Meeting, 'id'>) => void;
  users: User[];
  rooms: Room[];
  meetings: Meeting[];
  selectedDate: string;
  selectedTime: string;
  currentUser: User;
  editingMeeting?: Meeting;
  // NEW: when opening form from room column in day view
  initialRoomId?: string;
  selectedEndTime?: string; // NEW optional end time from drag selection
}

interface MeetingFormState {
  specialistId: string;
  patientName: string;
  guestName: string;
  roomId: string;
  startTime: string;
  endTime: string;
  notes: string;
  status: Meeting['status'];
}

const MeetingForm: React.FC<MeetingFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  users,
  rooms,
  meetings,
  selectedDate,
  selectedTime,
  currentUser,
  editingMeeting,
  initialRoomId,
  selectedEndTime // NEW
}) => {
  const computeDefaultEnd = (start: string): string => {
    if (!start) return '';
    const [h, m] = start.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m + 30, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // helpery konfliktów (pełny przedział)
  const toMin = (t:string) => { const [h,m]=t.split(':').map(Number); return h*60+m; };
  const overlap = (s1:string,e1:string,s2:string,e2:string) => !(toMin(e1) <= toMin(s2) || toMin(s1) >= toMin(e2));
  const specialistHasConflict = (specialistId:string, date:string, start:string, end:string, excludeId?:string) => meetings.some(m=> m.id!==excludeId && m.date===date && m.specialistId===specialistId && overlap(start,end,m.startTime,m.endTime));
  const roomHasConflict = (roomId:string, date:string, start:string, end:string, excludeId?:string) => meetings.some(m=> m.id!==excludeId && m.date===date && m.roomId===roomId && overlap(start,end,m.startTime,m.endTime));

  const [formData, setFormData] = useState<MeetingFormState>({
    specialistId: currentUser.role === 'employee' ? currentUser.id : '',
    patientName: '',
    guestName: '',
    roomId: initialRoomId || '',
    startTime: selectedTime,
    endTime: selectedEndTime || computeDefaultEnd(selectedTime), // NEW use passed end or +30m
    notes: '',
    status: 'present'
  });

  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (editingMeeting) {
      setFormData({
        specialistId: editingMeeting.specialistId,
        patientName: editingMeeting.patientName,
        guestName: editingMeeting.guestName || '',
        roomId: editingMeeting.roomId,
        startTime: editingMeeting.startTime,
        endTime: editingMeeting.endTime,
        notes: editingMeeting.notes || '',
        status: editingMeeting.status
      });
    } else {
      setFormData({
        specialistId: currentUser.role === 'employee' ? currentUser.id : '',
        patientName: '',
        guestName: '',
        roomId: initialRoomId || '',
        startTime: selectedTime,
        endTime: selectedEndTime || computeDefaultEnd(selectedTime), // NEW
        notes: '',
        status: 'present'
      });
    }
  }, [editingMeeting, currentUser, selectedTime, initialRoomId, selectedEndTime]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.specialistId) {
      newErrors.push('Wybierz specjalistę');
    }

    if (!formData.patientName.trim()) {
      newErrors.push('Wprowadź nazwę pacjenta');
    }

    if (!formData.roomId) {
      newErrors.push('Wybierz salę');
    }

    if (!formData.startTime || !formData.endTime) {
      newErrors.push('Określ godziny spotkania');
    }

    if (formData.startTime && formData.endTime) {
      const startM = toMin(formData.startTime);
      const endM = toMin(formData.endTime);
      if (endM <= startM) {
        newErrors.push('Godzina zakończenia musi być późniejsza niż rozpoczęcia');
      }
    }

    // Sprawdź dostępność specjalisty (również przy edycji, z pominięciem bieżącego spotkania)
    if (formData.specialistId && formData.startTime && formData.endTime) {
      const conflict = specialistHasConflict(formData.specialistId, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id);
      if (conflict) {
        newErrors.push('Specjalista jest niedostępny w tym przedziale czasu');
      }
    }

    // Sprawdź dostępność sali (również przy edycji, z pominięciem bieżącego spotkania)
    if (formData.roomId && formData.startTime && formData.endTime) {
      const conflict = roomHasConflict(formData.roomId, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id);
      if (conflict) {
        newErrors.push('Sala jest zajęta w tym przedziale czasu');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit({
        ...formData,
        date: selectedDate,
        createdBy: currentUser.id
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  const availableSpecialists = currentUser.role === 'admin' 
    ? users.filter(user => user.role === 'employee')
    : users.filter(user => user.id === currentUser.id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingMeeting ? 'Edytuj spotkanie' : 'Nowe spotkanie'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-sm font-medium text-red-800">Błędy formularza:</span>
              </div>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specjalista
            </label>
            <select
              value={formData.specialistId}
              onChange={(e) => setFormData({ ...formData, specialistId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={currentUser.role === 'employee'}
            >
              <option value="">Wybierz specjalistę</option>
              {availableSpecialists.map(user => {
                const disabledOpt = !!(formData.startTime && formData.endTime && specialistHasConflict(user.id, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id) && user.id !== formData.specialistId);
                return (
                  <option key={user.id} value={user.id} disabled={disabledOpt}>
                    {user.name} - {user.specialization}{disabledOpt ? ' (zajęty)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pacjent
            </label>
            <input
              type="text"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Imię i nazwisko pacjenta"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gość (opcjonalnie)
            </label>
            <input
              type="text"
              value={formData.guestName}
              onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Imię i nazwisko gościa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sala
            </label>
            <select
              value={formData.roomId}
              onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Wybierz salę</option>
              {rooms.map(room => {
                const disabledOpt = !!(formData.startTime && formData.endTime && roomHasConflict(room.id, selectedDate, formData.startTime, formData.endTime, editingMeeting?.id) && room.id !== formData.roomId);
                return (
                  <option key={room.id} value={room.id} disabled={disabledOpt}>
                    {room.name} - {room.capacity} os. {disabledOpt ? '(Zajęta)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Godzina rozpoczęcia
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Godzina zakończenia
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="present">Obecny</option>
              <option value="in-progress">W toku</option>
              <option value="cancelled">Odwołany</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notatki
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Dodatkowe informacje o spotkaniu"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
            >
              {editingMeeting ? 'Zapisz zmiany' : 'Utwórz spotkanie'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeetingForm;