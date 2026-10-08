/**
 * Outils communs des tests de règles Firestore (émulateur, projet demo-a2home).
 * Lancés par `pnpm test:rules` (Java 21+ requis), jamais par `pnpm test`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { serverTimestamp, type Firestore } from 'firebase/firestore';

export const PROJECT_ID = 'demo-a2home';
export const HID = 'a2home';
export const HH = `households/${HID}`;

const root = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

/** Les règles versionnées, exactement celles à coller dans la console. */
export const RULES = readFileSync(root('firestore.rules'), 'utf8');

/** Port de l'émulateur : celui de firebase.json (emulators:exec ou emulators:start). */
const emulator = JSON.parse(readFileSync(root('firebase.json'), 'utf8')).emulators.firestore as {
  host: string;
  port: number;
};

export function startEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: RULES, host: emulator.host, port: emulator.port },
  });
}

/** Les deux comptes invités (rôle déduit de l'e-mail) et des intrus. */
export const ARTHUR = { uid: 'uid-arthur', email: 'arthur.longuefosse@gmail.com', role: 'a' };
export const ALEXIA = { uid: 'uid-alexia', email: 'alexia.chaval@free.fr', role: 'b' };
export const STRANGER = { uid: 'uid-stranger', email: 'quelquun@gmail.com', role: 'a' };

/** Un compte connecté avec Google (jeton simulé par l'émulateur). */
export function google(
  env: RulesTestEnvironment,
  who: { uid: string; email: string },
  emailVerified = true,
): RulesTestContext {
  return env.authenticatedContext(who.uid, {
    email: who.email,
    email_verified: emailVerified,
    firebase: { sign_in_provider: 'google.com' },
  });
}

/**
 * Le Firestore d'un contexte, typé pour l'API modulaire (l'objet « compat »
 * renvoyé par rules-unit-testing est accepté par les fonctions modulaires).
 */
export function db(ctx: RulesTestContext): Firestore {
  return ctx.firestore() as unknown as Firestore;
}

/** Métadonnées exigées sur toute écriture : auteur + heure du serveur. */
export function stamp(uid: string) {
  return { updatedBy: uid, syncedAt: serverTimestamp() };
}

/** Un fait (complétion…) signé par son auteur. */
export function fact(who: { uid: string; role: string }, extra: Record<string, unknown> = {}) {
  return {
    taskId: 't1',
    localDay: '2026-10-08',
    completedAt: '2026-10-08T09:00:00.000Z',
    createdBy: who.uid,
    role: who.role,
    ...stamp(who.uid),
    ...extra,
  };
}

/** L'annulation douce d'un fait, signée du rôle de celui qui annule. */
export function undo(who: { uid: string; role: string }, extra: Record<string, unknown> = {}) {
  return {
    undoneAt: '2026-10-08T10:00:00.000Z',
    undoneDay: '2026-10-08',
    undoneBy: who.role,
    ...stamp(who.uid),
    ...extra,
  };
}
