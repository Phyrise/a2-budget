/**
 * Messages éphémères (« Pommes retirées · Annuler »). Région aria-live polie,
 * au-dessus de la navigation. Un seul message à la fois : le suivant remplace.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './format';

export interface ToastOptions {
  message: ReactNode;
  icon?: IconName;
  action?: { label: string; onClick: () => void };
  tone?: 'neutral' | 'success' | 'danger';
  /** Durée d'affichage (ms). Défaut : 4 s, 6 s avec une action. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [leaving, setLeaving] = useState(false);
  const idRef = useRef(0);

  const show = useCallback((options: ToastOptions) => {
    idRef.current += 1;
    setLeaving(false);
    setToast({ ...options, id: idRef.current });
  }, []);

  const dismiss = useCallback(() => setLeaving(true), []);

  useEffect(() => {
    if (toast === null) return;
    const duration = toast.duration ?? (toast.action ? 6000 : 4000);
    const timer = window.setTimeout(() => setLeaving(true), duration);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      setToast(null);
      setLeaving(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className={cx('toast', `toast--${toast.tone ?? 'neutral'}`, leaving && 'is-leaving')}>
            {toast.icon && <Icon name={toast.icon} size={20} className="toast__icon" />}
            <span className="toast__message">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action?.onClick();
                  setLeaving(true);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) throw new Error('useToast doit être utilisé dans <ToastProvider>');
  return ctx;
}
