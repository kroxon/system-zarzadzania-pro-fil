import React, { useState } from 'react';
import { User } from '../../types';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';

interface EmployeesManageProps {
  users: User[];
  onAdd: (user: Omit<User, 'id'>) => void;
  onUpdate?: (id: string, data: Partial<User>) => void;
  onDelete?: (id: string) => void;
}

const EmployeesManage: React.FC<EmployeesManageProps> = ({ users, onAdd, onUpdate, onDelete }) => {
  const employeeUsers = users.filter(u => u.role !== 'admin');
  const [showForm, setShowForm] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const blankForm = { name: '', specialization: '', employmentStart: '', employmentEnd: '', notes: '' };
  const [formData, setFormData] = useState(blankForm);
  const [errors, setErrors] = useState<string[]>([]);

  const openAddModal = () => {
    setModalMode('add');
    setEditingUserId(null);
    setFormData(blankForm);
    setErrors([]);
    setShowForm(true);
  };

  const openEditModal = (u: User) => {
    setModalMode('edit');
    setEditingUserId(u.id);
    setFormData({
      name: u.name || '',
      specialization: u.specialization || '',
      employmentStart: u.employmentStart || '',
      employmentEnd: u.employmentEnd || '',
      notes: u.notes || ''
    });
    setErrors([]);
    setShowForm(true);
  };

  const validate = () => {
    const errs: string[] = [];
    if (!formData.name.trim()) errs.push('Podaj imię i nazwisko');
    if (!formData.specialization.trim()) errs.push('Podaj specjalizację');
    if (formData.employmentEnd && formData.employmentStart && formData.employmentEnd < formData.employmentStart) errs.push('Data zakończenia przed datą rozpoczęcia');
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: formData.name.trim(),
      specialization: formData.specialization.trim(),
      role: 'employee' as const,
      employmentStart: formData.employmentStart || undefined,
      employmentEnd: formData.employmentEnd || undefined,
      notes: formData.notes.trim() || undefined
    };

    if (modalMode === 'add') {
      onAdd(payload);
    } else if (modalMode === 'edit' && editingUserId && onUpdate) {
      onUpdate(editingUserId, payload);
    }

    setShowForm(false);
    setEditingUserId(null);
    setFormData(blankForm);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Na pewno usunąć pracownika?')) return;
    onDelete && onDelete(id);
  };

  const isInactive = (u: User) => !!u.employmentEnd && (!u.employmentStart || u.employmentEnd < new Date().toISOString().split('T')[0]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">Liczba pracowników: {employeeUsers.length}</div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" /> Nowy pracownik
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imię i nazwisko</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specjalizacja</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zatrudnienie</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notatki</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {employeeUsers.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 ${isInactive(u) ? 'opacity-60 italic' : ''}`}>
                <td className="px-4 py-3 text-sm text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.specialization}</td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  <div>{u.employmentStart || '—'} → {u.employmentEnd || 'obecnie'}</div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  <div className="max-w-xs truncate" title={u.notes}>{u.notes || '—'}</div>
                </td>
                <td className="px-4 py-3 text-sm text-right space-x-2">
                  <button onClick={() => openEditModal(u)} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-xs border border-blue-200">
                    <Pencil className="w-3 h-3 mr-1"/>Edytuj
                  </button>
                  <button onClick={() => handleDelete(u.id)} className="inline-flex items-center px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs border border-red-200">
                    <Trash2 className="w-3 h-3 mr-1"/>Usuń
                  </button>
                </td>
              </tr>
            ))}
            {employeeUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Brak pracowników</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{modalMode === 'add' ? 'Nowy pracownik' : 'Edytuj pracownika'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <ul className="list-disc list-inside space-y-1">
                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imię i nazwisko</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Jan Kowalski"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specjalizacja</label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={e => setFormData({ ...formData, specialization: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Psycholog"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data rozpoczęcia</label>
                  <input
                    type="date"
                    value={formData.employmentStart}
                    onChange={e => setFormData({ ...formData, employmentStart: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data zakończenia</label>
                  <input
                    type="date"
                    value={formData.employmentEnd}
                    onChange={e => setFormData({ ...formData, employmentEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notatki</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-24"
                  placeholder="Uwagi kadrowe..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm">Anuluj</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors text-sm">{modalMode === 'add' ? 'Dodaj' : 'Zapisz zmiany'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesManage;
