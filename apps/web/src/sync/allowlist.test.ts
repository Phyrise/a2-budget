import { describe, expect, it } from 'vitest';
import rules from '../../../../firestore.rules?raw';
import { HOUSEHOLD_ID, INVITED_EMAILS, roleForAccount } from './allowlist';

/** La liste blanche telle que l'écrivent les règles Firestore. */
function rulesAllowlist(src: string) {
  const hid = /function householdId\(\) \{ return '([^']+)'; \}/.exec(src)?.[1];
  const block = /function roleByEmail\(\) \{\s*return \{([^}]*)\};/.exec(src)?.[1] ?? '';
  const roles = Object.fromEntries([...block.matchAll(/'([^']+)':\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  return { hid, roles };
}

describe('liste blanche', () => {
  it('le client et firestore.rules disent la même chose', () => {
    const fromRules = rulesAllowlist(rules);
    expect(fromRules.hid).toBe(HOUSEHOLD_ID);
    expect(fromRules.roles).toEqual(INVITED_EMAILS);
    for (const email of Object.keys(INVITED_EMAILS)) expect(email).toBe(email.toLowerCase());
  });

  it('rôle déduit de l’e-mail, sans tenir compte des majuscules', () => {
    expect(roleForAccount({ email: 'arthur.longuefosse@gmail.com', emailVerified: true })).toBe('a');
    expect(roleForAccount({ email: ' Alexia.Chaval@Free.fr ', emailVerified: true })).toBe('b');
  });

  it('compte non invité, e-mail absent ou non vérifié : refusé', () => {
    expect(roleForAccount({ email: 'quelquun@gmail.com', emailVerified: true })).toBeNull();
    expect(roleForAccount({ email: 'arthur.longuefosse@gmail.com', emailVerified: false })).toBeNull();
    expect(roleForAccount({ email: 'alexia.chaval@free.fr' })).toBeNull();
    expect(roleForAccount({ email: null, emailVerified: true })).toBeNull();
    expect(roleForAccount({ email: 'constructor', emailVerified: true })).toBeNull();
  });
});
