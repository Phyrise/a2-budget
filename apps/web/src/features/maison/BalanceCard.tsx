/**
 * « Équilibre de la semaine » : lecture qualitative de la charge partagée
 * (weeklyBalance), phrase bienveillante, suggestions applicables en un
 * geste (rebalanceSuggestions → applySuggestion, annulable). Jamais de
 * score comparé ni de gagnant (V3_BRIEF §1.2) : les intermédiaires a / b ne
 * servent qu'à incliner la branche ; le détail se limite aux gestes faits.
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
import { useMemo } from 'react';
import { useApp } from '../../state/store';
import { Button, Companion, Disclosure, Icon, NBSP, fr, useToast } from '../../ui';
import { BalanceStones } from './BalanceStones';
import type { Names } from './TaskRow';
import { assigneeName } from './taskText';

function verdictText(verdict: BalanceVerdict, total: number, names: Names): { title: string; body: string | null } {
  switch (verdict) {
    case 'quiet':
      return total === 0
        ? { title: 'La semaine commence tout juste.', body: 'Chaque geste viendra se poser ici, sans rien compter.' }
        : { title: 'La semaine se met en route, doucement.', body: 'Rien ne pèse encore d’un côté ou de l’autre.' }
    case 'balanced':
      return { title: 'Vous avez porté la maison à deux.', body: 'La branche est à l’équilibre. Merci à vous deux.' };
    case 'a-carried':
      return { title: fr(`${names.a} a beaucoup porté cette semaine. Un petit relais ?`), body: null };
    case 'b-carried':
      return { title: fr(`${names.b} a beaucoup porté cette semaine. Un petit relais ?`), body: null };
  }
}

interface DetailGroup {
  who: TaskAssignee;
  items: Array<{ title: string; count: number }>;
}

function weekDetail(tasks: HouseholdTask[], completions: ReturnType<typeof completionsOfWeek>): DetailGroup[] {
  const order: TaskAssignee[] = ['a', 'b', 'both', 'unassigned'];
  const groups = new Map<TaskAssignee, Map<string, number>>();
  for (const c of completions) {
    const who = whoDid(c);
    const title = tasks.find((t) => t.id === c.taskId)?.title ?? c.taskTitle;
    const g = groups.get(who) ?? new Map<string, number>();
    g.set(title, (g.get(title) ?? 0) + 1);
    groups.set(who, g);
  }
  return order
    .filter((who) => groups.has(who))
    .map((who) => ({
      who,
      items: [...groups.get(who)!.entries()]
        .map(([title, count]) => ({ title, count }))
        .sort((x, y) => y.count - x.count || x.title.localeCompare(y.title, 'fr')),
    }));
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
  const text = verdictText(balance.verdict, balance.total, names);

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
      <h2 id="balance-title" className="balance__eyebrow">
        Équilibre de la semaine
      </h2>
      <div className="balance__visual">
        <BalanceStones a={balance.a} b={balance.b} verdict={balance.verdict} />
        <div className="balance__legend" aria-hidden="true">
          <span className="balance__who balance__who--a">
            <Companion who="a" size={22} />
            {names.a}
          </span>
          <span className="balance__who balance__who--b">
            {names.b}
            <Companion who="b" size={22} />
          </span>
        </div>
      </div>
      <p className="balance__title" data-verdict={balance.verdict}>
        {text.title}
      </p>
      {text.body && <p className="balance__body">{text.body}</p>}

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
          <dl className="week-detail">
            {detail.map((group) => (
              <div key={group.who} className="week-detail__group">
                <dt className="week-detail__who">
                  <Companion who={group.who} size={group.who === 'both' ? 18 : 22} />
                  {assigneeName(group.who, names)}
                </dt>
                <dd className="week-detail__items">
                  {group.items.map((item) => (
                    <span key={item.title} className="week-detail__item">
                      {item.title}
                      {item.count > 1 && <span className="week-detail__count">{`${NBSP}×${item.count}`}</span>}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Disclosure>
      )}
    </section>
  );
}
