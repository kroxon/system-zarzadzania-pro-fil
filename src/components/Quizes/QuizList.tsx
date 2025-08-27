import React from 'react';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';

export interface QuizQuestion {
  question: string;
  answers: string[];
  correct: number[];
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  status: string;
  date: string;
}

const initialQuizzes: Quiz[] = [
  {
    id: 'q1',
    title: 'Rozumienie emocji',
    questions: [
      { question: 'Jaką emocję wyraża uśmiech?', answers: ['Smutek', 'Radość', 'Złość', 'Strach'], correct: [1] },
      { question: 'Co możesz zrobić, gdy jesteś zdenerwowany?', answers: ['Krzyczeć', 'Policzyć do 10', 'Nic', 'Płakać'], correct: [1] },
    ],
    status: 'Opublikowany',
    date: '2023-10-26',
  },
  {
    id: 'q2',
    title: 'Sygnały społeczne',
    questions: [
      { question: 'Co oznacza machanie ręką?', answers: ['Pożegnanie', 'Złość', 'Strach', 'Radość'], correct: [0] },
      { question: 'Jak reagujesz, gdy ktoś płacze?', answers: ['Ignorujesz', 'Pytasz co się stało', 'Śmiejesz się', 'Uciekasz'], correct: [1] },
    ],
    status: 'Szkic',
    date: '2023-11-05',
  },
];

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = React.useState<Quiz[]>(() => {
    const stored = localStorage.getItem('schedule_quizzes');
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed[0]?.questions?.[0]?.answers) {
          // migrate correct to array if needed
          return (parsed as Quiz[]).map((q) => ({
            id: q.id ?? '',
            title: q.title ?? '',
            status: q.status ?? 'Szkic',
            date: q.date ?? '',
            questions: Array.isArray(q.questions) ? q.questions.map((qq) => ({
              question: qq.question ?? '',
              answers: Array.isArray(qq.answers) ? qq.answers : [],
              correct: Array.isArray(qq.correct) ? qq.correct : typeof qq.correct === 'number' ? [qq.correct] : []
            })) : []
          }));
        }
        return initialQuizzes;
      } catch { return initialQuizzes; }
    }
    return initialQuizzes;
  });

  const [editingQuiz, setEditingQuiz] = React.useState<Quiz | null>(null);
  const [editedQuizData, setEditedQuizData] = React.useState<Quiz | null>(null);
  const [previewQuiz, setPreviewQuiz] = React.useState<Quiz | null>(null);
  const [newQuiz, setNewQuiz] = React.useState<Quiz>({
    id: '',
    title: '',
    status: 'Szkic',
    date: new Date().toISOString().slice(0, 10),
    questions: [
      { question: '', answers: ['', ''], correct: [] }
    ],
  });
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Usunięto nieużywaną funkcję handleEditClick

  const handleSaveEdit = () => {
    if (editingQuiz && editedQuizData) {
      setQuizzes((prev) =>
        prev.map((q) => (q.id === editingQuiz.id ? { ...q, ...editedQuizData } as Quiz : q))
      );
    }
    setEditingQuiz(null);
    setEditedQuizData(null);
  };

  const handleAddQuestion = () => {
    if (editedQuizData) {
      setEditedQuizData({
        ...editedQuizData,
        questions: [...editedQuizData.questions, { question: '', answers: [''], correct: [] }]
      });
    }
  };

  const handleRemoveQuestion = (index: number) => {
    if (editedQuizData) {
      const newQuestions = editedQuizData.questions.filter((_, i) => i !== index);
      setEditedQuizData({
        ...editedQuizData,
        questions: newQuestions
      });
    }
  };

  const handleQuestionChange = (index: number, value: string) => {
    if (editedQuizData) {
      const newQuestions = [...editedQuizData.questions];
      newQuestions[index].question = value;
      setEditedQuizData({
        ...editedQuizData,
        questions: newQuestions
      });
    }
  };

  const handleCreateClick = () => {
    setShowCreateModal(true);
    setCreateError(null);
    setNewQuiz({
      id: '',
      title: '',
      status: 'Szkic',
      date: new Date().toISOString().slice(0, 10),
      questions: [
        { question: '', answers: ['', ''], correct: [] }
      ],
    });
  };

  const handleAddQuestionCreate = () => {
    setNewQuiz(qz => ({
      ...qz,
      questions: [...qz.questions, { question: '', answers: ['', ''], correct: [] }]
    }));
  };

  const handleRemoveQuestionCreate = (idx:number) => {
    setNewQuiz(qz => ({
      ...qz,
      questions: qz.questions.filter((_,i)=>i!==idx)
    }));
  };

  const handleQuestionChangeCreate = (idx:number, value:string) => {
    setNewQuiz(qz => ({
      ...qz,
      questions: qz.questions.map((q,i)=>i===idx?{...q, question:value}:q)
    }));
  };

  const handleAnswerChangeCreate = (qIdx:number, aIdx:number, value:string) => {
    setNewQuiz(qz => ({
      ...qz,
      questions: qz.questions.map((q,i)=>i===qIdx?{...q, answers:q.answers.map((a,j)=>j===aIdx?value:a)}:q)
    }));
  };

  const handleAddAnswerCreate = (qIdx:number) => {
    setNewQuiz(qz => ({
      ...qz,
      questions: qz.questions.map((q,i)=>i===qIdx?{...q, answers:[...q.answers, '']}:q)
    }));
  };

  const handleRemoveAnswerCreate = (qIdx:number, aIdx:number) => {
    setNewQuiz(qz => ({
      ...qz,
      questions: qz.questions.map((q,i)=>{
        if(i!==qIdx) return q;
        // Usuń odpowiedź i zaktualizuj tablicę correct
        const newAnswers = q.answers.filter((_,j)=>j!==aIdx);
        const newCorrect = q.correct.filter(idx=>idx!==aIdx).map(idx=>idx > aIdx ? idx-1 : idx);
        return { ...q, answers: newAnswers, correct: newCorrect };
      })
    }));
  };

  const handleCorrectChangeCreate = (qIdx:number, aIdx:number) => {
    setNewQuiz(qz => ({
      ...qz,
      questions: qz.questions.map((q,i)=>{
        if(i!==qIdx) return q;
        const isChecked = q.correct.includes(aIdx);
        return {
          ...q,
          correct: isChecked ? q.correct.filter(idx=>idx!==aIdx) : [...q.correct, aIdx]
        };
      })
    }));
  };

  const handleSaveCreate = () => {
    if (!newQuiz.title.trim()) {
      setCreateError('Podaj tytuł quizu');
      return;
    }
    if (newQuiz.questions.some(q=>!q.question.trim() || q.answers.some(a=>!a.trim()))) {
      setCreateError('Uzupełnij wszystkie pytania i odpowiedzi');
      return;
    }
    const quizToSave = {
      id: 'q' + (quizzes.length + 1) + '_' + Date.now(),
      title: newQuiz.title,
      status: newQuiz.status,
      date: newQuiz.date,
      questions: newQuiz.questions,
    };
    setQuizzes(prev => [...prev, quizToSave]);
    setShowCreateModal(false);
    setCreateError(null);
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
            <button className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors" onClick={handleCreateClick}>
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
              {quizzes.map((quiz) => (
                <tr key={quiz.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 cursor-pointer hover:underline" onClick={() => setPreviewQuiz(quiz)}>{quiz.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">{quiz.questions.length}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${quiz.status === 'Opublikowany' ? 'bg-green-100 text-green-800' : quiz.status === 'Szkic' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{quiz.status}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{quiz.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      className="p-2 rounded hover:bg-gray-100"
                      aria-label="Edytuj quiz"
                      onClick={() => setEditingQuiz(quiz)}
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

      {(editingQuiz) && (
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
                  onChange={(e) => editedQuizData && setEditedQuizData({
                    ...editedQuizData,
                    title: e.target.value
                  })}
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
                        value={question.question}
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
              <button type="button" className="px-4 py-2 rounded border text-sm bg-gray-50 hover:bg-gray-100" onClick={() => { setEditingQuiz(null); setEditedQuizData(null); }}>Anuluj</button>
              <button type="button" className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700" onClick={handleSaveEdit}>Zapisz zmiany</button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <form className="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg" onSubmit={e=>{e.preventDefault();handleSaveCreate();}}>
            <h3 className="text-lg font-semibold mb-2">Dodaj nowy quiz</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Tytuł quizu</label>
              <input type="text" className="w-full border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={newQuiz.title} onChange={e=>setNewQuiz(qz=>({...qz,title:e.target.value}))} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Status</label>
              <select className="w-full border px-3 py-2 rounded" value={newQuiz.status} onChange={e=>setNewQuiz(qz=>({...qz,status:e.target.value}))}>
                <option value="Szkic">Szkic</option>
                <option value="Opublikowany">Opublikowany</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Pytania</label>
              {newQuiz.questions.map((q, qIdx) => (
                <div key={qIdx} className="mb-6 border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{qIdx+1}.</span>
                    <input type="text" className="flex-1 border px-2 py-1 rounded" placeholder="Treść pytania" value={q.question} onChange={e=>handleQuestionChangeCreate(qIdx, e.target.value)} />
                    <button type="button" className="ml-2 px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200" onClick={()=>handleRemoveQuestionCreate(qIdx)}>Usuń pytanie</button>
                  </div>
                  <div className="space-y-2">
                    {q.answers.map((ans, aIdx) => (
                      <div key={aIdx} className="flex items-center gap-2">
                        <input type="text" className="flex-1 border px-2 py-1 rounded" placeholder={`Odpowiedź ${aIdx+1}`} value={ans} onChange={e=>handleAnswerChangeCreate(qIdx, aIdx, e.target.value)} />
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={q.correct.includes(aIdx)} onChange={()=>handleCorrectChangeCreate(qIdx, aIdx)} />
                          Poprawna
                        </label>
                        <button type="button" className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 hover:bg-red-100" onClick={()=>handleRemoveAnswerCreate(qIdx, aIdx)}>Usuń</button>
                      </div>
                    ))}
                    <button type="button" className="mt-2 px-3 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200" onClick={()=>handleAddAnswerCreate(qIdx)}>Dodaj odpowiedź</button>
                  </div>
                </div>
              ))}
              <button type="button" className="px-4 py-2 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm" onClick={handleAddQuestionCreate}>Dodaj pytanie</button>
            </div>
            {createError && <div className="text-red-600 text-sm mb-2">{createError}</div>}
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="px-4 py-2 rounded border text-sm bg-gray-50 hover:bg-gray-100" onClick={()=>setShowCreateModal(false)}>Anuluj</button>
              <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Dodaj quiz</button>
            </div>
          </form>
        </div>
      )}

      {previewQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Podgląd quizu: {previewQuiz.title}</h3>
              <p className="text-sm text-gray-500">Pytania i odpowiedzi</p>
            </div>
            <div className="space-y-6">
              {previewQuiz.questions.map((q, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="font-medium mb-2">{idx+1}. {q.question}</div>
                  <ul className="space-y-1">
                    {q.answers.map((ans, i) => (
                      <li key={i} className={`px-2 py-1 rounded ${q.correct.includes(i) ? 'bg-green-100 text-green-800 font-semibold' : 'bg-gray-50'}`}>{ans}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button type="button" className="px-4 py-2 rounded border text-sm bg-gray-50 hover:bg-gray-100" onClick={() => setPreviewQuiz(null)}>Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
