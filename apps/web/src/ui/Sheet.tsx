/**
 * Feuille modale (dialog natif `showModal`) :
 * - plein écran sur mobile (`full`), feuille basse (`auto`) ou boîte d'alerte
 *   centrée (`alert`) ; centrée sur ordinateur ;
 * - focus piégé (Tab / Maj+Tab bouclent), Échap ferme, clic sur le fond
 *   ferme, le focus revient au bouton d'origine ;
 * - glisser vers le bas depuis la poignée / l'en-tête pour fermer ;
 * - animations d'entrée / sortie (désactivées si prefers-reduced-motion).
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { IconButton } from './Button';
import { cx } from './format';

export type SheetSize = 'full' | 'auto' | 'alert';

const CLOSE_MS = 220;
let openCount = 0;

function lockScroll() {
  openCount += 1;
  document.documentElement.classList.add('has-modal');
}
function unlockScroll() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.documentElement.classList.remove('has-modal');
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
  );
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Titre masqué visuellement (l'en-tête reste accessible). */
  titleHidden?: boolean;
  /** Courte phrase sous le titre. */
  description?: ReactNode;
  size?: SheetSize;
  children: ReactNode;
  /** Barre d'actions collée en bas (boutons Enregistrer…). */
  footer?: ReactNode;
  /** Élément à focaliser à l'ouverture (défaut : bouton Fermer). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  /** Contenu à gauche du bouton Fermer (ex. action secondaire). */
  headerExtra?: ReactNode;
  /** Masque le bouton Fermer (boîtes d'alerte : Annuler suffit). */
  hideClose?: boolean;
  /** Appelé une fois la feuille entièrement ouverte / fermée. */
  onOpened?: () => void;
  onClosed?: () => void;
}

export function Sheet({
  open,
  onClose,
  title,
  titleHidden = false,
  description,
  size = 'full',
  children,
  footer,
  initialFocusRef,
  className,
  headerExtra,
  hideClose = false,
  onOpened,
  onClosed,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<'open' | 'closing'>('open');
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;

  if (open && !mounted) setMounted(true);

  // Ouverture : showModal + focus initial.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !mounted || dialog === null) return;
    if (!dialog.open) {
      const active = document.activeElement;
      returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
      dialog.showModal();
      lockScroll();
    }
    setState('open');
    const target = initialFocusRef?.current ?? closeRef.current ?? panelRef.current;
    target?.focus({ preventScroll: true });
    dialog.scrollTop = 0;
    const timer = window.setTimeout(() => onOpenedRef.current?.(), CLOSE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  // Fermeture animée puis close() + retour du focus.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open || !mounted || dialog === null) return;
    setState('closing');
    const timer = window.setTimeout(() => {
      if (dialog.open) {
        dialog.close();
        unlockScroll();
      }
      setMounted(false);
      const back = returnFocusRef.current;
      if (back && back.isConnected) back.focus({ preventScroll: true });
      returnFocusRef.current = null;
      onClosedRef.current?.();
    }, CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  // Démontage pendant l'ouverture : libère le verrou de défilement.
  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) {
        dialog.close();
        unlockScroll();
      }
    };
  }, [mounted]);

  const requestClose = useCallback(() => onCloseRef.current(), []);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const root = panelRef.current;
    if (root === null) return;
    const items = focusables(root);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    const inside = active !== null && root.contains(active);
    if (event.shiftKey && (active === first || !inside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !inside)) {
      event.preventDefault();
      first.focus();
    }
  };

  // Glisser vers le bas pour fermer (poignée + en-tête).
  const drag = useRef<{ y: number; t: number; dy: number; id: number } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (size === 'alert') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    drag.current = { y: event.clientY, t: performance.now(), dy: 0, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const panel = panelRef.current;
    if (d === null || panel === null || d.id !== event.pointerId) return;
    d.dy = Math.max(0, event.clientY - d.y);
    panel.style.transition = 'none';
    panel.style.transform = `translateY(${d.dy}px)`;
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (d === null || panel === null || d.id !== event.pointerId) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t);
    panel.style.transition = '';
    if (d.dy > 120 || (d.dy > 40 && velocity > 0.6)) {
      panel.style.setProperty('--drag-from', `${d.dy}px`);
      panel.style.transform = '';
      requestClose();
    } else {
      panel.style.transform = '';
    }
  };

  if (!mounted) return null;

  return (
    <dialog
      ref={dialogRef}
      className={cx('sheet', `sheet--${size}`, className)}
      data-state={state}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      role={size === 'alert' ? 'alertdialog' : undefined}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="sheet__panel" ref={panelRef} tabIndex={-1}>
        <header
          className="sheet__header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {size !== 'alert' && <span className="sheet__handle" aria-hidden="true" />}
          <div className="sheet__titles">
            <h2 id={titleId} className={cx('sheet__title', titleHidden && 'visually-hidden')}>
              {title}
            </h2>
            {description && (
              <p id={descId} className="sheet__description">
                {description}
              </p>
            )}
          </div>
          {headerExtra}
          {!hideClose && (
            <IconButton ref={closeRef} icon="close" label="Fermer" variant="soft" className="sheet__close" onClick={requestClose} />
          )}
        </header>
        <div className="sheet__body">{children}</div>
        {footer && <footer className="sheet__footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
