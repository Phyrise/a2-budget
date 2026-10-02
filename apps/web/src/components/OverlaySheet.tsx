import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import '../styles/overlay.css';

export interface OverlaySheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Native modal dialog: keyboard focus stays inside and returns to its opener. */
export function OverlaySheet({ open, onClose, title, children }: OverlaySheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeRequestedRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      closeRequestedRef.current = false;
      dialog.showModal();
      closeButtonRef.current?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (!dialog?.open || closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    // Close before the parent's callback, so focus also returns if it unmounts us.
    dialog.close();
    onClose();
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;
    if (outside) requestClose();
  };

  const handleTabKey = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const dialog = event.currentTarget;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]',
    )).filter((element) =>
      element.tabIndex >= 0 &&
      !element.matches(':disabled') &&
      !element.closest('[inert]') &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden',
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) return;

    // Some browsers otherwise let Tab leave a modal for the browser chrome.
    const active = document.activeElement;
    const outside = !dialog.contains(active);
    if (event.shiftKey && (active === first || outside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || outside)) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="overlay-sheet"
      aria-labelledby={titleId}
      onClick={handleBackdropClick}
      onKeyDown={handleTabKey}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={() => {
        // Also synchronize a native close caused by a child form method="dialog".
        if (!dialogRef.current?.open && open && !closeRequestedRef.current) {
          closeRequestedRef.current = true;
          onClose();
        }
      }}
    >
      <header className="overlay-sheet__header">
        <h2 id={titleId} className="overlay-sheet__title">{title}</h2>
        <button
          ref={closeButtonRef}
          type="button"
          className="overlay-sheet__close"
          onClick={requestClose}
          autoFocus
        >
          <span>Fermer</span>
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div className="overlay-sheet__body">{children}</div>
    </dialog>
  );
}
