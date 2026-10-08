/**
 * Noiraudes vivantes d'un écran (Budget, et celles qui se trompent d'onglet
 * dans Courses ou Calendrier) : `<SootStage screen>` monte la scène (une
 * toile) ; `soot` la fait agir (portage, traversée, kompeitō du bocal) ;
 * `summonNoiraudes` fait venir une Noiraude, la dorée, la procession ou
 * une égarée (panneau DEV). Voir director.ts pour l'organisation.
 */
export { SootStage, type SootCanvas } from './SootStage';
export { registerJar, soot, summonNoiraudes, SUMMON_EVENT, type SootSummon } from './stage';
export { SPAWN_EVENT } from './rhythm';
export type { PortTarget } from './porters';
export type { KonpeitoTone } from './items';
export { STRAY_SIZE, nextDelayMs, pickPerch, type Box } from './perch';
