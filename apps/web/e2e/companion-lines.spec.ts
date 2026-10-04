/**
 * Garde-fou d'écriture des répliques des compagnons (principes V3 §1.1-1.2) :
 * aucune dette, aucun merci réclamé, aucune pique sur les habitudes d'un
 * humain. Lit la source (pas de navigateur).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const source = readFileSync(
  fileURLToPath(new URL('../src/features/maison/companionLines.ts', import.meta.url)),
  'utf8',
);
const lines = [...source.matchAll(/^ {4}'(.*)',$/gm)].map((m) => m[1]!);

const FORBIDDEN = [
  /pareille/i,
  /dis merci/i,
  /à ta place/i,
  /j[’']espère que tu/i,
  /avoue/i,
  /merci serait/i,
  /un merci s[’']impose/i,
  /tu as de la chance/i,
  /quand tu veux/i,
  /enfin quelqu[’']un/i,
  /moins attendu|en attendais pas moins/i,
  /te juger/i,
  /presque raisonnable/i,
  /te doit/i,
];

test('les répliques ne réclament rien et ne piquent personne', () => {
  expect(lines.length).toBeGreaterThan(100);
  for (const line of lines) {
    for (const re of FORBIDDEN) expect(line, `« ${line} »`).not.toMatch(re);
    expect(line.replace(/\{(autre|humain)\}/g, 'AL').length, `« ${line} »`).toBeLessThanOrEqual(90);
  }
});
