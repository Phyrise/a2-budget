/**
 * Aperçu dev (hors production) : rend les 4 états de vitalité de la forêt +
 * l'événement rare du gardien, pour la QA visuelle. N'est PAS inclus dans le
 * build de production (entrée séparée, config Vite dédiée).
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ForestState } from '@a2/core';
import { emptyForest } from '@a2/core';
import { ForestScene } from './modules/chores/ForestScene';
import './styles/tokens.css';
import './modules/chores/chores.css';

function makeForest(overrides: Partial<ForestState>): ForestState {
  return { ...emptyForest(), ...overrides };
}

const SCENES: { label: string; forest: ForestState }[] = [
  {
    label: '1 · Quiet (apaisée)',
    forest: makeForest({ vitality: 8, growthStage: 1, unlockedCreatureIds: [] }),
  },
  {
    label: '2 · Peaceful (paisible)',
    forest: makeForest({
      vitality: 35,
      growthStage: 1,
      unlockedCreatureIds: ['moss-ling'],
    }),
  },
  {
    label: '3 · Lively (vivante)',
    forest: makeForest({
      vitality: 62,
      growthStage: 2,
      unlockedCreatureIds: ['moss-ling', 'seed-spirit'],
    }),
  },
  {
    label: '4 · Flourishing (en floraison)',
    forest: makeForest({
      vitality: 92,
      growthStage: 4,
      unlockedCreatureIds: ['moss-ling', 'seed-spirit', 'leaf-sprite'],
    }),
  },
  {
    label: '5 · Événement rare — le Gardien',
    forest: makeForest({
      vitality: 70,
      growthStage: 3,
      unlockedCreatureIds: ['moss-ling', 'seed-spirit'],
      lastRareEvent: 'guardian',
    }),
  },
];

function Preview() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1 style={{ font: '500 26px Georgia, serif', margin: '0 0 4px' }}>
        A² Home — Forêt (aperçu dev)
      </h1>
      <p style={{ color: '#59684f', margin: '0 0 20px', fontSize: 14 }}>
        Les 4 états de vitalité doivent être distincts sans nombre affiché ; le
        gardien est un événement rare et exceptionnel.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 18,
        }}
      >
        {SCENES.map((scene) => (
          <figure key={scene.label} style={{ margin: 0 }}>
            <ForestScene forest={scene.forest} />
            <figcaption style={{ marginTop: 8, fontSize: 14, color: '#263e30' }}>
              {scene.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Racine #root introuvable');
}
createRoot(rootElement).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
