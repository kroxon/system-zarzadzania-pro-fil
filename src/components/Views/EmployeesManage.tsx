import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types';
import { X, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { fetchEmployees, fetchEmployee, updateEmployee, deleteEmployee, assignPatientsToEmployee, unassignPatientsFromEmployee } from '../../utils/api/employees';
import { mapBackendRolesToFrontend } from '../../utils/roleMapper';
import type { Employee as ApiEmployee, Occupation, Patient } from '../../types';
import { fetchPatients } from '../../utils/api/patients';
import { getAllOccupations, updateOccupation, deleteOccupation as deleteOccupationApi } from '../../utils/api/occupations';

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
      assignedPatientsIds: e.assignedPatientsIds || [],
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
  // Patients data for assignment UI
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  // Loading/error for assignment persistence when saving (not per-click now)
  const [assignActionLoading, setAssignActionLoading] = useState<boolean>(false);
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [onlyActivePatients, setOnlyActivePatients] = useState<boolean>(true); // default aktywni
  const [onlyAssignedPatients, setOnlyAssignedPatients] = useState<boolean>(false); // nowy filtr 'Przypisani'
  // Draft list of assigned patients – changes persisted only on final save
  const [draftAssignedPatientIds, setDraftAssignedPatientIds] = useState<number[]>([]);
  const normalized = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const filteredPatients = allPatients
    .filter(p => !onlyActivePatients || p.isActive)
    .filter(p => !onlyAssignedPatients || (draftAssignedPatientIds.includes(p.id)))
    .filter(p => {
      if (!patientSearch.trim()) return true;
      const q = normalized(patientSearch.trim());
      return normalized(p.name).includes(q) || normalized(p.surname).includes(q) || normalized(`${p.surname} ${p.name}`).includes(q) || normalized(`${p.name} ${p.surname}`).includes(q);
    })
    .sort((a,b) => a.surname.localeCompare(b.surname,'pl',{sensitivity:'base'}));
  // (Relacja column prep) will extend filtering later (tylko aktywni)

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

  // Default sorting by surname (Polish locale, case-insensitive)
  const sortBySurname = (arr: User[]) => [...arr].sort((a, b) => (a.surname || '').localeCompare(b.surname || '', 'pl', { sensitivity: 'base' }));
  const demoUsersSorted = sortBySurname(demoUsersToShow);
  const backendUsersSorted = sortBySurname(backendUsersToShow);

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
  // Occupations CRUD local UI state
  const [occActionLoading, setOccActionLoading] = useState(false);
  const [editingOccId, setEditingOccId] = useState<number | null>(null);
  const [editingOccName, setEditingOccName] = useState('');
  const [occCrudError, setOccCrudError] = useState<string | null>(null);
  // Dynamic table height
  const tablesLayoutRef = useRef<HTMLDivElement | null>(null);
  const [tablesMaxHeight, setTablesMaxHeight] = useState<number | null>(null);
  useEffect(() => {
    const recompute = () => {
      if (!tablesLayoutRef.current) return;
      const rect = tablesLayoutRef.current.getBoundingClientRect();
      const marginBottom = 32; // odstęp od dołu okna
      const available = window.innerHeight - rect.top - marginBottom;
      setTablesMaxHeight(available > 260 ? available : 260); // minimalna sensowna wysokość
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, []);

  const refreshOccupations = async () => {
    try {
      setOccLoading(true);
      setOccError(null);
      const list = await getAllOccupations();
      setOccupations(list);
    } catch {
      setOccError('Nie udało się odświeżyć listy specjalizacji');
    } finally {
      setOccLoading(false);
    }
  };

  const startEditOccupation = (id: number, name: string) => {
    setEditingOccId(id);
    setEditingOccName(name);
    setOccCrudError(null);
  };

  const cancelEditOccupation = () => {
    setEditingOccId(null);
    setEditingOccName('');
  };

  const saveEditOccupation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editingOccId == null) return;
    if (!editingOccName.trim()) { setOccCrudError('Nazwa nie może być pusta'); return; }
    const token = getAuthToken();
    if (!token) { setOccCrudError('Brak tokenu'); return; }
    try {
      setOccActionLoading(true); setOccCrudError(null);
      await updateOccupation(token, editingOccId, { name: editingOccName.trim() });
      await refreshOccupations();
      cancelEditOccupation();
    } catch {
      setOccCrudError('Nie udało się zapisać zmian');
    } finally {
      setOccActionLoading(false);
    }
  };

  const handleDeleteOccupation = async (id: number) => {
    if (!confirm('Usunąć tę specjalizację?')) return;
    const token = getAuthToken();
    if (!token) { setOccCrudError('Brak tokenu'); return; }
    try {
      setOccActionLoading(true); setOccCrudError(null);
      await deleteOccupationApi(token, id);
      // Optimistic removal
      setOccupations(prev => prev.filter(o => o.id !== id));
      // Optionally refresh for consistency
      await refreshOccupations();
    } catch {
      setOccCrudError('Nie udało się usunąć specjalizacji');
    } finally {
      setOccActionLoading(false);
    }
  };

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

  // Surname first helper
  const fullNameSurnameFirst = (u: Pick<User, 'name' | 'surname'>) => [u.surname, u.name].filter(Boolean).join(' ');

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
        setDraftAssignedPatientIds(fresh.assignedPatientsIds ? [...fresh.assignedPatientsIds] : []);
        setEditDraft({
          name: fresh.name,
          surname: fresh.surname,
          email: fresh.email,
          occupationId: fresh.occupationId,
          occupationName: fresh.occupationName,
          info: fresh.info ?? ''
        });
        // Load patients list (only once per opening)
        setPatientsLoading(true);
        setPatientsError(null);
        try {
          const pts = await fetchPatients(token);
          setAllPatients(pts);
        } catch {
          setPatientsError('Nie udało się pobrać listy pacjentów');
        } finally {
          setPatientsLoading(false);
        }
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
    if (!editDraft.name.trim() || !editDraft.surname.trim() || !editDraft.email.trim() || !Number.isFinite(editDraft.occupationId)) {
      setSaveBackendError('Uzupełnij wymagane pola');
      return;
    }
  setSaveBackendError(null);
    setIsSavingBackend(true);
    try {
      // 1. Update core employee data
      await updateEmployee(editApiData.id, {
        name: editDraft.name.trim(),
        surname: editDraft.surname.trim(),
        email: editDraft.email.trim(),
        occupationId: Number(editDraft.occupationId),
        info: editDraft.info?.trim() ? editDraft.info.trim() : null,
      }, token);

      // 2. Compute assignment diffs
      const original = new Set(editApiData.assignedPatientsIds || []);
      const current = new Set(draftAssignedPatientIds);
      const toAssign: number[] = [];
      const toUnassign: number[] = [];
      current.forEach(id => { if (!original.has(id)) toAssign.push(id); });
      original.forEach(id => { if (!current.has(id)) toUnassign.push(id); });

      // 3. Apply diffs (sequential to keep things simple)
      if (toAssign.length > 0) {
        await assignPatientsToEmployee(editApiData.id, { patientIds: toAssign }, token, false);
      }
      if (toUnassign.length > 0) {
        await unassignPatientsFromEmployee(editApiData.id, { patientIds: toUnassign }, token, false);
      }

      // 4. Refresh lists and close
      await refreshBackendUsers();
      if (onBackendRefresh) await onBackendRefresh();
      setShowForm(false);
      resetEditApiState();
    } catch (e) {
      setSaveBackendError('Nie udało się zapisać zmian (sprawdź sieć)');
    } finally {
      setIsSavingBackend(false);
      setAssignActionLoading(false);
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

  const isInactive = (_u: User) => false; // employment column removed, keep hover style simple

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
      <div ref={tablesLayoutRef} className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-stretch">
        {/* Employees section */}
        <div className="xl:col-span-2 flex flex-col space-y-3">
          <h2 className="text-base font-semibold text-gray-800 px-1">Pracownicy</h2>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col" style={tablesMaxHeight ? { maxHeight: tablesMaxHeight } : undefined}>
            <div className="flex-1 overflow-auto">{/* scroll pojawia się gdy zawartość przekroczy maxHeight */}
              <table className="min-w-full border border-gray-200 border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-200 bg-gray-50">Nazwisko i imię</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-200 bg-gray-50">Specjalizacja</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-200 bg-gray-50">Rola</th>
              {/* Zatrudnienie column removed */}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-200 bg-gray-50">Notatki</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-200 bg-gray-50">Podopieczni</th>
              <th className="px-4 py-3 border border-gray-200 bg-gray-50" />
            </tr>
          </thead>
          <tbody className="bg-white">
            {demoUsersSorted.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 ${isInactive(u) ? 'opacity-60 italic' : ''}`}>
                <td className="px-4 py-3 text-sm text-gray-900 border border-gray-100">{fullNameSurnameFirst(u)}</td>
                <td className="px-4 py-3 text-sm text-gray-600 border border-gray-100">{u.specialization}</td>
                <td className="px-4 py-3 text-sm text-gray-600 border border-gray-100">{roleToLabel(u.role)}</td>
                {/* Employment column removed */}
                <td className="px-4 py-3 text-xs text-gray-600 border border-gray-100">
                  <div className="max-w-xs truncate" title={u.notes}>{u.notes || '—'}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap border border-gray-100">{Array.isArray(u.assignedPatientsIds) ? u.assignedPatientsIds.length : '—'}</td>
                <td className="px-4 py-3 text-sm text-right space-x-2 border border-gray-100">
                  <button onClick={() => openEditModal(u)} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-xs border border-blue-200">
                    <Pencil className="w-3 h-3 mr-1"/>Edytuj
                  </button>
                  <button onClick={() => handleDelete(u.id)} className="inline-flex items-center px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs border border-red-200">
                    <Trash2 className="w-3 h-3 mr-1"/>Usuń
                  </button>
                </td>
              </tr>
            ))}

            {/* separator removed */}

            {backendUsersSorted.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 ${isInactive(u) ? 'opacity-60 italic' : ''}`}>
                <td className="px-4 py-3 text-sm text-gray-900 border border-gray-100">{fullNameSurnameFirst(u)}</td>
                <td className="px-4 py-3 text-sm text-gray-600 border border-gray-100">{u.specialization}</td>
                <td className="px-4 py-3 text-sm text-gray-600 border border-gray-100">{roleToLabel(u.role)}</td>
                {/* Employment column removed */}
                <td className="px-4 py-3 text-xs text-gray-600 border border-gray-100">
                  <div className="max-w-xs truncate" title={u.notes}>{u.notes || '—'}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap border border-gray-100">{Array.isArray(u.assignedPatientsIds) ? u.assignedPatientsIds.length : '—'}</td>
                <td className="px-4 py-3 text-sm text-right space-x-2 border border-gray-100">
                  <button onClick={() => openEditModal(u)} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-xs border border-blue-200">
                    <Pencil className="w-3 h-3 mr-1"/>Edytuj
                  </button>
                  <button onClick={() => openDeleteDialog(u)} className="inline-flex items-center px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs border border-red-200">
                    <Trash2 className="w-3 h-3 mr-1"/>Usuń
                  </button>
                </td>
              </tr>
            ))}

            {demoUsersSorted.length + backendUsersSorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Brak pracowników</td>
              </tr>
            )}
          </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* Occupations section simplified */}
        <div className="flex flex-col space-y-3">
          <h2 className="text-base font-semibold text-gray-800 px-1">Specjalizacje</h2>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col" style={tablesMaxHeight ? { maxHeight: tablesMaxHeight } : undefined}>
            {occCrudError && <div className="px-4 py-2 text-xs text-red-600 border-b border-red-100 bg-red-50">{occCrudError}</div>}
            {occError && !occCrudError && <div className="px-4 py-2 text-xs text-red-600 border-b border-red-100 bg-red-50">{occError}</div>}
            <div className="flex-1 overflow-auto">
              <table className="min-w-full border border-gray-200 border-collapse text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-200 bg-gray-50">Nazwa</th>
                    <th className="px-3 py-2 border border-gray-200 bg-gray-50" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {occLoading && (
                    <tr><td colSpan={2} className="px-3 py-4 text-center text-xs text-gray-500">Ładowanie...</td></tr>
                  )}
                  {!occLoading && occupations.map(o => {
                    const isEditing = o.id === editingOccId;
                    return (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-800 border border-gray-100">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingOccName}
                              onChange={e => setEditingOccName(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                              autoFocus
                            />
                          ) : o.name}
                        </td>
                        <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap border border-gray-100">
                          {isEditing ? (
                            <>
                              <button onClick={() => saveEditOccupation()} disabled={occActionLoading} className="inline-flex items-center px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-[11px] border border-blue-700 disabled:opacity-50">Zapisz</button>
                              <button onClick={cancelEditOccupation} disabled={occActionLoading} className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-[11px] border border-gray-300 disabled:opacity-50">Anuluj</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEditOccupation(o.id, o.name)} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-[11px] border border-blue-200"><Pencil className="w-3 h-3 mr-1"/>Edytuj</button>
                              <button onClick={() => handleDeleteOccupation(o.id)} disabled={occActionLoading} className="inline-flex items-center px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-[11px] border border-red-200 disabled:opacity-50"><Trash2 className="w-3 h-3 mr-1"/>Usuń</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!occLoading && occupations.length===0 && (
                    <tr><td colSpan={2} className="px-3 py-4 text-center text-xs text-gray-500">Brak specjalizacji</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-xl shadow-xl w-full ${modalMode==='edit' && editApiData ? 'max-w-4xl' : 'max-w-md'} border border-blue-100 flex flex-col max-h-[88vh]`}>
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
            {/* If we have backend API data and are in edit mode, render redesigned API-aligned edit form */}
            {modalMode === 'edit' && (isEditLoading || editApiData || editFetchError) ? (
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                {isEditLoading && <div className="p-6 text-sm text-gray-500">Ładowanie danych pracownika…</div>}
                {editFetchError && <div className="m-6 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{editFetchError}</div>}
                {editApiData && editDraft && (
                  <>
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                      <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,_0.75rem)_1fr] items-start">
                        {/* Left column: core data */}
                        <div className="space-y-5">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Imię<span className="text-red-500">*</span></label>
                              <input type="text" value={editDraft.name} onChange={e => setEditDraft({ ...(editDraft ?? editApiData), name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Nazwisko<span className="text-red-500">*</span></label>
                              <input type="text" value={editDraft.surname} onChange={e => setEditDraft({ ...(editDraft ?? editApiData), surname: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Email<span className="text-red-500">*</span></label>
                            <input type="email" value={editDraft.email} onChange={e => setEditDraft({ ...(editDraft ?? editApiData), email: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Specjalizacja<span className="text-red-500">*</span></label>
                            <div className="relative">
                              <button ref={occBtnBackendRef} type="button" disabled={occLoading} onClick={() => !occLoading && setShowOccMenuBackend(v => !v)} className={`w-full px-3 py-2 border rounded-lg text-left flex items-center justify-between ${occLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'} border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400`}>
                                <span className={`text-sm ${editDraft.occupationId ? 'text-gray-900' : 'text-gray-500'}`}>{editDraft.occupationName || 'Wybierz profesję...'}</span>
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              </button>
                              {showOccMenuBackend && (
                                <div ref={occMenuBackendRef} className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                                  <div className="max-h-60 overflow-auto py-1">
                                    {occupations.map(o => (
                                      <button key={o.id} type="button" onClick={() => { setEditDraft({ ...(editDraft ?? editApiData), occupationId: o.id, occupationName: o.name }); setShowOccMenuBackend(false); }} className={`w-full text-left px-3 py-2 text-sm ${editDraft.occupationId === o.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>{o.name}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            {occError && <div className="text-xs text-red-600 mt-1">{occError}</div>}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Notatki</label>
                            <textarea value={editDraft.info} onChange={e => setEditDraft({ ...(editDraft ?? editApiData), info: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-none h-28" placeholder="Uwagi kadrowe..." />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Rola</label>
                            {(() => { const selected = backendPrimaryRoleFromArray(editApiData.roles); return (
                              <div className="flex flex-wrap items-center gap-5 text-sm text-gray-700">
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
                        </div>
                        {/* Vertical separator (hidden on small screens) */}
                        <div className="hidden md:block h-full relative select-none" aria-hidden="true">
                          <div className="absolute top-4 bottom-12 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
                        </div>
                        {/* Right column: assignments */}
                        <div className="space-y-4">
                          <div className="rounded-lg p-4 h-full flex flex-col">
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-xs font-semibold tracking-wide text-gray-800 uppercase">Przypisani pacjenci</h3>
                            </div>
                            {patientsLoading && <div className="text-xs text-gray-500">Ładowanie pacjentów…</div>}
                            {patientsError && <div className="text-xs text-red-600 mb-2">{patientsError}</div>}
                            {!patientsLoading && !patientsError && (
                              <>
                                <div
                                  className={`mb-3 flex flex-wrap gap-2 ${draftAssignedPatientIds.length > 10 ? 'overflow-y-auto pr-1' : ''}`}
                                  style={draftAssignedPatientIds.length > 10 ? { maxHeight: '220px' } : undefined}
                                >
                                  {draftAssignedPatientIds.length === 0 && <span className="text-[11px] text-gray-500">Brak przypisanych</span>}
                                  {(() => {
                                    // Build enriched list with patient objects for sorting & styling
                                    const enriched = draftAssignedPatientIds.map(pid => {
                                      const patient = allPatients.find(ap => ap.id === pid);
                                      return { pid, patient, label: patient ? `${patient.surname} ${patient.name}` : `ID ${pid}` };
                                    }).sort((a,b) => {
                                      const aActive = !!a.patient?.isActive;
                                      const bActive = !!b.patient?.isActive;
                                      if (aActive !== bActive) return aActive ? -1 : 1; // aktywni najpierw
                                      return a.label.localeCompare(b.label, 'pl', { sensitivity: 'base' });
                                    });
                                    return enriched.map(({ pid, patient, label }) => {
                                      const active = !!patient?.isActive;
                                      const cls = active
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : 'bg-gray-100 text-gray-600 border-gray-300';
                                      return (
                                        <span
                                          key={pid}
                                          className={`inline-flex items-center gap-2 pl-3 pr-3 py-1.5 rounded-md text-[12px] font-medium border shadow-sm ${cls}`}
                                          title={active ? 'Aktywny' : 'Nieaktywny'}
                                        >
                                          {label}
                                        </span>
                                      );
                                    });
                                  })()}
                                </div>
                                <div className="space-y-2 flex-1 flex flex-col">
                                  <div className="flex gap-2 items-center">
                                    <input type="text" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Szukaj pacjenta (imię / nazwisko)" className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-white" />
                                    {patientSearch && (
                                      <button type="button" onClick={() => setPatientSearch('')} className="text-[10px] px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700" aria-label="Wyczyść wyszukiwanie">Wyczyść</button>
                                    )}
                                    <label className="inline-flex items-center gap-1 text-[11px] text-gray-600 ml-2 whitespace-nowrap">
                                      <input type="checkbox" className="accent-blue-600 h-3 w-3" checked={onlyActivePatients} onChange={e => setOnlyActivePatients(e.target.checked)} />
                                      <span>Aktywni</span>
                                    </label>
                                    <label className="inline-flex items-center gap-1 text-[11px] text-gray-600 ml-1 whitespace-nowrap">
                                      <input type="checkbox" className="accent-blue-600 h-3 w-3" checked={onlyAssignedPatients} onChange={e => setOnlyAssignedPatients(e.target.checked)} />
                                      <span>Przypisani</span>
                                    </label>
                                  </div>
                                  <div className="flex-1 min-h-0">
                                    <div
                                      className={`h-full overflow-auto border border-gray-200 rounded-md ${filteredPatients.length > 10 ? 'shadow-inner' : ''}`}
                                      style={filteredPatients.length > 10 ? { maxHeight: '275px' } : undefined}
                                    >
                                      <table className="min-w-full text-[11px]">
                                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                                          <tr>
                                            <th className="px-2 py-2 text-left font-medium text-gray-700">Pacjent</th>
                                            <th className="px-2 py-2 text-left font-medium text-gray-700">Status</th>
                                            <th className="px-2 py-2 text-left font-medium text-gray-700">Relacja</th>
                                            <th className="px-2 py-1" />
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {filteredPatients.map(p => {
                                            const assigned = draftAssignedPatientIds.includes(p.id);
                                            return (
                                              <tr key={p.id} className={`${assigned ? 'bg-blue-50 hover:bg-blue-100' : 'odd:bg-white even:bg-gray-50 hover:bg-gray-100'} transition-colors`}>                            
                                                <td className="px-2 py-1 whitespace-nowrap">
                                                  <span className={`truncate max-w-[160px] font-medium ${p.isActive ? 'text-gray-800' : 'text-gray-500'}`}>{p.surname} {p.name}</span>
                                                </td>
                                                <td className="px-2 py-1 whitespace-nowrap"><span className={`font-semibold ${p.isActive ? 'text-green-700' : 'text-gray-500'}`}>{p.isActive ? 'aktywny' : 'nieaktywny'}</span></td>
                                                <td className="px-2 py-1 whitespace-nowrap"><span className={`font-semibold ${assigned ? 'text-blue-700' : 'text-gray-600'}`}>{assigned ? 'przypisany' : 'wolny'}</span></td>
                                                <td className="px-2 py-1 text-right">
                                                  <button type="button" disabled={assignActionLoading} onClick={() => {
                                                    setDraftAssignedPatientIds(ids => assigned ? ids.filter(id => id !== p.id) : [...ids, p.id]);
                                                  }} className={`px-2 py-1 rounded-md text-[11px] font-medium border shadow-sm transition-colors ${assigned ? 'bg-red-600 text-white border-red-700 hover:bg-red-700' : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>{assigned ? 'Usuń' : 'Dodaj'}</button>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                          {filteredPatients.length === 0 && (
                                            <tr>
                                              <td colSpan={4} className="px-2 py-3 text-center text-gray-500">Brak wyników</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Footer / actions */}
                    <div className="border-t border-gray-200 px-6 py-4 bg-white flex justify-between items-center gap-4">
                      {saveBackendError && <div className="text-sm text-red-600">{saveBackendError}</div>}
                      <div className="ml-auto flex gap-3">
                        <button type="button" onClick={() => { if (!isSavingBackend) { setShowForm(false); resetEditApiState(); } }} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm" disabled={isSavingBackend}>Anuluj</button>
                        {isSavingBackend ? (
                          <div className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm inline-flex items-center justify-center min-w-[140px]">
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          </div>
                        ) : (
                          <button type="button" onClick={handleBackendSave} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors text-sm">Zapisz zmiany</button>
                        )}
                      </div>
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
