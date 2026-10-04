/**
 * <LivingForest> — la scène forêt vivante (contrat LivingForestProps /
 * LivingForestHandle de world/types.ts).
 *
 * Chargement sans saut : placeholder flou → peinture du stade (<img>, fondu)
 * → canvas WebGL quand la première image est prête (fondu enchaîné). Les
 * <img> reprennent exactement le cadrage du moteur (engine/framing.ts).
 * Le moteur (OGL + shaders) est importé paresseusement. Sans WebGL, ou après
 * une perte de contexte non récupérée : peinture fixe + voile de brume CSS.
 */
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { framingFor, imageBoxStyle, type Framing } from './engine/framing';
import type { EngineStats, QualitySetting, WorldEngine } from './engine';
import { manifest as defaultManifest } from './manifest';
import type { GrowthStage, LivingForestHandle, LivingForestProps, WorldManifest, WorldMotion } from './types';
import { ForestMist } from './engine/ForestMist';

/** Poignée étendue (labo de dev uniquement). */
export interface LivingForestDebugHandle extends LivingForestHandle {
  stats(): EngineStats | null;
  setQuality(q: QualitySetting): void;
}

type Mode = 'loading' | 'webgl' | 'fallback';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

const layer: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };

/**
 * Taille par défaut (spécificité nulle : la coquille la remplace librement,
 * ex. `.app-world { position: fixed; height: var(--world-h) }`).
 */
const BASE_CSS = ':where(.living-forest){position:relative;display:block;width:100%;height:100%;}';

export const LivingForest = forwardRef<LivingForestHandle, LivingForestProps & { manifest?: WorldManifest }>(function LivingForest(
  { state, variant = 'hero', live, motion = 'full', className = '', onReady, manifest = defaultManifest },
  ref,
) {
  const reduced = usePrefersReducedMotion();
  const effMotion: WorldMotion = reduced ? 'still' : motion;
  const effLive = live ?? variant !== 'banner';
  const stage = Math.min(7, Math.max(1, Math.round(state.stage))) as GrowthStage;

  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WorldEngine | null>(null);
  const qualityRef = useRef<QualitySetting>('auto');
  const latest = useRef({ state, variant, live: effLive, motion: effMotion });
  latest.current = { state, variant, live: effLive, motion: effMotion };
  const variantRef = useRef(variant);
  variantRef.current = variant;
  const readyRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const [framing, setFraming] = useState<Framing | null>(null);
  const [mode, setMode] = useState<Mode>('loading');
  const [canvasShown, setCanvasShown] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  const signalReady = () => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReadyRef.current?.();
  };

  // Taille du conteneur → cadrage des <img> et du moteur.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      setFraming(framingFor(variantRef.current, r.width, r.height, manifest.size));
      engineRef.current?.resize(r.width, r.height);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [manifest, variant]);

  // Création du moteur (import dynamique), recréé après une perte de contexte.
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box || mode === 'fallback') return;
    let cancelled = false;
    let engine: WorldEngine | null = null;
    let restoreTimer = 0;
    let cleanupIo = () => {};
    const onRestored = () => {
      window.clearTimeout(restoreTimer);
      setCanvasKey((k) => k + 1);
    };
    void (async () => {
      try {
        const mod = await import('./engine');
        if (cancelled) return;
        const r = box.getBoundingClientRect();
        const cur = latest.current;
        // Moteur créé tout de suite : un démontage pendant le chargement l'arrête net
        // (aucun téléversement GPU orphelin, ex. double montage de StrictMode).
        engine = new mod.WorldEngine(
          canvas,
          {
            manifest,
            variant: cur.variant,
            motion: cur.motion,
            live: cur.live,
            quality: qualityRef.current,
            onFirstFrame: () => {
              if (cancelled) return;
              setCanvasShown(true);
              setMode('webgl');
              signalReady();
            },
            onContextLost: () => {
              setCanvasShown(false);
              canvas.addEventListener('webglcontextrestored', onRestored, { once: true });
              // Sans restauration rapide : nouvelle tentative sur un canvas neuf.
              restoreTimer = window.setTimeout(onRestored, 3000);
            },
          },
        );
        engine.resize(Math.max(1, r.width), Math.max(1, r.height));
        await engine.init(cur.state);
        if (cancelled) return;
        engineRef.current = engine;
        engine.setState(latest.current.state);
        const io = new IntersectionObserver((entries) => {
          for (const en of entries) engine?.setVisible(en.isIntersecting);
        });
        io.observe(box);
        cleanupIo = () => io.disconnect();
      } catch {
        if (!cancelled) setMode('fallback');
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(restoreTimer);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      cleanupIo();
      engine?.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
    // Recréé seulement pour un nouveau canvas ou un autre manifest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasKey, manifest]);

  // Trop de pertes de contexte : on reste sur la peinture fixe.
  useEffect(() => {
    if (canvasKey > 3) setMode('fallback');
  }, [canvasKey]);

  useEffect(() => {
    engineRef.current?.setState(state);
  }, [state]);

  useEffect(() => {
    engineRef.current?.configure({ variant, live: effLive, motion: effMotion });
  }, [variant, effLive, effMotion]);

  useImperativeHandle(
    ref,
    (): LivingForestDebugHandle => ({
      pulse: (opts) => engineRef.current?.pulse(opts),
      playGuardian: () => engineRef.current?.playGuardian(),
      // TODO(MONDE V3) : lanterne dans la scène ; sans effet en attendant.
      focus: () => {},
      stats: () => engineRef.current?.stats() ?? null,
      setQuality: (q) => {
        qualityRef.current = q;
        engineRef.current?.configure({ quality: q });
      },
    }),
    [],
  );

  const box = framing ? imageBoxStyle(framing, manifest.size.w, manifest.size.h) : null;
  const imgStyle = (extra: CSSProperties): CSSProperties =>
    box ? { ...box, ...extra } : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...extra };
  const showImages = !canvasShown || mode !== 'webgl';

  return (
    <div className={`living-forest living-forest--${variant} ${className}`.trim()} aria-hidden="true">
      <style>{BASE_CSS}</style>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0b1410' }} ref={boxRef}>
        {showImages || !imgLoaded ? (
          <img
            src={manifest.placeholder}
            alt=""
            draggable={false}
            style={imgStyle({ filter: 'blur(14px)', transform: 'scale(1.04)', opacity: imgLoaded ? 0 : 1, transition: 'opacity 600ms ease' })}
          />
        ) : null}
        <img
          src={manifest.stages[stage].color}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => {
            setImgLoaded(true);
            signalReady();
          }}
          style={imgStyle({
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 600ms ease',
            visibility: canvasShown && mode === 'webgl' ? 'hidden' : 'visible',
            transitionProperty: 'opacity, visibility',
            transitionDelay: canvasShown && mode === 'webgl' ? '0ms, 900ms' : '0ms',
          })}
        />
        {mode === 'fallback' ? <ForestMist still={effMotion === 'still'} /> : null}
        <canvas
          key={canvasKey}
          ref={canvasRef}
          style={{ ...layer, width: '100%', height: '100%', display: 'block', opacity: canvasShown && mode === 'webgl' ? 1 : 0, transition: 'opacity 800ms ease' }}
        />
      </div>
    </div>
  );
});
