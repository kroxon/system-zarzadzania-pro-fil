import { MoreHorizontal, Plus, CheckCircle2, Circle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { EmployeeTask } from '../../types/index'
import { Employee } from '../../types/index';
import { fetchEmployees } from '../../utils/api/employees';
import { createEmployeeTask } from '../../utils/api/tasks';


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


export default function TasksPage({ userRole }: { userRole: 'admin' | 'employee' | 'contact' }) {
  const [employeesLoading, setEmployeesLoading] = useState(true);
  // Fetch tasks from backend on mount/login
  // Fetch tasks only when entering this page (mount)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    import('../../utils/api/tasks').then(api => {
      api.fetchEmployeeTasks(token)
        .then(setTaskList)
        .catch(() => setTaskList([]));
    });
  }, []);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [taskList, setTaskList] = useState<EmployeeTask[]>([]);
  const [editingTask, setEditingTask] = useState<EmployeeTask | null>(null);
  const [formData, setFormData] = useState<EmployeeTask | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState<EmployeeTask>({
    id: 0,
    name: '',
    assignedEmployeesIds: [],
    dueDate: '',
    isCompleted: false,
  });

  const handleOpenCreateModal = () => {
    setNewTask({ id: 0, name: '', assignedEmployeesIds: [], dueDate: '', isCompleted: false });
    setShowCreateModal(true);
  };

  const headerDescription = userRole === 'admin'
    ? 'Zarządzaj zadaniami dla pracowników'
    : 'Zarządzaj swoimi zadaniami';

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleChangeNewTask = (field: keyof EmployeeTask, value: string | number | number[]) => {
    if (field === 'assignedEmployeesIds') {
      // value is array of selected employee IDs
      setNewTask((prev) => ({ ...prev, assignedEmployeesIds: Array.isArray(value) ? value : [Number(value)] }));
    } else {
      setNewTask((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSaveCreateTask = () => {
    if (!newTask.name.trim() || newTask.assignedEmployeesIds.length === 0 || !newTask.dueDate.trim()) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    createEmployeeTask({
      name: newTask.name,
      assignedEmployeesIds: newTask.assignedEmployeesIds,
      dueDate: newTask.dueDate,
      isCompleted: false
    }, token)
      .then((created) => {
        setTaskList(prev => [...prev, created]);
        setShowCreateModal(false);
      })
      .catch(() => {/* obsługa błędu */});
  };

  const handleEditTask = (task: EmployeeTask) => {
    setEditingTask(task);
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
    if (editingTask) {
      setFormData(editingTask);
    } else {
      setFormData(null);
    }
  }, [editingTask]);

  const handleUndoCompleteTask = (taskId: number) => {
    const token = localStorage.getItem('token');
    const task = taskList.find(t => t.id === taskId);
    if (!token || !task) return;
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
    import('../../utils/api/tasks').then(api => {
      api.updateEmployeeTask(taskId, { ...task, isCompleted: true }, token)
        .then(() => {
          setTaskList(taskList.map(t => t.id === taskId ? { ...t, isCompleted: true } : t));
        })
        .catch(() => {/* obsługa błędu */});
    });
  };

  const handleSaveEdit = () => {
    if (!formData) return;
    setTaskList(taskList.map(task => {
      if (task.id === formData.id) {
        return formData;
      }
      return task;
    }));
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId: number) => {
    if (!window.confirm('Czy na pewno chcesz usunąć to zadanie?')) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    import('../../utils/api/tasks').then(api => {
      api.deleteEmployeeTask(taskId, token)
        .then(() => {
          setTaskList(taskList.filter(task => task.id !== taskId));
        })
        .catch(() => {/* obsługa błędu */});
    });
  };




  return (
    <>
      <div className="flex-1 space-y-8 p-4 md:p-8">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight font-headline">Zadania</h2>
            <p className="text-muted-foreground"> {headerDescription} </p>
          </div>
          <div className="flex items-center space-x-2">
            <button className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors" onClick={handleOpenCreateModal}>
              <Plus className="mr-2 h-4 w-4" /> Dodaj zadanie
            </button>
          </div>
        </div>
        <div className="rounded-lg border shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zadanie</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Przypisane do</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Termin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><span className="sr-only">Akcje</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employeesLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Ładowanie pracowników...</td>
                </tr>
              ) : taskList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Brak zadań do wyświetlenia.</td>
                </tr>
              ) : (
                taskList.map((task) => (
                  <tr key={task.id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{task.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {task.assignedEmployeesIds
                        .map(id => {
                          const emp = employees.find(e => Number(e.id) === Number(id));
                          return emp ? `${emp.name} ${emp.surname}` : id;
                        })
                        .join(', ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{task.dueDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge isCompleted={task.isCompleted} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button className="p-2 rounded hover:bg-gray-100" aria-label="Edytuj zadanie" onClick={() => handleEditTask(task)}>
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      <button className="ml-2 p-2 rounded hover:bg-gray-100" aria-label="Usuń zadanie" onClick={() => handleDeleteTask(task.id)}>
                        <span className="sr-only">Usuń</span>🗑️
                      </button>
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
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <form onSubmit={e => { e.preventDefault(); handleSaveCreateTask(); }}>
              <h3 className="text-lg font-semibold mb-2">Dodaj nowe zadanie</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Tytuł zadania</label>
                <input type="text" className="w-full border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newTask.name} onChange={e => handleChangeNewTask('name', e.target.value)} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Przypisane do pracownika</label>
                <select
                  multiple
                  className="w-full border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={newTask.assignedEmployeesIds.map(String)}
                  onChange={e => {
                    const selected = Array.from(e.target.selectedOptions, opt => Number(opt.value));
                    handleChangeNewTask('assignedEmployeesIds', selected);
                  }}
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Termin</label>
                <input type="date" className="w-full border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newTask.dueDate} onChange={e => handleChangeNewTask('dueDate', e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="px-4 py-2 rounded border text-sm bg-gray-50 hover:bg-gray-100" onClick={handleCloseCreateModal}>Anuluj</button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Dodaj zadanie</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal edycji zadania */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Edytuj zadanie</h3>
              <p className="text-sm text-gray-500">Wprowadź zmiany w zadaniu.</p>
            </div>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="title" className="text-right text-sm font-medium text-gray-700">Zadanie</label>
                <input id="title" value={formData?.name || ''} onChange={(e) => formData && setFormData({ ...formData, name: e.target.value })} className="col-span-3 border px-2 py-1 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="assignedTo" className="text-right text-sm font-medium text-gray-700">Przypisane do</label>
                <select
                  id="assignedTo"
                  multiple
                  className="col-span-3 border px-2 py-1 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData?.assignedEmployeesIds ? formData.assignedEmployeesIds.map(String) : []}
                  onChange={e => {
                    if (formData) {
                      const selected = Array.from(e.target.selectedOptions, opt => Number(opt.value));
                      setFormData({ ...formData, assignedEmployeesIds: selected });
                    }
                  }}
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="dueDate" className="text-right text-sm font-medium text-gray-700">Termin</label>
                <input id="dueDate" value={formData?.dueDate || ''} onChange={(e) => formData && setFormData({ ...formData, dueDate: e.target.value })} className="col-span-3 border px-2 py-1 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" type="date" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="px-4 py-2 rounded border text-sm bg-gray-50 hover:bg-gray-100" onClick={() => setEditingTask(null)}>Anuluj</button>
              <button type="button" className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700" onClick={handleSaveEdit}>Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

