/**
 * Noiraudes du Budget (V4.2, dessinées par le code depuis « vivantes ») :
 * la scène des Noiraudes de l'écran (creatures/soot) — vagabondes perchées
 * au bord des blocs, attrapées d'un toucher, jouets, portage, kompeitō du
 * bocal, raretés — et, en bas de la feuille, le compteur discret
 * « Noiraudes attrapées : N » (creatures/play, hors AppState).
 * Navigateur piloté (tests) : aucune apparition spontanée ; l'événement
 * `a2:susuwatari` en fait venir une.
 * Monté une fois dans la feuille du Budget.
 */
import { usePlay } from '../../../creatures/play';
import { SootStage } from '../../../creatures/soot';
import { budgetTheme } from '../../../themes/manifest';
import { fr } from '../../../ui';
import './jar.css';

export function SusuwatariGame() {
  const { caught } = usePlay();
  return (
    <>
      <SootStage screen="budget" />
      {caught > 0 && (
        <p className="susu-count" data-testid="susu-count">
          <img src={budgetTheme.susuwatari.sleeping} alt="" draggable={false} width={22} height={17} />
          {fr(`Noiraudes attrapées : ${caught}`)}
        </p>
      )}
    </>
  );
}
