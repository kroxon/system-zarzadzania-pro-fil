import { notify, notifyFromResponseError } from '../../components/common/Notification';

// Global guard to avoid duplicate notifications/redirects on burst of 401s
let isHandling401 = false;

// Thin wrapper around fetch that:
// - Optionally injects Authorization header from storage if not provided
// - On 401: shows a single toast and redirects to /login after clearing storage
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});

  // If caller didn't provide Authorization, try to inject from storage
  if (!headers.has('Authorization')) {
    try {
      const storedUserRaw = localStorage.getItem('schedule_current_user');
      const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
      const token = (storedUser?.token as string | undefined) || localStorage.getItem('token') || undefined;
      if (token) headers.set('Authorization', `Bearer ${token}`);
    } catch {
      // ignore
    }
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    if (!isHandling401) {
      isHandling401 = true;
      try {
        await notifyFromResponseError(res, 'warning', { single: true });
      } catch {
        notify.warning('Sesja wygasła, zaloguj się ponownie.');
      } finally {
        try {
          localStorage.removeItem('schedule_current_user');
          localStorage.removeItem('token');
        } catch {}
        setTimeout(() => {
          isHandling401 = false;
          // Hard redirect to reset app state reliably
          window.location.assign('/login');
        }, 50);
      }
    }
    // Propagate error to caller (optional)
    throw new Error('Unauthorized');
  }

  return res;
}
