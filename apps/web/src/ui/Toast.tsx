/**
 * Messages éphémères (« Pommes retirées · Annuler »). Région aria-live polie,
 * au-dessus de la navigation. Un seul message à la fois : le suivant remplace.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './format';

export interface ToastOptions {
  message: ReactNode;
  icon?: IconName;
  action?: { label: string; onClick: () => void };
  tone?: 'neutral' | 'success' | 'danger';
  /** Durée d'affichage (ms). Défaut : 4 s, 6 s avec une action. */
  duration?: number;
  /**
   * `low` : annonce secondaire (« Disponible hors ligne ») qui ne remplace
   * jamais un message affiché (ex. une annulation) : elle attend son tour.
   */
  priority?: 'normal' | 'low';
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
  const currentRef = useRef<ToastItem | null>(null);
  const pendingRef = useRef<ToastOptions | null>(null);
  const toastEl = useRef<HTMLDivElement | null>(null);

  // Hauteur occupée par le message (--toast-lift) : la bulle flottante d'un
  // compagnon s'empile au-dessus au lieu d'être recouverte.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = toastEl.current;
    if (toast === null || leaving || el === null) {
      root.style.removeProperty('--toast-lift');
      return;
    }
    const apply = () => root.style.setProperty('--toast-lift', `${Math.ceil(el.getBoundingClientRect().height) + 10}px`);
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [toast, leaving]);

  const show = useCallback((options: ToastOptions) => {
    if (options.priority === 'low' && currentRef.current !== null) {
      pendingRef.current = options;
      return;
    }
    idRef.current += 1;
    const item = { ...options, id: idRef.current };
    currentRef.current = item;
    setLeaving(false);
    setToast(item);
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
      currentRef.current = null;
      setToast(null);
      setLeaving(false);
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) window.setTimeout(() => show(pending), 400);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [leaving, show]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} ref={toastEl} className={cx('toast', `toast--${toast.tone ?? 'neutral'}`, leaving && 'is-leaving')}>
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
