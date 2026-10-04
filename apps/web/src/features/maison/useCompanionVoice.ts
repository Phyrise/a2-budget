/**
 * Voix des compagnons : une seule bulle à la fois, éphémère (~2,8 s, un peu
 * plus pour une longue réplique), remplacée par la suivante. Ne vole jamais
 * le focus ; le texte est annoncé poliment (aria-live dans CompanionBubble).
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CompanionBubbleData } from '../../ui/CompanionBubble';
import { pickLine, type BubbleContext, type Speaker } from './companionLines';

const BASE_MS = 2800;
const PER_CHAR_MS = 32;
const MAX_MS = 4600;
const LEAVE_MS = 240;

export function bubbleDuration(text: string): number {
  return Math.min(MAX_MS, BASE_MS + Math.max(0, text.length - 50) * PER_CHAR_MS);
}

export function useCompanionVoice(names: { a: string; b: string }) {
  const [bubble, setBubble] = useState<CompanionBubbleData | null>(null);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);
  const namesRef = useRef(names);
  namesRef.current = names;

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  const say = useCallback((context: BubbleContext, speaker: Speaker, opts: { quiet?: boolean } = {}) => {
    const n = namesRef.current;
    const text = pickLine(speaker, context, { humain: n[speaker], autre: speaker === 'a' ? n.b : n.a });
    clearTimers();
    seq.current += 1;
    const key = seq.current;
    setBubble(opts.quiet === true ? { who: speaker, text, key, quiet: true } : { who: speaker, text, key });
    const duration = bubbleDuration(text);
    timers.current.push(
      window.setTimeout(() => setBubble((b) => (b?.key === key ? { ...b, leaving: true } : b)), duration),
      window.setTimeout(() => setBubble((b) => (b?.key === key ? null : b)), duration + LEAVE_MS),
    );
  }, []);

  const hush = useCallback(() => {
    clearTimers();
    setBubble(null);
  }, []);

  return { bubble, say, hush };
}

/**
 * Vrai tant que l'élément est entièrement visible sous l'en-tête fixe (sinon
 * la bulle posée à côté des compagnons passerait sous l'en-tête : on bascule
 * alors sur la bulle flottante).
 */
export function useInView(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (el === null || typeof IntersectionObserver === 'undefined') return;
    const header = Math.round(document.querySelector('.app-header')?.getBoundingClientRect().bottom ?? 72);
    const io = new IntersectionObserver(([entry]) => setInView(entry ? entry.intersectionRatio >= 0.98 : true), {
      threshold: [0, 0.98, 1],
      rootMargin: `-${Math.max(56, header + 6)}px 0px -96px 0px`,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

/** Alterne Jiji / Calcifer quand personne en particulier n'a agi. */
let alternate: Speaker = 'b';
export function speakerFor(who: string): Speaker {
  if (who === 'a' || who === 'b') return who;
  alternate = alternate === 'a' ? 'b' : 'a';
  return alternate;
}
