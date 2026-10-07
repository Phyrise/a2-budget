/**
 * Labo Noiraudes (mode développeur) : page plein écran sur le fond du
 * Budget, ouverte par `?lab=noiraudes` ou depuis le panneau DEV, pour juger
 * et RÉGLER les Noiraudes dessinées par le code avant de les mettre dans
 * l'app (les Noiraudes peintes du Budget n'en dépendent pas).
 * - Comparaison côte à côte : le trio peint / le même trio en code ;
 * - aperçu de la même Noiraude à 30, 50, 80 et 140 px ;
 * - une scène où quelques Noiraudes vivent (toucher, appui long, regard) ;
 * - « Réglages » (repliable) : un curseur par paramètre de l'apparence,
 *   copier / coller / mémoires ; panneau ouvert, comparaison et aperçu
 *   restent visibles en haut et la scène devient une bande en bas.
 * Rien n'est écrit dans les données ; les réglages restent sur ce téléphone.
 */
import { useEffect, useRef, useState } from 'react';
import { budgetTheme } from '../../../themes/manifest';
import { Icon } from '../../../ui';
import { LabRange } from './LabRange';
import { TunePanel } from './TunePanel';
import { useCompareTrio } from './useCompareTrio';
import { useLabScene } from './useLabScene';
import { PREVIEW_SIZES, useSizesBand } from './useSizesBand';
import { useTuning } from './useTuning';
import '../../../styles/base.css';
import '../../../styles/ui.css';
import './noiraudesLab.css';

/** Retour à l'app (sans le paramètre du labo). */
export function leaveLab(): void {
  window.location.assign(import.meta.env.BASE_URL);
}

export default function NoiraudesLab() {
  const compareRef = useRef<HTMLCanvasElement>(null);
  const sizesRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLImageElement>(null);
  const [count, setCount] = useState(8);
  const [size, setSize] = useState(54);
  const [night, setNight] = useState(false);
  const [fps, setFps] = useState<string>('');
  const tuning = useTuning();
  const { params, open } = tuning;
  useCompareTrio(compareRef, params);
  useSizesBand(sizesRef, params);
  const layer = useLabScene(sceneRef, bgRef, { count, size, night, params });

  useEffect(() => {
    document.title = 'Labo Noiraudes — A² Home';
    const timer = window.setInterval(() => {
      const st = layer.current?.stats();
      if (st) setFps(`${Math.round(st.fps)} i/s · ${st.frameMs.toFixed(1)} ms · densité ${st.dpr}`);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [layer]);

  const sceneControls = (
    <>
      <button type="button" className="dev-choice nlab__night" aria-pressed={night} onClick={() => setNight((n) => !n)}>
        <Icon name={night ? 'sun' : 'moon'} size={16} />
        Nuit
      </button>
      <LabRange label="Nombre" value={count} min={1} max={50} onChange={setCount} />
      <LabRange label="Taille" value={size} min={22} max={110} onChange={setSize} unit=" px" />
      <span className="nlab__fps" aria-live="off">
        {fps}
      </span>
    </>
  );

  return (
    <div className={`nlab${night ? ' is-night' : ''}${open ? ' is-tuning' : ''}`} data-testid="noiraudes-lab">
      <img ref={bgRef} className="nlab__bg" src={budgetTheme.banners.portrait} alt="" aria-hidden="true" />
      <div className="nlab__veil" aria-hidden="true" />

      <header className="nlab__head">
        <h1 className="nlab__title">Labo Noiraudes</h1>
        <button
          type="button"
          className="nlab__tune-toggle"
          aria-expanded={open}
          aria-controls="nlab-tune"
          onClick={() => tuning.setOpen(!open)}
        >
          <Icon name="settings" size={16} />
          Réglages
          <Icon name="chevron-down" size={14} />
        </button>
        <button type="button" className="nlab__close" onClick={leaveLab} aria-label="Fermer le labo">
          <Icon name="close" size={20} />
        </button>
      </header>

      <section className="nlab__compare" aria-label="Comparaison peinture / code">
        <figure className="nlab-cell">
          <img className="nlab-cell__art" src={budgetTheme.susuwatari.trio} alt="Trio de Noiraudes peint" draggable={false} />
          <figcaption>Peinture</figcaption>
        </figure>
        <figure className="nlab-cell">
          <canvas ref={compareRef} className="nlab-cell__art" aria-label="Trio de Noiraudes dessiné par le code" />
          <figcaption>Code</figcaption>
        </figure>
      </section>

      <section className="nlab__sizes" aria-label="Aperçu à 30, 50, 80 et 140 px">
        <div className="nlab-sizes">
          <canvas ref={sizesRef} className="nlab-sizes__canvas" aria-label="La même Noiraude à 30, 50, 80 et 140 px" />
          <div className="nlab-sizes__labels" aria-hidden="true">
            {PREVIEW_SIZES.map((s) => (
              <span key={s} style={{ width: s }}>
                {s} px
              </span>
            ))}
          </div>
        </div>
      </section>

      {open ? <TunePanel tuning={tuning} scene={sceneControls} /> : <div className="nlab__controls">{sceneControls}</div>}

      <div className="nlab__scene">
        <canvas ref={sceneRef} className="nlab__canvas" aria-label="Scène : toucher une Noiraude la fait sauter, un appui long la fait fuir" />
        <p className="nlab__hint">Toucher : elle saute · appui long : elle s’enfuit</p>
      </div>
    </div>
  );
}
