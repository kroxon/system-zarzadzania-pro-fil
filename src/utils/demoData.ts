import { User, Room, Meeting, Patient } from '../types';
import { saveMeetings, saveRooms, saveUsers, savePatients, markDemoLoaded, clearAllData } from './storage';
import { saveTherapistAssignments } from './storage';

// Generate deterministic-ish random with seed for reproducibility (optional simple impl)
function seedRandom(seed:number){
  let x = seed % 2147483647; if(x<=0) x+=2147483646;
  return ()=> (x = x*16807 % 2147483647) / 2147483647;
}

const roomPalette = ['#facc15', /* żółta */ '#93c5fd', /* jasnoniebieska */ '#ef4444', /* czerwona */ '#f97316', /* pomarańczowa */ '#10b981' /* zielona */];

export interface DemoDataBundle { users: User[]; rooms: Room[]; patients: Patient[]; meetings: Meeting[]; assignments: Record<string,string[]>; }
export interface DemoTask {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  status: 'Ukończone' | 'Do zrobienia';
}

export interface DemoQuiz {
  id: string;
  title: string;
  questions: { question: string; answers: string[]; correct: number }[];
  status: string;
  date: string;
}

export function generateDemoData(seed:number = Date.now()): DemoDataBundle & { quizzes: DemoQuiz[] } {
  const rand = seedRandom(seed);
  // Add realistic session note templates (Polish)
  const sessionNoteTemplates = [
    'Praca nad koncentracją – lekkie trudności na początku, poprawa po przerwie.',
    'Ćwiczenia motoryki małej. Wymagało dodatkowych wskazówek, postęp widoczny.',
    'Sesja diagnostyczna – obserwacja reakcji na zmianę struktury zadań.',
    'Kontynuacja programu usprawniania mowy – lepsza artykulacja wybranych głosek.',
    'Trening pamięci roboczej w formie gry – duże zaangażowanie.',
    'Elementy relaksacji oddechowej – obniżone napięcie po 5 minutach.',
    'Ćwiczenia narracyjne – samodzielne budowanie krótkich opowiadań.',
    'Stymulacja sensoryczna – dobra tolerancja bodźców dotykowych.',
    'Zadania na koordynację oko–ręka – większa precyzja niż w poprzednim tygodniu.',
    'Wzmocnienie pozytywnych zachowań – skuteczne przy pochwałach natychmiastowych.',
    'Krótsza sesja z powodu zmęczenia – mimo to realizacja głównego celu.',
    'Trening planowania sekwencji czynności – potrzebne 2 dodatkowe podpowiedzi.',
    'Stabilny nastrój, większa inicjatywa w zadawaniu pytań.',
    'Powtórzenie materiału z poprzednich zajęć – utrwalone w 80%.',
    'Rozbudowana aktywność ruchowa – dobra regulacja pobudzenia po ćwiczeniach.'
  ];
  // 5 rooms
  const rooms: Room[] = Array.from({length:5}).map((_,i)=>({
    id: 'r'+(i+1),
    name: ['Gabinet A','Gabinet B','Sala terapii','Sala konsultacyjna','Sala grupowa'][i] || 'Sala '+(i+1),
    capacity: i===4? 10: 2+(i%3)*2,
    equipment: ['Stół','Krzesła','Tablica'].slice(0, 1+(i%3)),
    purpose: ['Rehabilitacja','Masaż','Terapia','Konsultacje','Zajęcia grupowe'][i] || 'Terapia',
    color: roomPalette[i%roomPalette.length]
  }));
  // 7 therapists (first is admin)
  const specList = ['Psycholog','Fizjoterapeuta','Terapeuta SI','Logopeda','Pedagog','Neurologopeda','Masażysta'];
  const names = ['Anna Kowalska','Piotr Nowak','Maria Wiśniewska','Jan Kowalczyk','Ewa Zielińska','Tomasz Lewandowski','Katarzyna Mazur'];
  const users: User[] = names.map((fullName,i)=>{
    const [name, surname] = fullName.split(' ');
    return {
      id: 'u'+(i+1),
      name,
      surname: surname || '',
      role: i===0? 'admin':'employee',
      specialization: specList[i%specList.length]
    };
  });
  const employeeUsers = users.filter(u=>u.role==='employee');
  // 20 patients (assign 0+ therapists later)
  const patientFirst = ['Jan','Anna','Piotr','Maria','Tomasz','Katarzyna','Michał','Agnieszka','Karolina','Łukasz','Ola','Bartek','Ewa','Igor','Zuzanna','Marek','Paweł','Julia','Natalia','Kamil'];
  const patientLast = ['Kowalski','Nowak','Zieliński','Wiśniewska','Lewandowski','Szymańska','Dąbrowski','Król','Wójcik','Kaczmarek','Lis','Adamski','Bąk','Gajewski','Maj','Kubiak','Pawlak','Walczak','Krawczyk','Baran'];
  const patients: Patient[] = Array.from({length:20}).map((_,i)=>({ id:'p'+(i+1), firstName:patientFirst[i], lastName:patientLast[i], status: rand()>0.15? 'aktywny':'nieaktywny', birthDate: `${2008 + (i%6)}-${String(1+ (i%12)).padStart(2,'0')}-${String(1+(i%28)).padStart(2,'0')}` }));
  // Assign therapists to patients: 25% none, otherwise 1-3 random distinct specialists
  const assignments: Record<string,string[]> = {};
  patients.forEach(p=>{
    let list: string[] = [];
    if(rand() > 0.25){
      const howMany = 1 + Math.floor(rand()*3); // 1..3
      const shuffled = [...employeeUsers].sort(()=>rand()-0.5);
      list = shuffled.slice(0, howMany).map(u=>u.id);
    }
    p.therapists = list; // store also on patient record
    assignments[p.id] = list;
  });
  // Meetings for previous, current, next week (Mon-Fri) — ensure EACH patient has 0..10 meetings
  const today = new Date();
  const startOfISOWeek = (d:Date)=>{ const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; };
  const thisWeekStart = startOfISOWeek(today);
  const weeks = [-1,0,1];
  const meetings: Meeting[] = [];

  // Helper: format local date (avoids UTC shift from toISOString)
  const formatLocalDate = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayLocal = formatLocalDate(new Date());

  // Pre-compute available date list with week offset for status assignment
  const datePool: { date: string; w: number }[] = [];
  function dayToISO(base:Date, weekOffset:number, weekday:number){ const d=new Date(base); d.setDate(base.getDate()+weekOffset*7 + weekday); return formatLocalDate(d); }
  weeks.forEach(w=>{ for(let weekday=0; weekday<5; weekday++){ datePool.push({ date: dayToISO(thisWeekStart, w, weekday), w }); }});

  const timeSlots = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00'];
  function addMinutes(t:string, mins:number){ const [h,m]=t.split(':').map(Number); const total=h*60+m+mins; const hh = String(Math.floor(total/60)).padStart(2,'0'); const mm=String(total%60).padStart(2,'0'); return `${hh}:${mm}`; }
  const pickSlotRange = ()=>{ const startIdx = Math.floor(rand()* (timeSlots.length-4)); const len = 1 + Math.floor(rand()*3); return { start: timeSlots[startIdx], end: addMinutes(timeSlots[startIdx], 30*len) }; };

  function hasConflict(date:string, specialistId:string, roomId:string, start:string, end:string){
    return meetings.some(m=> m.date===date && (start < m.endTime && end > m.startTime) && (m.specialistId===specialistId || m.roomId===roomId));
  }

  // For each patient assign 0..10 meetings distributed across the 3 weeks
  patients.forEach(p=>{
    // Decide target meeting count: ~15% zero, otherwise 3-10 (higher density)
    let meetingCount = 0;
    if(rand() > 0.15){ meetingCount = 3 + Math.floor(rand()*8); } // 3..10
    for(let i=0;i<meetingCount;i++){
      // Attempt to find a non-conflicting slot (more attempts to reach higher counts)
      for(let attempt=0; attempt<200; attempt++){
        const { date, w } = datePool[Math.floor(rand()*datePool.length)];
        const therapist = employeeUsers[Math.floor(rand()*employeeUsers.length)];
        const room = rooms[Math.floor(rand()*rooms.length)];
        const { start, end } = pickSlotRange();
        if(hasConflict(date, therapist.id, room.id, start, end)) continue;
        let status: Meeting['status'];
        if(w === -1){ status = rand()>0.1 ? 'present' : 'cancelled'; }
        else if(w === 0){ status = rand()>0.85 ? 'in-progress' : 'present'; }
        else { status = rand()>0.05 ? 'present' : 'cancelled'; }
        // Generate realistic notes only for past completed sessions (status present & date in past)
        let note = '';
        // use local date reference
        const todayISO = todayLocal;
        const isPast = (w === -1) || (w === 0 && date <= todayISO);
        if(status === 'present' && isPast){
          if(rand() > 0.2){ // 80% of past completed sessions get a note
            note = sessionNoteTemplates[Math.floor(rand()*sessionNoteTemplates.length)];
          }
        } else if(status === 'cancelled') {
          if(rand()>0.5) note = 'Odwołane – informacja od opiekuna (choroba).';
          else note = 'Odwołane – kolizja z innym wydarzeniem.';
        } else if(status === 'present') { // future planned marked as present in model
          if(rand()>0.85) note = 'Planowana sesja – przygotować materiały sensoryczne.';
        } else if(status === 'in-progress') {
          note = 'Sesja w toku – obserwacja reakcji na nowe zadania.';
        }
        meetings.push({ id: 'm'+(meetings.length+1), specialistId: therapist.id, patientName: `${p.firstName} ${p.lastName}`, patientId: p.id, roomId: room.id, date, startTime: start, endTime: end, notes: note, status, createdBy: therapist.id });
        break;
      }
    }
  });

  const quizzes = generateDemoQuizzes();
  const tasks: DemoTask[] = [
    { id: 't1', title: 'Ukończ kartę mocy "Uczucia"', assignedTo: users[1]?.name || '', dueDate: '2025-08-28', status: 'Ukończone' },
    { id: 't2', title: 'Ćwicz quiz "Dzielenie się"', assignedTo: users[2]?.name || '', dueDate: '2025-08-29', status: 'Do zrobienia' },
    { id: 't3', title: 'Codzienne zameldowanie', assignedTo: users[3]?.name || '', dueDate: '2025-08-30', status: 'Do zrobienia' },
    { id: 't4', title: 'Ćwiczenie słuchania', assignedTo: users[4]?.name || '', dueDate: '2025-08-31', status: 'Do zrobienia' },
    { id: 't5', title: 'Ćwiczenie powitań', assignedTo: users[5]?.name || '', dueDate: '2025-09-01', status: 'Do zrobienia' },
  ];
  return { users, rooms, patients, meetings, assignments, quizzes, tasks } as DemoDataBundle & { quizzes: DemoQuiz[]; tasks: DemoTask[] };
}

export function generateDemoQuizzes(): DemoQuiz[] {
  return [
    {
      id: 'quiz1',
      title: 'Emocje i uczucia',
      status: 'Opublikowany',
      date: '2025-08-01',
      questions: [
        {
          question: 'Jaką emocję wyraża uśmiech?',
          answers: ['Smutek', 'Radość', 'Złość', 'Strach'],
          correct: 1,
        },
        {
          question: 'Co możesz zrobić, gdy jesteś zdenerwowany?',
          answers: ['Krzyczeć', 'Policzyć do 10', 'Nic', 'Płakać'],
          correct: 1,
        },
        {
          question: 'Która z poniższych to pozytywna emocja?',
          answers: ['Radość', 'Złość', 'Strach', 'Smutek'],
          correct: 0,
        },
      ],
    },
    {
      id: 'quiz2',
      title: 'Sygnały społeczne',
      status: 'Szkic',
      date: '2025-08-02',
      questions: [
        {
          question: 'Co oznacza machanie ręką?',
          answers: ['Pożegnanie', 'Złość', 'Strach', 'Radość'],
          correct: 0,
        },
        {
          question: 'Jak reagujesz, gdy ktoś płacze?',
          answers: ['Ignorujesz', 'Pytasz co się stało', 'Śmiejesz się', 'Uciekasz'],
          correct: 1,
        },
      ],
    },
    {
      id: 'quiz3',
      title: 'Codzienne rutyny',
      status: 'Opublikowany',
      date: '2025-08-03',
      questions: [
        {
          question: 'Co robisz rano po przebudzeniu?',
          answers: ['Idziesz spać', 'Myjesz zęby', 'Jesz obiad', 'Oglądasz TV'],
          correct: 1,
        },
        {
          question: 'Co należy zrobić przed wyjściem z domu?',
          answers: ['Założyć buty', 'Nic', 'Zjeść kolację', 'Położyć się spać'],
          correct: 0,
        },
      ],
    },
  ];
}

export function loadAndApplyDemo(seed?:number){
  const { users, rooms, patients, meetings, assignments, quizzes, tasks } = generateDemoData(seed) as DemoDataBundle & { quizzes: DemoQuiz[]; tasks: DemoTask[] };
  saveUsers(users); saveRooms(rooms); savePatients(patients); saveMeetings(meetings); saveTherapistAssignments(assignments); markDemoLoaded();
  localStorage.setItem('schedule_quizzes', JSON.stringify(quizzes));
  localStorage.setItem('schedule_tasks', JSON.stringify(tasks));
  return { users, rooms, patients, meetings, assignments, quizzes, tasks };
}

export function purgeDemo(){
  clearAllData();
}
