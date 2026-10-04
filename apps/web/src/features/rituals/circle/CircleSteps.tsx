/**
 * Les trois étapes du cercle : Merci → Ce qui pèse → Ajuster.
 * Rien n'est obligatoire, rien n'est noté : des mots échangés.
 */
import type { BalanceVerdict, RebalanceSuggestion } from '@a2/core';
import { useId } from 'react';
import { Button, Companion, Icon, cx } from '../../../ui';
import { NB, other, type Names, type Person } from '../ritualText';

export interface CircleDraft {
  /** thanks.a = le merci de A pour B. */
  thanks: Record<Person, string>;
  burdens: Record<Person, string>;
  intention: string;
}

function Chips({ items, value, onPick, label }: { items: string[]; value: string; onPick: (s: string) => void; label: string }) {
  if (items.length === 0) return null;
  return (
    <div className="ritual-chips" role="group" aria-label={label}>
      {items.map((s) => (
        <button
          key={s}
          type="button"
          className={cx('chip', 'ritual-chip', value.trim() === s && 'is-selected')}
          aria-pressed={value.trim() === s}
          onClick={() => onPick(value.trim() === s ? '' : s)}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function Words({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="field__input ritual-textarea"
        rows={2}
        maxLength={280}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const THANKS_FALLBACK = [
  `Merci pour ta patience cette semaine`,
  `Merci d’avoir été là`,
  `Merci pour les petits gestes que je n’ai pas toujours vus`,
];

export function StepThanks({
  names,
  draft,
  suggestions,
  onChange,
}: {
  names: Names;
  draft: CircleDraft;
  suggestions: Record<Person, string[]>;
  onChange: (p: Person, text: string) => void;
}) {
  const id = useId();
  return (
    <div className="circle-step">
      <p className="circle-step__lead">
        On commence par ce qui a fait du bien. Choisissez une phrase, ou dites-le avec vos mots.
      </p>
      {(['a', 'b'] as const).map((from) => {
        const to = other(from);
        const items = suggestions[from].length > 0 ? suggestions[from] : THANKS_FALLBACK;
        return (
          <section key={from} className={cx('circle-voice', `circle-voice--${from}`)} aria-labelledby={`${id}-${from}`}>
            <header className="circle-voice__head">
              <Companion who={from} size={40} mood="happy" />
              <h3 id={`${id}-${from}`} className="circle-voice__title">
                {names[from]} remercie {names[to]}
              </h3>
            </header>
            <Chips items={items} value={draft.thanks[from]} onPick={(s) => onChange(from, s)} label={`Suggestions de merci pour ${names[to]}`} />
            <Words
              id={`${id}-t-${from}`}
              label="Avec vos mots"
              value={draft.thanks[from]}
              onChange={(v) => onChange(from, v)}
              placeholder={`Merci ${names[to]}, pour…`}
            />
          </section>
        );
      })}
    </div>
  );
}

const STARTERS = [`J’ai eu du mal avec `, `J’aurais aimé un coup de main pour `, `Rien de lourd cette semaine.`];

export function StepBurdens({ names, draft, onChange }: { names: Names; draft: CircleDraft; onChange: (p: Person, text: string) => void }) {
  const id = useId();
  return (
    <div className="circle-step">
      <p className="circle-step__quote display">Le dire, c’est déjà alléger.</p>
      <p className="circle-step__lead">
        Une phrase chacun, si l’envie est là. Pas de réponse à donner, pas de solution à trouver{NB}: on écoute, c’est tout.
      </p>
      {(['a', 'b'] as const).map((who) => (
        <section key={who} className={cx('circle-voice', `circle-voice--${who}`)} aria-labelledby={`${id}-${who}`}>
          <header className="circle-voice__head">
            <Companion who={who} size={40} mood="curious" />
            <h3 id={`${id}-${who}`} className="circle-voice__title">
              {names[who]}
            </h3>
            <span className="circle-voice__optional">facultatif</span>
          </header>
          <div className="ritual-chips" role="group" aria-label={`Débuts de phrase pour ${names[who]}`}>
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                className="chip ritual-chip ritual-chip--quiet"
                onClick={() => onChange(who, draft.burdens[who].trim() === '' ? s : `${draft.burdens[who].trimEnd()} ${s}`)}
              >
                {s.trim().replace(/ $/, '')}
                {s.endsWith(' ') ? '…' : ''}
              </button>
            ))}
          </div>
          <Words
            id={`${id}-b-${who}`}
            label={`Ce qui a pesé pour ${names[who]} cette semaine`}
            value={draft.burdens[who]}
            onChange={(v) => onChange(who, v)}
            placeholder="Par exemple : penser à tout pour le week-end"
          />
        </section>
      ))}
    </div>
  );
}

function balancePhrase(verdict: BalanceVerdict, names: Names): string {
  switch (verdict) {
    case 'quiet':
      return `Une semaine tranquille${NB}: rien à rééquilibrer.`;
    case 'balanced':
      return `La semaine a été bien partagée. Belle équipe.`;
    case 'a-carried':
      return `${names.a} a beaucoup porté cette semaine — et si ${names.b} prenait le relais sur une chose ou deux${NB}?`;
    case 'b-carried':
      return `${names.b} a beaucoup porté cette semaine — et si ${names.a} prenait le relais sur une chose ou deux${NB}?`;
  }
}

/** Deux pierres sur une branche : un visuel qualitatif, jamais un score. */
function Stones({ verdict }: { verdict: BalanceVerdict }) {
  const tilt = verdict === 'a-carried' ? -5 : verdict === 'b-carried' ? 5 : 0;
  return (
    <svg className="circle-stones" viewBox="0 0 160 70" aria-hidden="true">
      <path d="M8 52 C 40 46, 120 46, 152 52" stroke="#6e4530" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M118 49 q 10 -10 22 -8" stroke="#4b6b45" strokeWidth="2" fill="none" strokeLinecap="round" />
      <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '80px 50px', transition: 'transform 600ms ease' }}>
        <ellipse cx="50" cy="38" rx="17" ry="12" fill="#c6d3e6" opacity="0.9" />
        <ellipse cx="112" cy="38" rx="17" ry="12" fill="#eba15a" opacity="0.9" />
      </g>
    </svg>
  );
}

const INTENTIONS = ['Un dîner sans écrans', 'Une balade ensemble', 'Se coucher un peu plus tôt', 'Cuisiner ensemble dimanche'];

export function StepAdjust({
  names,
  verdict,
  suggestions,
  applied,
  onApply,
  intention,
  onIntention,
}: {
  names: Names;
  verdict: BalanceVerdict;
  suggestions: RebalanceSuggestion[];
  applied: string[];
  onApply: (s: RebalanceSuggestion) => void;
  intention: string;
  onIntention: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="circle-step">
      <div className="circle-balance card">
        <Stones verdict={verdict} />
        <p className="circle-balance__text">{balancePhrase(verdict, names)}</p>
      </div>

      {suggestions.length > 0 && (
        <ul className="circle-suggestions" aria-label="Petits ajustements possibles">
          {suggestions.map((s) => {
            const done = applied.includes(s.taskId);
            return (
              <li key={s.taskId} className={cx('circle-suggestion', done && 'is-applied')}>
                <Icon name={s.kind === 'rotate' ? 'repeat' : 'users'} size={20} />
                <p className="circle-suggestion__text">{s.reason}</p>
                {done ? (
                  <span className="circle-suggestion__done">
                    <Icon name="check" size={16} /> C’est fait
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => onApply(s)}>
                    {s.kind === 'rotate' ? 'Tour à tour' : `Confier à ${names[s.to ?? 'a']}`}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="circle-voice circle-voice--both" aria-labelledby={`${id}-int`}>
        <header className="circle-voice__head">
          <Companion who="both" size={36} mood="idle" />
          <h3 id={`${id}-int`} className="circle-voice__title">
            Une intention pour la semaine qui vient
          </h3>
          <span className="circle-voice__optional">facultatif</span>
        </header>
        <Chips items={INTENTIONS} value={intention} onPick={onIntention} label="Idées d’intention" />
        <Words id={`${id}-i`} label="Notre intention" value={intention} onChange={onIntention} placeholder="Ce qu’on aimerait s’offrir, ensemble" />
      </section>
    </div>
  );
}
