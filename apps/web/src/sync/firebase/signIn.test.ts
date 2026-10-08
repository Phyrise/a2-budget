import { describe, expect, it } from 'vitest';
import { isIos, redirectWorks, signInMethod, type PlatformHints } from './platform';
import { errorCode, outcomeForAuthError } from './types';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';

function hints(userAgent: string, standalone: boolean, extra: Partial<PlatformHints> = {}): PlatformHints {
  return { userAgent, platform: '', maxTouchPoints: 0, standalone, ...extra };
}

describe('méthode de connexion Google', () => {
  it('fenêtre partout, sauf dans l’app installée sur iPhone / iPad', () => {
    expect(signInMethod(hints(IPHONE, false))).toBe('popup');
    expect(signInMethod(hints(IPHONE, true))).toBe('redirect');
    expect(signInMethod(hints(ANDROID, true))).toBe('popup');
    expect(signInMethod(hints(ANDROID, false))).toBe('popup');
    expect(signInMethod(hints(IPAD_AS_MAC, true, { platform: 'MacIntel', maxTouchPoints: 5 }))).toBe('redirect');
    expect(signInMethod(hints(IPAD_AS_MAC, true, { platform: 'MacIntel', maxTouchPoints: 0 }))).toBe('popup');
  });

  it('reconnaît iOS (iPadOS se présente comme un Mac tactile)', () => {
    expect(isIos(hints(IPHONE, false))).toBe(true);
    expect(isIos(hints(IPAD_AS_MAC, false, { platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true);
    expect(isIos(hints(ANDROID, false))).toBe(false);
  });

  it('la redirection n’aboutit qu’avec la page de connexion sur le site lui-même', () => {
    expect(redirectWorks('phyrise.github.io', 'phyrise.github.io')).toBe(true);
    expect(redirectWorks('Phyrise.GitHub.io', 'phyrise.github.io')).toBe(true);
    expect(redirectWorks('a2-home-7f3c1.firebaseapp.com', 'phyrise.github.io')).toBe(false);
  });
});

describe('erreurs de connexion → mot doux', () => {
  it('fenêtre fermée : rien à dire ; bloquée, hors ligne, autre : un mot', () => {
    expect(outcomeForAuthError('auth/popup-closed-by-user')).toEqual({ kind: 'cancelled' });
    expect(outcomeForAuthError('auth/cancelled-popup-request')).toEqual({ kind: 'cancelled' });
    expect(outcomeForAuthError('auth/popup-blocked')).toEqual({ kind: 'failed', notice: 'popup-blocked' });
    expect(outcomeForAuthError('auth/network-request-failed')).toEqual({ kind: 'failed', notice: 'offline' });
    expect(outcomeForAuthError('auth/unauthorized-domain')).toEqual({ kind: 'failed', notice: 'failed' });
    expect(outcomeForAuthError(undefined)).toEqual({ kind: 'failed', notice: 'failed' });
  });

  it('code d’une erreur quelconque', () => {
    expect(errorCode({ code: 'auth/popup-blocked' })).toBe('auth/popup-blocked');
    expect(errorCode(new Error('x'))).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
  });
});
