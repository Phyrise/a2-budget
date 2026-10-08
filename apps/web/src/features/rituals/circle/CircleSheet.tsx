/**
 * Cercle de la semaine : rituel guidé en trois étapes (merci → ce qui pèse
 * → ajuster), clôturé par un moment dans la forêt. S'il a déjà été tenu
 * cette semaine, la feuille s'ouvre sur sa relecture (« Le refaire » reste
 * possible : le cercle de la semaine est remplacé, son id conservé).
 *
 * V5.2 — connecté, chacun écrit SA part (sa lettre) de son téléphone : les
 * étapes ne montrent que sa voix, l'autre la reçoit (letters/). Invité : le
 * cercle se tient à deux sur le même téléphone, comme avant.
 */
import {
  circleForWeek,
  circlePart,
  weeklyCircles,
  gratitudeSuggestions,
  rebalanceSuggestions,
  weeklyBalance,
  type BalanceVerdict,
  type Circle,
  type RebalanceSuggestion,
} from '@a2/core';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { playCue } from '../../../app/sound';
import { useApp } from '../../../state/store';
import { Button, Sheet, cx } from '../../../ui';
import { ritualWeek, typo, type Names, type Person } from '../ritualText';
import { CircleClosing, CircleReadback } from './CircleRead';
import { BOTH, StepAdjust, StepBurdens, StepThanks, type CircleDraft } from './CircleSteps';

type View = { kind: 'hold'; step: 0 | 1 | 2 } | { kind: 'closing'; circle: Circle } | { kind: 'read'; circle: Circle };

interface Prepared {
  weekStart: string;
  gratitude: Record<Person, string[]>;
  verdict: BalanceVerdict;
  suggestions: RebalanceSuggestion[];
}

const STEPS = ['Merci', 'Ce qui pèse', 'Ajuster'] as const;
const EMPTY: CircleDraft = { thanks: { a: '', b: '' }, burdens: { a: '', b: '' }, intention: '', notes: { a: '', b: '' } };

function draftFrom(c: Circle, me: Person | null): CircleDraft {
  const thanks = (p: Person) => c.gratitude.find((g) => g.from === p)?.text ?? '';
  const burden = (p: Person) => c.burdens.find((b) => b.who === p)?.text ?? '';
  const note = (p: Person) => c.notes?.find((n) => n.from === p)?.text ?? '';
  return {
    thanks: { a: thanks('a'), b: thanks('b') },
    burdens: { a: burden('a'), b: burden('b') },
    intention: (me !== null && c.author !== me ? undefined : c.intentions[0]) ?? '',
    notes: { a: note('a'), b: note('b') },
  };
}

export function CircleSheet({
  open,
  onClose,
  onHeld,
  names,
}: {
  open: boolean;
  onClose: () => void;
  /** Le cercle vient d'être clos : moment dans la forêt après la fermeture. */
  onHeld: () => void;
  names: Names;
}) {
  const { appState, today, saveCircle, applySuggestion, me } = useApp();
  // Connecté : sa part seulement ; invité : les deux voix.
  const voices: readonly Person[] = me === null ? BOTH : [me];
  const [view, setView] = useState<View>({ kind: 'hold', step: 0 });
  const [draft, setDraft] = useState<CircleDraft>(EMPTY);
  const [applied, setApplied] = useState<string[]>([]);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const heldRef = useRef(false);

  const rituals = appState?.rituals;
  const thisWeek = prepared ? circleForWeek(rituals, prepared.weekStart) : null;
  const past = weeklyCircles(rituals).filter((c) => c.weekStart !== prepared?.weekStart).reverse();

  const prepare = () => {
    const { ref, weekStart } = ritualWeek(today);
    const tasks = appState?.chores.tasks ?? [];
    const completions = appState?.chores.completions ?? [];
    const thanks = (p: Person) => gratitudeSuggestions(tasks, completions, ref, p, 4).map(typo);
    setPrepared({
      weekStart,
      gratitude: { a: thanks('a'), b: thanks('b') },
      verdict: weeklyBalance(tasks, completions, ref).verdict,
      suggestions: rebalanceSuggestions(tasks, completions, ref, 3, names).map((s) => ({ ...s, reason: typo(s.reason) })),
    });
    setApplied([]);
    return weekStart;
  };

  // À chaque ouverture : relecture si le cercle est déjà tenu, sinon étape 1.
  // « Plus tard » garde les mots déjà écrits pour la même semaine.
  const draftWeek = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    heldRef.current = false;
    const weekStart = prepare();
    // Connecté : relecture seulement si SA part est écrite (sinon, l'écrire).
    const mine = me === null || circlePart(appState?.rituals, weekStart, me) !== null;
    const existing = mine ? circleForWeek(appState?.rituals, weekStart) : null;
    if (draftWeek.current !== weekStart) {
      draftWeek.current = weekStart;
      setDraft(EMPTY);
    }
    setView(existing ? { kind: 'read', circle: existing } : { kind: 'hold', step: 0 });
    // Préparé une fois par ouverture : les suggestions ne bougent pas pendant le rituel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Changement d'étape : retour en haut, focus sur le contenu.
  const viewKey = view.kind === 'hold' ? `hold-${view.step}` : `${view.kind}-${view.circle.id}`;
  useLayoutEffect(() => {
    const body = bodyRef.current?.closest('.sheet__body');
    body?.scrollTo({ top: 0 });
  }, [viewKey]);

  const go = (step: 0 | 1 | 2) => setView({ kind: 'hold', step });

  const close = () => {
    onClose();
    if (heldRef.current) {
      heldRef.current = false;
      onHeld();
    }
  };

  const finish = () => {
    if (!prepared) return;
    const to = (from: Person): Person => (from === 'a' ? 'b' : 'a');
    const saved = saveCircle({
      weekStart: prepared.weekStart,
      gratitude: voices.map((from) => ({ from, to: to(from), text: draft.thanks[from] })),
      burdens: voices.map((who) => ({ who, text: draft.burdens[who] })),
      intentions: draft.intention.trim() ? [draft.intention] : [],
      notes: voices.map((from) => ({ from, to: to(from), text: draft.notes[from] })),
      ...(me !== null ? { author: me } : {}),
    });
    if (saved) {
      if (me !== null) playCue('circle'); // sa lettre part (celle de l'autre arrive en silence)
      heldRef.current = true;
      draftWeek.current = null;
      setView({ kind: 'closing', circle: saved });
    }
  };

  const apply = (s: RebalanceSuggestion) => {
    if (applySuggestion(s)) setApplied((list) => [...list, s.taskId]);
  };

  const setThanks = (p: Person, text: string) => setDraft((d) => ({ ...d, thanks: { ...d.thanks, [p]: text } }));
  const setBurden = (p: Person, text: string) => setDraft((d) => ({ ...d, burdens: { ...d.burdens, [p]: text } }));

  let footer: ReactNode;
  if (view.kind === 'hold') {
    footer = (
      <>
        {view.step === 0 ? (
          <Button variant="quiet" onClick={close}>
            Plus tard
          </Button>
        ) : (
          <Button variant="quiet" icon="chevron-left" onClick={() => go((view.step - 1) as 0 | 1)}>
            Retour
          </Button>
        )}
        {view.step < 2 ? (
          <Button variant="primary" iconEnd="chevron-right" onClick={() => go((view.step + 1) as 1 | 2)}>
            Continuer
          </Button>
        ) : (
          <Button variant="primary" icon="sparkle" onClick={finish}>
            Clore le cercle
          </Button>
        )}
      </>
    );
  } else if (view.kind === 'closing') {
    footer = (
      <Button variant="primary" icon="leaf" onClick={close}>
        Retourner dans la forêt
      </Button>
    );
  } else {
    const isThisWeek = thisWeek !== null && view.circle.id === thisWeek.id;
    footer = (
      <>
        {isThisWeek ? (
          <Button
            variant="ghost"
            icon="refresh"
            onClick={() => {
              setDraft(draftFrom(me !== null ? (circlePart(rituals, view.circle.weekStart, me) ?? view.circle) : view.circle, me));
              go(0);
            }}
          >
            Le refaire
          </Button>
        ) : (
          <Button variant="ghost" icon="chevron-left" onClick={() => (thisWeek ? setView({ kind: 'read', circle: thisWeek }) : go(0))}>
            {thisWeek ? 'Cette semaine' : 'Tenir le cercle'}
          </Button>
        )}
        <Button variant="primary" onClick={close}>
          Fermer
        </Button>
      </>
    );
  }

  const description =
    view.kind === 'hold'
      ? `Étape ${view.step + 1} sur 3 · ${STEPS[view.step]}`
      : view.kind === 'closing'
        ? 'Le cercle est clos'
        : 'Relire les mots échangés';

  return (
    <Sheet open={open} onClose={close} title="Cercle de la semaine" description={description} size="full" footer={footer} className="circle-sheet">
      <div ref={bodyRef} className="circle-body" key={viewKey}>
        {view.kind === 'hold' && (
          <ol className="circle-progress" aria-label="Étapes du cercle">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className={cx('circle-progress__step', i < view.step && 'is-past', i === view.step && 'is-current')}
                aria-current={i === view.step ? 'step' : undefined}
              >
                <span className="circle-progress__dot" aria-hidden="true" />
                <span className="circle-progress__label">{label}</span>
              </li>
            ))}
          </ol>
        )}
        {view.kind === 'hold' && view.step === 0 && prepared && (
          <StepThanks names={names} voices={voices} draft={draft} suggestions={prepared.gratitude} onChange={setThanks} />
        )}
        {view.kind === 'hold' && view.step === 1 && <StepBurdens names={names} voices={voices} draft={draft} onChange={setBurden} />}
        {view.kind === 'hold' && view.step === 2 && prepared && (
          <StepAdjust
            names={names}
            verdict={prepared.verdict}
            suggestions={prepared.suggestions}
            applied={applied}
            onApply={apply}
            intention={draft.intention}
            onIntention={(v) => setDraft((d) => ({ ...d, intention: v }))}
            voices={voices}
            notes={draft.notes}
            onNote={(p, v) => setDraft((d) => ({ ...d, notes: { ...d.notes, [p]: v } }))}
          />
        )}
        {view.kind === 'closing' && <CircleClosing circle={view.circle} names={names} sentTo={me === null ? null : me === 'a' ? 'b' : 'a'} />}
        {view.kind === 'read' && (
          <CircleReadback
            circle={view.circle}
            names={names}
            today={today}
            past={past.filter((c) => c.id !== view.circle.id)}
            onSelect={(c) => setView({ kind: 'read', circle: c })}
          />
        )}
        {view.kind === 'hold' && view.step === 0 && past.length > 0 && !thisWeek && (
          <button type="button" className="circle-reread" onClick={() => setView({ kind: 'read', circle: past[0]! })}>
            Relire les cercles d’avant
          </button>
        )}
      </div>
    </Sheet>
  );
}
