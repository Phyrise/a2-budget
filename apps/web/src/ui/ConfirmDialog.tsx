import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Sheet } from './Sheet';

/**
 * Confirmation explicite (boîte d'alerte centrée). `acknowledge` ajoute une
 * case « Je comprends… » à cocher avant de pouvoir confirmer (actions
 * irréversibles comme « Recommencer à zéro »).
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Annuler',
  tone = 'primary',
  acknowledge,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  acknowledge?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const ackId = useId();

  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      size="alert"
      hideClose
      initialFocusRef={cancelRef}
      className="confirm"
      footer={
        <div className="confirm__actions">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            disabled={acknowledge !== undefined && !acknowledged}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children && <div className="confirm__message">{children}</div>}
      {acknowledge && (
        <label className="confirm__ack" htmlFor={ackId}>
          <input id={ackId} type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
          <span>{acknowledge}</span>
        </label>
      )}
    </Sheet>
  );
}
