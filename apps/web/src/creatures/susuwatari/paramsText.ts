/**
 * Paramètres de Noiraude ↔ texte : l'objet TypeScript prêt à coller dans
 * params.ts (bouton « Copier » du Labo) et, à l'inverse, la lecture
 * tolérante d'un objet collé (TypeScript, JavaScript ou JSON ; commentaires,
 * clés sans guillemets, apostrophes et virgules finales acceptés).
 */
import { looksLikeParams, normalizeParams, type SootSpriteParams } from './params';

function literal(v: unknown): string {
  if (typeof v === 'number') return String(Number(v.toFixed(4)));
  if (typeof v === 'string') return `'${v}'`;
  if (Array.isArray(v)) return `[${v.map(literal).join(', ')}]`;
  return String(v);
}

/** Objet TypeScript, une clé par ligne, groupe par groupe. */
export function formatParams(p: SootSpriteParams, name = 'SOOT_PARAMS'): string {
  const lines = [`export const ${name}: SootSpriteParams = {`];
  for (const [group, values] of Object.entries(p)) {
    lines.push(`  ${group}: {`);
    for (const [key, v] of Object.entries(values as Record<string, unknown>)) lines.push(`    ${key}: ${literal(v)},`);
    lines.push('  },');
  }
  lines.push('};');
  return lines.join('\n');
}

/**
 * Texte collé → paramètres complets (les clés absentes gardent celles de
 * `base`), ou null si aucun objet de paramètres n'y est reconnu.
 */
export function parseParams(text: string, base?: SootSpriteParams): SootSpriteParams | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const json = text
    .slice(start, end + 1)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'([^'\\\n]*)'/g, (_m, s: string) => JSON.stringify(s))
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/\bas\s+const\b/g, '')
    .replace(/,(\s*[}\]])/g, '$1');
  try {
    const value: unknown = JSON.parse(json);
    return looksLikeParams(value) ? normalizeParams(value, base) : null;
  } catch {
    return null;
  }
}
