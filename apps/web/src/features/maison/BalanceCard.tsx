/**
 * « Le partage de la semaine » (ex-« Équilibre ») : lecture qualitative de la charge partagée
 * (weeklyBalance), phrase bienveillante, suggestions applicables en un
 * geste (rebalanceSuggestions → applySuggestion, annulable). Jamais de
 * score comparé ni de gagnant (V3_BRIEF §1.2) : les intermédiaires a / b ne
 * servent qu'à incliner la branche ; le détail se limite aux gestes faits,
 * regroupés par tâche, sans décompte. V4.2 : plus compacte — une phrase
 * sous la branche seulement si elle penche. V4.2.1 : le « ? » retourne la
 * carte, l'explication est écrite au dos, posé exactement sur l'endroit :
 * la carte garde sa taille.
 */
import {
  completionsOfWeek,
  rebalanceSuggestions,
  weeklyBalance,
  whoDid,
  type BalanceVerdict,
  type HouseholdTask,
  type RebalanceSuggestion,
  type TaskAssignee,
} from '@a2/core';
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';
import { useApp } from '../../state/store';
import { Button, Companion, Disclosure, Icon, NBSP, cx, fr, useToast } from '../../ui';
import { BalanceStones } from './BalanceStones';
import { EffortArt } from './EffortArt';
import type { Names } from './TaskRow';
import { assigneeName } from './taskText';

/** Une phrase sous la branche, seulement quand elle penche. */
function verdictText(verdict: BalanceVerdict, names: Names): string | null {
  if (verdict === 'a-carried') return fr(`${names.a} a beaucoup porté : et si ${names.b} prenait le relais ?`);
  if (verdict === 'b-carried') return fr(`${names.b} a beaucoup porté : et si ${names.a} prenait le relais ?`);
  return null;
}

/** L'endroit : le titre et, en haut à droite, le « ? » qui retourne la carte. */
function BalanceHead({ backId, flipped, onFlip, helpRef }: { backId: string; flipped: boolean; onFlip: () => void; helpRef: RefObject<HTMLButtonElement | null> }) {
  return (
    <div className="balance__head">
      <h2 id="balance-title" className="balance__heading">
        Le partage de la semaine
      </h2>
      <button
        ref={helpRef}
        type="button"
        className="balance__help"
        aria-expanded={flipped}
        aria-controls={backId}
        aria-label={fr('Comment ça marche ?')}
        title={fr('Comment ça marche ?')}
        onClick={onFlip}
      >
        <span aria-hidden="true">?</span>
      </button>
    </div>
  );
}

/**
 * Le dos de la carte : comment ça marche, sans chiffre ni barème (un miroir,
 * pas un score). Un toucher n'importe où — le bouton du coin compris, par
 * propagation — ou Échap la remettent à l'endroit.
 */
function BalanceBack({ id, open, onClose, closeRef }: { id: string; open: boolean; onClose: () => void; closeRef: RefObject<HTMLButtonElement | null> }) {
  return (
    <div
      id={id}
      className="balance__face balance__back card"
      inert={!open}
      aria-hidden={!open || undefined}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="balance__head">
        <h3 className="balance__heading">{fr('Comment ça marche ?')}</h3>
        <button ref={closeRef} type="button" className="balance__help" aria-label="Retourner la carte" title="Retourner la carte">
          <span aria-hidden="true">
            <Icon name="close" size={12} />
          </span>
        </button>
      </div>
      <ul className="balance-how">
        <li>
          <EffortArt effort={1} size={22} />
          <span>Chaque tâche pèse du côté de qui l’a faite.</span>
        </li>
        <li>
          <EffortArt effort={3} size={22} />
          <span>Les corvées pèsent plus. Faites ensemble, elles se partagent en deux.</span>
        </li>
        <li>
          <Icon name="leaf" size={19} />
          <span>Pas de score. Tout repart à zéro le lundi.</span>
        </li>
      </ul>
    </div>
  );
}

interface DetailItem {
  title: string;
  /** Qui y a mis la main cette semaine (ordre fixe a, b, ensemble, libre). */
  who: TaskAssignee[];
}

/**
 * Gestes de la semaine regroupés **par tâche** (ordre alphabétique) : qui y a
 * mis la main, sans nombre de fois ni colonne par personne — rien qui
 * ressemble à un tableau de score.
 */
function weekDetail(tasks: HouseholdTask[], completions: ReturnType<typeof completionsOfWeek>): DetailItem[] {
  const order: TaskAssignee[] = ['a', 'b', 'both', 'unassigned'];
  const byTitle = new Map<string, Set<TaskAssignee>>();
  for (const c of completions) {
    const title = tasks.find((t) => t.id === c.taskId)?.title ?? c.taskTitle;
    const set = byTitle.get(title) ?? new Set<TaskAssignee>();
    set.add(whoDid(c));
    byTitle.set(title, set);
  }
  return [...byTitle.entries()]
    .map(([title, set]) => ({ title, who: order.filter((w) => set.has(w)) }))
    .sort((x, y) => x.title.localeCompare(y.title, 'fr'));
}

export function BalanceCard({ names }: { names: Names }) {
  const { appState, today, applySuggestion, updateHomeTask } = useApp();
  const toast = useToast();
  const tasks = appState?.chores.tasks ?? [];
  const completions = appState?.chores.completions ?? [];

  const balance = useMemo(() => weeklyBalance(tasks, completions, today), [tasks, completions, today]);
  const suggestions = useMemo(() => rebalanceSuggestions(tasks, completions, today, 2, names), [tasks, completions, today, names]);
  const week = useMemo(() => completionsOfWeek(completions, today), [completions, today]);
  const detail = useMemo(() => weekDetail(tasks, week), [tasks, week]);
  const text = verdictText(balance.verdict, names);

  const [flipped, setFlipped] = useState(false);
  const backId = useId();
  const helpRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Le focus suit la face visible (la face cachée est inerte), seulement
  // après un geste : jamais au montage.
  const refocus = useRef(false);
  const flip = (next: boolean) => {
    refocus.current = true;
    setFlipped(next);
  };
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    (flipped ? closeRef : helpRef).current?.focus({ preventScroll: true });
  }, [flipped]);

  const apply = (s: RebalanceSuggestion) => {
    const before = tasks.find((t) => t.id === s.taskId);
    if (!before || !applySuggestion(s)) return;
    const title = `«${NBSP}${before.title}${NBSP}»`;
    const message = s.kind === 'rotate' ? `${title} passe en tour à tour.` : `${s.to === 'a' ? names.a : names.b} prend ${title} pour un temps.`;
    toast.show({
      message: fr(message),
      icon: s.kind === 'rotate' ? 'repeat' : 'leaf',
      action: {
        label: 'Annuler',
        onClick: () => updateHomeTask(before.id, s.kind === 'rotate' ? { rotation: false } : { assignee: before.assignee }),
      },
    });
  };

  return (
    <section className={cx('balance', flipped && 'is-flipped')} aria-labelledby="balance-title">
      <div className="balance__face balance__front card" inert={flipped} aria-hidden={flipped || undefined}>
        <BalanceHead backId={backId} flipped={flipped} onFlip={() => flip(true)} helpRef={helpRef} />
        <div className="balance__visual">
          <BalanceStones a={balance.a} b={balance.b} verdict={balance.verdict} />
          <div className="balance__legend" aria-hidden="true">
            <span className="balance__who balance__who--a">
              <Companion who="a" size={20} />
              {names.a}
            </span>
            <span className="balance__who balance__who--b">
              {names.b}
              <Companion who="b" size={20} />
            </span>
          </div>
        </div>
        {text && (
          <p className="balance__title" data-verdict={balance.verdict}>
            {text}
          </p>
        )}

        {suggestions.length > 0 && (
          <ul className="suggestions" aria-label="Suggestions pour alléger">
            {suggestions.map((s) => (
              <li key={`${s.taskId}-${s.kind}`} className="suggestion">
                <span className="suggestion__icon" aria-hidden="true">
                  {s.kind === 'rotate' ? <Icon name="repeat" size={18} /> : <Companion who={s.to ?? 'both'} size={24} />}
                </span>
                <p className="suggestion__text">{s.reason}</p>
                <Button size="sm" variant="ghost" className="suggestion__apply" onClick={() => apply(s)} aria-label={`Appliquer : ${s.reason}`}>
                  Appliquer
                </Button>
              </li>
            ))}
          </ul>
        )}

        {detail.length > 0 && (
          <Disclosure summary="Les gestes de la semaine" className="balance__detail">
            <ul className="week-detail">
              {detail.map((item) => (
                <li key={item.title} className="week-detail__task">
                  <span className="week-detail__title">{item.title}</span>
                  <span className="week-detail__people">
                    {item.who.map((w, i) => (
                      <span key={w} className="week-detail__who">
                        {i > 0 && (
                          <span className="week-detail__sep" aria-hidden="true">
                            ·
                          </span>
                        )}
                        {i > 0 && <span className="visually-hidden">, </span>}
                        <Companion who={w} size={w === 'both' ? 16 : 18} />
                        {assigneeName(w, names)}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
      </div>
      <BalanceBack id={backId} open={flipped} onClose={() => flip(false)} closeRef={closeRef} />
    </section>
  );
}
