/**
 * Les moments de Kiki dans l'écran Courses : liste vide (Kiki et sa liste,
 * Jiji endormi), tout est dans le panier, salut de la première ouverture du
 * jour, et l'envol avec le sac de provisions quand on vide le panier.
 * Images décoratives (alt vide / aria-hidden) : le texte porte le sens.
 */
import { createPortal } from 'react-dom';
import { coursesTheme } from '../../themes/manifest';
import { IconButton, plural, timeOfDay } from '../../ui';

/** Liste vide : Kiki relit sa liste, Jiji fait la sieste. */
export function CoursesEmpty() {
  return (
    <div className="kiki-empty">
      <div className="kiki-empty__art" aria-hidden="true">
        <span className="kiki-empty__glow" />
        <img className="kiki-empty__kiki" src={coursesTheme.kiki.list} alt="" draggable={false} />
        <img className="kiki-empty__jiji" src={coursesTheme.jiji.sleeping} alt="" draggable={false} />
      </div>
      <p className="eyebrow kiki-empty__eyebrow">La liste est vide</p>
      <h2 className="kiki-empty__title display">Qu’est-ce qu’il nous faut&nbsp;?</h2>
      <p className="kiki-empty__text">
        Tapez un article ci-dessus, avec sa quantité si besoin&nbsp;: <span className="nowrap">«&nbsp;2 pommes&nbsp;»</span>,{' '}
        <span className="nowrap">«&nbsp;lait x2&nbsp;»</span>, <span className="nowrap">«&nbsp;500 g de farine&nbsp;»</span>.
      </p>
    </div>
  );
}

/** Plus rien à prendre : Kiki tient le panier. */
export function AllInBasket() {
  return (
    <div className="kiki-done">
      <img className="kiki-done__kiki" src={coursesTheme.kiki.basket} alt="" aria-hidden="true" draggable={false} />
      <div>
        <h2 className="kiki-done__title display">Tout est dans le panier</h2>
        <p className="kiki-done__text">Il ne reste plus qu’à passer en caisse.</p>
      </div>
    </div>
  );
}

/** Salut de Kiki à la première ouverture du jour. */
export function KikiGreeting({ toBuy, now, onClose }: { toBuy: number; now: Date; onClose: () => void }) {
  const moment = timeOfDay(now);
  const hello = moment === 'soir' || moment === 'nuit' ? 'Bonsoir' : 'Bonjour';
  const line =
    toBuy > 0
      ? `${plural(toBuy, 'article')} sur la liste. Je file quand vous voulez !`
      : 'Tout est déjà dans le panier. Bravo, l’équipe !';
  return (
    <aside className="kiki-hello" aria-label="Bonjour de Kiki">
      <img className="kiki-hello__kiki" src={coursesTheme.kiki.wave} alt="" aria-hidden="true" draggable={false} />
      <div className="kiki-hello__text">
        <p className="kiki-hello__title display">{hello}&nbsp;!</p>
        <p className="kiki-hello__line">{line}</p>
      </div>
      <IconButton icon="close" label="Fermer le bonjour de Kiki" variant="ghost" className="kiki-hello__close" onClick={onClose} />
    </aside>
  );
}

/**
 * Envol de Kiki (« Vider le panier ») : elle traverse le haut de l'écran,
 * sous l'en-tête, avec son sac de provisions. Calque fixe hors de la feuille.
 */
export function KikiFlight({ reduced }: { reduced: boolean }) {
  return createPortal(
    <div className={reduced ? 'kiki-flight kiki-flight--still' : 'kiki-flight'} aria-hidden="true">
      <span className="kiki-flight__path">
        <img className="kiki-flight__trail" src={coursesTheme.sparkles} alt="" draggable={false} />
        <img className="kiki-flight__kiki" src={coursesTheme.kiki.flying} alt="" draggable={false} />
      </span>
    </div>,
    document.body,
  );
}
