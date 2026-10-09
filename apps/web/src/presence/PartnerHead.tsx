/**
 * La petite tête du compagnon de l'autre (celui qu'il a choisi, V5.6 ; Hin,
 * large et bas, est élargi dans presence.css), posée sur l'icône de l'onglet
 * où il se trouve, avec un léger halo.
 * Décorative : elle vit dans un bouton de la barre, dont le nom ne change pas.
 */
import type { ModuleId } from '../app/prefs';
import { useShell } from '../app/ShellContext';
import { Companion, cx } from '../ui';
import { useLive } from './LiveContext';

export function PartnerHead({ tab }: { tab: ModuleId }) {
  const { partner, partnerTab } = useLive();
  const { prefs } = useShell();
  if (partner === null || partnerTab !== tab) return null;
  return (
    <span className={cx('partner-head', prefs.forestMotion === 'still' && 'is-calm')} data-who={partner} aria-hidden="true">
      <Companion who={partner} size={20} />
    </span>
  );
}
