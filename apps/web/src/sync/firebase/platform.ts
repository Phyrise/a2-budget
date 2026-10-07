/**
 * Choix de la méthode de connexion Google (docs/SYNC_DESIGN.md §1.1).
 * Module pur (aucun Firebase), testé dans platform.test.ts.
 *
 * - Navigateur, Android (même installé) : fenêtre (`signInWithPopup`).
 * - App installée sur iPhone / iPad : la fenêtre ne revient jamais ; redirection
 *   (`signInWithRedirect`), qui ne marche que si la page de connexion est
 *   servie par le site lui-même (helper auto-hébergé : authDomain =
 *   phyrise.github.io). Sinon : message clair, aucune tentative.
 */

export type SignInMethod = 'popup' | 'redirect';

export interface PlatformHints {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** App installée (display-mode standalone, ou navigator.standalone d'iOS). */
  standalone: boolean;
}

export function isIos(hints: PlatformHints): boolean {
  // iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
  return /iPad|iPhone|iPod/.test(hints.userAgent) || (hints.platform === 'MacIntel' && hints.maxTouchPoints > 1);
}

export function signInMethod(hints: PlatformHints): SignInMethod {
  return hints.standalone && isIos(hints) ? 'redirect' : 'popup';
}

/** La redirection n'aboutit que si la page de connexion est sur le même site. */
export function redirectWorks(authDomain: string, hostname: string): boolean {
  return authDomain.trim().toLowerCase() === hostname.trim().toLowerCase();
}

/** Indices du navigateur courant (valeurs neutres si indisponibles). */
export function currentPlatform(): PlatformHints {
  try {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    let standalone = nav.standalone === true;
    try {
      standalone ||= window.matchMedia('(display-mode: standalone)').matches;
    } catch {
      // matchMedia absent : on garde l'indice d'iOS.
    }
    return {
      userAgent: nav.userAgent ?? '',
      platform: nav.platform ?? '',
      maxTouchPoints: nav.maxTouchPoints ?? 0,
      standalone,
    };
  } catch {
    return { userAgent: '', platform: '', maxTouchPoints: 0, standalone: false };
  }
}
