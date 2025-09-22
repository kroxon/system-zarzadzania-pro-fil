import { MainPanelStatistics, EmployeeMonthlyStatistic } from '../../types';

const API_URL = import.meta.env.VITE_API_URL;

// Helpers (reuse minimal pattern for enriched errors similar to rooms/occupations where helpful)
async function buildError(res: Response, fallback: string) {
  let detail = '';
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json().catch(() => undefined);
      const msg = (data && (data.message || data.error)) || undefined;
      detail = msg ? `: ${msg}` : '';
    } else {
      const text = await res.text();
      detail = text ? `: ${text}` : '';
    }
  } catch { /* ignore */ }
  return new Error(`${fallback} (status ${res.status})${detail}`);
}

// GET /api/statistics/main-panel
export async function fetchMainPanelStatistics(token: string): Promise<MainPanelStatistics> {
  const res = await fetch(`${API_URL}/api/statistics/main-panel`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw await buildError(res, 'Failed to fetch main panel statistics');
  return await res.json();
}

// GET /api/statistics?year=YYYY&month=M (lista statystyk dla wszystkich pracowników)
export async function fetchEmployeesMonthlyStatistics(year: number, month: number, token: string): Promise<EmployeeMonthlyStatistic[]> {
  const res = await fetch(`${API_URL}/api/statistics?year=${year}&month=${month}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw await buildError(res, 'Failed to fetch employees monthly statistics');
  return await res.json();
}

// GET /api/statistics/me?year=YYYY&month=M (statystyki tylko zalogowanego pracownika)
export async function fetchMyMonthlyStatistics(year: number, month: number, token: string): Promise<EmployeeMonthlyStatistic[]> {
  const res = await fetch(`${API_URL}/api/statistics/me?year=${year}&month=${month}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw await buildError(res, 'Failed to fetch my monthly statistics');
  return await res.json();
}
