/** « de Léa », « d’AL » : élision devant une voyelle (fêtes, réglages). */
export function deName(name: string): string {
  const folded = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return /^[aeiouyœæ]/u.test(folded) ? `d’${name}` : `de ${name}`;
}
