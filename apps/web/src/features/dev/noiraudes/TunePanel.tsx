/**
 * Labo Noiraudes — panneau « Réglages » : un curseur par paramètre important
 * de l'apparence (`SootSpriteParams`), par onglets (Corps, Poils, Yeux,
 * Membres, Anim., Scène) ; chaque geste redessine aussitôt toutes les
 * Noiraudes du Labo. En bas : copier l'objet TypeScript (presse-papiers, ou
 * texte à sélectionner), coller un objet, réinitialiser, mémoires A / B / C.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SOOT_PRESETS, cloneParams, formatParams, parseParams } from '../../../creatures/susuwatari';
import { LabRange } from './LabRange';
import { SPECS, TABS, digitsOf, readParam, writeParam } from './paramSpecs';
import { SLOTS, type Tuning } from './useTuning';
import './tunePanel.css';

type TextSheet = { mode: 'copy'; text: string; copied: boolean } | { mode: 'paste'; text: string; error: string };

const PRESETS = [
  { id: 'vise', label: 'Visé (défaut)' },
  { id: 'porcEpic', label: 'Porc-épic' },
  { id: 'ronces', label: 'Ronces' },
] as const;

export function TunePanel({ tuning, scene }: { tuning: Tuning; scene: ReactNode }) {
  const { params, setParams, tab, setTab, slots } = tuning;
  const [sheet, setSheet] = useState<TextSheet | null>(null);
  const [status, setStatus] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(''), 2600);
    return () => window.clearTimeout(id);
  }, [status]);

  // Texte copié : sélectionné d'office (prêt pour « Copier » du système si le presse-papiers a refusé).
  useEffect(() => {
    const area = textRef.current;
    if (!area || !sheet) return;
    area.focus({ preventScroll: true });
    if (sheet.mode === 'copy') area.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.mode]);

  const copy = async () => {
    const text = formatParams(params);
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
    setSheet({ mode: 'copy', text, copied });
  };

  // « Coller » : la zone de texte s'ouvre ; si le système le permet (bulle
  // « Coller » de l'iPhone), le presse-papiers la remplit d'office.
  const startPaste = () => {
    setSheet({ mode: 'paste', text: '', error: '' });
    navigator.clipboard
      ?.readText()
      .then((text) => setSheet((s) => (s?.mode === 'paste' && s.text === '' && text.includes('{') ? { ...s, text } : s)))
      .catch(() => undefined);
  };

  const applyPaste = () => {
    if (sheet?.mode !== 'paste') return;
    const next = parseParams(sheet.text, params);
    if (!next) {
      setSheet({ ...sheet, error: 'Aucun objet de paramètres reconnu dans ce texte.' });
      return;
    }
    setParams(next);
    setSheet(null);
    setStatus('Paramètres importés');
  };

  return (
    <section id="nlab-tune" className="nlab-tune" aria-label="Réglages de l’apparence">
      <div className="nlab-tune__card">
        <div className="nlab-tune__tabs" role="tablist" aria-label="Groupes de réglages">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`nlab-tab-${t.id}`}
              className="nlab-tune__tab"
              aria-selected={tab === t.id}
              aria-controls="nlab-tune-list"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div id="nlab-tune-list" className="nlab-tune__list" role="tabpanel" aria-labelledby={`nlab-tab-${tab}`}>
          {tab === 'scene' ? (
            <>
              <div className="nlab-tune__scene">{scene}</div>
              <div className="nlab-tune__presets" role="group" aria-label="Modèles">
                <span className="nlab-tune__presets-title">Modèles</span>
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="nlab-btn nlab-btn--chip"
                    onClick={() => {
                      setParams(cloneParams(SOOT_PRESETS[p.id]));
                      setStatus(`Modèle « ${p.label} »`);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            SPECS[tab].map((s) => (
              <LabRange
                key={`${s.group}.${s.key}`}
                label={s.label}
                value={readParam(params, s)}
                min={s.min}
                max={s.max}
                step={s.step}
                digits={digitsOf(s.step)}
                unit={s.unit}
                onChange={(v) => setParams(writeParam(params, s, v))}
              />
            ))
          )}
        </div>

        <div className="nlab-tune__actions">
          <div className="nlab-tune__row">
            <button type="button" className="nlab-btn nlab-btn--main" onClick={() => void copy()}>
              Copier les paramètres
            </button>
            <button type="button" className="nlab-btn" onClick={startPaste}>
              Coller
            </button>
            <button
              type="button"
              className="nlab-btn"
              onClick={() => {
                tuning.reset();
                setStatus('Réinitialisé : modèle visé');
              }}
            >
              Réinitialiser
            </button>
          </div>
          <div className="nlab-tune__slots">
            {SLOTS.map((slot) => (
              <div key={slot} className="nlab-slot">
                <button
                  type="button"
                  className="nlab-slot__recall"
                  aria-label={`Rappeler ${slot}`}
                  disabled={!slots[slot]}
                  data-filled={slots[slot] ? 'true' : undefined}
                  onClick={() => {
                    tuning.recall(slot);
                    setStatus(`${slot} rappelé`);
                  }}
                >
                  {slot}
                </button>
                <button
                  type="button"
                  className="nlab-slot__save"
                  aria-label={`Mémoriser ${slot}`}
                  onClick={() => {
                    tuning.remember(slot);
                    setStatus(`Réglages mémorisés dans ${slot}`);
                  }}
                >
                  Mémoriser
                </button>
              </div>
            ))}
          </div>
          <p className="nlab-tune__status" role="status">
            {status}
          </p>
        </div>

        {sheet && (
          <div className="nlab-tune__sheet" role="dialog" aria-label={sheet.mode === 'copy' ? 'Paramètres copiés' : 'Coller des paramètres'}>
            <p className="nlab-tune__sheet-title">
              {sheet.mode === 'copy'
                ? sheet.copied
                  ? 'Copié dans le presse-papiers. Le voici aussi :'
                  : 'Copie automatique impossible : le texte est sélectionné, copie-le.'
                : 'Colle ici un objet de paramètres (TypeScript ou JSON) :'}
            </p>
            <textarea
              ref={textRef}
              className="nlab-tune__text"
              aria-label={sheet.mode === 'copy' ? 'Paramètres en TypeScript' : 'Paramètres à importer'}
              value={sheet.text}
              readOnly={sheet.mode === 'copy'}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              onFocus={(e) => sheet.mode === 'copy' && e.currentTarget.select()}
              onChange={(e) => sheet.mode === 'paste' && setSheet({ ...sheet, text: e.target.value, error: '' })}
            />
            {sheet.mode === 'paste' && sheet.error && (
              <p className="nlab-tune__error" role="alert">
                {sheet.error}
              </p>
            )}
            <div className="nlab-tune__row nlab-tune__row--end">
              {sheet.mode === 'paste' && (
                <button type="button" className="nlab-btn nlab-btn--main" onClick={applyPaste}>
                  Appliquer
                </button>
              )}
              <button type="button" className="nlab-btn" onClick={() => setSheet(null)}>
                {sheet.mode === 'copy' ? 'Fermer' : 'Annuler'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
