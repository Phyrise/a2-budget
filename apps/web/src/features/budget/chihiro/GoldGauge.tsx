/**
 * Jauge « Reste du mois » : une rigole de bois laqué qui se remplit de pépites
 * d'or, proportionnellement au reste / versements (borné 0..1, voir goldFill).
 * Remplissage doux à l'affichage et à chaque changement ; déficit sobre (terre
 * cuite, pas d'or). Décorative : le reste est déjà écrit juste au-dessus.
 */
import { useEffect, useState } from 'react';
import { budgetTheme } from '../../../themes/manifest';
import { cx } from '../../../ui';
import { stableHash } from './mood';

const SLOTS = 12;

const NUGGETS = Array.from({ length: SLOTS }, (_, i) => {
  const h = stableHash(`pepite-${i}`);
  const coin = i % 5 === 3;
  const pool = coin ? budgetTheme.gold.coins : budgetTheme.gold.nuggets;
  return {
    src: pool[h % pool.length] ?? budgetTheme.gold.nuggets[0],
    coin,
    rotate: (h % 70) - 35,
    lift: i % 2 === 0 ? -2 : 3,
    size: coin ? 19 : 21 + (h % 5),
  };
});

export function GoldGauge({ fill, deficit }: { fill: number; deficit: boolean }) {
  const target = deficit ? 0 : Math.max(0, Math.min(1, fill));
  // Part de 0 au premier rendu pour que l'or « coule » dans la rigole.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setShown(target));
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <div className={cx('gold-gauge', deficit && 'gold-gauge--deficit')} aria-hidden="true" data-fill={target.toFixed(3)}>
      <div className="gold-gauge__track">
        <span className="gold-gauge__clip">
          <span className="gold-gauge__fill" style={{ transform: `scaleX(${Math.min(1, Math.max(0, shown))})` }} />
        </span>
        {NUGGETS.map((n, i) => {
          const at = (i + 0.5) / SLOTS;
          const on = i === 0 ? shown > 0 : at <= shown;
          return (
            <img
              key={i}
              className={cx('gold-gauge__nugget', n.coin && 'is-coin', on && 'is-on')}
              src={n.src}
              alt=""
              draggable={false}
              decoding="async"
              style={{
                left: `${at * 100}%`,
                width: n.size,
                height: n.size,
                ['--rot' as string]: `${n.rotate}deg`,
                ['--lift' as string]: `${n.lift}px`,
                transitionDelay: on ? `${120 + i * 55}ms` : '0ms',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
