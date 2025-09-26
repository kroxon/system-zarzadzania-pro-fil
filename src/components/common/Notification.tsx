import React, { useCallback, useEffect, useMemo, useRef, useState, createContext, useContext } from 'react';

export interface NotificationProps {
	type?: 'success' | 'error' | 'info' | 'warning';
	title?: string;
	message: string;
	onClose?: () => void;
	duration?: number; // ms
}

const colorMap: Record<NonNullable<NotificationProps['type']>, { base: string; border: string; text: string; iconBg: string; } > = {
	success: { base: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', iconBg: 'bg-green-100' },
	error: { base: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', iconBg: 'bg-red-100' },
	info: { base: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', iconBg: 'bg-blue-100' },
	warning: { base: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', iconBg: 'bg-amber-100' },
};

export const Notification: React.FC<NotificationProps> = ({ type='info', title, message, onClose, duration=3000 }) => {
	// Smooth progress with rAF and hover-to-pause
	const total = duration || 0;
	const [remaining, setRemaining] = useState<number | undefined>(duration);
	const [progress, setProgress] = useState<number>(0); // 0..100
	const timerRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const startRef = useRef<number>(Date.now());
	const runRemainingStartRef = useRef<number>(duration || 0);

	const clearTimer = () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; } };
	const clearRaf = () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
	const frame = useCallback(() => {
		if (!total || remaining === undefined) return;
		const now = Date.now();
		const elapsedThisRun = now - startRef.current; // ms
		const remainingNow = Math.max(0, runRemainingStartRef.current - elapsedThisRun);
		const pct = Math.max(0, Math.min(100, ((total - remainingNow) / total) * 100));
		setProgress(pct);
		if (remainingNow > 0 && timerRef.current) {
			rafRef.current = requestAnimationFrame(frame);
		}
	}, [remaining, total]);

	const startTimer = useCallback((ms?: number) => {
		clearTimer();
		clearRaf();
		if (!ms || ms <= 0) { setProgress(100); return; }
		startRef.current = Date.now();
		runRemainingStartRef.current = ms;
		timerRef.current = window.setTimeout(() => { onClose && onClose(); }, ms);
		rafRef.current = requestAnimationFrame(frame);
	}, [frame, onClose]);

	useEffect(() => { startTimer(remaining); return () => { clearTimer(); clearRaf(); }; }, [remaining, startTimer]);

	const onMouseEnter = () => {
		if (remaining === undefined) return;
		const elapsed = Date.now() - startRef.current;
		const newRemaining = Math.max(0, (runRemainingStartRef.current ?? remaining) - elapsed);
		setRemaining(newRemaining);
		clearTimer();
		clearRaf();
	};
	const onMouseLeave = () => { if (remaining && remaining > 0) startTimer(remaining); };

	const c = colorMap[type];
	return (
		<div
			role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
			aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			className={`pointer-events-auto w-full max-w-sm shadow-lg rounded-xl border ${c.border} ${c.base} p-4 pt-3 pb-3 flex items-center gap-3 animate-fadeIn relative overflow-hidden`}
		>      
			<div className={`${c.iconBg} w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${c.text}`}>{type === 'success' ? '✓' : type === 'error' ? '!' : type === 'warning' ? '!' : 'i'}</div>
			<div className="flex-1">
				{title && <div className={`text-sm font-semibold mb-0.5 ${c.text}`}>{title}</div>}
				<div className={`text-xs leading-relaxed whitespace-pre-line ${c.text}`}>{message}</div>
			</div>
			{onClose && (
				<button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-sm">×</button>
			)}
			{total > 0 && (
				<div className="absolute left-0 right-0 bottom-0 h-0.5 bg-black/5">
					<div className={`h-full will-change-transform ${type==='error' ? 'bg-red-400/70' : type==='warning' ? 'bg-amber-400/70' : type==='success' ? 'bg-green-400/70' : 'bg-blue-400/70'}`}
						 style={{ width: `${progress}%` }} />
				</div>
			)}
		</div>
	);
};

export default Notification;

// ===== Global Notification Provider & API =====
// ===== NotificationInstance: manages its own timer/progress, never resets on queue change =====
const NotificationInstance: React.FC<NotificationItem & { onClose: () => void }> = ({ type, title, message, duration, onClose }) => {
	const total = duration || 0;
	const [remaining, setRemaining] = useState<number | undefined>(duration);
	const [progress, setProgress] = useState<number>(0);
	const timerRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const startRef = useRef<number>(Date.now());
	const runRemainingStartRef = useRef<number>(duration || 0);
	// keep onClose in a ref so we don't force startTimer to change identity when parent re-renders
	const onCloseRef = useRef(onClose);
	useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

	const clearTimer = () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; } };
	const clearRaf = () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
	const frame = useCallback(() => {
		if (!total || remaining === undefined) return;
		const now = Date.now();
		const elapsedThisRun = now - startRef.current;
		const remainingNow = Math.max(0, runRemainingStartRef.current - elapsedThisRun);
		const pct = Math.max(0, Math.min(100, ((total - remainingNow) / total) * 100));
		setProgress(pct);
		if (remainingNow > 0 && timerRef.current) {
			rafRef.current = requestAnimationFrame(frame);
		}
	}, [remaining, total]);

		const startTimer = useCallback((ms?: number) => {
		clearTimer();
		clearRaf();
		if (!ms || ms <= 0) { setProgress(100); return; }
		startRef.current = Date.now();
		runRemainingStartRef.current = ms;
			timerRef.current = window.setTimeout(() => { onCloseRef.current && onCloseRef.current(); }, ms);
		rafRef.current = requestAnimationFrame(frame);
		}, [frame]);

	useEffect(() => { startTimer(remaining); return () => { clearTimer(); clearRaf(); }; }, [remaining, startTimer]);

	const onMouseEnter = () => {
		if (remaining === undefined) return;
		const elapsed = Date.now() - startRef.current;
		const newRemaining = Math.max(0, (runRemainingStartRef.current ?? remaining) - elapsed);
		setRemaining(newRemaining);
		clearTimer();
		clearRaf();
	};
	const onMouseLeave = () => { if (remaining && remaining > 0) startTimer(remaining); };

	const c = colorMap[type];
	return (
		<div
			role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
			aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			className={`pointer-events-auto w-full max-w-sm shadow-lg rounded-xl border ${c.border} ${c.base} p-4 pt-3 pb-3 flex items-center gap-3 animate-fadeIn relative overflow-hidden`}
		>
			<div className={`${c.iconBg} w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${c.text}`}>{type === 'success' ? '✓' : type === 'error' ? '!' : type === 'warning' ? '!' : 'i'}</div>
			<div className="flex-1">
				{title && <div className={`text-sm font-semibold mb-0.5 ${c.text}`}>{title}</div>}
				<div className={`text-xs leading-relaxed whitespace-pre-line ${c.text}`}>{message}</div>
			</div>
			{onClose && (
				<button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-sm">×</button>
			)}
			{total > 0 && (
				<div className="absolute left-0 right-0 bottom-0 h-0.5 bg-black/5">
					<div className={`h-full will-change-transform ${type==='error' ? 'bg-red-400/70' : type==='warning' ? 'bg-amber-400/70' : type==='success' ? 'bg-green-400/70' : 'bg-blue-400/70'}`}
							 style={{ width: `${progress}%` }} />
				</div>
			)}
		</div>
	);
};

export type NotificationType = NonNullable<NotificationProps['type']>;
export interface NotificationItem extends Required<Pick<NotificationProps, 'message'>> {
	id: string;
	type: NotificationType;
	title?: string;
	duration?: number; // ms; 0/undefined -> sticky
}

type AddNotificationInput = Omit<NotificationItem, 'id'> & { id?: string };

interface NotificationContextValue {
	notify: (n: AddNotificationInput) => string;
	close: (id: string) => void;
	clear: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const defaultDurations: Record<NotificationType, number> = {
	success: 3000,
	info: 4000,
	warning: 6000,
	error: 8000,
};

// Simple translation map (EN -> PL). We normalize keys (trim, remove trailing punctuation, lowercase)
// to make matching robust against punctuation/capitalization differences from backend.
const _rawEnPl: Record<string, string> = {
	'Invalid credentials': 'Nieprawidłowe dane logowania',
	'Invalid request': 'Nieprawidłowe żądanie',
	'User not found': 'Użytkownik nie został znaleziony',
	'Email already in use': 'Adres e-mail jest już używany',
	'A user with this email already exists.': 'Użytkownik z tym adresem e-mail już istnieje.',
	'Forbidden': 'Brak uprawnień do wykonania operacji',
	'Unauthorized': 'Nieautoryzowany dostęp',
	'Validation failed': 'Błąd walidacji danych',
	'One or more validation errors occurred.': 'Wystąpiły błędy walidacji.',
	'Internal server error': 'Wewnętrzny błąd serwera',
	'Invalid token': 'Nieprawidłowy token',
	'Token expired': 'Token wygasł',
	'Bad request': 'Nieprawidłowe żądanie',
	'Not found': 'Nie znaleziono',
};

const enPlDictionary: Record<string, string> = Object.keys(_rawEnPl).reduce((acc, k) => {
	const norm = k.trim().replace(/[\.!,;:\s]+$/g, '').toLowerCase();
	acc[norm] = _rawEnPl[k];
	return acc;
}, {} as Record<string, string>);

export function translateMessage(msg: string): string {
	if (!msg) return msg;
	// Normalize (trim, remove trailing punctuation, lowercase) and try direct match;
	const normalized = msg.trim().replace(/[\.!,;:\s]+$/g, '').toLowerCase();
	const direct = enPlDictionary[normalized];
	if (direct) return direct;
	// fallback heuristics
	const lower = normalized;
	if (lower.includes('invalid') && lower.includes('credential')) return 'Nieprawidłowe dane logowania';
	if (lower.includes('invalid') && lower.includes('token')) return 'Nieprawidłowy token';
	if (lower.includes('token') && lower.includes('expired')) return 'Token wygasł';
	if (lower.includes('unauthorized')) return 'Nieautoryzowany dostęp';
	if (lower.includes('forbidden')) return 'Brak uprawnień do wykonania operacji';
	if (lower.includes('internal server error')) return 'Wewnętrzny błąd serwera';
	if (lower.includes('invalid request')) return 'Nieprawidłowe żądanie';
	// Backend often returns variants like "A user with this email already exists." or
	// "User with this email already exists" — catch those generically.
	if (lower.includes('user') && lower.includes('email') && lower.includes('exist')) return 'Użytkownik z tym adresem e-mail już istnieje.';
	if (lower.includes('not found')) return 'Nie znaleziono';
	if (lower.includes('validation')) return 'Błąd walidacji danych';
	return msg;
}

// Extract messages array from various backend error payload shapes
export async function extractApiErrorMessages(response: Response): Promise<string[]> {
	try {
		const text = await response.text();
		if (!text) return [response.statusText || `HTTP ${response.status}`];
		let data: any;
		try { data = JSON.parse(text); } catch { return [text]; }

	const msgs: string[] = [];
		// Common minimal-API / Result patterns
		if (typeof data === 'string') msgs.push(data);
		if (data?.message && typeof data.message === 'string') msgs.push(data.message);
		if (data?.error && typeof data.error === 'string') msgs.push(data.error);
		if (Array.isArray(data?.errors)) msgs.push(...data.errors.filter((x: any) => typeof x === 'string'));
		if (Array.isArray(data?.messages)) msgs.push(...data.messages.filter((x: any) => typeof x === 'string'));
		// ModelState-like: { errors: { field: ["msg1", "msg2"] } }
		if (data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
			Object.values<any>(data.errors).forEach((arr: any) => {
				if (Array.isArray(arr)) arr.forEach(v => { if (typeof v === 'string') msgs.push(v); });
				else if (typeof arr === 'string') msgs.push(arr);
			});
		}
		if (data?.title && typeof data.title === 'string') msgs.push(data.title);
		if (data?.detail && typeof data.detail === 'string') msgs.push(data.detail);

		return msgs.length ? msgs : [response.statusText || `HTTP ${response.status}`];
	} catch {
		return [response.statusText || `HTTP ${response.status}`];
	}
}

// External bridge so non-React modules (e.g., fetch utils) can trigger notifications without hooks
type ExternalNotify = {
	push: (n: AddNotificationInput) => string | undefined;
	close: (id: string) => void;
};
let externalNotify: ExternalNotify | null = null;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [items, setItems] = useState<NotificationItem[]>([]);

	// No deduplication here: allow showing multiple notifications (including identical ones) as requested.

	const close = useCallback((id: string) => {
		setItems(prev => prev.filter(i => i.id !== id));
	}, []);

	const notify = useCallback((n: AddNotificationInput) => {
		const id = n.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
		const normalized: NotificationItem = {
			id,
			type: n.type || 'info',
			title: n.title,
			message: n.message,
			duration: typeof n.duration === 'number' ? n.duration : defaultDurations[n.type || 'info'],
		};

		// Always append the new notification. Caller can control deduplication if desired.
		setItems(prev => [...prev, normalized]);
		return id;
	}, []);

	const clear = useCallback(() => setItems([]), []);

	const ctx = useMemo<NotificationContextValue>(() => ({ notify, close, clear }), [notify, close, clear]);

	// Register external bridge
	useEffect(() => {
		externalNotify = { push: (n) => notify(n), close };
		return () => { externalNotify = null; };
	}, [notify, close]);

		return (
			<NotificationContext.Provider value={ctx}>
				{children}
				{/* Container (top-right) */}
				<div
					className="fixed top-4 right-4 z-[1000] flex flex-col items-end gap-2 pointer-events-none"
					onClick={(e) => {
						// clicking background (container) closes the most recent
						if (e.currentTarget === e.target && items.length) {
							const last = items[items.length - 1];
							close(last.id);
						}
					}}
				>
					{items.map((it) => (
						<div key={it.id} className="transition-transform duration-200 ease-out translate-y-0">
							<NotificationInstance
								{...it}
								onClose={() => close(it.id)}
							/>
						</div>
					))}
				</div>
			</NotificationContext.Provider>
		);
};

export function useNotify() {
	const ctx = useContext(NotificationContext);
	if (!ctx) throw new Error('useNotify must be used within <NotificationProvider>');
	const base = ctx.notify;
	return {
		notify: base,
		success: (message: string, opts?: Partial<AddNotificationInput>) => base({ type: 'success', message, ...opts }),
		info: (message: string, opts?: Partial<AddNotificationInput>) => base({ type: 'info', message, ...opts }),
		warning: (message: string, opts?: Partial<AddNotificationInput>) => base({ type: 'warning', message, ...opts }),
		error: (message: string, opts?: Partial<AddNotificationInput>) => base({ type: 'error', message, ...opts }),
		close: ctx.close,
		clear: ctx.clear,
	};
}

// Global notify facade usable outside React components (e.g., in fetch utils)
export const notify = {
	success: (message: string, opts?: Partial<AddNotificationInput>) => externalNotify?.push({ type: 'success', message, ...opts }),
	info: (message: string, opts?: Partial<AddNotificationInput>) => externalNotify?.push({ type: 'info', message, ...opts }),
	warning: (message: string, opts?: Partial<AddNotificationInput>) => externalNotify?.push({ type: 'warning', message, ...opts }),
	error: (message: string, opts?: Partial<AddNotificationInput>) => externalNotify?.push({ type: 'error', message, ...opts }),
	close: (id: string) => externalNotify?.close(id),
};

// Helper: notify from a failed Response by extracting backend messages with translation
export async function notifyFromResponseError(
	response: Response,
	type: NotificationType = 'error',
	options?: { single?: boolean; dropGeneric?: boolean }
) {
	const { single = false, dropGeneric = true } = options || {};
	let msgs = await extractApiErrorMessages(response);

	// Translate first
	msgs = msgs.map(m => translateMessage(m)).filter(Boolean);

	// Normalize and deduplicate (case-insensitive, trimmed)
	const seen = new Set<string>();
	msgs = msgs.filter(m => {
		const key = m.trim().toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	// Drop generic placeholders if specifics exist
	if (dropGeneric && msgs.length > 1) {
		const generics = ['błąd walidacji danych', 'wystąpiły błędy walidacji.', 'nieprawidłowe żądanie', 'nieautoryzowany dostęp', 'brak uprawnień do wykonania operacji'];
		const filtered = msgs.filter(m => !generics.includes(m.trim().toLowerCase()));
		if (filtered.length) msgs = filtered;
	}

	if (single) {
		const first = msgs[0] || 'Wystąpił błąd';
		notify[type](first);
		return;
	}
	msgs.forEach(m => notify[type](m));
}

