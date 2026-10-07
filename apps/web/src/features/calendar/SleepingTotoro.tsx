/**
 * Totoro endormi (jour libre du Calendrier, V4.3) : un toucher, il bâille et
 * s'étire — étirement, tête qui se soulève, petite bulle de sommeil qui
 * gonfle au nez puis éclate — et se rendort. Anti-rafale : rien pendant le
 * bâillement ni juste après. Calme (mouvement réduit, Forêt « Immobile ») :
 * Totoro ne bouge pas, seule la bulle paraît et s'efface. Son « yawn »
 * seulement si les petits sons sont permis. Le mode développeur le fait
 * bâiller sans attendre (`previewYawn`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { readPrefs } from '../../app/prefs';
import { playCue } from '../../app/sound/play';
import { calendarTheme } from '../../themes/manifest';
import { cx } from '../../ui';
import './totoro-yawn.css';

/** Durée du bâillement, puis repos avant le suivant (ms). */
export const YAWN_MS = 2600;
const REST_MS = 1200;
const PREVIEW_EVENT = 'a2:totoro-yawn';

/** Mode développeur : chaque Totoro endormi monté bâille. */
export function previewYawn() {
  window.dispatchEvent(new CustomEvent(PREVIEW_EVENT));
}

function calmNow(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || readPrefs().forestMotion === 'still';
  } catch {
    return false;
  }
}

export function SleepingTotoro({ className }: { className?: string }) {
  const [yawn, setYawn] = useState<{ n: number; calm: boolean } | null>(null);
  const busyUntil = useRef(0);
  const count = useRef(0);

  const start = useCallback(() => {
    const now = performance.now();
    if (now < busyUntil.current) return;
    busyUntil.current = now + YAWN_MS + REST_MS;
    count.current += 1;
    setYawn({ n: count.current, calm: calmNow() });
    playCue('yawn');
  }, []);

  useEffect(() => {
    if (yawn === null) return;
    const t = window.setTimeout(() => setYawn(null), YAWN_MS);
    return () => window.clearTimeout(t);
  }, [yawn]);

  useEffect(() => {
    window.addEventListener(PREVIEW_EVENT, start);
    return () => window.removeEventListener(PREVIEW_EVENT, start);
  }, [start]);

  return (
    <button
      type="button"
      className={cx('cal-totoro', yawn && 'is-yawning', yawn?.calm && 'is-calm', className)}
      aria-label="Chatouiller Totoro"
      onClick={start}
    >
      <img className="cal-day-empty__art cal-totoro__art" src={calendarTheme.totoro.sleeping} alt="" width={84} height={44} decoding="async" draggable={false} />
      {yawn && (
        <span key={yawn.n} className="cal-totoro__bubble">
          <i className="cal-totoro__film" />
          <i className="cal-totoro__drop" />
          <i className="cal-totoro__drop" />
        </span>
      )}
    </button>
  );
}
