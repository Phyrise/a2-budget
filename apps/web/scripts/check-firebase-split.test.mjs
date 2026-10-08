/** Le contrôle « Firebase à part » sur de petits builds factices. */
import { describe, expect, it } from 'vitest';
import { QA_MARKER, checkBuild, chunkImports, entryScripts } from './check-firebase-split.mjs';

const HTML = '<!doctype html><script type="module" crossorigin src="/a2-budget/assets/index-A.js"></script>';
const SDK = 'fetch("https://identitytoolkit.googleapis.com/v1")';

describe('check-firebase-split', () => {
  it('lit les imports d’un chunk minifié et l’entrée de index.html', () => {
    expect(chunkImports('import{a as b}from"./x-1.js";import"./y-2.js";const s=()=>import("./session-3.js")')).toEqual({
      statics: ['./x-1.js', './y-2.js'],
      dynamics: ['./session-3.js'],
    });
    expect(entryScripts(HTML)).toEqual(['assets/index-A.js']);
  });

  it('sans configuration : aucun Firebase, c’est conforme', () => {
    expect(checkBuild({ 'index.html': HTML, 'assets/index-A.js': 'import"./ui-B.js"', 'assets/ui-B.js': '' })).toEqual([]);
  });

  it('Firebase derrière un import dynamique : conforme ; atteint au démarrage : refusé', () => {
    const split = {
      'index.html': HTML,
      'assets/index-A.js': 'const s=()=>import("./session-C.js")',
      'assets/session-C.js': `import{a}from"./index-A.js";${SDK}`,
    };
    expect(checkBuild(split)).toEqual([]);
    const eager = { ...split, 'assets/index-A.js': 'import"./vendor-D.js"', 'assets/vendor-D.js': SDK };
    expect(checkBuild(eager)).toEqual(['assets/vendor-D.js : Firebase chargé au démarrage']);
  });

  it('porte de QA : seulement dans le build émulateurs, qui doit avoir son chunk', () => {
    const qa = {
      'index.html': HTML,
      'assets/index-A.js': `window.${QA_MARKER}={};const s=()=>import("./session-C.js")`,
      'assets/session-C.js': SDK,
    };
    expect(checkBuild(qa, { emulators: true })).toEqual([]);
    expect(checkBuild(qa)).toEqual(['porte de QA hors build émulateurs : assets/index-A.js']);
    expect(checkBuild({ 'index.html': HTML, 'assets/index-A.js': '' }, { emulators: true })).toEqual([
      'build émulateurs sans chunk Firebase',
    ]);
  });
});
