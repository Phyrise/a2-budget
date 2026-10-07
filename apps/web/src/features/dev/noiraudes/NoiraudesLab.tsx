/**
 * Labo Noiraudes (mode développeur) : page plein écran sur le fond du
 * Budget, ouverte par `?lab=noiraudes` ou depuis le panneau DEV, pour juger
 * les Noiraudes dessinées par le code avant de les mettre dans l'app.
 * - Comparaison côte à côte : le trio peint / le même trio en code ;
 * - une scène où quelques Noiraudes vivent (toucher, appui long, regard) ;
 * - « Nuit », nombre (1–50) et taille.
 * Rien n'est écrit dans les données ; les vraies interactions viendront après.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { budgetTheme } from '../../../themes/manifest';
import { Icon } from '../../../ui';
import { useCompareTrio } from './useCompareTrio';
import { useLabScene } from './useLabScene';
import '../../../styles/base.css';
import '../../../styles/ui.css';
import './noiraudesLab.css';

/** Retour à l'app (sans le paramètre du labo). */
export function leaveLab(): void {
  window.location.assign(import.meta.env.BASE_URL);
}

function Range({ label, value, min, max, onChange, unit }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="nlab-range">
      <span className="nlab-range__label">
        {label}
        <output className="nlab-range__value">
          {value}
          {unit}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function NoiraudesLab() {
  const compareRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLImageElement>(null);
  const [count, setCount] = useState(8);
  const [size, setSize] = useState(54);
  const [night, setNight] = useState(false);
  const [fps, setFps] = useState<string>('');
  useCompareTrio(compareRef);
  const layer = useLabScene(sceneRef, bgRef, { count, size, night });

  useEffect(() => {
    document.title = 'Labo Noiraudes — A² Home';
    const timer = window.setInterval(() => {
      const st = layer.current?.stats();
      if (st) setFps(`${Math.round(st.fps)} i/s · ${st.frameMs.toFixed(1)} ms · densité ${st.dpr}`);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [layer]);

  return (
    <div className={`nlab${night ? ' is-night' : ''}`} data-testid="noiraudes-lab">
      <img ref={bgRef} className="nlab__bg" src={budgetTheme.banners.portrait} alt="" aria-hidden="true" />
      <div className="nlab__veil" aria-hidden="true" />

      <header className="nlab__head">
        <h1 className="nlab__title">Labo Noiraudes</h1>
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

      <div className="nlab__controls">
        <button type="button" className="dev-choice nlab__night" aria-pressed={night} onClick={() => setNight((n) => !n)}>
          <Icon name={night ? 'sun' : 'moon'} size={16} />
          Nuit
        </button>
        <Range label="Nombre" value={count} min={1} max={50} onChange={setCount} />
        <Range label="Taille" value={size} min={22} max={110} onChange={setSize} unit=" px" />
        <span className="nlab__fps" aria-live="off">
          {fps}
        </span>
      </div>

      <div className="nlab__scene">
        <canvas ref={sceneRef} className="nlab__canvas" aria-label="Scène : toucher une Noiraude la fait sauter, un appui long la fait fuir" />
        <p className="nlab__hint">Toucher : elle saute · appui long : elle s’enfuit</p>
      </div>
    </div>
  );
}
