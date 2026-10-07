/**
 * Comptes Google invités (V5) : un seul foyer, deux personnes, rôle déduit
 * de l'e-mail (AL = 'a', AC = 'b').
 *
 * Dit exactement la même chose que le bloc « liste blanche » de
 * `firestore.rules` (allowlist.test.ts le vérifie) : le client refuse
 * gentiment, les règles refusent vraiment. Une future logique « par paire »
 * remplacera ce module et ce bloc, rien d'autre.
 *
 * Module pur : n'importe jamais Firebase (le mode invité ne le charge pas).
 */

export type MemberRole = 'a' | 'b';

/** Le foyer unique (id du document `households/{id}`). */
export const HOUSEHOLD_ID = 'a2home';

/** E-mails invités (en minuscules) → rôle. */
export const INVITED_EMAILS: Readonly<Record<string, MemberRole>> = Object.freeze({
  'arthur.longuefosse@gmail.com': 'a',
  'alexia.chaval@free.fr': 'b',
});

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Rôle d'un compte connecté, ou `null` s'il n'est pas invité. Comme les
 * règles, exige un e-mail vérifié par Google.
 */
export function roleForAccount(account: {
  email?: string | null;
  emailVerified?: boolean;
}): MemberRole | null {
  if (!account.email || account.emailVerified !== true) return null;
  const key = normalizeEmail(account.email);
  return Object.hasOwn(INVITED_EMAILS, key) ? (INVITED_EMAILS[key] ?? null) : null;
}
