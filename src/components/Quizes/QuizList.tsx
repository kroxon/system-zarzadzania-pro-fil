import React from 'react';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';

interface Quiz {
  id: string;
  title: string;
  questions: string[];
  status: string;
  date: string;
}

const quizzes = [
  {
    id: 'q1',
    title: 'Rozumienie emocji',
    questions: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, i) => `Pytanie ${i + 1}`),
    status: 'Opublikowany',
    date: '2023-10-26',
  },
  {
    id: 'q2',
    title: 'Sygnały społeczne',
    questions: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, i) => `Pytanie ${i + 1}`),
    status: 'Szkic',
    date: '2023-11-05',
  },
  {
    id: 'q3',
    title: 'Scenariusze rozwiązywania problemów',
    questions: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, i) => `Pytanie ${i + 1}`),
    status: 'Opublikowany',
    date: '2023-09-15',
  },
  {
    id: 'q4',
    title: 'Codzienne rutyny',
    questions: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, i) => `Pytanie ${i + 1}`),
    status: 'Zarchiwizowany',
    date: '2023-08-20',
  },
];

interface EditedQuizData {
  id?: string;
  title?: string;
  questions?: string[];
  status?: string;
  date?: string;
}

export default function QuizzesPage() {
  const [editingQuiz, setEditingQuiz] = React.useState<Quiz | null>(null);
  const [editedQuizData, setEditedQuizData] = React.useState<EditedQuizData | null>(null);

  const handleEditClick = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setEditedQuizData({ ...quiz });
  };

  const handleSaveEdit = () => {
    console.log("Saving quiz data:", editedQuizData);
    setEditingQuiz(null);
  };

  const handleQuestionChange = (index: number, value: string) => {
    const newQuestions = editedQuizData?.questions ? [...editedQuizData.questions] : [];
    newQuestions[index] = value;
    setEditedQuizData({ ...editedQuizData, questions: newQuestions } as EditedQuizData);
  };

  const handleAddQuestion = () => {
    if (editedQuizData?.questions) {
      setEditedQuizData({ ...editedQuizData, questions: [...editedQuizData.questions, ''] });
    } else {
      setEditedQuizData({ ...editedQuizData, questions: [''] });
    }
  };

  const handleRemoveQuestion = (index: number) => {
    if (editedQuizData?.questions) {
      const newQuestions = editedQuizData.questions.filter((_, i) => i !== index);
      setEditedQuizData({ ...editedQuizData, questions: newQuestions });
    } 
  };

  return (
    <>
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Quizy</h2>
          <p className="text-muted-foreground">
            Twórz i zarządzaj quizami dla dzieci.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
            <Plus className="mr-2 h-4 w-4" /> Dodaj quiz
          </button>
        </div>
      </div>
      <div className="rounded-lg border shadow-sm overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tytuł</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pytania</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data utworzenia</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"><span className="sr-only">Akcje</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quizzes.map((quiz: Quiz) => (
              <tr key={quiz.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{quiz.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">{quiz.questions.length}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${quiz.status === 'Opublikowany' ? 'bg-green-100 text-green-800' : quiz.status === 'Szkic' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{quiz.status}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{quiz.date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    className="p-2 rounded hover:bg-gray-100"
                    aria-label="Edytuj quiz"
                    onClick={() => handleEditClick(quiz)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {editingQuiz && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Edytuj Quiz</h3>
            <p className="text-sm text-gray-500">Edytuj pytania quizu i dodaj nowe.</p>
          </div>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="title" className="text-right text-sm font-medium text-gray-700">
                Tytuł
              </label>
              <input
                id="title"
                value={editedQuizData?.title || ''}
                onChange={(e) => setEditedQuizData({ ...editedQuizData, title: e.target.value })}
                className="col-span-3 border px-2 py-1 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <label htmlFor="questions" className="text-right pt-2 text-sm font-medium text-gray-700">
                Pytania:
              </label>
              <div className="col-span-3 space-y-2 max-h-60 overflow-y-auto pr-2">
                {editedQuizData?.questions?.map((question, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      id={`question-${index}`}
                      aria-label={`Question ${index + 1}`}
                      value={question}
                      onChange={(e) => handleQuestionChange(index, e.target.value)}
                      className="border px-2 py-1 rounded flex-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button type="button" className="p-2 rounded hover:bg-gray-100" onClick={() => handleRemoveQuestion(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                ))}
                <button type="button" className="px-3 py-1 rounded border text-sm bg-gray-50 hover:bg-gray-100" onClick={handleAddQuestion}>Dodaj pytanie</button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="px-4 py-2 rounded border text-sm bg-gray-50 hover:bg-gray-100" onClick={() => setEditingQuiz(null)}>Anuluj</button>
            <button type="button" className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700" onClick={handleSaveEdit}>Zapisz zmiany</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
