import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types';
import { X, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { fetchEmployees, fetchEmployee, updateEmployee, deleteEmployee } from '../../utils/api/employees';
import { mapBackendRolesToFrontend } from '../../utils/roleMapper';
import type { Employee as ApiEmployee, Occupation } from '../../types';
import { getAllOccupations } from '../../utils/api/occupations';

interface EmployeesManageProps {
  users: User[];
  onAdd: (user: Omit<User, 'id'>) => void;
  onUpdate?: (id: string, data: Partial<User>) => void;
  onDelete?: (id: string) => void;
  // NEW: request parent to refresh backend users globally (App -> usersState)
  onBackendRefresh?: () => Promise<void> | void;
}

const EmployeesManage: React.FC<EmployeesManageProps> = ({ users, onAdd, onUpdate, onDelete, onBackendRefresh }) => {
  // Start with demo/local users; backend kept separately and shown below
  const [displayUsers, setDisplayUsers] = useState<User[]>(users);
  const [backendUsersState, setBackendUsersState] = useState<User[]>([]);

  // Helper: map API employees to local User shape
  const mapApiEmployeesToUsers = (apiEmployees: ApiEmployee[]): User[] => (
    apiEmployees.map(e => ({
      id: e.id.toString(),
      name: e.name,
      surname: e.surname,
      role: (mapBackendRolesToFrontend(e.roles)[0]) || 'employee',
      specialization: e.occupationName,
      notes: e.info || undefined,
    }))
  );

  // Helper: get auth token
  const getAuthToken = (): string | undefined => {
    const stored = localStorage.getItem('schedule_current_user');
    const parsed = stored ? (() => { try { return JSON.parse(stored); } catch { return undefined; } })() : undefined;
    return (parsed?.token as string | undefined) || localStorage.getItem('token') || undefined;
  };

  // NEW: centralized refresh of backend employees (prevents stale lists)
  const refreshBackendUsers = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const apiEmployees = await fetchEmployees(token);
      setBackendUsersState(mapApiEmployeesToUsers(apiEmployees));
    } catch (e) {
      console.warn('Nie udało się pobrać pracowników z backendu');
    }
  };

  // NEW: backend edit state aligned with API
  const [editApiData, setEditApiData] = useState<ApiEmployee | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editFetchError, setEditFetchError] = useState<string | null>(null);
  type EditDraft = { name: string; surname: string; email: string; occupationId: number; occupationName: string; info: string };
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  // Sync with incoming users (demo/local)
  useEffect(() => {
    setDisplayUsers(users);
  }, [users]);

  // Fetch backend employees on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshBackendUsers();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, []);

  // Also refresh when the window/tab regains focus
  useEffect(() => {
    const onFocus = () => { refreshBackendUsers(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Show all roles (admin, pierwszy kontakt, pracownik)
  const employeeUsers = displayUsers;
  const backendIds = new Set(backendUsersState.map(u => u.id));
  const demoUsersToShow = employeeUsers.filter(d => !backendIds.has(d.id));
  const backendUsersToShow = backendUsersState.filter(u => !demoUsersToShow.some(d => d.id === u.id));

  const [showForm, setShowForm] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // DEMO/LOCAL form state aligned to API fields
  type DemoFormDraft = {
    name: string;
    surname: string;
    email: string;
    occupationName: string;
    occupationId: string; // keep as string for input, validate/parse as number
    info: string;
  };
  const blankForm: DemoFormDraft = { name: '', surname: '', email: '', occupationName: '', occupationId: '', info: '' };
  const [formData, setFormData] = useState<DemoFormDraft>(blankForm);
  const [errors, setErrors] = useState<string[]>([]);

  // Occupations for selects
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [occLoading, setOccLoading] = useState(false);
  const [occError, setOccError] = useState<string | null>(null);

  // Custom dropdown state/refs for occupation (backend edit + demo form)
  const [showOccMenuBackend, setShowOccMenuBackend] = useState(false);
  const occBtnBackendRef = useRef<HTMLButtonElement|null>(null);
  const occMenuBackendRef = useRef<HTMLDivElement|null>(null);
  const [showOccMenuDemo, setShowOccMenuDemo] = useState(false);
  const occBtnDemoRef = useRef<HTMLButtonElement|null>(null);
  const occMenuDemoRef = useRef<HTMLDivElement|null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (showOccMenuBackend && !occMenuBackendRef.current?.contains(t) && !occBtnBackendRef.current?.contains(t)) setShowOccMenuBackend(false);
      if (showOccMenuDemo && !occMenuDemoRef.current?.contains(t) && !occBtnDemoRef.current?.contains(t)) setShowOccMenuDemo(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showOccMenuBackend, showOccMenuDemo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setOccLoading(true);
        setOccError(null);
        const list = await getAllOccupations();
        if (!cancelled) setOccupations(list);
      } catch {
        if (!cancelled) setOccError('Nie udało się pobrać listy specjalizacji');
      } finally {
        if (!cancelled) setOccLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Role label mapping
  const roleToLabel = (role: User['role']) => {
    switch (role) {
      case 'admin': return 'admin';
      case 'contact': return 'pierwszy kontakt';
      case 'employee': return 'pracownik';
      default: return 'pracownik';
    }
  };

  // Full name helper
  const fullName = (u: Pick<User, 'name' | 'surname'>) => [u.name, u.surname].filter(Boolean).join(' ');

  const resetEditApiState = () => {
    setEditApiData(null);
    setIsEditLoading(false);
    setEditFetchError(null);
    setEditDraft(null);
  };

  const openEditModal = (u: User) => {
    setModalMode('edit');
    setEditingUserId(u.id);
    setErrors([]);
    setShowForm(true);

    // Use current backendIds snapshot to determine origin
    const backendIdsNow = new Set(backendUsersState.map(b => b.id));
    const isBackendUser = backendIdsNow.has(u.id);
    if (!isBackendUser) {
      // demo user – use API-aligned local form fields
      resetEditApiState();
      const matchedOcc = occupations.find(o => o.name === (u.specialization || ''));
      setFormData({
        name: u.name || '',
        surname: u.surname || '',
        email: '',
        occupationName: matchedOcc?.name || (u.specialization || ''),
        occupationId: matchedOcc ? String(matchedOcc.id) : '',
        info: u.notes || ''
      });
      return;
    }

    const stored = localStorage.getItem('schedule_current_user');
    const token = (stored ? (() => { try { return JSON.parse(stored)?.token; } catch { return undefined; } })() : undefined) || localStorage.getItem('token') || undefined;
    if (!token) return;

    setIsEditLoading(true);
    setEditFetchError(null);
    const idNum = Number(u.id);
    if (!Number.isFinite(idNum)) {
      setIsEditLoading(false);
      setEditFetchError('Nieprawidłowe ID pracownika');
      return;
    }
    (async () => {
      try {
        const fresh = await fetchEmployee(idNum, token);
        setEditApiData(fresh);
        setEditDraft({
          name: fresh.name,
          surname: fresh.surname,
          email: fresh.email,
          occupationId: fresh.occupationId,
          occupationName: fresh.occupationName,
          info: fresh.info ?? ''
        });
      } catch (err) {
        console.warn('Nie udało się pobrać szczegółów pracownika');
        setEditFetchError('Nie udało się pobrać danych pracownika');
      } finally {
        setIsEditLoading(false);
      }
    })();
  };

  // NEW: saving state for backend edit
  const [isSavingBackend, setIsSavingBackend] = useState(false);
  const [saveBackendError, setSaveBackendError] = useState<string | null>(null);

  // Save backend changes
  const handleBackendSave = async () => {
    if (!editApiData || !editDraft) return;
    const token = getAuthToken();
    if (!token) return;
    // Simple validation
    if (!editDraft.name.trim() || !editDraft.surname.trim() || !editDraft.email.trim() || !Number.isFinite(editDraft.occupationId)) {
      setSaveBackendError('Uzupełnij wymagane pola');
      return;
    }
    setSaveBackendError(null);
    setIsSavingBackend(true);
    try {
      await updateEmployee(editApiData.id, {
        name: editDraft.name.trim(),
        surname: editDraft.surname.trim(),
        email: editDraft.email.trim(),
        occupationId: Number(editDraft.occupationId),
        info: editDraft.info?.trim() ? editDraft.info.trim() : null,
      }, token);
      // Refresh lists (local + global) and close modal
      await refreshBackendUsers();
      if (onBackendRefresh) await onBackendRefresh();
      setShowForm(false);
      resetEditApiState();
    } catch (e) {
      setSaveBackendError('Nie udało się zapisać zmian');
    } finally {
      setIsSavingBackend(false);
    }
  };

  const validate = () => {
    const errs: string[] = [];
    // Validate only for demo/local form submissions
    if (!formData.name.trim()) errs.push('Podaj imię');
    if (!formData.surname.trim()) errs.push('Podaj nazwisko');
    if (!formData.email.trim()) errs.push('Podaj email');
    const occId = Number(formData.occupationId);
    if (!Number.isFinite(occId) || occId <= 0) errs.push('Podaj prawidłowe ID specjalizacji');
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // If editing backend user, do not submit (feature coming later)
    if (modalMode === 'edit' && editApiData) {
      return;
    }
    if (!validate()) return;

    const selectedOcc = occupations.find(o => String(o.id) === String(formData.occupationId));
    // Map demo/local form to our User shape
    const payload = {
      name: formData.name.trim(),
      surname: formData.surname.trim(),
      specialization: selectedOcc?.name || '',
      role: 'employee' as const,
      notes: formData.info.trim() || undefined
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

  // NEW: Properly derive primary role from backend roles array
  const backendPrimaryRoleFromArray = (roles?: string[]): 'admin' | 'contact' | 'employee' => {
    if (!roles || roles.length === 0) return 'employee';
    const mapped = mapBackendRolesToFrontend(roles);
    if (mapped.includes('admin')) return 'admin';
    if (mapped.includes('contact')) return 'contact';
    return 'employee';
  };

  const handleDelete = (id: string) => {
    if (!confirm('Na pewno usunąć pracownika?')) return;
    onDelete && onDelete(id);
  };

  const isInactive = (u: User) => !!u.employmentEnd && (!u.employmentStart || u.employmentEnd < new Date().toISOString().split('T')[0]);

  // Delete confirmation state (backend users)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; surname: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Open delete confirmation for backend users; fallback to default for demo users
  const openDeleteDialog = (u: User) => {
    const isBackend = backendUsersState.some(b => b.id === u.id);
    if (!isBackend) {
      // use existing demo deletion flow
      handleDelete(u.id);
      return;
    }
    const idNum = Number(u.id);
    if (!Number.isFinite(idNum)) return;
    setDeleteTarget({ id: idNum, name: u.name || '', surname: u.surname || '' });
    setDeleteError(null);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const token = getAuthToken();
    if (!token) { setDeleteError('Brak tokenu uwierzytelniającego'); return; }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteEmployee(deleteTarget.id, token);
      await refreshBackendUsers();
      if (onBackendRefresh) await onBackendRefresh();
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError('Nie udało się usunąć pracownika');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">Liczba pracowników: {demoUsersToShow.length + backendUsersToShow.length}</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imię i nazwisko</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specjalizacja</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rola</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zatrudnienie</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notatki</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {demoUsersToShow.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 ${isInactive(u) ? 'opacity-60 italic' : ''}`}>
                <td className="px-4 py-3 text-sm text-gray-900">{fullName(u)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.specialization}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{roleToLabel(u.role)}</td>
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

            {backendUsersToShow.length > 0 && (
              <tr>
                <td colSpan={6} className="px-4">
                  <div className="relative mt-1 mb-2">
                    <div className="border-t-2 border-red-500"></div>
                    <div className="absolute inset-x-0 -top-3 text-center">
                      <span className="inline-block bg-white px-2 text-xs font-medium text-red-600">backend data</span>
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {backendUsersToShow.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 ${isInactive(u) ? 'opacity-60 italic' : ''}`}>
                <td className="px-4 py-3 text-sm text-gray-900">{fullName(u)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.specialization}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{roleToLabel(u.role)}</td>
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
                  <button onClick={() => openDeleteDialog(u)} className="inline-flex items-center px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs border border-red-200">
                    <Trash2 className="w-3 h-3 mr-1"/>Usuń
                  </button>
                </td>
              </tr>
            ))}

            {demoUsersToShow.length + backendUsersToShow.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">Brak pracowników</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-blue-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                {modalMode === 'edit' && (
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-50 border border-blue-100">
                    <Pencil className="w-3.5 h-3.5 text-blue-600" />
                  </span>
                )}
                {modalMode === 'add' ? 'Nowy pracownik' : 'Edytuj pracownika'}
              </h2>
              <button onClick={() => { setShowForm(false); resetEditApiState(); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            {/* If we have backend API data and are in edit mode, render API-aligned edit form */}
            {modalMode === 'edit' && (isEditLoading || editApiData || editFetchError) ? (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {isEditLoading && (
                  <div className="text-sm text-gray-500">Ładowanie danych pracownika…</div>
                )}
                {editFetchError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{editFetchError}</div>
                )}
                {editApiData && editDraft && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Imię<span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={e => setEditDraft({ ...(editDraft ?? editApiData), name: e.target.value })}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nazwisko<span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={editDraft.surname}
                          onChange={e => setEditDraft({ ...(editDraft ?? editApiData), surname: e.target.value })}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email<span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        value={editDraft.email}
                        onChange={e => setEditDraft({ ...(editDraft ?? editApiData), email: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Specjalizacja<span className="text-red-500">*</span></label>
                        <div className="relative">
                          <button
                            ref={occBtnBackendRef}
                            type="button"
                            disabled={occLoading}
                            onClick={() => !occLoading && setShowOccMenuBackend(v => !v)}
                            className={`w-full px-3 py-2 border rounded-lg text-left flex items-center justify-between ${occLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'} border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400`}
                          >
                            <span className={`text-sm ${editDraft.occupationId ? 'text-gray-900' : 'text-gray-500'}`}>
                              {editDraft.occupationName || 'Wybierz profesję...'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          </button>
                          {showOccMenuBackend && (
                            <div ref={occMenuBackendRef} className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                              <div className="max-h-60 overflow-auto py-1">
                                {occupations.map(o => (
                                  <button
                                    key={o.id}
                                    type="button"
                                    onClick={() => { setEditDraft({ ...(editDraft ?? editApiData), occupationId: o.id, occupationName: o.name }); setShowOccMenuBackend(false); }}
                                    className={`w-full text-left px-3 py-2 text-sm ${editDraft.occupationId === o.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                                  >
                                    {o.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {occError && <div className="text-xs text-red-600 mt-1">{occError}</div>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notatki</label>
                      <textarea
                        value={editDraft.info}
                        onChange={e => setEditDraft({ ...(editDraft ?? editApiData), info: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-none h-24"
                        placeholder="Uwagi kadrowe..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rola</label>
                      {(() => { const selected = backendPrimaryRoleFromArray(editApiData.roles); return (
                        <div className="flex items-center gap-6 text-sm text-gray-700">
                          {(['admin','contact','employee'] as const).map(r => (
                            <label key={r} className="inline-flex items-center gap-2">
                              <input type="radio" className="accent-blue-600" name="role_backend" value={r} checked={selected===r} readOnly disabled />
                              <span>{r === 'contact' ? 'pierwszy kontakt' : r === 'employee' ? 'pracownik' : 'admin'}</span>
                            </label>
                          ))}
                        </div>
                      ); })()}
                      <div className="mt-1 text-xs text-gray-500">Zmiana roli — dostępne wkrótce</div>
                    </div>
                    {saveBackendError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{saveBackendError}</div>
                    )}
                    <div className="flex justify-end space-x-3 pt-2">
                      <button type="button" onClick={() => { if (!isSavingBackend) { setShowForm(false); resetEditApiState(); } }} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors" disabled={isSavingBackend}>Anuluj</button>
                      {isSavingBackend ? (
                        <div className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm inline-flex items-center justify-center min-w-[140px]">
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        </div>
                      ) : (
                        <button type="button" onClick={handleBackendSave} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors text-sm">
                          Zapisz zmiany
                        </button>
                      )}
                    </div>
                  </>
                )}
              </form>
            ) : (
              // Legacy add/edit form for demo/local users (API-aligned fields)
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <ul className="list-disc list-inside space-y-1">
                      {errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Imię<span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                      placeholder="Jan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nazwisko<span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.surname}
                      onChange={e => setFormData({ ...formData, surname: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                      placeholder="Kowalski"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email<span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    placeholder="jan.kowalski@przyklad.pl"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Specjalizacja<span className="text-red-500">*</span></label>
                    <div className="relative">
                      <button
                        ref={occBtnDemoRef}
                        type="button"
                        disabled={occLoading}
                        onClick={() => !occLoading && setShowOccMenuDemo(v => !v)}
                        className={`w-full px-3 py-2 border rounded-lg text-left flex items-center justify-between ${occLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'} border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400`}
                      >
                        <span className={`text-sm ${formData.occupationId ? 'text-gray-900' : 'text-gray-500'}`}>
                          {formData.occupationName || 'Wybierz profesję...'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>
                      {showOccMenuDemo && (
                        <div ref={occMenuDemoRef} className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                          <div className="max-h-60 overflow-auto py-1">
                            {occupations.map(o => (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => { setFormData({ ...formData, occupationId: String(o.id), occupationName: o.name }); setShowOccMenuDemo(false); }}
                                className={`w-full text-left px-3 py-2 text-sm ${String(o.id) === String(formData.occupationId) ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                              >
                                {o.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {occError && <div className="text-xs text-red-600 mt-1">{occError}</div>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notatki</label>
                  <textarea
                    value={formData.info}
                    onChange={e => setFormData({ ...formData, info: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus-border-blue-400 resize-none h-24"
                    placeholder="Uwagi kadrowe..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rola</label>
                  {(() => { const selected = editingUserId ? (displayUsers.find(d => d.id === editingUserId)?.role ?? 'employee') : 'employee'; return (
                    <div className="flex items-center gap-6 text-sm text-gray-700">
                      {(['admin','contact','employee'] as const).map(r => (
                        <label key={r} className="inline-flex items-center gap-2">
                          <input type="radio" className="accent-blue-600" name="role_demo" value={r} checked={selected===r} readOnly disabled />
                          <span>{r === 'contact' ? 'pierwszy kontakt' : r === 'employee' ? 'pracownik' : 'admin'}</span>
                        </label>
                      ))}
                    </div>
                  ); })()}
                  <div className="mt-1 text-xs text-gray-500">Zmiana roli — dostępne wkrótce</div>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm">Anuluj</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors text-sm">{modalMode === 'add' ? 'Dodaj' : 'Zapisz zmiany'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-red-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-red-100">
              <h3 className="text-lg font-semibold text-gray-900">Potwierdź usunięcie</h3>
              <button onClick={() => { if (!isDeleting) setShowDeleteDialog(false); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-700">
                Czy na pewno chcesz usunąć pracownika <span className="font-medium">{deleteTarget?.name} {deleteTarget?.surname}</span>? Tej operacji nie można cofnąć.
              </p>
              {deleteError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{deleteError}</div>
              )}
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm">Anuluj</button>
                <button type="button" onClick={handleConfirmDelete} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors text-sm inline-flex items-center min-w-[120px] justify-center">
                  {isDeleting ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Usuń'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesManage;
