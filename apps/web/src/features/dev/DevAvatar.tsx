/**
 * Mode développeur — l'avatar de l'autre (V5.2) : le faire venir en local
 * (présence simulée, il suit l'onglet), lui faire envoyer un coucou, le
 * faire repartir. Rien n'est écrit, ni dans les données ni sur le serveur.
 * V5.6 : n'importe quel compagnon (Jiji et Teto viennent pour AL, Calcifer
 * et Hin pour AC : la couleur de personne suit le rôle).
 */
import { devVisitCome, devVisitLeave, devVisitPoke, useDevVisit } from '../../presence/avatar/devVisit';
import { COMPANION_IDS, companionProfile, type CompanionId } from '../../ui/companions';

const VISITOR: Record<CompanionId, 'a' | 'b'> = { jiji: 'a', calcifer: 'b', teto: 'a', hin: 'b' };

export function DevAvatar({ onClose }: { onClose: () => void }) {
  const visit = useDevVisit();
  return (
    <section className="dev-section" aria-labelledby="dev-avatar">
      <h3 id="dev-avatar" className="dev-section__title">
        Avatar de l’autre
      </h3>
      <div className="dev-actions">
        {COMPANION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className="dev-choice"
            onClick={() => {
              devVisitCome(VISITOR[id], id);
              onClose();
            }}
          >
            Faire venir {companionProfile(id).name}
          </button>
        ))}
        {visit !== null && (
          <>
            <button
              type="button"
              className="dev-choice"
              onClick={() => {
                devVisitPoke();
                onClose();
              }}
            >
              Il me fait coucou
            </button>
            <button type="button" className="dev-choice" onClick={devVisitLeave}>
              Le faire repartir
            </button>
          </>
        )}
      </div>
    </section>
  );
}
