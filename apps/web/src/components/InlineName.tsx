import { useEffect, useRef, useState } from 'react';

/**
 * Nom éditable en place : affiché comme du texte avec une petite icône crayon ;
 * un clic transforme le texte en champ, et la validation (Entrée / perte de
 * focus) réaffiche le texte. Permet de gagner de la verticalité dans les
 * Réglages sans sacrifier l'édition.
 */
export function InlineName({
  value,
  onCommit,
  label,
}: {
  value: string;
  onCommit: (value: string) => void;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed.length > 0) {
      onCommit(trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="inline-name__input"
        type="text"
        value={draft}
        aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
          } else if (event.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="inline-name"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      aria-label={`${label} : ${value} (modifier)`}
    >
      <span className="inline-name__text">{value}</span>
      <svg className="inline-name__pencil" viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
        <path
          d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M13.5 6.5l3 3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </button>
  );
}
