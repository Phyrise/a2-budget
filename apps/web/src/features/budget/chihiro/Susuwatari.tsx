/**
 * Noiraudes : petites boules de suie de la chaufferie de Kamaji.
 * - `useSusuwatariRun` : après la modification d'un montant, une Noiraude
 *   (dessinée par le code, scène des Noiraudes : soot.runner) traverse en
 *   bas de la feuille, un kompeitō sur la tête. Jamais au calme
 *   (prefers-reduced-motion, forêt « immobile »).
 * - `Konpeito` : pastille de couleur stable d'une dépense.
 * - `SusuwatariEmpty` : état vide des dépenses, une Noiraude cachée derrière
 *   son caillou.
 */
import { useEffect, type ReactNode } from 'react';
import { soot } from '../../../creatures/soot';
import { budgetTheme } from '../../../themes/manifest';
import { EmptyState } from '../../../ui';
import { konpeitoColorFor } from './mood';
import type { SusuwatariRun } from './useMonthEdits';

/** Une course demandée : la scène la joue, puis on l'oublie. */
export function useSusuwatariRun(run: SusuwatariRun | null, onDone: () => void): void {
  useEffect(() => {
    if (run === null) return;
    soot.runner(run.tone);
    onDone();
    // onDone est recréé à chaque rendu : seule la course compte.
  }, [run]);
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
