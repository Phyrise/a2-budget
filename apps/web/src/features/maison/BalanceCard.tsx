/**
 * « Le partage de la semaine » (ex-« Équilibre ») : lecture qualitative de la charge partagée
 * (weeklyBalance), phrase bienveillante, suggestions applicables en un
 * geste (rebalanceSuggestions → applySuggestion, annulable). Jamais de
 * score comparé ni de gagnant (V3_BRIEF §1.2) : les intermédiaires a / b ne
 * servent qu'à incliner la branche ; le détail se limite aux gestes faits,
 * regroupés par tâche, sans décompte. V4.2 : plus compacte — une phrase
 * sous la branche seulement si elle penche ; l'explication tient dans une
 * petite bulle derrière le « ? » de l'en-tête.
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
import { useEffect, useId, useMemo, useRef, useState } from 'react';
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

/**
 * En-tête : le titre et, en haut à droite, un « ? » qui ouvre une petite
 * bulle d'explication, sans chiffre ni barème (un miroir, pas un score).
 * Se referme au « ? », à Échap ou en touchant ailleurs.
 */
function BalanceHead() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="balance__top" ref={ref}>
      <div className="balance__head">
        <h2 id="balance-title" className="balance__heading">
          Le partage de la semaine
        </h2>
        <button
          type="button"
          className={cx('balance__help', open && 'is-open')}
          aria-expanded={open}
          aria-controls={id}
          aria-label={fr('Comment ça marche ?')}
          title={fr('Comment ça marche ?')}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">?</span>
        </button>
      </div>
      <ul id={id} className="balance-how" hidden={!open}>
        <li>
          <EffortArt effort={1} size={22} />
          <span>Chaque tâche cochée pèse du côté de qui l’a faite.</span>
        </li>
        <li>
          <EffortArt effort={3} size={22} />
          <span>Une corvée pèse plus. Faite ensemble, elle se partage en deux.</span>
        </li>
        <li>
          <Icon name="repeat" size={19} />
          <span>Si la branche penche, une idée de relais apparaît.</span>
        </li>
        <li>
          <Icon name="leaf" size={19} />
          <span>Pas de score. Tout repart à zéro chaque lundi.</span>
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

  const apply = (s: RebalanceSuggestion) => {
    const before = tasks.find((t) => t.id === s.taskId);
    if (!before || !applySuggestion(s)) return;
    const title = `«${NBSP}${before.title}${NBSP}»`;
    const message = s.kind === 'rotate' ? `${title} passe en tour à tour.` : `${title} est confiée à ${s.to === 'a' ? names.a : names.b}.`;
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
    <section className="balance card" aria-labelledby="balance-title">
      <BalanceHead />
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
    </section>
  );
}
