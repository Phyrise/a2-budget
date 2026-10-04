/**
 * Mode développeur — les chiffres : progression de la forêt, objectif de la
 * semaine, partage de la semaine, constantes et déblocages. Seul endroit de
 * l'app où ces nombres apparaissent.
 */
import type { ReactNode } from 'react';
import { cx } from '../../ui';
import { CREATURE_ENTRIES, STAGE_NAMES } from '../rituals/carnet/carnetData';
import { CONSTANTS, VITALITY_LABELS, num, pct, type DevData } from './devData';

const GOAL_LEVELS = { resting: 'se repose', good: 'va bien', flourishing: 's’épanouit' } as const;
const TRENDS = { rising: 'la lumière monte (montrée)', steady: 'stable (jamais montrée)', resting: 'en baisse (jamais montrée)' } as const;
const VERDICTS = { quiet: 'calme', balanced: 'équilibré', 'a-carried': 'A a porté', 'b-carried': 'B a porté' } as const;
function Row({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="dev-row">
      <dt className="dev-row__label">{label}</dt>
      <dd className="dev-row__value">
        {value}
        {hint && <span className="dev-row__hint">{hint}</span>}
      </dd>
    </div>
  );
}

function Bar({ ratio, label }: { ratio: number; label: string }) {
  const clamped = Math.min(1, Math.max(0, ratio));
  return (
    <div className="dev-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)}>
      <span className="dev-bar__fill" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

export function DevNumbers({ data }: { data: DevData }) {
  const { progress: p, goal: g, balance: b } = data;
  const next = p.nextThreshold;
  return (
    <>
      <section className="dev-section" aria-labelledby="dev-forest">
        <h3 id="dev-forest" className="dev-section__title">
          La forêt, en chiffres
        </h3>
        <dl className="dev-grid">
          <Row label="Stade" value={`${p.stage} / ${CONSTANTS.GROWTH_THRESHOLDS.length}`} hint={STAGE_NAMES[p.stage]} />
          <Row label="Soins cumulés" value={num(p.lifetimeCare)} hint="lifetimeCare" />
          <Row label="Seuil du stade" value={num(p.stageFloor)} hint={next === null ? 'dernier stade' : `suivant : ${num(next)}`} />
          <Row
            label="Vers le stade suivant"
            value={pct(p.progressToNext)}
            hint={next === null ? undefined : `encore ${num(Math.max(0, next - p.lifetimeCare))} soin${next - p.lifetimeCare > 1 ? 's' : ''}`}
          />
        </dl>
        <Bar ratio={p.progressToNext} label="Avancée vers le stade suivant" />
        <dl className="dev-grid">
          <Row label="Crédits du jour" value={`${p.creditsToday} / ${p.dailyCap}`} hint="actifs + annulés" />
          <Row label="Vitalité" value={`${num(p.vitality)} / ${p.vitalityMax}`} hint={VITALITY_LABELS[p.vitalityState]} />
        </dl>
        <Bar ratio={p.vitality / p.vitalityMax} label="Vitalité" />
        <dl className="dev-grid">
          <Row label="Série en cours" value={`${p.currentStreak} j`} hint={`gardien à ${CONSTANTS.GUARDIAN_STREAK}`} />
          <Row label="Plus longue série" value={`${p.longestStreak} j`} />
          <Row label="Pause" value={p.paused ? 'oui' : 'non'} />
          <Row label="Dernier événement rare" value={data.lastRareEvent ?? '—'} />
          <Row label="Dernier jour traité" value={data.lastProcessedDay ?? '—'} />
          <Row
            label="Registre des crédits"
            value={num(data.ledger.active)}
            hint={`actifs · ${num(data.ledger.tombstoned)} annulés · ${num(data.ledger.uncredited)} non crédités`}
          />
        </dl>
      </section>

      <section className="dev-section" aria-labelledby="dev-goal">
        <h3 id="dev-goal" className="dev-section__title">
          Objectif de la semaine
        </h3>
        <dl className="dev-grid">
          <Row label="Semaine" value={`${g.weekStart} → ${g.weekEnd}`} />
          <Row label="Soins de la semaine" value={`${g.creditsThisWeek} / ${g.target}`} hint={pct(g.progress)} />
          <Row label="Niveau" value={g.level} hint={`la forêt ${GOAL_LEVELS[g.level]}`} />
          <Row label="Seuils" value={`bon dès ${g.goodFrom}`} hint={`florissante dès ${g.target}`} />
          <Row label="Tendance" value={g.trend} hint={TRENDS[g.trend]} />
          <Row label="Semaine passée, même durée" value={num(g.previousWeekSameSpan)} />
        </dl>
        <Bar ratio={g.progress} label="Objectif de la semaine" />
      </section>

      <section className="dev-section" aria-labelledby="dev-balance">
        <h3 id="dev-balance" className="dev-section__title">
          Partage de la semaine
        </h3>
        <dl className="dev-grid">
          <Row label="Efforts A · B" value={`${num(b.a)} · ${num(b.b)}`} hint={`total ${num(b.total)}`} />
          <Row label="Verdict" value={b.verdict} hint={VERDICTS[b.verdict]} />
        </dl>
      </section>

      <section className="dev-section" aria-labelledby="dev-constants">
        <h3 id="dev-constants" className="dev-section__title">
          Constantes
        </h3>
        <p className="dev-section__lead">Dans packages/core (forest.ts, forestProgress.ts) : à modifier ensemble, puis recharger.</p>
        <ol className="dev-thresholds" aria-label="Seuils de croissance (GROWTH_THRESHOLDS)">
          {CONSTANTS.GROWTH_THRESHOLDS.map((t, i) => (
            <li key={i} className={cx('dev-threshold', i + 1 === p.stage && 'is-current', i + 1 < p.stage && 'is-past')}>
              <span className="dev-threshold__stage">{i + 1}</span>
              <span className="dev-threshold__value">{num(t)}</span>
            </li>
          ))}
        </ol>
        <dl className="dev-grid dev-grid--code">
          <Row label="DAILY_CREDIT_CAP" value={CONSTANTS.DAILY_CREDIT_CAP} />
          <Row label="VITALITY_PER_CREDIT" value={CONSTANTS.VITALITY_PER_CREDIT} />
          <Row label="VITALITY_MAX" value={CONSTANTS.VITALITY_MAX} />
          <Row label="DAILY_DECAY" value={CONSTANTS.DAILY_DECAY} />
          <Row label="INACTIVITY_GRACE_DAYS" value={CONSTANTS.INACTIVITY_GRACE_DAYS} />
          <Row label="GUARDIAN_STREAK" value={CONSTANTS.GUARDIAN_STREAK} />
          <Row
            label="VITALITY_STATE_THRESHOLDS"
            value={CONSTANTS.VITALITY_STATE_THRESHOLDS.map((s) => s.min).join(' / ')}
            hint={CONSTANTS.VITALITY_STATE_THRESHOLDS.map((s) => VITALITY_LABELS[s.state]).join(' · ')}
          />
          <Row label="WEEKLY_GOAL_TARGET" value={CONSTANTS.WEEKLY_GOAL_TARGET} />
          <Row
            label="WEEKLY_GOAL_LEVELS"
            value={`${CONSTANTS.WEEKLY_GOAL_LEVELS.resting} / ${CONSTANTS.WEEKLY_GOAL_LEVELS.good} / ${CONSTANTS.WEEKLY_GOAL_LEVELS.flourishing}`}
            hint="repos · bon · florissante"
          />
        </dl>
      </section>

      <section className="dev-section" aria-labelledby="dev-unlocks">
        <h3 id="dev-unlocks" className="dev-section__title">
          Créatures et environnements
        </h3>
        <ul className="dev-unlocks">
          {data.creatures.map((c) => (
            <li key={c.id} className={cx('dev-unlock', c.unlocked && 'is-unlocked')}>
              <span className="dev-unlock__stage">stade {c.stage}</span>
              <span className="dev-unlock__name">{CREATURE_ENTRIES[c.id]?.name ?? c.id}</span>
              <code className="dev-unlock__id">{c.id}</code>
              <span className="dev-unlock__state">{c.unlocked ? 'rencontrée' : 'à venir'}</span>
            </li>
          ))}
          {data.environments.map((e) => (
            <li key={e.id} className={cx('dev-unlock', 'dev-unlock--env', e.unlocked && 'is-unlocked')}>
              <span className="dev-unlock__stage">stade {e.stage}</span>
              <span className="dev-unlock__name">Environnement</span>
              <code className="dev-unlock__id">{e.id}</code>
              <span className="dev-unlock__state">{e.unlocked ? 'débloqué' : 'à venir'}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
