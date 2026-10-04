/**
 * Noiraudes : petites boules de suie de la chaufferie de Kamaji.
 * - `SusuwatariRunner` : après la modification d'un montant, une Noiraude
 *   traverse la feuille en sautillant, un kompeitō sur la tête (≈1,6 s),
 *   juste au-dessus de la barre de navigation (portail dans <body>). Jamais rendue si
 *   prefers-reduced-motion (voir useMonthEdits).
 * - `Konpeito` : pastille de couleur stable d'une dépense.
 * - `SusuwatariEmpty` : état vide des dépenses, une Noiraude cachée derrière
 *   son caillou.
 */
import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { budgetTheme } from '../../../themes/manifest';
import { EmptyState } from '../../../ui';
import { konpeitoColorFor } from './mood';
import type { SusuwatariRun } from './useMonthEdits';

export const RUN_MS = 1600;

export function SusuwatariRunner({
  run,
  areaRef,
  onDone,
}: {
  run: SusuwatariRun | null;
  areaRef: RefObject<HTMLElement | null>;
  onDone: () => void;
}) {
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (run === null) return;
    const rect = areaRef.current?.getBoundingClientRect();
    const width = rect && rect.width > 0 ? rect.width : window.innerWidth;
    setBox({ left: rect?.left ?? 0, width });
    // Filet de sécurité si animationend ne vient pas (onglet caché…).
    const timer = window.setTimeout(onDone, RUN_MS + 400);
    return () => window.clearTimeout(timer);
    // onDone est recréé à chaque rendu : seule la course compte.
  }, [run]);

  if (run === null || box === null) return null;
  // Portail : aucune transformation d'ancêtre ne doit capturer le `position: fixed`.
  return createPortal(
    <div className="susu-lane" style={{ left: box.left, width: box.width }} aria-hidden="true">
      <div
        key={run.id}
        className="susu-runner"
        data-carrier={run.carrier}
        style={{ ['--lane' as string]: `${box.width}px`, animationDuration: `${RUN_MS}ms` }}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) onDone();
        }}
      >
        <img className="susu-runner__img" src={budgetTheme.susuwatari[run.carrier]} alt="" draggable={false} />
        <span className="susu-runner__dust" />
      </div>
    </div>,
    document.body,
  );
}

export function Konpeito({ label }: { label: string }) {
  const color = konpeitoColorFor(label);
  return (
    <img
      className="konpeito"
      data-color={color}
      src={budgetTheme.gold.konpeito[color] ?? budgetTheme.gold.konpeito.yellow}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      width={22}
      height={22}
    />
  );
}

export function SusuwatariEmpty({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="susu-empty">
      <img className="susu-empty__img" src={budgetTheme.susuwatari.hiding} alt="" aria-hidden="true" draggable={false} width={77} height={69} />
      <EmptyState art="none" compact title={title}>
        {children}
      </EmptyState>
    </div>
  );
}
