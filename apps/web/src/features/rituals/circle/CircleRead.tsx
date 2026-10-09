/**
 * Relire un cercle (mots échangés, gardés en mémoire) et écran de clôture.
 */
import type { Circle } from '@a2/core';
import { Companion, Icon, cx } from '../../../ui';
import { companionProfile, useCompanionIds } from '../../../ui/companions';
import { NB, typo, weekLabel, type Names } from '../ritualText';
import { circleClosingLine } from '../voices';

function heldOn(circle: Circle): string {
  const d = new Date(circle.heldAt);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function CircleWords({ circle, names }: { circle: Circle; names: Names }) {
  const notes = circle.notes ?? [];
  const empty = circle.gratitude.length === 0 && circle.burdens.length === 0 && circle.intentions.length === 0 && notes.length === 0;
  return (
    <div className="circle-words">
      {empty && <p className="circle-words__empty">Un cercle tout en silence — parfois, être là suffit.</p>}
      {circle.gratitude.length > 0 && (
        <section className="circle-words__group">
          <h3 className="eyebrow">Merci</h3>
          <ul>
            {circle.gratitude.map((g, i) => (
              <li key={i} className={cx('circle-quote', `circle-quote--${g.from}`)}>
                <Companion who={g.from} size={30} />
                <blockquote>
                  <p>«{NB}{typo(g.text)}{NB}»</p>
                  <footer>
                    {names[g.from]} à {names[g.to]}
                  </footer>
                </blockquote>
              </li>
            ))}
          </ul>
        </section>
      )}
      {notes.length > 0 && (
        <section className="circle-words__group">
          <h3 className="eyebrow">Petits mots</h3>
          <ul>
            {notes.map((n, i) => (
              <li key={i} className={cx('circle-quote', `circle-quote--${n.from}`)}>
                <Companion who={n.from} size={30} mood="happy" />
                <blockquote>
                  <p>{typo(n.text)}</p>
                  <footer>
                    {names[n.from]} à {names[n.to]}
                  </footer>
                </blockquote>
              </li>
            ))}
          </ul>
        </section>
      )}
      {circle.burdens.length > 0 && (
        <section className="circle-words__group">
          <h3 className="eyebrow">Ce qui pesait</h3>
          <ul>
            {circle.burdens.map((b, i) => (
              <li key={i} className={cx('circle-quote', 'circle-quote--soft', `circle-quote--${b.who}`)}>
                <Companion who={b.who} size={30} mood="sleepy" />
                <blockquote>
                  <p>{typo(b.text)}</p>
                  <footer>{names[b.who]}</footer>
                </blockquote>
              </li>
            ))}
          </ul>
        </section>
      )}
      {circle.intentions.length > 0 && (
        <section className="circle-words__group">
          <h3 className="eyebrow">Notre intention</h3>
          {circle.intentions.map((t, i) => (
            <p key={i} className="circle-intention display">
              <Icon name="sparkle" size={18} /> {typo(t)}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

export function CircleReadback({
  circle,
  names,
  today,
  past,
  onSelect,
}: {
  circle: Circle;
  names: Names;
  today: Date;
  /** Autres cercles (plus récents d'abord). */
  past: Circle[];
  onSelect: (c: Circle) => void;
}) {
  return (
    <div className="circle-read">
      <p className="circle-read__meta">
        <Icon name="check" size={16} /> {weekLabel(circle.weekStart, today)} · tenu le {heldOn(circle)}
      </p>
      <CircleWords circle={circle} names={names} />
      {past.length > 0 && (
        <section className="circle-past">
          <h3 className="eyebrow">Les cercles d’avant</h3>
          <ul>
            {past.slice(0, 12).map((c) => (
              <li key={c.id}>
                <button type="button" className="circle-past__item" onClick={() => onSelect(c)}>
                  <span className="circle-past__when">{weekLabel(c.weekStart, today)}</span>
                  <span className="circle-past__what">
                    {typo(c.intentions[0] ?? c.gratitude[0]?.text ?? "Un moment à deux")}
                  </span>
                  <Icon name="chevron-right" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function CircleClosing({ circle, names, sentTo = null }: { circle: Circle; names: Names; sentTo?: 'a' | 'b' | null }) {
  const lines = circleClosingLine(circle.id);
  const ids = useCompanionIds();
  return (
    <div className="circle-closing">
      <div className="circle-closing__pair">
        <Companion who="a" size={72} mood="proud" reactKey="close-a" touchable />
        <Companion who="b" size={68} mood="happy" reactKey="close-b" touchable />
      </div>
      <h3 className="circle-closing__title display">Merci d’avoir pris ce moment.</h3>
      <p className="circle-closing__sub">
        {sentTo !== null ? `${names[sentTo]} va recevoir ta lettre.` : 'Le cercle de la semaine est gardé dans le carnet de la forêt.'}
      </p>
      <div className="circle-closing__bubbles">
        <p className="ritual-bubble ritual-bubble--a">
          <span className="ritual-bubble__who">{companionProfile(ids.a).name}</span> {lines.a}
        </p>
        <p className="ritual-bubble ritual-bubble--b">
          <span className="ritual-bubble__who">{companionProfile(ids.b).name}</span> {lines.b}
        </p>
      </div>
      <CircleWords circle={circle} names={names} />
    </div>
  );
}
