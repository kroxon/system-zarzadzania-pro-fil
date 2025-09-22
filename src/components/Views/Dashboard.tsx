import React from 'react';
import { Calendar, BarChart3, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { User, Room, Meeting, Patient, MainPanelStatistics } from '../../types';
import { fetchMainPanelStatistics, fetchMyMonthlyStatistics, fetchEmployeesMonthlyStatistics } from '../../utils/api/statistics';

interface DashboardProps {
  users: User[];
  rooms: Room[];
  meetings: Meeting[];
  patients?: Patient[];
}

const Dashboard: React.FC<DashboardProps> = ({ users, rooms, meetings, patients = [] }) => {
  // --- Funkcje pomocnicze dat bez użycia toISOString (unikamy przesunięć UTC) ---
  const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayDate = new Date();
  const isoToday = toYMD(todayDate); // lokalna data
  const tomorrowDate = new Date(todayDate.getTime());
  tomorrowDate.setDate(todayDate.getDate() + 1);
  const isoTomorrow = toYMD(tomorrowDate);
  // Początek tygodnia (poniedziałek)
  const dayOfWeek = todayDate.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - diffToMonday);
  const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6, 23,59,59,999);
  const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  // endOfMonth no longer used after backend stats refactor
  // const startOfYear = new Date(todayDate.getFullYear(), 0, 1); // usunięte (nieużywane po czyszczeniu statystyk)
  // Filtr: tylko spotkania z przypisaną salą (roomId niepuste) – brak sali traktujemy jako nieobecność i NIE liczymy w statystykach
  const validMeetings = meetings.filter(m => m.roomId && m.roomId.trim().length > 0);

  // Usunięto filtrowanie po specjaliście (prostota widoku)
  // Wszystkie statystyki oparte są teraz na pełnym zbiorze validMeetings

  // Użyj pacjentów z backendu przekazanych jako props
  const patientsList = patients;
  const activePatientsCount = React.useMemo(()=> patientsList.filter((p: any) => (p as any).isActive !== false).length, [patientsList]);

  // Przygotowanie danych dla dzisiejszych spotkań (podział na kolumny przy większej liczbie)
  const todayMeetings = validMeetings.filter(m => m.date === isoToday);
  const sortedTodayMeetings = [...todayMeetings].sort((a,b)=>a.startTime.localeCompare(b.startTime));
  const splitThreshold = 10; // powyżej / równo tej liczby przechodzimy na 2 kolumny
  const useTwoColumns = sortedTodayMeetings.length >= splitThreshold;
  const midIndex = useTwoColumns ? Math.ceil(sortedTodayMeetings.length / 2) : sortedTodayMeetings.length;
  const firstColumn = sortedTodayMeetings.slice(0, midIndex);
  const secondColumn = useTwoColumns ? sortedTodayMeetings.slice(midIndex) : [];

  // Załaduj pacjentów do mapy dla poprawnego wyświetlania (patientId -> full name)
  const patientsMap = React.useMemo(()=>{
    const map: Record<string,string> = {};
    patientsList.forEach((p:any)=>{ map[String(p.id)] = `${p.name ?? ''} ${p.surname ?? ''}`.trim(); });
    return map;
  }, [patientsList]);

  // Pomocnicza funkcja: zamienia ID pacjenta (pXX) na pełne imię i nazwisko jeśli dostępne
  const resolvePatientToken = (token: string) => {
    if (/^p\d+$/i.test(token)) {
      return patientsMap[token] || token; // jeśli nie znamy, zostaw ID (ostatnia linia funkcji zamieni na '—')
    }
    return token;
  };

  // Funkcja do wyświetlania nazwy pacjenta / gościa.
  // Priorytety:
  // 1. Jeśli jest guestName -> gość
  // 2. Jeśli patientNamesList zawiera wpisy: mapujemy każdy token (ID -> pełna nazwa) i bierzemy pierwszy do tabeli (lub wszystkie połączone jeśli potrzeba)
  // 3. Jeśli patientName jest już pełnym opisem (nie wygląda jak pXX)
  // 4. Jeśli mamy patientId -> mapa
  // 5. Inaczej '—'
  const getPatientDisplayName = (meeting: Meeting) => {
    if (meeting.guestName) return meeting.guestName;
    if (meeting.patientNamesList && meeting.patientNamesList.length > 0) {
      const mapped = meeting.patientNamesList.map(resolvePatientToken).filter(Boolean);
      // jeśli po mapowaniu pierwszy element nadal wygląda jak pXX i brak w mapie, pokaż '—'
      const first = mapped[0];
      if (first && !/^p\d+$/i.test(first)) return first;
      // jeśli wszystkie były nieznane ID i brak w mapie
      return mapped.find(n => !/^p\d+$/i.test(n)) || '—';
    }
    if (meeting.patientName && !/^p\d+$/i.test(meeting.patientName)) return meeting.patientName;
    if (meeting.patientId && patientsMap[meeting.patientId]) return patientsMap[meeting.patientId];
    return '—';
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      'present': 'bg-green-100 text-green-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    const labels = {
      'present': 'Obecny',
      'in-progress': 'W toku',
      'cancelled': 'Odwołany'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status as keyof typeof colors]}`}>{labels[status as keyof typeof labels]}</span>
    );
  };

  // --- Backend statistics integration ---
  const [mainStats, setMainStats] = React.useState<MainPanelStatistics | null>(null);
  const [statsLoading, setStatsLoading] = React.useState(false);
  const [statsError, setStatsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setStatsLoading(true); setStatsError(null);
      try {
        // token strategy consistent with other components
        const storedUserRaw = localStorage.getItem('schedule_current_user');
        let token: string | undefined;
        if (storedUserRaw) {
          try { token = JSON.parse(storedUserRaw)?.token; } catch { /* ignore */ }
        }
        token = token || localStorage.getItem('token') || undefined;
        if (!token) throw new Error('Brak tokenu autoryzacji');
        const data = await fetchMainPanelStatistics(token);
        if (mounted) setMainStats(data);
      } catch (e:any) {
        if (mounted) setStatsError(e.message || 'Nie udało się pobrać statystyk');
      } finally {
        if (mounted) setStatsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  interface StatTile { key:string; count:number; label:string; dateRange:string; icon:any; gradient:string; disabled?: boolean; }
  const stats: (StatTile & { weekStart?: string; weekEnd?: string })[] = [
    { key: 'today', count: mainStats?.today ?? 0, label: 'DZIŚ', dateRange: todayDate.toLocaleDateString('pl-PL'), icon: Calendar, gradient: 'from-blue-500/80 via-sky-400/70 to-cyan-400/80', disabled: !mainStats },
    { key: 'tomorrow', count: mainStats?.tomorrow ?? 0, label: 'JUTRO', dateRange: tomorrowDate.toLocaleDateString('pl-PL'), icon: Calendar, gradient: 'from-fuchsia-500/80 via-pink-400/70 to-rose-400/80', disabled: !mainStats },
    { key: 'week', count: mainStats?.thisWeek ?? 0, label: 'W TYM TYGODNIU', dateRange: `${startOfWeek.toLocaleDateString('pl-PL')} – ${endOfWeek.toLocaleDateString('pl-PL')}`, weekStart: startOfWeek.toLocaleDateString('pl-PL'), weekEnd: endOfWeek.toLocaleDateString('pl-PL'), icon: Calendar, gradient: 'from-emerald-500/80 via-green-400/70 to-lime-400/80', disabled: !mainStats },
    { key: 'month', count: mainStats?.thisMonth ?? 0, label: 'W TYM MIESIĄCU', dateRange: startOfMonth.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }).toUpperCase(), icon: Calendar, gradient: 'from-amber-400/80 via-orange-400/70 to-red-400/80', disabled: !mainStats },
    { key: 'patients', count: mainStats?.activePatients ?? activePatientsCount, label: 'AKTYWNI PODOPIECZNI', dateRange: 'Łączna liczba', icon: Users, gradient: 'from-purple-500/80 via-violet-400/70 to-indigo-400/80', disabled: !mainStats }
  ];

  // ================= Nowa sekcja statystyk (rok / miesiąc + filtr pracownika) =================
  const currentUserScoped = React.useMemo(() => { try { return JSON.parse(localStorage.getItem('schedule_current_user') || 'null'); } catch { return null; } }, []);
  const isAdminScoped = currentUserScoped?.role === 'admin';
  const [statsMode, setStatsMode] = React.useState<'year' | 'month'>('year');
  const [periodDate, setPeriodDate] = React.useState(new Date());
  const periodYear = periodDate.getFullYear();
  const periodMonth = periodDate.getMonth();
  const monthNames = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  const shiftPeriod = (delta: number) => {
    if (statsMode === 'year') setPeriodDate(new Date(periodYear + delta, 0, 1));
    else setPeriodDate(new Date(periodYear, periodMonth + delta, 1));
  };
  const [selectedSpecialist, setSelectedSpecialist] = React.useState<string>(isAdminScoped ? 'all' : (currentUserScoped?.id || 'all'));
  React.useEffect(() => { if (!isAdminScoped && currentUserScoped?.id) setSelectedSpecialist(currentUserScoped.id); }, [isAdminScoped, currentUserScoped]);
  const periodLabel = statsMode === 'year' ? periodYear.toString() : `${monthNames[periodMonth]} ${periodYear}`;
  // ================= Backend month/year statistics (per employee / all) =================
  interface AggregatedEmployeeStats { employeeId: number; totalEvents: number; completedEvents: number; cancelledEvents: number; absentPatients: number; }
  const [periodStatsLoading, setPeriodStatsLoading] = React.useState(false);
  const [periodStatsError, setPeriodStatsError] = React.useState<string | null>(null);
  const [yearEmployeesStats, setYearEmployeesStats] = React.useState<AggregatedEmployeeStats[] | null>(null); // for year mode (all employees aggregated across months)
  const [monthEmployeesStats, setMonthEmployeesStats] = React.useState<AggregatedEmployeeStats[] | null>(null); // for month mode

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      setPeriodStatsLoading(true); setPeriodStatsError(null);
      try {
        // token retrieval
        const storedUserRaw = localStorage.getItem('schedule_current_user');
        let token: string | undefined;
        if (storedUserRaw) { try { token = JSON.parse(storedUserRaw)?.token; } catch { /* ignore */ } }
        token = token || localStorage.getItem('token') || undefined;
        if (!token) throw new Error('Brak tokenu autoryzacji');

        if (statsMode === 'month') {
          // Single month fetch
            if (isAdminScoped) {
              const all = await fetchEmployeesMonthlyStatistics(periodYear, periodMonth + 1, token);
              if (!active) return;
              setMonthEmployeesStats(all.map(e => ({...e})));
              setYearEmployeesStats(null);
            } else {
              const mine = await fetchMyMonthlyStatistics(periodYear, periodMonth + 1, token);
              if (!active) return;
              setMonthEmployeesStats(mine.map(e => ({...e})));
              setYearEmployeesStats(null);
            }
        } else { // year mode
          // Need to aggregate 12 months (or up to current month). We'll fetch 12 for completeness.
          const months = Array.from({length:12}, (_,i)=>i+1);
          if (isAdminScoped) {
            const perMonthArrays = await Promise.all(months.map(m => fetchEmployeesMonthlyStatistics(periodYear, m, token).catch(()=>[])));
            if (!active) return;
            // Aggregate per employeeId
            const map = new Map<number, AggregatedEmployeeStats>();
            for (const arr of perMonthArrays) {
              for (const rec of arr as AggregatedEmployeeStats[]) {
                const existing = map.get(rec.employeeId) || { employeeId: rec.employeeId, totalEvents:0, completedEvents:0, cancelledEvents:0, absentPatients:0 };
                existing.totalEvents += rec.totalEvents;
                existing.completedEvents += rec.completedEvents;
                existing.cancelledEvents += rec.cancelledEvents;
                existing.absentPatients += rec.absentPatients;
                map.set(rec.employeeId, existing);
              }
            }
            setYearEmployeesStats(Array.from(map.values()));
            setMonthEmployeesStats(null);
          } else {
            const perMonthArrays = await Promise.all(months.map(m => fetchMyMonthlyStatistics(periodYear, m, token).catch(()=>[])));
            if (!active) return;
            // Each array should contain a single record for the logged user
            const agg = { employeeId: -1, totalEvents:0, completedEvents:0, cancelledEvents:0, absentPatients:0 } as AggregatedEmployeeStats;
            for (const arr of perMonthArrays) {
              for (const rec of arr as AggregatedEmployeeStats[]) {
                agg.employeeId = rec.employeeId;
                agg.totalEvents += rec.totalEvents;
                agg.completedEvents += rec.completedEvents;
                agg.cancelledEvents += rec.cancelledEvents;
                agg.absentPatients += rec.absentPatients;
              }
            }
            setYearEmployeesStats([agg]);
            setMonthEmployeesStats(null);
          }
        }
      } catch (e:any) {
        if (active) setPeriodStatsError(e.message || 'Nie udało się pobrać statystyk okresu');
      } finally {
        if (active) setPeriodStatsLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [statsMode, periodYear, periodMonth, selectedSpecialist, isAdminScoped]);

  // Derive counts for UI
  const deriveCounts = () => {
    const list = statsMode === 'month' ? monthEmployeesStats : yearEmployeesStats;
    if (!list || list.length === 0) return { total:0, completed:0, cancelled:0, absent:0 };
    if (isAdminScoped) {
      if (selectedSpecialist === 'all') {
        return list.reduce((acc, r) => ({
          total: acc.total + r.totalEvents,
          completed: acc.completed + r.completedEvents,
          cancelled: acc.cancelled + r.cancelledEvents,
            absent: acc.absent + r.absentPatients
        }), { total:0, completed:0, cancelled:0, absent:0 });
      } else {
        const numericId = parseInt(String(selectedSpecialist),10);
        const rec = list.find(r => r.employeeId === numericId);
        return rec ? { total: rec.totalEvents, completed: rec.completedEvents, cancelled: rec.cancelledEvents, absent: rec.absentPatients } : { total:0, completed:0, cancelled:0, absent:0 };
      }
    } else {
      const rec = list[0];
      return { total: rec.totalEvents, completed: rec.completedEvents, cancelled: rec.cancelledEvents, absent: rec.absentPatients };
    }
  };
  const { total: totalCount, completed: presentCount, cancelled: cancelledCount, absent: absentCount } = deriveCounts();
  const percent = (part: number) => totalCount ? Math.round((part / totalCount) * 100) : 0;
  const statusTiles = [
    { label: 'Łącznie', value: totalCount, gradient: 'from-slate-500/80 via-slate-400/70 to-slate-300/80', showPct: false },
    { label: 'Odbyło się', value: presentCount, gradient: 'from-emerald-500/80 via-green-400/70 to-lime-400/80', showPct: true },
    { label: 'Odwołane', value: cancelledCount, gradient: 'from-rose-500/80 via-pink-400/70 to-fuchsia-400/80', showPct: true },
    { label: 'Nieobecny podopieczny', value: absentCount, gradient: 'from-amber-500/80 via-orange-400/70 to-red-400/80', showPct: true }
  ];

  // Animacja słupków zestawienia – rosną od 0 po każdej zmianie zakresu/statystyk
  // Removed animatedPercents (animation dropped after backend integration)

  return (
    <div className="space-y-6">
      {/* Sekcja statystyk spotkań na miejscu */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Spotkania w siedzibie fundacji ogółem
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {stats.map(stat => {
            const isLoading = statsLoading && !mainStats;
            return (
              <div
                key={stat.key}
                className={`relative overflow-hidden rounded-3xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12)] border border-white/30 bg-white/60 backdrop-blur-xl p-4 md:p-5 transition-all duration-500 group ${stat.disabled ? 'opacity-70' : ''} min-w-[150px]`}
              >
                <div className={`pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br ${stat.gradient} mix-blend-overlay`} />
                <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_30%_30%,white,transparent_70%)] opacity-40" style={{backgroundImage:'repeating-linear-gradient(135deg,rgba(255,255,255,0.18)_0_10px,transparent_10px_20px)'}} />
                <div className="relative flex md:grid items-center gap-3 md:grid-cols-[auto_1fr_auto] min-h-[78px] w-full">
                  <div className="flex flex-col items-start shrink-0">
                    {isLoading ? (
                      <span className="w-10 h-8 rounded-md bg-gray-200 animate-pulse" />
                    ) : (
                      <span className="text-4xl md:text-5xl leading-none font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent drop-shadow-sm">
                        {stat.count}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-center justify-center text-center px-0 md:px-1 flex-1">
                    <p className="text-[11px] md:text-[12px] font-semibold tracking-wide text-gray-500 uppercase leading-tight">{stat.label}</p>
                    <div className={`mt-1 text-xs md:text-sm font-medium text-gray-700 leading-snug break-words text-center ${stat.key==='week' ? 'space-y-0.5' : ''}`}>
                      {isLoading ? (
                        <span className="inline-block h-3 w-16 md:w-20 rounded bg-gray-200 animate-pulse" />
                      ) : stat.key === 'week' && stat.weekStart && stat.weekEnd ? (
                        <>
                          <span>{stat.weekStart} –</span><br />
                          <span>{stat.weekEnd}</span>
                        </>
                      ) : (
                        stat.dateRange
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end items-start shrink-0 self-start md:self-auto ml-auto">
                    <div className={`p-2.5 md:p-3 rounded-2xl bg-gradient-to-br ${stat.gradient} text-white shadow-md ring-1 ring-white/40 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}> 
                      <stat.icon className="h-5 w-5 md:h-6 md:w-6 drop-shadow" />
                    </div>
                  </div>
                </div>
                {statsError && stat.key === 'today' && (
                  <div className="absolute inset-x-0 bottom-0 px-3 py-1 bg-red-50 text-[11px] text-red-600 font-medium border-t border-red-200">
                    {statsError}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dzisiejsze spotkania */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" /> Dzisiejsze spotkania
          </h2>
        </div>
        <div className="p-0">
          {todayMeetings.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Brak spotkań na dziś</p>
          ) : (
            <div className={`relative w-full`}>{/* pełna szerokość bez max-w */}
              <div className="pointer-events-none absolute top-0 right-0 h-full w-px bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200" />
              {!useTwoColumns && (
                <>
                  <div className="hidden md:grid grid-cols-[110px_1fr_1fr_1fr_120px] gap-4 px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-600 bg-gray-50/80 border-b border-gray-200 rounded-t-xl">
                    <span>Godzina</span>
                    <span>Specjalista</span>
                    <span>Pacjent / Gość</span>
                    <span>Sala</span>
                    <span>Status</span>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {firstColumn.map(meeting => {
                      const specialist = users.find(u => u.id === meeting.specialistId);
                      const room = rooms.find(r => r.id === meeting.roomId);
                      const patientDisplay = getPatientDisplayName(meeting);
                      return (
                        <div
                          className="group px-4 md:px-6 py-4 flex flex-col gap-3 md:grid md:grid-cols-[110px_1fr_1fr_1fr_120px] md:items-center bg-white hover:bg-gray-50 transition-colors"
                          key={meeting.id}
                        >
                          {/* Godzina */}
                          <div className="flex items-center md:justify-start">
                            <span className="inline-flex items-center justify-center rounded-md bg-blue-600/10 text-blue-700 text-sm font-semibold px-3 py-1 tracking-wide border border-blue-200/60 shadow-sm">
                              {meeting.startTime}
                            </span>
                          </div>
                          {/* Specjalista */}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{specialist?.name}</p>
                          </div>
                          {/* Pacjent / Gość */}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{patientDisplay}</p>
                          </div>
                          {/* Sala */}
                          <div className="min-w-0 flex items-center gap-2">
                            <span
                              className="inline-block w-3.5 h-3.5 rounded-full ring-1 ring-black/10 shadow-sm flex-shrink-0"
                              style={{ backgroundColor: room?.hexColor || '#CBD5E1' }}
                              aria-label={room?.hexColor ? `Kolor sali ${room.name}` : 'Brak koloru sali'}
                            />
                            <p className="text-sm text-gray-700 font-medium truncate">{room?.name}</p>
                          </div>
                          {/* Status */}
                          <div className="flex items-center md:justify-start"><div className="scale-110 md:scale-100">{getStatusBadge(meeting.status)}</div></div>
                          {/* Widok mobile */}
                          <div className="md:hidden">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase">Specjalista:</span>
                                <span className="text-sm font-medium text-gray-900">{specialist?.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase">Pacjent / Gość:</span>
                                <span className="text-sm font-medium text-gray-900">{patientDisplay}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase">Sala:</span>
                                <span className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                  <span
                                    className="inline-block w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: room?.hexColor || '#CBD5E1' }}
                                    aria-label={room?.hexColor ? `Kolor sali ${room.name}` : 'Brak koloru sali'}
                                  />
                                  {room?.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase">Status:</span>
                                <span className="text-sm font-medium text-gray-900">{getStatusBadge(meeting.status)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {useTwoColumns && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pr-px">{/* pr-px żeby linia stykała się ładnie */}
                  {[firstColumn, secondColumn].map((col, idx) => (
                    <div key={idx} className="relative bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {idx === 1 && <div className="pointer-events-none absolute top-0 -right-4 h-full w-px bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200" />}
                      <div className="hidden md:grid grid-cols-[105px_1fr_1fr_1fr_110px] gap-3 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 bg-gray-50/80 border-b border-gray-200">
                        <span>Godzina</span>
                        <span>Specjalista</span>
                        <span>Pacjent / Gość</span>
                        <span>Sala</span>
                        <span>Status</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {col.map(meeting => {
                          const specialist = users.find(u => u.id === meeting.specialistId);
                          const room = rooms.find(r => r.id === meeting.roomId);
                          const patientDisplay = getPatientDisplayName(meeting);
                          return (
                            <div key={meeting.id} className="group px-4 py-3 flex flex-col gap-2 md:grid md:grid-cols-[105px_1fr_1fr_1fr_110px] md:items-center bg-white hover:bg-gray-50 transition-colors">
                              {/* Godzina */}
                              <div className="flex items-center">
                                <span className="inline-flex items-center justify-center rounded-md bg-blue-600/10 text-blue-700 text-[13px] font-semibold px-2.5 py-1 tracking-wide border border-blue-200/60">
                                  {meeting.startTime}
                                </span>
                              </div>
                              {/* Specjalista */}
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-gray-900 truncate">{specialist?.name}</p>
                              </div>
                              {/* Pacjent / Gość */}
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-gray-800 truncate">{patientDisplay}</p>
                              </div>
                              {/* Sala */}
                              <div className="min-w-0 flex items-center gap-2">
                                <span
                                  className="inline-block w-3 h-3 rounded-full ring-[0.5px] ring-black/10 shadow-sm flex-shrink-0"
                                  style={{ backgroundColor: room?.hexColor || '#CBD5E1' }}
                                  aria-label={room?.hexColor ? `Kolor sali ${room.name}` : 'Brak koloru sali'}
                                />
                                <p className="text-[12px] font-medium text-gray-700 truncate">{room?.name}</p>
                              </div>
                              {/* Status */}
                              <div className="flex items-center">{getStatusBadge(meeting.status)}</div>
                              {/* Mobile extra */}
                              <div className="md:hidden">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-gray-500 uppercase">Specjalista:</span>
                                    <span className="text-sm font-medium text-gray-900">{specialist?.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-gray-500 uppercase">Pacjent / Gość:</span>
                                    <span className="text-sm font-medium text-gray-900">{patientDisplay}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-gray-500 uppercase">Sala:</span>
                                    <span className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                      <span
                                        className="inline-block w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: room?.hexColor || '#CBD5E1' }}
                                        aria-label={room?.hexColor ? `Kolor sali ${room.name}` : 'Brak koloru sali'}
                                      />
                                      {room?.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-gray-500 uppercase">Status:</span>
                                    <span className="text-sm font-medium text-gray-900">{getStatusBadge(meeting.status)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Statystyki spotkań (globalne / per pracownik) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex flex-col gap-4">
          {/** Dynamic heading text based on role */}
          {/** Admin: "Statystyki spotkań wybranych pracowników" | Others: "Moje statystyki spotkań" */}
          {/** isAdminScoped already computed above */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" /> {isAdminScoped ? 'Statystyki spotkań wybranych pracowników' : 'Moje statystyki spotkań'}
            </h2>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <button onClick={()=>setStatsMode('year')} className={`px-3 py-1.5 text-sm font-medium transition ${statsMode==='year' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-white'}`}>Rok</button>
                <button onClick={()=>setStatsMode('month')} className={`px-3 py-1.5 text-sm font-medium transition ${statsMode==='month' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-white'}`}>Miesiąc</button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>shiftPeriod(-1)} className="p-2 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600"><ChevronLeft className="h-4 w-4" /></button>
                <span className="min-w-[140px] text-center text-sm font-semibold text-gray-800 whitespace-nowrap">{periodLabel}</span>
                <button onClick={()=>shiftPeriod(1)} className="p-2 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
          {isAdminScoped && (
            <div className="flex flex-wrap gap-2 justify-center pt-1">
              <button
                onClick={()=>setSelectedSpecialist('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${selectedSpecialist==='all' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'}`}
              >Wszyscy</button>
              {users.map(u=> {
                const fullName = `${u.name || ''} ${u.surname || ''}`.trim();
                return (
                  <button
                    key={u.id}
                    onClick={()=>setSelectedSpecialist(u.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${selectedSpecialist===u.id ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'}`}
                    title={fullName}
                  >{fullName}</button>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-6 space-y-8">
          <h3 className="text-sm font-semibold text-gray-800 tracking-wide uppercase mb-2">Zestawienie spotkań w siedzibie fundacji</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {statusTiles.map(tile => (
              <div key={tile.label} className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur p-4 border border-gray-200 group shadow-sm hover:shadow transition min-h-[92px]">
                <div className={`pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br ${tile.gradient} mix-blend-overlay`} />
                {periodStatsLoading && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" aria-label="Ładowanie" />
                  </div>
                )}
                <div className="relative flex flex-col">
                  <span className="text-3xl font-bold text-gray-900">{tile.value}</span>
                  <span className="mt-1 text-[11px] font-semibold tracking-wide text-gray-600 uppercase leading-tight">{tile.label}</span>
                </div>
              </div>
            ))}
          </div>
          {periodStatsError && (
            <div className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {periodStatsError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              {/* Heading moved above tiles */}
              <div className="space-y-3">
                {[{id:'present',label:'Odbyło się', value:presentCount, color:'bg-green-500'}, {id:'cancelled',label:'Odwołane', value:cancelledCount, color:'bg-rose-500'}, {id:'absent',label:'Nieobecny podopieczny', value:absentCount, color:'bg-amber-500'}].map(row => (
                  <div key={row.id} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shadow-sm ring-1 ring-black/10 flex-shrink-0 ${row.color}`} />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gray-600 font-medium">
                        <span>{row.label}</span>
                        <span>{row.value} ({percent(row.value)}%)</span>
                      </div>
                      <div className="h-2 mt-1 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`${row.color} h-full transition-all duration-700 ease-out`}
                          style={{width: `${periodStatsLoading ? 0 : percent(row.value)}%`}}
                          aria-label={`${row.label} ${percent(row.value)}%`}
                          aria-valuenow={percent(row.value)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          role="progressbar"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;