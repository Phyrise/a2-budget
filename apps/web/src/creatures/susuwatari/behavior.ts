/**
 * Vie autonome d'une Noiraude (`autonomous`) : au repos, elle attend
 * quelques secondes puis se promène un peu, sautille sur place, se lève pour
 * regarder, ou somnole. Mouvement réduit : promenades plus rares, pas de
 * sautillement. Pur : seulement des commandes de `Susuwatari`.
 */
import type { Rect, Susuwatari } from './creature';

export function live(s: Susuwatari, time: number, area: Rect, reduced: boolean): void {
  if (!s.autonomous || s.state !== 'idle' || s.z > 0) return;
  if (s.restUntil === 0) {
    s.restUntil = time + 0.5 + s.rand() * 3;
    return;
  }
  if (time < s.restUntil) return;
  const roll = s.rand();
  const pause = reduced ? 4 + s.rand() * 6 : 1.5 + s.rand() * 4;
  s.restUntil = time + pause;
  if (roll < (reduced ? 0.35 : 0.55)) {
    // Petite promenade, sans sortir de la zone.
    const reach = s.scale * (1.2 + s.rand() * 3);
    const angle = s.rand() * Math.PI * 2;
    const x = Math.max(area.left, Math.min(area.right, s.x + Math.cos(angle) * reach));
    const y = Math.max(area.top, Math.min(area.bottom, s.y + Math.sin(angle) * reach * 0.45));
    s.walkTo(x, y, { speed: 55 + s.rand() * 45 });
  } else if (roll < 0.7 && !reduced) {
    s.bounce(0.45 + s.rand() * 0.35);
  } else if (roll < 0.85) {
    // Se dresse un instant sur ses pattes, puis se rassoit.
    s.standFor(1 + s.rand() * 1.2);
    s.restUntil = time + 1.6 + s.rand() * 1.5;
  } else if (roll < 0.93) {
    s.sleep(3 + s.rand() * 5);
    s.restUntil = s.sleepUntil + 1;
  }
}
