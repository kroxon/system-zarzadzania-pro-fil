import React from 'react';

type ActionFn = () => void;

export interface UnsavedHandler {
  isDirty: () => boolean;
  save: () => void | Promise<void>;
  discard: () => void | Promise<void>;
  title?: string;
  message?: string;
}

interface GuardContextValue {
  register: (handler: UnsavedHandler | null) => () => void;
  attempt: (action: ActionFn, opts?: { title?: string; message?: string }) => void;
}

const GuardContext = React.createContext<GuardContextValue | undefined>(undefined);

export const UnsavedChangesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handlerRef = React.useRef<UnsavedHandler | null>(null);
  const pendingActionRef = React.useRef<ActionFn | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogTitle, setDialogTitle] = React.useState<string>('Niezapisane zmiany');
  const [dialogMessage, setDialogMessage] = React.useState<string>('Masz niezapisane zmiany. Co chcesz zrobić?');
  const [busy, setBusy] = React.useState<'save' | 'discard' | null>(null);

  // Native beforeunload (tab close/refresh)
  React.useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (handlerRef.current?.isDirty()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  const register = React.useCallback((handler: UnsavedHandler | null) => {
    handlerRef.current = handler;
    return () => {
      if (handlerRef.current === handler) handlerRef.current = null;
    };
  }, []);

  const attempt = React.useCallback((action: ActionFn, opts?: { title?: string; message?: string }) => {
    const h = handlerRef.current;
    if (h && h.isDirty()) {
      pendingActionRef.current = action;
      setDialogTitle(opts?.title || h.title || 'Niezapisane zmiany');
      setDialogMessage(
        opts?.message ||
          h.message ||
          'Masz niezapisane zmiany. Zapisz je lub odrzuć, aby kontynuować.'
      );
      setDialogOpen(true);
    } else {
      action();
    }
  }, []);

  const handleClose = () => {
    if (busy) return;
    setDialogOpen(false);
    pendingActionRef.current = null;
  };

  const minDelay = async (fn: () => void | Promise<void>, minMs = 500) => {
    const t0 = Date.now();
    await Promise.resolve(fn());
    const elapsed = Date.now() - t0;
    if (elapsed < minMs) await new Promise(res => setTimeout(res, minMs - elapsed));
  };

  const proceedAfter = () => {
    const act = pendingActionRef.current;
    setDialogOpen(false);
    pendingActionRef.current = null;
    if (act) act();
  };

  const onSave = async () => {
    if (!handlerRef.current) return handleClose();
    try {
      setBusy('save');
      await minDelay(() => handlerRef.current!.save(), 500);
      proceedAfter();
    } finally {
      setBusy(null);
    }
  };
  const onDiscard = async () => {
    if (!handlerRef.current) return handleClose();
    try {
      setBusy('discard');
      await minDelay(() => handlerRef.current!.discard(), 300);
      proceedAfter();
    } finally {
      setBusy(null);
    }
  };

  return (
    <GuardContext.Provider value={{ register, attempt }}>
      {children}
      {dialogOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">{dialogTitle}</h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed text-center">{dialogMessage}</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={!!busy}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={onDiscard}
                  disabled={!!busy}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-60"
                >
                  {busy === 'discard' ? (
                    <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />Odrzucanie…</span>
                  ) : 'Odrzuć i kontynuuj'}
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!!busy}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {busy === 'save' ? (
                    <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border-2 border-blue-300 border-t-white animate-spin" />Zapisywanie…</span>
                  ) : 'Zapisz i kontynuuj'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </GuardContext.Provider>
  );
};

export function useUnsavedChangesGuard() {
  const ctx = React.useContext(GuardContext);
  if (!ctx) throw new Error('useUnsavedChangesGuard must be used within UnsavedChangesProvider');
  return ctx;
}
