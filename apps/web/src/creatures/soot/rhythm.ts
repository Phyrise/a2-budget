/**
 * Rythme des apparitions d'un écran, et appels sans attendre.
 * - Budget : une vagabonde toutes les 25–60 s (60–120 s au calme), jamais
 *   pendant les 20 premières secondes, parfois quand on s'arrête de faire
 *   défiler ; rarement la dorée ou la procession (jamais annoncées).
 * - Courses, Calendrier : de loin en loin, une Noiraude « se trompe
 *   d'onglet » (une fois par visite au plus).
 * - Navigateur piloté (tests) : rien de spontané. `a2:susuwatari` fait venir
 *   une vagabonde tout de suite (si rien n'est ouvert) ; `a2:noiraudes`
 *   (panneau DEV) attend qu'aucune feuille ne soit ouverte (≤ 5 s).
 * Onglet caché : plus de minuterie ; elle reprend au retour.
 */
import { busy, type SootDirector } from './director';
import { procession } from './parade';
import { SCROLL_GAP_MS, WARMUP_MS, WRONG_TAB_CHANCE, nextDelayMs, rollRarity, wrongTabDelayMs } from './perch';
import { SUMMON_EVENT, type SootSummon, type SummonDetail } from './stage';
import { spawnStray } from './strays';

export const SPAWN_EVENT = 'a2:susuwatari';

function automated(): boolean {
  try {
    return navigator.webdriver === true;
  } catch {
    return false;
  }
}

function summon(d: SootDirector, kind: SootSummon): boolean {
  if (kind === 'procession') return procession(d);
  return spawnStray(d, { golden: kind === 'golden', lost: kind === 'lost' }) !== null;
}

export function startRhythm(d: SootDirector): () => void {
  const robot = automated();
  const mountedAt = performance.now();
  let lastAt = mountedAt;
  let timer: number | undefined;
  let scrollTimer: number | undefined;
  let lostShown = false;
  const retries = new Set<number>();

  const spontaneous = () => {
    if (busy()) return;
    lastAt = performance.now();
    if (d.screen !== 'budget') {
      if (!lostShown && d.rand() < WRONG_TAB_CHANCE) lostShown = spawnStray(d, { lost: true }) !== null;
      return;
    }
    if (d.count('stray') > 0) return;
    const rare = rollRarity(d.calm, d.rand);
    if (rare === 'procession' && procession(d)) return;
    spawnStray(d, { golden: rare === 'golden' });
  };

  const delay = () => (d.screen === 'budget' ? nextDelayMs(d.calm, d.rand) : wrongTabDelayMs(d.rand));
  const schedule = (ms: number) => {
    window.clearTimeout(timer);
    if (robot) return;
    timer = window.setTimeout(() => {
      spontaneous();
      schedule(delay());
    }, ms);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') schedule(Math.max(4000, delay()));
    else window.clearTimeout(timer);
  };

  // Parfois, quand on s'arrête de faire défiler (Budget).
  const onScroll = () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      const now = performance.now();
      if (robot || d.screen !== 'budget' || now - mountedAt < WARMUP_MS || now - lastAt < SCROLL_GAP_MS) return;
      if (d.rand() < (d.calm ? 0.08 : 0.2)) schedule(600 + d.rand() * 1200);
    }, 450);
  };

  const onSpawn = () => {
    if (d.screen === 'budget') spawnStray(d);
  };

  const onSummon = (event: Event) => {
    const detail = (event as CustomEvent<Partial<SummonDetail> | null>).detail;
    if (detail?.screen && detail.screen !== d.screen) return;
    const kind = detail?.kind ?? 'stray';
    const started = performance.now();
    const attempt = () => {
      if (!busy() && summon(d, kind)) return;
      if (performance.now() - started > 5000) return;
      const id = window.setTimeout(() => {
        retries.delete(id);
        attempt();
      }, 200);
      retries.add(id);
    };
    attempt();
  };

  schedule(Math.max(WARMUP_MS, delay()));
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener(SPAWN_EVENT, onSpawn);
  window.addEventListener(SUMMON_EVENT, onSummon);
  return () => {
    window.clearTimeout(timer);
    window.clearTimeout(scrollTimer);
    retries.forEach((id) => window.clearTimeout(id));
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener(SPAWN_EVENT, onSpawn);
    window.removeEventListener(SUMMON_EVENT, onSummon);
  };
}
