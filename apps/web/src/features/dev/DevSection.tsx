/**
 * Mode développeur — rangement en accordéon : chaque partie du panneau est
 * une section repliable (titre court + chevron), une seule ouverte à la
 * fois, toutes fermées par défaut. La dernière ouverte est retenue sur ce
 * téléphone (stockage protégé : sans lui, vaut pour la session). Le contenu
 * des sections n'est pas touché : il est seulement enveloppé.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Disclosure } from '../../ui';

const KEY = 'a2-budget:dev-section:v1';

let remembered: string | null | undefined;

function readOpen(): string | null {
  if (remembered !== undefined) return remembered;
  remembered = null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (typeof raw === 'string' && raw.length > 0 && raw.length < 40) remembered = raw;
  } catch {
    // Stockage indisponible : tout fermé.
  }
  return remembered;
}

function writeOpen(id: string | null): void {
  remembered = id;
  try {
    if (id === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, id);
  } catch {
    // Stockage indisponible : vaut pour la session.
  }
}

interface Accordion {
  open: string | null;
  setOpen: (id: string | null) => void;
}

const AccordionContext = createContext<Accordion | null>(null);

/** L'accordéon : une seule section ouverte, la dernière retenue. */
export function DevAccordion({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState<string | null>(readOpen);
  const setOpen = useCallback((id: string | null) => {
    setOpenState(id);
    writeOpen(id);
  }, []);
  return (
    <AccordionContext.Provider value={{ open, setOpen }}>
      <div className="dev-accordion">{children}</div>
    </AccordionContext.Provider>
  );
}

/** Une partie du panneau, repliable (sous-titres internes gardés s'il y en a plusieurs). */
export function DevSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const accordion = useContext(AccordionContext);
  const open = accordion?.open === id;
  return (
    <Disclosure
      variant="card"
      className="dev-fold"
      summary={title}
      open={open}
      onOpenChange={(next) => accordion?.setOpen(next ? id : null)}
    >
      <div className="dev-fold__body" data-dev-section={id}>
        {children}
      </div>
    </Disclosure>
  );
}
