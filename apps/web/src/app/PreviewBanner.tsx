/**
 * Bandeau du mode développeur, visible tant qu'un aperçu change ce que
 * montre la forêt : rappelle que les données ne bougent pas et permet de
 * revenir à la vraie forêt d'un geste.
 */
import { useWorld } from '../world/WorldContext';

export function PreviewBanner() {
  const { previewActive, setPreview } = useWorld();
  if (!previewActive) return null;
  return (
    <div className="preview-banner" role="status">
      <span className="preview-banner__dot" aria-hidden="true" />
      <span className="preview-banner__text">Aperçu — vos données ne changent pas</span>
      <button type="button" className="preview-banner__reset" onClick={() => setPreview(null)}>
        Revenir à la vraie forêt
      </button>
    </div>
  );
}
