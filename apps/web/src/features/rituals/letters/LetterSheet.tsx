/**
 * La lettre de l'autre, ouverte : l'enveloppe se décachette, la feuille
 * monte, puis ses mots — son merci, son petit mot, ce qui lui pèse, son
 * intention. Si je n'ai pas encore écrit ma part de la semaine : « Écrire
 * ma part » (le cercle s'ouvre, voir letters.requestWrite).
 */
import type { Circle } from '@a2/core';
import { useRef } from 'react';
import { Button, Icon, Sheet } from '../../../ui';
import { NB, typo, weekLabel, type Names } from '../ritualText';
import { Envelope } from './Envelope';

export function LetterSheet({
  letter,
  names,
  today,
  canWrite,
  onClose,
  onWrite,
}: {
  letter: Circle | null;
  names: Names;
  today: Date;
  /** Ma part de cette semaine n'est pas encore écrite. */
  canWrite: boolean;
  onClose: () => void;
  onWrite: () => void;
}) {
  // Gardée pendant la fermeture de la feuille (le contenu ne disparaît pas d'un coup).
  const last = useRef<Circle | null>(null);
  const open = letter !== null;
  if (letter !== null) last.current = letter;
  letter = last.current;
  const from = letter?.author ?? 'a';
  const thanks = letter?.gratitude[0]?.text;
  const note = letter?.notes?.[0]?.text;
  const burden = letter?.burdens[0]?.text;
  const intention = letter?.intentions[0];
  const empty = !thanks && !note && !burden && !intention;

  const footer = canWrite ? (
    <>
      <Button variant="quiet" onClick={onClose}>
        Fermer
      </Button>
      <Button variant="primary" icon="feather" onClick={onWrite}>
        Écrire ma part
      </Button>
    </>
  ) : (
    <Button variant="primary" onClick={onClose}>
      Fermer
    </Button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Une lettre de ${names[from]}`}
      description={letter ? weekLabel(letter.weekStart, today) : undefined}
      footer={footer}
      className="letter-sheet"
    >
      {letter && (
        <div className={`letter letter--${from}`} key={`${letter.id}-${letter.heldAt}`}>
          <Envelope from={from} size={96} opened className="letter__envelope" />
          <article className="letter__paper">
            {empty && <p className="letter__empty">{`Une page blanche${NB}: juste un «${NB}je pense à toi${NB}».`}</p>}
            {thanks && <p className="letter__thanks display">«{NB}{typo(thanks)}{NB}»</p>}
            {note && <p className="letter__note display">{typo(note)}</p>}
            {burden && (
              <section className="letter__part">
                <h3 className="eyebrow">Ce qui pèse</h3>
                <p>{typo(burden)}</p>
              </section>
            )}
            {intention && (
              <p className="letter__intention">
                <Icon name="sparkle" size={16} /> {typo(intention)}
              </p>
            )}
            <p className="letter__sign">— {names[from]}</p>
          </article>
        </div>
      )}
    </Sheet>
  );
}
