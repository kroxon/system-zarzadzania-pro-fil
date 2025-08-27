import { MoreHorizontal, Plus, CheckCircle2, Circle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  status: 'Ukończone' | 'Do zrobienia';
}

function loadTasks(): Task[] {
  const stored = localStorage.getItem('schedule_tasks');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err) {
      console.error('Błąd ładowania zadań z localStorage:', err);
    }
  }
  return [];
}
const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'Ukończone') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold text-green-600 border border-green-300 bg-green-50">
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {status}
      </span>
    );
  }
  // 'Do zrobienia'
  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold text-gray-600 border border-gray-300 bg-gray-50">
      <Circle className="mr-2 h-4 w-4" />
      {status}
    </span>
  );
};


export default function TasksPage() {
  const [taskList, setTaskList] = useState<Task[]>(() => loadTasks());
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<Task | null>(null);

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
  };

  useEffect(() => {
    if (editingTask) {
      setFormData(editingTask);
    } else {
      setFormData(null);
    }
  }, [editingTask]);

  const handleCompleteTask = (taskId: string) => {
    setTaskList(taskList.map(task => {
      if (task.id === taskId) {
        return { ...task, status: 'Ukończone' };
      }
      return task;
    }));
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

  const handleDeleteTask = (taskId: string) => {
    setTaskList(taskList.filter(task => task.id !== taskId));
  };




  return (
    <>
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Zadania</h2>
          <p className="text-muted-foreground">
            Zarządzaj i monitoruj działania terapeutyczne.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
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
            {taskList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Brak zadań do wyświetlenia.</td>
              </tr>
            ) : (
              taskList.map((task) => (
                <tr key={task.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{task.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{task.assignedTo}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{task.dueDate}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={task.status} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      className="p-2 rounded hover:bg-gray-100"
                      aria-label="Edytuj zadanie"
                      onClick={() => handleEditTask(task)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <button
                      className="ml-2 p-2 rounded hover:bg-gray-100"
                      aria-label="Usuń zadanie"
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      <span className="sr-only">Usuń</span>
                      🗑️
                    </button>
                    <button
                      className="ml-2 p-2 rounded hover:bg-gray-100"
                      aria-label="Oznacz jako ukończone"
                      onClick={() => handleCompleteTask(task.id)}
                    >
                      <span className="sr-only">Ukończ</span>
                      ✔️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

    {editingTask && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Edytuj zadanie</h3>
            <p className="text-sm text-gray-500">Wprowadź zmiany w zadaniu.</p>
          </div>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="title" className="text-right text-sm font-medium text-gray-700">
                Zadanie
              </label>
              <input
                id="title"
                value={formData?.title || ''}
                onChange={(e) => formData && setFormData({ ...formData, title: e.target.value })}
                className="col-span-3 border px-2 py-1 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="assignedTo" className="text-right text-sm font-medium text-gray-700">
                Przypisane do
              </label>
              <input
                id="assignedTo"
                value={formData?.assignedTo || ''}
                onChange={(e) => formData && setFormData({ ...formData, assignedTo: e.target.value })}
                className="col-span-3 border px-2 py-1 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="dueDate" className="text-right text-sm font-medium text-gray-700">
                Termin
              </label>
              <input
                id="dueDate"
                value={formData?.dueDate || ''}
                onChange={(e) => formData && setFormData({ ...formData, dueDate: e.target.value })}
                className="col-span-3 border px-2 py-1 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="date"
              />
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

