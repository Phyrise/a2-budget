/** Harnais du QA coquille V4 (sons) : store réel + useSoundEvents, en StrictMode. */
export const harnessHtml = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>QA coquille V4</title></head>
<body style="background:#101814;padding:16px"><div id="root"></div><script type="module" src="./harness.tsx"></script></body></html>\n`;

export const harnessTsx = `import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import * as core from '@a2/core';
import { AppProvider, useApp } from '../../src/state/store';
import { useSoundEvents, soundEngine } from '../../src/app/sound';
import { buildBus } from '../../src/app/sound/engine';
import { renderCue } from '../../src/app/sound/voices';
import { lantern } from '../../src/features/rituals/lantern/lanternStore';

const w = window as unknown as Record<string, unknown>;
w.__core = core;
w.__sound = soundEngine;
w.__lantern = lantern;
const records: unknown[] = [];
w.__records = records;
soundEngine.subscribe((r) => records.push(r));
w.__measure = async (cue: string, gentle: boolean) => {
  const rate = 44100;
  const ctx = new OfflineAudioContext(2, rate * 4, rate);
  const bus = buildBus(ctx, ctx.destination);
  renderCue(bus, cue as never, 0.01, { gentle });
  const buf = await ctx.startRendering();
  let peak = 0, end = 0, nan = false;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]!);
      if (Number.isNaN(v)) nan = true;
      if (v > peak) peak = v;
      if (v > 0.003) end = Math.max(end, i / rate);
    }
  }
  return { peak, end, nan };
};
function Shell() {
  const ctx = useApp();
  useSoundEvents();
  useEffect(() => { w.__app = ctx; }, [ctx]);
  return <pre style={{ color: '#eee' }}>{ctx.appState ? 'prêt' : 'chargement'}</pre>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><AppProvider><Shell /></AppProvider></StrictMode>);
`;
