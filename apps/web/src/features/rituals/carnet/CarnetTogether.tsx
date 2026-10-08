/**
 * Carnet de la forêt — « À deux » (V5.1) : la trace des quêtes communes
 * réglées, un petit dessin et la date, de la plus récente à la plus ancienne.
 * Sobre : rien tant qu'aucune n'est réglée.
 */
import { doneQuests, parseLocalDateKey, type AppState } from '@a2/core';
import { QuestArt } from '../../quests/QuestArt';
import '../../quests/quests.css';

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function CarnetTogether({ app }: { app: AppState }) {
  const done = doneQuests(app.quests?.items).reverse();
  if (done.length === 0) return null;
  return (
    <section className="carnet-section" aria-labelledby="carnet-together">
      <h3 id="carnet-together" className="carnet-section__title display">
        À deux
      </h3>
      <ul className="carnet-together">
        {done.map((q) => (
          <li key={q.id} className="carnet-together__item">
            <span className="carnet-together__art" aria-hidden="true">
              <QuestArt kind={q.kind} status="done" />
            </span>
            <span className="carnet-together__date">{DATE.format(parseLocalDateKey(q.day))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
