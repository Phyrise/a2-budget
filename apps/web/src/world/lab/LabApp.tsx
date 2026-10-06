/**
 * Labo du monde (dev seulement, servi par le serveur de dev : /a2-budget/world-lab.html).
 * Contrôles : stade, humeur, pause, lumières ±, pulse (fort), gardien,
 * saison (vraies peintures de saison du manifest, fondu au changement ; soir d'été), lanterne (progression, floraison,
 * modèle de pierre `model=…`, kodama assis sur le toit), mouvement,
 * variante, qualité, données, LUT de test ; fps et temps par image.
 * Paramètres d'URL identiques aux clés de LabSettings (captures Playwright),
 * `ui=0` masque le panneau ; window.__lab pilote la scène.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { LivingForest, type LivingForestDebugHandle } from '../LivingForest';
import type { EngineStats, QualitySetting } from '../engine';
import type { LivingForestHandle, Mood, Season, WorldLight, WorldMotion, WorldState, WorldVariant, Who } from '../types';
import { labManifest, type LabData } from './labManifest';
import { seasonOf } from '../worldState';

interface LabSettings {
  stage: number;
  mood: Mood;
  paused: boolean;
  lights: number;
  variant: WorldVariant;
  motion: WorldMotion;
  live: boolean;
  quality: QualitySetting;
  data: LabData;
  lut: boolean;
  progress: number;
  creature: boolean;
  season: Season | 'auto';
  /** Soirée simulée (lucioles d'été). */
  evening: boolean;
  /** Lanterne : progression 0..1, ou -1 = éteinte. */
  lantern: number;
  lanternWho: Who;
  /** Lanterne de pierre posée (WorldState.lantern). */
  model: string;
}

const WHO: Who[] = ['a', 'b', 'both', 'unassigned'];
const MOODS: Mood[] = ['quiet', 'peaceful', 'lively', 'flourishing'];
const MOOD_FR: Record<Mood, string> = { quiet: 'calme', peaceful: 'paisible', lively: 'vive', flourishing: 'florissante' };
const SEASONS: (Season | 'auto')[] = ['auto', 'spring', 'summer', 'autumn', 'winter'];
const SEASON_FR: Record<Season | 'auto', string> = { auto: 'auto', spring: 'printemps', summer: 'été', autumn: 'automne', winter: 'hiver' };
const WHO_FR: Record<Who, string> = { a: 'AL', b: 'AC', both: 'ensemble', unassigned: '—' };
const MODELS = ['kasuga-moss', 'yukimi', 'oribe', 'kotoji', 'tachi-carved', 'ancient-shrine', 'spirit-light'];

function readSettings(): LabSettings {
  const q = new URLSearchParams(location.search);
  const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
  const qual = q.get('quality');
  return {
    stage: num('stage', 6),
    mood: (q.get('mood') as Mood) ?? 'peaceful',
    paused: q.get('paused') === '1',
    lights: num('lights', 3),
    variant: (q.get('variant') as WorldVariant) ?? 'hero',
    motion: (q.get('motion') as WorldMotion) ?? 'full',
    live: q.get('live') !== '0',
    quality: qual === null || qual === 'auto' ? 'auto' : (Number(qual) as 0 | 1 | 2),
    data: (q.get('data') as LabData) ?? 'stub',
    lut: q.get('lut') === '1',
    progress: num('progress', 0.4),
    creature: q.get('creature') === '1',
    season: (q.get('season') as Season | null) ?? 'auto',
    evening: q.get('evening') === '1',
    lantern: num('lantern', -1),
    lanternWho: (q.get('who') as Who | null) ?? 'b',
    model: q.get('model') ?? 'kasuga-moss',
  };
}

const lightList = (n: number): WorldLight[] => Array.from({ length: n }, (_, i) => ({ id: `lab-${i}`, who: WHO[i % 4]! }));

declare global {
  interface Window {
    __lab?: {
      set: (p: Partial<LabSettings>) => void;
      pulse: (x?: number, y?: number, strong?: boolean) => void;
      focus: (progress: number | null, who?: Who) => void;
      guardian: () => void;
      kodama: (pose?: number) => void;
      stats: () => EngineStats | null;
    };
  }
}

export function LabApp() {
  const [s, setS] = useState<LabSettings>(readSettings);
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [extra, setExtra] = useState<WorldLight[]>([]);
  const ref = useRef<LivingForestHandle>(null);
  const showUi = new URLSearchParams(location.search).get('ui') !== '0';
  const set = (p: Partial<LabSettings>) => setS((cur) => ({ ...cur, ...p }));
  const manifest = useMemo(() => labManifest(s.data, s.lut), [s.data, s.lut]);

  const state: WorldState = useMemo(
    () => ({
      stage: s.stage,
      growthProgress: s.progress,
      mood: s.mood,
      paused: s.paused,
      season: s.season === 'auto' ? seasonOf(new Date()) : s.season,
      creatures: s.creature ? ['lab-creature'] : [],
      lights: [...lightList(s.lights), ...extra],
      lantern: { id: s.model },
    }),
    [s.stage, s.progress, s.mood, s.paused, s.lights, s.creature, s.season, extra, s.model],
  );

  const debug = () => ref.current as LivingForestDebugHandle | null;

  const pulse = (x?: number, y?: number, strong = false) => {
    const id = `pulse-${Date.now()}`;
    const who = WHO[Math.floor(Math.random() * 4)]!;
    setExtra((e) => [...e, { id, who }]);
    ref.current?.pulse({ id, who, strong, fromClientX: x ?? innerWidth * 0.3, fromClientY: y ?? innerHeight * 0.85 });
  };

  useEffect(() => {
    debug()?.setQuality(s.quality);
  }, [s.quality]);

  useEffect(() => {
    debug()?.setHour(s.evening ? 21 : null);
  }, [s.evening]);

  useEffect(() => {
    ref.current?.focus(s.lantern < 0 ? null : s.lantern, s.lanternWho);
  }, [s.lantern, s.lanternWho]);

  useEffect(() => {
    const focus = (progress: number | null, who?: Who) => set({ lantern: progress ?? -1, ...(who ? { lanternWho: who } : {}) });
    window.__lab = { set, pulse, focus, guardian: () => ref.current?.playGuardian(), kodama: (pose) => debug()?.lanternKodama(pose), stats: () => debug()?.stats() ?? null };
    const id = window.setInterval(() => setStats(debug()?.stats() ?? null), 500);
    return () => window.clearInterval(id);
  });

  const worldH = s.variant === 'backdrop' ? '100svh' : s.variant === 'banner' ? '24svh' : '54svh';
  const btn: CSSProperties = {
    font: '13px/1.2 system-ui', color: '#eae6da', background: '#1b2a22', border: '1px solid #33473b',
    borderRadius: 8, padding: '6px 9px', cursor: 'pointer',
  };
  const on = (active: boolean): CSSProperties => (active ? { ...btn, background: '#c8a45a', color: '#10170f', borderColor: '#c8a45a' } : btn);
  const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' };

  return (
    <div style={{ minHeight: '100svh', background: '#0b1410', color: '#eae6da', font: '14px system-ui' }}>
      <div style={{ position: 'fixed', inset: 0, height: worldH }}>
        <LivingForest
          ref={ref}
          state={state}
          variant={s.variant}
          live={s.live}
          motion={s.motion}
          manifest={manifest}
          className="lab-world"
        />
      </div>
      <div style={{ height: worldH }} />
      {s.variant !== 'backdrop' ? (
        <div style={{ position: 'relative', background: '#0e1813', borderRadius: '30px 30px 0 0', padding: '22px 20px', minHeight: '40svh' }}>
          <div style={{ font: '600 20px Georgia, serif' }}>Aujourd’hui</div>
          <p style={{ opacity: 0.7 }}>La forêt est {s.paused ? 'endormie' : MOOD_FR[s.mood]} ce matin.</p>
        </div>
      ) : null}
      {showUi ? (
        <div style={{ position: 'fixed', right: 8, bottom: 8, left: 8, maxWidth: 560, marginLeft: 'auto', background: 'rgba(10,16,13,0.92)', border: '1px solid #2a3a31', borderRadius: 14, padding: 10, display: 'grid', gap: 8, zIndex: 10 }}>
          <div style={{ ...row, justifyContent: 'space-between', font: '12px ui-monospace, monospace', opacity: 0.85 }}>
            <span>
              {stats ? `${stats.fps.toFixed(0)} fps · ${stats.frameMs.toFixed(1)} ms · cible ${stats.targetFps} · palier ${stats.tier} · dpr ${stats.dpr} · ${stats.memoryMB.toFixed(1)} Mo · ${stats.paint}${stats.fading ? ' (fondu)' : ''}` : 'chargement…'}
            </span>
          </div>
          <div style={row}>
            Stade
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} style={on(s.stage === n)} onClick={() => set({ stage: n })}>{n}</button>
            ))}
          </div>
          <div style={row}>
            {MOODS.map((m) => (
              <button key={m} style={on(s.mood === m && !s.paused)} onClick={() => set({ mood: m, paused: false })}>{MOOD_FR[m]}</button>
            ))}
            <button style={on(s.paused)} onClick={() => set({ paused: !s.paused })}>nuit</button>
          </div>
          <div style={row}>
            Lumières {s.lights + extra.length}
            <button style={btn} onClick={() => set({ lights: Math.max(0, s.lights - 1) })}>−</button>
            <button style={btn} onClick={() => set({ lights: s.lights + 1 })}>+</button>
            <button style={btn} onClick={(e) => pulse(e.clientX, e.clientY)}>pulse</button>
            <button style={btn} onClick={(e) => pulse(e.clientX, e.clientY, true)}>pulse fort</button>
            <button style={btn} onClick={() => setExtra((x) => x.slice(0, -1))}>annuler</button>
            <button style={btn} onClick={() => ref.current?.playGuardian()}>gardien</button>
            <button style={on(s.creature)} onClick={() => set({ creature: !s.creature })}>créature</button>
          </div>
          <div style={row}>
            {SEASONS.map((x) => (
              <button key={x} style={on(s.season === x)} onClick={() => set({ season: x })}>{SEASON_FR[x]}</button>
            ))}
            <button style={on(s.evening)} onClick={() => set({ evening: !s.evening })}>soir</button>
          </div>
          <div style={row}>
            <button style={on(s.lantern >= 0)} onClick={() => set({ lantern: s.lantern >= 0 ? -1 : 0 })}>lanterne</button>
            <input
              type="range" min={0} max={1} step={0.01} value={Math.max(0, s.lantern)} aria-label="Progression de la lanterne"
              onChange={(e) => set({ lantern: Number(e.target.value) })} style={{ flex: '1 1 120px' }}
            />
            <span style={{ font: '12px ui-monospace, monospace', minWidth: 36 }}>{s.lantern < 0 ? '—' : `${Math.round(s.lantern * 100)} %`}</span>
            <button style={btn} onClick={() => set({ lantern: 1 })}>floraison</button>
            {(['a', 'b', 'both'] as Who[]).map((w) => (
              <button key={w} style={on(s.lanternWho === w)} onClick={() => set({ lanternWho: w })}>{WHO_FR[w]}</button>
            ))}
          </div>
          <div style={row}>
            {MODELS.map((m) => (
              <button key={m} style={on(s.model === m)} onClick={() => set({ model: m })}>{m}</button>
            ))}
            <button style={btn} onClick={() => debug()?.lanternKodama(Math.floor(Math.random() * 4))}>kodama</button>
          </div>
          <div style={row}>
            {(['full', 'gentle', 'still'] as WorldMotion[]).map((m) => (
              <button key={m} style={on(s.motion === m)} onClick={() => set({ motion: m })}>{m}</button>
            ))}
            {(['hero', 'banner', 'backdrop'] as WorldVariant[]).map((v) => (
              <button key={v} style={on(s.variant === v)} onClick={() => set({ variant: v })}>{v}</button>
            ))}
            <button style={on(s.live)} onClick={() => set({ live: !s.live })}>live</button>
          </div>
          <div style={row}>
            Qualité
            {(['auto', 0, 1, 2] as QualitySetting[]).map((q) => (
              <button key={String(q)} style={on(s.quality === q)} onClick={() => set({ quality: q })}>{String(q)}</button>
            ))}
            Données
            {(['stub', 'labo'] as LabData[]).map((d) => (
              <button key={d} style={on(s.data === d)} onClick={() => set({ data: d })}>{d === 'stub' ? 'réel' : 'labo'}</button>
            ))}
            <button style={on(s.lut)} onClick={() => set({ lut: !s.lut })}>LUT test</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
