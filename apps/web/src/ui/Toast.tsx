/**
 * Messages éphémères (« Pommes retirées · Annuler »). Région aria-live polie,
 * au-dessus de la navigation. Un seul message à la fois : le suivant remplace.
 * V5.10 : plusieurs actions courtes (« C'était AC · Ensemble · Annuler »),
 * sur une rangée sous le message ; une action peut en montrer un autre
 * (correction) : il remplace alors celui-ci au lieu de se fermer.
 * Fermeture d'un glissé (horizontal ou vers le bas, voir swipeDismiss.ts) ou
 * par la petite croix ; la fermeture automatique attend la fin d'un glissé,
 * et (V5.10) que le pointeur ou le focus quitte le message.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { cx } from './format';
import { useSwipeDismiss } from './swipeDismiss';

export interface ToastAction {
  label: string;
  onClick: () => void;
  /** Nom accessible plus explicite que le libellé court. */
  ariaLabel?: string;
  /** Repère stable (data-action), pour les tests. */
  id?: string;
}

export interface ToastOptions {
  message: ReactNode;
  icon?: IconName;
  /** À la place de l'icône : un petit visuel (tête de compagnon). */
  visual?: ReactNode;
  action?: ToastAction;
  /** Plusieurs actions (rangée sous le message, cibles ≥ 44 px). */
  actions?: ToastAction[];
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
  const [held, setHeld] = useState(false);
  // Survolé ou focus dedans : le temps de lire et de choisir.
  const [hovered, setHovered] = useState(false);
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
    setHeld(false);
    setHovered(false);
    setToast(item);
  }, []);

  const dismiss = useCallback(() => setLeaving(true), []);
  const swipe = useSwipeDismiss<HTMLDivElement>({ onDismiss: dismiss, onDragChange: setHeld });

  useEffect(() => {
    if (toast === null || held || hovered) return;
    const duration = toast.duration ?? (toast.action || toast.actions?.length ? 6000 : 4000);
    const timer = window.setTimeout(() => setLeaving(true), duration);
    return () => window.clearTimeout(timer);
  }, [toast, held, hovered]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      currentRef.current = null;
      setToast(null);
      setLeaving(false);
      setHovered(false);
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) window.setTimeout(() => show(pending), 400);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [leaving, show]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  /** Une action, puis fermeture — sauf si elle a montré un autre message (qui remplace). */
  const run = (item: ToastItem, a: ToastAction) => {
    a.onClick();
    if (currentRef.current?.id === item.id) setLeaving(true);
  };
  const actions = toast?.actions ?? [];
  const many = actions.length > 0;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} ref={toastEl} className={cx('toast', `toast--${toast.tone ?? 'neutral'}`, many && 'toast--choices', leaving && 'is-leaving')}
            {...swipe}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHovered(false)}
          >
            {toast.visual ? <span className="toast__visual" aria-hidden="true">{toast.visual}</span> : toast.icon && <Icon name={toast.icon} size={20} className="toast__icon" />}
            <span className="toast__message">{toast.message}</span>
            {toast.action && !many && (
              <button type="button" className="toast__action" aria-label={toast.action.ariaLabel} onClick={() => run(toast, toast.action!)}>
                {toast.action.label}
              </button>
            )}
            <button type="button" className="toast__close" aria-label="Fermer" onClick={dismiss}>
              <Icon name="close" size={16} strokeWidth={2} />
            </button>
            {many && (
              <span className="toast__actions" role="group">
                {actions.map((a) => (
                  <button key={a.label} type="button" className="toast__action" data-action={a.id} aria-label={a.ariaLabel} onClick={() => run(toast, a)}>
                    {a.label}
                  </button>
                ))}
              </span>
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
