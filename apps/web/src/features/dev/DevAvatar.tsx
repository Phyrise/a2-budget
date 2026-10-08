/**
 * Mode développeur — l'avatar de l'autre (V5.2) : le faire venir en local
 * (présence simulée, il suit l'onglet), lui faire envoyer un coucou, le
 * faire repartir. Rien n'est écrit, ni dans les données ni sur le serveur.
 */
import { devVisitCome, devVisitLeave, devVisitPoke, useDevVisit } from '../../presence/avatar/devVisit';

export function DevAvatar({ onClose }: { onClose: () => void }) {
  const visit = useDevVisit();
  return (
    <section className="dev-section" aria-labelledby="dev-avatar">
      <h3 id="dev-avatar" className="dev-section__title">
        Avatar de l’autre
      </h3>
      <div className="dev-actions">
        <button
          type="button"
          className="dev-choice"
          onClick={() => {
            devVisitCome('a');
            onClose();
          }}
        >
          Faire venir Jiji
        </button>
        <button
          type="button"
          className="dev-choice"
          onClick={() => {
            devVisitCome('b');
            onClose();
          }}
        >
          Faire venir Calcifer
        </button>
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
