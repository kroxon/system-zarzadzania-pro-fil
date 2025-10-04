import { MoreHorizontal, Plus, CheckCircle2, Circle, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Calendar, UserRoundPlus, Loader2 } from 'lucide-react';
import Portal from '../common/Portal';
import { notify } from '../common/Notification';
import { useState, useEffect, useMemo, useRef } from 'react';
import { EmployeeTask, Employee } from '../../types/index';
import { fetchEmployees } from '../../utils/api/employees';
import { createEmployeeTask } from '../../utils/api/tasks';

type TaskFormState = {
  name: string;
  assignedEmployeeId: number | null;
  dueDate: string;
};

const createEmptyFormState = (): TaskFormState => ({
  name: '',
  assignedEmployeeId: null,
  dueDate: '',
});

const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'] as const;
const daysOfWeek = ['Pn','Wt','Śr','Cz','Pt','So','Nd'] as const;
const FUTURE_YEAR_LOOKAHEAD = 10;

const formatDateYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getMonthGrid = (month: Date) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, idx) => {
    const current = new Date(start);
    current.setDate(start.getDate() + idx);
    return {
      date: current,
      isCurrentMonth: current.getMonth() === month.getMonth(),
    };
  });
};

const formatDueDateHuman = (value: string) => {
  if (!value) return 'Wybierz termin';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' });
};

const validateTaskForm = (form: TaskFormState) => {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push('Tytuł zadania jest wymagany');
  if (form.assignedEmployeeId == null) errors.push('Wybierz pracownika');
  if (!form.dueDate.trim()) errors.push('Termin wykonania jest wymagany');
  return errors;
};

type TaskDatePickerHook = {
  show: boolean;
  open: () => void;
  close: () => void;
  month: Date;
  setMonth: React.Dispatch<React.SetStateAction<Date>>;
  selectDate: (date: Date) => void;
  overlayRef: React.RefObject<HTMLDivElement>;
  showYearMenu: boolean;
  setShowYearMenu: React.Dispatch<React.SetStateAction<boolean>>;
  yearBtnRef: React.RefObject<HTMLButtonElement>;
  yearMenuRef: React.RefObject<HTMLDivElement>;
};

const useTaskDatePicker = (
  getCurrentValue: () => string,
  onChange: (next: string) => void,
  onAfterSelect?: () => void
): TaskDatePickerHook => {
  const [show, setShow] = useState(false);
  const [month, setMonth] = useState<Date>(() => new Date());
  const [showYearMenu, setShowYearMenu] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const yearBtnRef = useRef<HTMLButtonElement | null>(null);
  const yearMenuRef = useRef<HTMLDivElement | null>(null);

  const open = () => {
    const current = getCurrentValue();
    const base = current ? new Date(current) : new Date();
    const safe = Number.isNaN(base.getTime()) ? new Date() : base;
    setMonth(new Date(safe.getFullYear(), safe.getMonth(), 1));
    setShow(true);
  };

  const close = () => {
    setShow(false);
    setShowYearMenu(false);
  };

  const selectDate = (date: Date) => {
    onChange(formatDateYMD(date));
    onAfterSelect?.();
    close();
  };

  useEffect(() => {
    if (show) {
      requestAnimationFrame(() => overlayRef.current?.focus());
    }
  }, [show]);

  useEffect(() => {
    if (!showYearMenu) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!yearMenuRef.current?.contains(target) && !yearBtnRef.current?.contains(target)) {
        setShowYearMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showYearMenu]);

  return { show, open, close, month, setMonth, selectDate, overlayRef, showYearMenu, setShowYearMenu, yearBtnRef, yearMenuRef };
};


// Usunięto demo dane, lista zawsze pusta na start
const StatusBadge = ({ isCompleted }: { isCompleted: boolean }) => {
  if (isCompleted === true) {
    return (
  <div className="flex items-center justify-center w-36 h-8 rounded-lg bg-green-50 border border-green-300 shadow-sm px-2 overflow-hidden">
        <CheckCircle2 className="text-green-600 mr-1 h-5 w-5 shrink-0" />
        <span className="text-green-700 font-semibold text-sm truncate whitespace-nowrap">Ukończone</span>
      </div>
    );
  }
  // 'Do zrobienia'
  return (
  <div className="flex items-center justify-center w-36 h-8 rounded-lg bg-gray-50 border border-gray-300 shadow-sm px-2 overflow-hidden">
      <Circle className="text-gray-400 mr-1 h-5 w-5 shrink-0" />
      <span className="text-gray-600 font-semibold text-sm truncate whitespace-nowrap">Do zrobienia</span>
    </div>
  );
};


interface TasksPageProps { userRole: 'admin' | 'employee' | 'contact'; currentUserId: string | number; }
export default function TasksPage({ userRole, currentUserId }: TasksPageProps) {
  // Fallback: if currentUserId not provided (legacy usage), try to load from persisted user
  let effectiveCurrentUserId = currentUserId;
  if(!effectiveCurrentUserId){
    try {
      const raw = localStorage.getItem('schedule_current_user');
      if(raw){ const parsed = JSON.parse(raw); if(parsed?.id) effectiveCurrentUserId = parsed.id; }
    } catch {}
  }
  const [employeesLoading, setEmployeesLoading] = useState(true);
  // Fetch tasks from backend on mount/login
  // Fetch tasks only when entering this page (mount)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    import('../../utils/api/tasks').then(api => {
      api.fetchEmployeeTasks(token)
        .then(all => {
          if (userRole === 'admin') {
            setTaskList(all);
          } else {
            // filter tasks where current user is assigned
            const uidNum = Number(currentUserId);
            setTaskList(all.filter(t => t.assignedEmployeesIds.some(id => Number(id) === uidNum)));
          }
        })
        .catch(() => setTaskList([]));
    });
  }, [userRole, effectiveCurrentUserId]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [taskList, setTaskList] = useState<EmployeeTask[]>([]);
  const [editingTask, setEditingTask] = useState<EmployeeTask | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<TaskFormState>(() => createEmptyFormState());
  const [createErrors, setCreateErrors] = useState<string[]>([]);
  const [creatingTask, setCreatingTask] = useState(false);
  const [showCreateAssignMenu, setShowCreateAssignMenu] = useState(false);
  const createAssignBtnRef = useRef<HTMLButtonElement | null>(null);
  const createAssignMenuRef = useRef<HTMLDivElement | null>(null);
  const createModalRef = useRef<HTMLDivElement | null>(null);
  const createPrevFocusRef = useRef<HTMLElement | null>(null);

  const [showEditAssignMenu, setShowEditAssignMenu] = useState(false);
  const editAssignBtnRef = useRef<HTMLButtonElement | null>(null);
  const editAssignMenuRef = useRef<HTMLDivElement | null>(null);
  const editModalRef = useRef<HTMLDivElement | null>(null);
  const editPrevFocusRef = useRef<HTMLElement | null>(null);
  const [editForm, setEditForm] = useState<TaskFormState>(() => createEmptyFormState());
  const [editErrors, setEditErrors] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + FUTURE_YEAR_LOOKAHEAD;
    const minYear = 1900;
    const list: number[] = [];
    for (let year = maxYear; year >= minYear; year--) {
      list.push(year);
    }
    return list;
  }, []);

  const todayYMD = useMemo(() => formatDateYMD(new Date()), []);

  const createDatePicker = useTaskDatePicker(
    () => createForm.dueDate,
    (next) => setCreateForm(prev => ({ ...prev, dueDate: next })),
    () => setCreateErrors([])
  );

  const editDatePicker = useTaskDatePicker(
    () => editForm.dueDate,
    (next) => setEditForm(prev => ({ ...prev, dueDate: next })),
    () => setEditErrors([])
  );

  const createMonthGrid = useMemo(() => getMonthGrid(createDatePicker.month), [createDatePicker.month]);
  const editMonthGrid = useMemo(() => getMonthGrid(editDatePicker.month), [editDatePicker.month]);

  // Sort state
  type SortField = 'assigned' | 'dueDate' | 'status' | null;
  // Domyślne (ukryte) sortowanie: po dacie rosnąco (najwcześniejsze na górze), ale bez zaznaczenia aktywnej kolumny
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: Exclude<SortField, null>) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir('asc');
    } else {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    }
  };

  const getAssignedNames = (task: EmployeeTask) => {
    return task.assignedEmployeesIds
      .map(id => {
        const emp = employees.find(e => Number(e.id) === Number(id));
        return emp ? `${emp.name} ${emp.surname}`.trim() : String(id);
      })
      .join(', ');
  };

  const displayedTasks = (() => {
    if (!sortField) {
      // Bazowe sortowanie po dueDate ASC (YYYY-MM-DD). Puste daty na dół.
      return [...taskList].sort((a, b) => {
        const ad = a.dueDate || '';
        const bd = b.dueDate || '';
        if (!ad && !bd) return 0;
        if (!ad) return 1; // brak daty na dół
        if (!bd) return -1;
        return ad.localeCompare(bd);
      });
    }
    const list = [...taskList];
    list.sort((a, b) => {
      let va = '';
      let vb = '';
      if (sortField === 'assigned') { va = getAssignedNames(a); vb = getAssignedNames(b); }
      else if (sortField === 'dueDate') { va = a.dueDate || ''; vb = b.dueDate || ''; }
      else if (sortField === 'status') { // status: not completed (0) vs completed (1) + tie-break po dueDate
        const aVal = a.isCompleted ? 1 : 0;
        const bVal = b.isCompleted ? 1 : 0;
        if (aVal !== bVal) return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        // tie-break: wcześniejsza data wyżej (puste daty na dole)
        const ad = a.dueDate || '';
        const bd = b.dueDate || '';
        if (!ad && !bd) return 0;
        if (!ad) return 1; // brak daty na dół
        if (!bd) return -1;
        return sortDir === 'asc' ? ad.localeCompare(bd) : bd.localeCompare(ad);
      }
      if (sortField === 'dueDate') {
        // YYYY-MM-DD lexical compare works, fallback empty strings last
        if (!va && !vb) return 0;
        if (!va) return 1;
        if (!vb) return -1;
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      const cmp = va.toLowerCase().localeCompare(vb.toLowerCase(), 'pl');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  })();

  const employeesSorted = useMemo(() => {
    const strip = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    return employees
      .map(emp => {
        const first = (emp.name || '').trim();
        const last = (emp.surname || '').trim();
        const label = last ? `${last} ${first}`.trim() : (first || String(emp.id));
        const sortKey = `${strip(last)} ${strip(first)}`;
        return { id: emp.id, label, sortKey };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [employees]);

  const createSelectedEmployee = useMemo(() => {
    if (createForm.assignedEmployeeId == null) return null;
    return employees.find(emp => Number(emp.id) === Number(createForm.assignedEmployeeId)) ?? null;
  }, [employees, createForm.assignedEmployeeId]);

  const createSelectedEmployeeLabel = useMemo(() => {
    if (!createSelectedEmployee) return '';
    const first = (createSelectedEmployee.name || '').trim();
    const last = (createSelectedEmployee.surname || '').trim();
    return [last, first].filter(Boolean).join(' ').trim();
  }, [createSelectedEmployee]);

  const editSelectedEmployee = useMemo(() => {
    if (editForm.assignedEmployeeId == null) return null;
    return employees.find(emp => Number(emp.id) === Number(editForm.assignedEmployeeId)) ?? null;
  }, [employees, editForm.assignedEmployeeId]);

  const editSelectedEmployeeLabel = useMemo(() => {
    if (!editSelectedEmployee) return '';
    const first = (editSelectedEmployee.name || '').trim();
    const last = (editSelectedEmployee.surname || '').trim();
    return [last, first].filter(Boolean).join(' ').trim();
  }, [editSelectedEmployee]);

  const handleOpenCreateModal = () => {
    if (userRole !== 'admin') return; // guard
    setCreateForm(createEmptyFormState());
    setCreateErrors([]);
    setShowCreateAssignMenu(false);
    setCreatingTask(false);
    setShowCreateModal(true);
  };

  const headerDescription = userRole === 'admin'
    ? 'Zarządzaj zadaniami dla pracowników'
    : 'Zarządzaj swoimi zadaniami';

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setShowCreateAssignMenu(false);
    setCreateErrors([]);
    setCreateForm(createEmptyFormState());
  };

  const selectNewTaskAssignee = (id: number) => {
    const numericId = Number(id);
    if (Number.isNaN(numericId)) return;
    setCreateForm(prev => ({ ...prev, assignedEmployeeId: numericId }));
    setShowCreateAssignMenu(false);
    setCreateErrors([]);
  };

  const clearNewTaskAssignee = () => {
    setCreateForm(prev => ({ ...prev, assignedEmployeeId: null }));
    setShowCreateAssignMenu(false);
  };

  const handleCreateClearDate = () => {
    setCreateForm(prev => ({ ...prev, dueDate: '' }));
    setCreateErrors([]);
    createDatePicker.close();
  };

  const handleCreateToday = () => {
    const today = new Date();
    createDatePicker.selectDate(today);
  };

  const handleSaveCreateTask = async () => {
    if (userRole !== 'admin') return;
    const errors = validateTaskForm(createForm);
    if (errors.length) {
      setCreateErrors(errors);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    setCreatingTask(true);
    try {
      const created = await createEmployeeTask({
        name: createForm.name.trim(),
        assignedEmployeesIds: createForm.assignedEmployeeId == null ? [] : [createForm.assignedEmployeeId],
        dueDate: createForm.dueDate,
        isCompleted: false
      }, token);
      setTaskList(prev => [...prev, created]);
      setShowCreateModal(false);
      setCreateForm(createEmptyFormState());
      notify.success('Zadanie utworzone');
    } catch (err) {
      setCreateErrors(['Nie udało się utworzyć zadania. Spróbuj ponownie.']);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleEditTask = (task: EmployeeTask) => {
    if (userRole !== 'admin') return;
    setEditingTask(task);
    setEditForm({
      name: task.name || '',
      assignedEmployeeId: task.assignedEmployeesIds.length ? Number(task.assignedEmployeesIds[0]) : null,
      dueDate: task.dueDate || '',
    });
    setEditErrors([]);
    setShowEditAssignMenu(false);
    setEditSaving(false);
  };

  const handleCloseEditModal = () => {
    setShowEditAssignMenu(false);
    setEditingTask(null);
    setEditErrors([]);
  };

  const selectEditTaskAssignee = (id: number) => {
    const numericId = Number(id);
    if (Number.isNaN(numericId)) return;
    setEditForm(prev => ({ ...prev, assignedEmployeeId: numericId }));
    setShowEditAssignMenu(false);
    setEditErrors([]);
  };

  const clearEditTaskAssignee = () => {
    setEditForm(prev => ({ ...prev, assignedEmployeeId: null }));
    setShowEditAssignMenu(false);
  };

  const handleEditClearDate = () => {
    setEditForm(prev => ({ ...prev, dueDate: '' }));
    setEditErrors([]);
    editDatePicker.close();
  };

  const handleEditToday = () => {
    const today = new Date();
    editDatePicker.selectDate(today);
  };

  const handleSaveEdit = async () => {
    if (userRole !== 'admin' || !editingTask) return;
    const errors = validateTaskForm(editForm);
    if (errors.length) {
      setEditErrors(errors);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    setEditSaving(true);
    try {
      const api = await import('../../utils/api/tasks');
      const payload = {
        ...editingTask,
        name: editForm.name.trim(),
        assignedEmployeesIds: editForm.assignedEmployeeId == null ? [] : [editForm.assignedEmployeeId],
        dueDate: editForm.dueDate,
      };
  await api.updateEmployeeTask(editingTask.id, payload, token);
  setTaskList(prev => prev.map(task => (task.id === editingTask.id ? { ...task, ...payload } : task)));
      notify.success('Zadanie zaktualizowane');
      setEditingTask(null);
    } catch (err: any) {
      setEditErrors([err?.message || 'Nie udało się zaktualizować zadania']);
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetchEmployees(token)
      .then(data => {
        setEmployees(data);
        setEmployeesLoading(false);
      })
      .catch(() => {
        setEmployees([]);
        setEmployeesLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!showCreateAssignMenu) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!createAssignMenuRef.current?.contains(target) && !createAssignBtnRef.current?.contains(target)) {
        setShowCreateAssignMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCreateAssignMenu]);

  useEffect(() => {
    if (showCreateModal) {
      createPrevFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        const focusable = createModalRef.current?.querySelector<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        );
        focusable?.focus();
      });
    } else {
      document.body.style.overflow = '';
      createPrevFocusRef.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showCreateModal]);

  useEffect(() => {
    if (!showEditAssignMenu) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!editAssignMenuRef.current?.contains(target) && !editAssignBtnRef.current?.contains(target)) {
        setShowEditAssignMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEditAssignMenu]);

  useEffect(() => {
    if (editingTask) {
      editPrevFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        const focusable = editModalRef.current?.querySelector<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        );
        focusable?.focus();
      });
    } else {
      document.body.style.overflow = '';
      editPrevFocusRef.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [editingTask]);

  const handleUndoCompleteTask = (taskId: number) => {
    const token = localStorage.getItem('token');
    const task = taskList.find(t => t.id === taskId);
    if (!token || !task) return;
    // Only admin or assigned user can toggle
  const uidNum = Number(effectiveCurrentUserId);
    if (!(userRole === 'admin' || task.assignedEmployeesIds.some(id => Number(id) === uidNum))) return;
    import('../../utils/api/tasks').then(api => {
      api.updateEmployeeTask(taskId, { ...task, isCompleted: false }, token)
        .then(() => {
          setTaskList(taskList.map(t => t.id === taskId ? { ...t, isCompleted: false } : t));
        })
        .catch(() => {/* obsługa błędu */});
    });
  };
  const handleCompleteTask = (taskId: number) => {
    const token = localStorage.getItem('token');
    const task = taskList.find(t => t.id === taskId);
    if (!token || !task) return;
  const uidNum = Number(effectiveCurrentUserId);
    if (!(userRole === 'admin' || task.assignedEmployeesIds.some(id => Number(id) === uidNum))) return;
    import('../../utils/api/tasks').then(api => {
      api.updateEmployeeTask(taskId, { ...task, isCompleted: true }, token)
        .then(() => {
          setTaskList(taskList.map(t => t.id === taskId ? { ...t, isCompleted: true } : t));
        })
        .catch(() => {/* obsługa błędu */});
    });
  };

  const handleDeleteTask = async (taskId: number) => {
    if (userRole !== 'admin') return;
    if (!window.confirm('Czy na pewno chcesz usunąć to zadanie?')) return;
    const token = localStorage.getItem('token');
    if (!token) {
      notify.error('Brak tokenu uwierzytelnienia. Zaloguj się ponownie.');
      return;
    }
    try {
      const api = await import('../../utils/api/tasks');
      await api.deleteEmployeeTask(taskId, token);
      setTaskList(prev => prev.filter(t => t.id !== taskId));
      notify.success('Zadanie usunięte');
    } catch (error: any) {
      notify.error(error?.message || 'Nie udało się usunąć zadania');
    }
  };




  return (
    <>
  <div className="flex-1 space-y-6">
  <div className="flex items-center justify-between mb-2">
          <div>
            {/* Usunięto wtórny nagłówek "Zadania" – TopBar już go wyświetla */}
            <p className="text-sm text-gray-600">{headerDescription}</p>
          </div>
          {userRole==='admin' && (
            <div className="flex items-center space-x-2">
              <button className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors" onClick={handleOpenCreateModal}>
                <Plus className="mr-2 h-4 w-4" /> Dodaj zadanie
              </button>
            </div>
          )}
        </div>
        <div className="rounded-lg border shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* Zadanie (bez sortowania) */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zadanie</th>
                {[
                  { label: 'Przypisane do', field: 'assigned' as const },
                  { label: 'Termin', field: 'dueDate' as const },
                  { label: 'Status', field: 'status' as const },
                ].map(col => {
                  const active = sortField === col.field;
                  const dir = active ? sortDir : undefined;
                  const Icon = !active ? ArrowUpDown : (dir === 'asc' ? ChevronUp : ChevronDown);
                  return (
                    <th key={col.field} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        <button
                          type="button"
                          onClick={() => toggleSort(col.field)}
                          aria-label={`Sortuj kolumnę ${col.label}`}
                          aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className={`p-1 rounded hover:bg-gray-200 transition-colors ${active ? 'text-blue-600' : 'text-gray-500'}`}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      </div>
                    </th>
                  );
                })}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><span className="sr-only">Akcje</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employeesLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Ładowanie pracowników...</td>
                </tr>
              ) : displayedTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Brak zadań do wyświetlenia.</td>
                </tr>
              ) : (
                displayedTasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{task.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getAssignedNames(task)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{task.dueDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge isCompleted={task.isCompleted} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {userRole==='admin' && (
                        <>
                          <button className="p-2 rounded hover:bg-gray-100" aria-label="Edytuj zadanie" onClick={() => handleEditTask(task)}>
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          <button className="ml-2 p-2 rounded hover:bg-gray-100" aria-label="Usuń zadanie" onClick={() => handleDeleteTask(task.id)}>
                            <span className="sr-only">Usuń</span>🗑️
                          </button>
                        </>
                      )}
                      {task.isCompleted ? (
                        <button className="ml-2 p-2 rounded hover:bg-gray-100" aria-label="Cofnij ukończenie" onClick={() => handleUndoCompleteTask(task.id)}>
                          <span className="sr-only">Cofnij</span>↩️
                        </button>
                      ) : (
                        <button className="ml-2 p-2 rounded hover:bg-gray-100" aria-label="Oznacz jako ukończone" onClick={() => handleCompleteTask(task.id)}>
                          <span className="sr-only">Ukończ</span>✔️
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal dodawania nowego zadania */}
      {userRole==='admin' && showCreateModal && (
        <Portal>
        <div
          className="fixed inset-0 z-[1000] flex items-start justify-center p-6 bg-black/40 backdrop-blur-sm overflow-y-auto"
          onKeyDown={(e) => {
            if(e.key==='Escape'){ e.stopPropagation(); handleCloseCreateModal(); }
            if(e.key==='Tab' && createModalRef.current){
              const focusables = Array.from(createModalRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"))
                .filter(el => !el.hasAttribute('disabled'));
              if(!focusables.length) return;
              const first = focusables[0];
              const last = focusables[focusables.length-1];
              if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
              else if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
            }
          }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="createTaskTitle"
        >
          <div
            ref={createModalRef}
            className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 rounded-t-2xl">
              <div className="space-y-1">
                <h3 id="createTaskTitle" className="text-lg font-semibold text-gray-800">Nowe zadanie</h3>
                <p className="text-sm text-gray-500">Utwórz zadanie i przypisz je do wybranego specjalisty.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseCreateModal}
                className="p-2 rounded-lg hover:bg-white/70 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleSaveCreateTask(); }} className="px-6 py-6 space-y-6">
              {createErrors.length>0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700" aria-live="assertive">
                  <ul className="list-disc list-inside space-y-1">
                    {createErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Tytuł zadania</label>
                  <input
                    value={createForm.name}
                    onChange={e => {
                      const value = e.target.value;
                      setCreateForm(prev => ({ ...prev, name: value }));
                      setCreateErrors([]);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Wprowadź nazwę zadania"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Pracownik</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <button
                        ref={createAssignBtnRef}
                        type="button"
                        onClick={() => setShowCreateAssignMenu(v => !v)}
                        className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg bg-white border border-gray-300 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        aria-haspopup="listbox"
                        aria-expanded={showCreateAssignMenu}
                      >
                        <span className="inline-flex items-center gap-2 text-gray-700">
                          <UserRoundPlus className="h-4 w-4 text-indigo-500" />
                          <span className="truncate">{createSelectedEmployeeLabel || 'Wybierz pracownika'}</span>
                        </span>
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showCreateAssignMenu ? 'rotate-180' : ''}`} />
                      </button>
                      {showCreateAssignMenu && (
                        <div
                          ref={createAssignMenuRef}
                          role="listbox"
                          tabIndex={-1}
                          onKeyDown={(e)=> { if(e.key==='Escape'){ e.preventDefault(); setShowCreateAssignMenu(false); createAssignBtnRef.current?.focus(); } }}
                          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-gray-100"
                        >
                          <div className="max-h-60 overflow-y-auto py-1">
                            {employeesSorted.map(option => {
                              const isActive = Number(option.id) === Number(createForm.assignedEmployeeId);
                              return (
                                <button
                                  type="button"
                                  key={option.id}
                                  onClick={() => selectNewTaskAssignee(Number(option.id))}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}
                                  role="option"
                                  aria-selected={isActive}
                                >
                                  <span className="truncate">{option.label}</span>
                                  {isActive && <CheckCircle2 className="h-4 w-4 text-indigo-500" />}
                                </button>
                              );
                            })}
                            {!employeesSorted.length && (
                              <div className="px-3 py-2 text-sm text-gray-500">Brak dostępnych pracowników</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearNewTaskAssignee}
                      className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                      disabled={createForm.assignedEmployeeId == null}
                    >
                      Wyczyść
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Termin</label>
                  <button
                    type="button"
                    onClick={createDatePicker.open}
                    className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <span className="inline-flex items-center gap-2 text-gray-700">
                      <Calendar className="h-4 w-4 text-indigo-500" />
                      <span className="truncate">{formatDueDateHuman(createForm.dueDate)}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-60"
                  disabled={creatingTask}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={creatingTask}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 shadow hover:from-indigo-500 hover:to-blue-500 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
                >
                  {creatingTask ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Zapisywanie...
                    </>
                  ) : (
                    'Utwórz zadanie'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

        {createDatePicker.show && (
          <Portal>
          <div
            ref={createDatePicker.overlayRef}
            tabIndex={-1}
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/40"
            onClick={(e) => { if (e.target === e.currentTarget) createDatePicker.close(); }}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); createDatePicker.close(); } }}
            role="dialog"
            aria-modal="true"
            aria-label="Wybierz termin zadania"
          >
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-100 p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => createDatePicker.setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className="p-2 rounded-lg hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500"
                    aria-label="Poprzedni miesiąc"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                  </button>
                  <div className="text-sm font-semibold text-gray-800 min-w-[120px] text-center">
                    {monthNames[createDatePicker.month.getMonth()]} {createDatePicker.month.getFullYear()}
                  </div>
                  <button
                    type="button"
                    onClick={() => createDatePicker.setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    className="p-2 rounded-lg hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500"
                    aria-label="Następny miesiąc"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
                <div className="relative">
                  <button
                    ref={createDatePicker.yearBtnRef}
                    type="button"
                    onClick={() => createDatePicker.setShowYearMenu(v => !v)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wide border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500"
                    aria-haspopup="listbox"
                    aria-expanded={createDatePicker.showYearMenu}
                  >
                    {createDatePicker.month.getFullYear()}
                    <ChevronDown className={`h-3 w-3 text-gray-500 transition-transform ${createDatePicker.showYearMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {createDatePicker.showYearMenu && (
                    <div
                      ref={createDatePicker.yearMenuRef}
                      role="listbox"
                      tabIndex={-1}
                      className="absolute right-0 mt-2 w-28 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl"
                    >
                      {yearsList.map(year => {
                        const active = createDatePicker.month.getFullYear() === year;
                        return (
                          <button
                            type="button"
                            key={year}
                            onClick={() => {
                              createDatePicker.setMonth(prev => new Date(year, prev.getMonth(), 1));
                              createDatePicker.setShowYearMenu(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${active ? 'text-indigo-600 font-semibold' : 'text-gray-700'}`}
                            role="option"
                            aria-selected={active}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {daysOfWeek.map(day => (
                  <div key={day} className="text-center">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {createMonthGrid.map(({ date, isCurrentMonth }) => {
                  const cellValue = formatDateYMD(date);
                  const isSelected = createForm.dueDate === cellValue;
                  const isToday = todayYMD === cellValue;
                  let cls = 'w-10 h-10 flex items-center justify-center rounded-lg text-sm transition-colors';
                  if (isSelected) cls += ' bg-indigo-600 text-white shadow hover:bg-indigo-600';
                  else if (isToday) cls += ' border border-indigo-400 text-indigo-700 hover:bg-indigo-50';
                  else if (!isCurrentMonth) cls += ' text-gray-400 hover:bg-gray-100';
                  else cls += ' text-gray-700 hover:bg-indigo-50';
                  return (
                    <button
                      type="button"
                      key={cellValue}
                      onClick={() => createDatePicker.selectDate(date)}
                      className={cls}
                      aria-pressed={isSelected}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={handleCreateClearDate} className="text-sm text-gray-500 hover:text-gray-700">Wyczyść</button>
                <button type="button" onClick={handleCreateToday} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Dziś</button>
              </div>
            </div>
          </div>
          </Portal>
        )}

        {editDatePicker.show && (
          <Portal>
          <div
            ref={editDatePicker.overlayRef}
            tabIndex={-1}
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/40"
            onClick={(e) => { if (e.target === e.currentTarget) editDatePicker.close(); }}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); editDatePicker.close(); } }}
            role="dialog"
            aria-modal="true"
            aria-label="Wybierz termin zadania"
          >
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-100 p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => editDatePicker.setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className="p-2 rounded-lg hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500"
                    aria-label="Poprzedni miesiąc"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                  </button>
                  <div className="text-sm font-semibold text-gray-800 min-w-[120px] text-center">
                    {monthNames[editDatePicker.month.getMonth()]} {editDatePicker.month.getFullYear()}
                  </div>
                  <button
                    type="button"
                    onClick={() => editDatePicker.setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    className="p-2 rounded-lg hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500"
                    aria-label="Następny miesiąc"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
                <div className="relative">
                  <button
                    ref={editDatePicker.yearBtnRef}
                    type="button"
                    onClick={() => editDatePicker.setShowYearMenu(v => !v)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wide border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500"
                    aria-haspopup="listbox"
                    aria-expanded={editDatePicker.showYearMenu}
                  >
                    {editDatePicker.month.getFullYear()}
                    <ChevronDown className={`h-3 w-3 text-gray-500 transition-transform ${editDatePicker.showYearMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {editDatePicker.showYearMenu && (
                    <div
                      ref={editDatePicker.yearMenuRef}
                      role="listbox"
                      tabIndex={-1}
                      className="absolute right-0 mt-2 w-28 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl"
                    >
                      {yearsList.map(year => {
                        const active = editDatePicker.month.getFullYear() === year;
                        return (
                          <button
                            type="button"
                            key={year}
                            onClick={() => {
                              editDatePicker.setMonth(prev => new Date(year, prev.getMonth(), 1));
                              editDatePicker.setShowYearMenu(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${active ? 'text-indigo-600 font-semibold' : 'text-gray-700'}`}
                            role="option"
                            aria-selected={active}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {daysOfWeek.map(day => (
                  <div key={day} className="text-center">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {editMonthGrid.map(({ date, isCurrentMonth }) => {
                  const cellValue = formatDateYMD(date);
                  const isSelected = editForm.dueDate === cellValue;
                  const isToday = todayYMD === cellValue;
                  let cls = 'w-10 h-10 flex items-center justify-center rounded-lg text-sm transition-colors';
                  if (isSelected) cls += ' bg-indigo-600 text-white shadow hover:bg-indigo-600';
                  else if (isToday) cls += ' border border-indigo-400 text-indigo-700 hover:bg-indigo-50';
                  else if (!isCurrentMonth) cls += ' text-gray-400 hover:bg-gray-100';
                  else cls += ' text-gray-700 hover:bg-indigo-50';
                  return (
                    <button
                      type="button"
                      key={cellValue}
                      onClick={() => editDatePicker.selectDate(date)}
                      className={cls}
                      aria-pressed={isSelected}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={handleEditClearDate} className="text-sm text-gray-500 hover:text-gray-700">Wyczyść</button>
                <button type="button" onClick={handleEditToday} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Dziś</button>
              </div>
            </div>
          </div>
          </Portal>
        )}

      {/* Modal edycji zadania */}
      {userRole==='admin' && editingTask && (
        <Portal>
        <div
          className="fixed inset-0 z-[1000] flex items-start justify-center p-6 bg-black/40 backdrop-blur-sm overflow-y-auto"
          onKeyDown={(e) => {
            if(e.key==='Escape'){ e.stopPropagation(); handleCloseEditModal(); }
            if(e.key==='Tab' && editModalRef.current){
              const focusables = Array.from(editModalRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"))
                .filter(el => !el.hasAttribute('disabled'));
              if(!focusables.length) return;
              const first = focusables[0];
              const last = focusables[focusables.length-1];
              if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
              else if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
            }
          }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="editTaskTitle"
        >
          <div
            ref={editModalRef}
            className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 rounded-t-2xl">
              <div className="space-y-1">
                <h3 id="editTaskTitle" className="text-lg font-semibold text-gray-800">Edytuj zadanie</h3>
                <p className="text-sm text-gray-500">Aktualizuj szczegóły i przypisanie zadania.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="p-2 rounded-lg hover:bg-white/70 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleSaveEdit(); }} className="px-6 py-6 space-y-6">
              {editErrors.length>0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700" aria-live="assertive">
                  <ul className="list-disc list-inside space-y-1">
                    {editErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Tytuł zadania</label>
                  <input
                    value={editForm.name}
                    onChange={e => {
                      const value = e.target.value;
                      setEditForm(prev => ({ ...prev, name: value }));
                      setEditErrors([]);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Wprowadź nazwę zadania"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Pracownik</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <button
                        ref={editAssignBtnRef}
                        type="button"
                        onClick={() => setShowEditAssignMenu(v => !v)}
                        className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg bg-white border border-gray-300 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        aria-haspopup="listbox"
                        aria-expanded={showEditAssignMenu}
                      >
                        <span className="inline-flex items-center gap-2 text-gray-700">
                          <UserRoundPlus className="h-4 w-4 text-indigo-500" />
                          <span className="truncate">{editSelectedEmployeeLabel || 'Wybierz pracownika'}</span>
                        </span>
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showEditAssignMenu ? 'rotate-180' : ''}`} />
                      </button>
                      {showEditAssignMenu && (
                        <div
                          ref={editAssignMenuRef}
                          role="listbox"
                          tabIndex={-1}
                          onKeyDown={(e)=> { if(e.key==='Escape'){ e.preventDefault(); setShowEditAssignMenu(false); editAssignBtnRef.current?.focus(); } }}
                          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-gray-100"
                        >
                          <div className="max-h-60 overflow-y-auto py-1">
                            {employeesSorted.map(option => {
                              const isActive = Number(option.id) === Number(editForm.assignedEmployeeId);
                              return (
                                <button
                                  type="button"
                                  key={option.id}
                                  onClick={() => selectEditTaskAssignee(Number(option.id))}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}
                                  role="option"
                                  aria-selected={isActive}
                                >
                                  <span className="truncate">{option.label}</span>
                                  {isActive && <CheckCircle2 className="h-4 w-4 text-indigo-500" />}
                                </button>
                              );
                            })}
                            {!employeesSorted.length && (
                              <div className="px-3 py-2 text-sm text-gray-500">Brak dostępnych pracowników</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearEditTaskAssignee}
                      className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                      disabled={editForm.assignedEmployeeId == null}
                    >
                      Wyczyść
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-600 mb-2 uppercase">Termin</label>
                  <button
                    type="button"
                    onClick={editDatePicker.open}
                    className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <span className="inline-flex items-center gap-2 text-gray-700">
                      <Calendar className="h-4 w-4 text-indigo-500" />
                      <span className="truncate">{formatDueDateHuman(editForm.dueDate)}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-60"
                  disabled={editSaving}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 shadow hover:from-indigo-500 hover:to-blue-500 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
                >
                  {editSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Zapisywanie...
                    </>
                  ) : (
                    'Zapisz zmiany'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}


