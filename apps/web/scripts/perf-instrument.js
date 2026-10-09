/**
 * Script injecté AVANT l'app par la sonde (perf-runtime.mjs) : compte sans
 * rien changer au comportement — boucles requestAnimationFrame (callbacks
 * distincts, images où l'app a dessiné), minuteurs, textures WebGL (taille
 * de base, mipmaps), appels de dessin. Lu par `window.__perf.take()`.
 * Option : `window.__perfHidden(true)` simule l'app en arrière-plan
 * (document.hidden + visibilitychange), comme un téléphone qui verrouille.
 */
(() => {
  const w = window;
  const raf = w.requestAnimationFrame.bind(w);
  const st = { rafCalls: 0, callbacks: new Set(), frames: new Set(), timeouts: 0, draws: 0 };
  const intervals = new Map();
  w.requestAnimationFrame = (cb) => {
    st.rafCalls += 1;
    st.callbacks.add(cb);
    return raf((t) => {
      st.frames.add(t);
      cb(t);
    });
  };
  const setI = w.setInterval.bind(w);
  const clearI = w.clearInterval.bind(w);
  w.setInterval = (fn, ms, ...rest) => {
    const id = setI(fn, ms, ...rest);
    intervals.set(id, Number(ms) || 0);
    return id;
  };
  w.clearInterval = (id) => {
    intervals.delete(id);
    clearI(id);
  };
  const setT = w.setTimeout.bind(w);
  w.setTimeout = (...a) => {
    st.timeouts += 1;
    return setT(...a);
  };

  // --- WebGL ---------------------------------------------------------------
  const textures = new Map(); // WebGLTexture -> { w, h, mip, bpp }
  const bound = new WeakMap(); // contexte -> { unit, units: Map<unit, tex> }
  const canvases = new Set();
  const half = new Set([0x881a, 0x8d61, 0x822f, 0x8230]); // RGBA16F, HALF_FLOAT_OES, RG16F, RG32F (≈ 8 o)
  const patch = (proto) => {
    if (!proto) return;
    const orig = {};
    for (const k of ['createTexture', 'deleteTexture', 'bindTexture', 'activeTexture', 'texImage2D', 'texStorage2D', 'generateMipmap', 'drawArrays', 'drawElements', 'compressedTexImage2D']) orig[k] = proto[k];
    const cur = (gl) => {
      let b = bound.get(gl);
      if (!b) bound.set(gl, (b = { unit: 0, units: new Map() }));
      return b;
    };
    proto.createTexture = function () {
      const t = orig.createTexture.call(this);
      textures.set(t, { w: 0, h: 0, mip: false, bpp: 4 });
      canvases.add(this.canvas);
      return t;
    };
    proto.deleteTexture = function (t) {
      textures.delete(t);
      return orig.deleteTexture.call(this, t);
    };
    proto.activeTexture = function (u) {
      cur(this).unit = u;
      return orig.activeTexture.call(this, u);
    };
    proto.bindTexture = function (target, t) {
      if (target === this.TEXTURE_2D) cur(this).units.set(cur(this).unit, t);
      return orig.bindTexture.call(this, target, t);
    };
    const record = (gl, level, wd, ht, type) => {
      const t = cur(gl).units.get(cur(gl).unit);
      const info = t && textures.get(t);
      if (!info || level !== 0) return;
      info.w = wd;
      info.h = ht;
      info.bpp = half.has(type) ? 8 : 4;
    };
    proto.texImage2D = function (...a) {
      if (a[0] === this.TEXTURE_2D) {
        if (a.length >= 8) record(this, a[1], a[3], a[4], a[7]);
        else {
          const src = a[5];
          record(this, a[1], src?.naturalWidth || src?.videoWidth || src?.displayWidth || src?.width || 0, src?.naturalHeight || src?.videoHeight || src?.displayHeight || src?.height || 0, a[4]);
        }
      }
      return orig.texImage2D.apply(this, a);
    };
    proto.compressedTexImage2D = function (...a) {
      if (a[0] === this.TEXTURE_2D) record(this, a[1], a[3], a[4], 0);
      return orig.compressedTexImage2D.apply(this, a);
    };
    if (orig.texStorage2D) {
      proto.texStorage2D = function (target, levels, fmt, wd, ht) {
        if (target === this.TEXTURE_2D) record(this, 0, wd, ht, fmt);
        const t = cur(this).units.get(cur(this).unit);
        if (levels > 1 && textures.get(t)) textures.get(t).mip = true;
        return orig.texStorage2D.call(this, target, levels, fmt, wd, ht);
      };
    }
    proto.generateMipmap = function (target) {
      const t = cur(this).units.get(cur(this).unit);
      if (textures.get(t)) textures.get(t).mip = true;
      return orig.generateMipmap.call(this, target);
    };
    proto.drawArrays = function (...a) {
      st.draws += 1;
      return orig.drawArrays.apply(this, a);
    };
    proto.drawElements = function (...a) {
      st.draws += 1;
      return orig.drawElements.apply(this, a);
    };
  };
  patch(w.WebGLRenderingContext?.prototype);
  patch(w.WebGL2RenderingContext?.prototype);

  let hidden = false;
  const docProto = Document.prototype;
  const realHidden = Object.getOwnPropertyDescriptor(docProto, 'hidden');
  const realState = Object.getOwnPropertyDescriptor(docProto, 'visibilityState');
  Object.defineProperty(docProto, 'hidden', { configurable: true, get() { return hidden || realHidden.get.call(this); } });
  Object.defineProperty(docProto, 'visibilityState', { configurable: true, get() { return hidden ? 'hidden' : realState.get.call(this); } });
  w.__perfHidden = (value) => {
    hidden = value;
    document.dispatchEvent(new Event('visibilitychange'));
  };

  w.__perf = {
    take() {
      const tex = [...textures.values()].filter((t) => t.w > 0);
      const gpu = tex.reduce((s, t) => s + t.w * t.h * t.bpp * (t.mip ? 4 / 3 : 1), 0);
      const live = [...canvases].filter((c) => c && c.isConnected);
      const anims = document.getAnimations().filter((a) => a.playState === 'running' && !a.effect?.target?.closest?.('[hidden]'));
      const names = {};
      for (const a of anims) {
        const el = a.effect?.target;
        const k = `${a.animationName ?? a.constructor.name}@${(el?.className?.baseVal ?? el?.className ?? el?.tagName ?? '').toString().split(' ')[0]}`;
        names[k] = (names[k] ?? 0) + 1;
      }
      const out = {
        animations: anims.length,
        animationNames: Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k}×${n}`),
        rafCalls: st.rafCalls,
        rafCallbacks: st.callbacks.size,
        frames: st.frames.size,
        timeouts: st.timeouts,
        intervals: [...intervals.values()].sort((a, b) => a - b),
        draws: st.draws,
        textures: tex.length,
        textureBytes: Math.round(gpu),
        biggestTextures: tex.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 4).map((t) => `${t.w}×${t.h}${t.mip ? '+mip' : ''}`),
        canvases: live.map((c) => `${c.width}×${c.height}`),
        canvasBytes: live.reduce((s, c) => s + c.width * c.height * 4 * 3, 0), // couleur ×2 (double tampon) + profondeur
      };
      st.rafCalls = 0;
      st.callbacks = new Set();
      st.frames = new Set();
      st.timeouts = 0;
      st.draws = 0;
      return out;
    },
  };
})();
