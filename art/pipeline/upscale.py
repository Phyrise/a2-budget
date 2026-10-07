"""Agrandissement des peintures livrées (stades de base et de saison) :
1024×1536 (natif des sources) → 1536×2304, même cadrage (facteur 1,5 exact).

Real-ESRGAN « realesr-general-x4v3 » (×4, réseau compact, ≈ 12 s par image sur
16 cœurs CPU, via spandrel), ramené à 1536×2304 par Lanczos, puis mélangé à
parts égales (AI_SHARE) avec un Lanczos direct de la source. Seul, le modèle
aplatit les touches fines (feuillage lointain, écorce) en aplats « plastiques » ;
le mélange garde la texture peinte avec des bords plus nets. Comparé sur
gros plans simulant un téléphone (cèdre, fougères, canopée) à RealESRGAN_x2plus
(trop lisse), x4plus (invente des traits, 15× plus lent) et Lanczos + masque
flou (bruit de la source amplifié).

Résultats en cache, PNG sans perte : <work>/upscaled/<nom>.png (recalculé si
la source est plus récente). Poids du modèle : téléchargé une fois depuis les
releases officielles xinntao/Real-ESRGAN dans $A2ART_MODELS (défaut
~/a2art/models), empreinte SHA-256 vérifiée.
Dépendances (env ~/a2art/env) : torch CPU, spandrel (pip install spandrel).
"""
from __future__ import annotations

import hashlib
import os
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

# Taille livrée des peintures (le cadrage de référence reste 1024×1536, common.W/H).
PW, PH = 1536, 2304
AI_SHARE = 0.5
MODEL_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth"
MODEL_SHA256 = "8dc7edb9ac80ccdc30c3a5dca6616509367f05fbc184ad95b731f05bece96292"
MODEL = Path(os.environ.get("A2ART_MODELS", Path.home() / "a2art" / "models")) / "realesr-general-x4v3.pth"
TILE, PAD = 512, 32

_net = None


def _sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def net():
    global _net
    if _net is None:
        import torch
        from spandrel import ModelLoader

        if not MODEL.exists():
            MODEL.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(MODEL_URL, MODEL)
        if _sha256(MODEL) != MODEL_SHA256:
            raise SystemExit(f"empreinte inattendue : {MODEL}")
        torch.set_num_threads(int(os.environ.get("OMP_NUM_THREADS", "16")))
        _net = ModelLoader().load_from_file(str(MODEL)).eval()
    return _net


def ai_upscale(im: Image.Image) -> Image.Image:
    """Inférence par tuiles (marge PAD, raccords invisibles), sortie ×4."""
    import torch

    m = net()
    s = m.scale
    a = torch.from_numpy(np.asarray(im.convert("RGB"), dtype=np.float32) / 255).permute(2, 0, 1)[None]
    _, _, h, w = a.shape
    out = torch.zeros(1, 3, h * s, w * s)
    with torch.inference_mode():
        for y in range(0, h, TILE):
            for x in range(0, w, TILE):
                x0, y0, x1, y1 = max(0, x - PAD), max(0, y - PAD), min(w, x + TILE + PAD), min(h, y + TILE + PAD)
                r = m(a[:, :, y0:y1, x0:x1])
                tw, th = (min(w, x + TILE) - x) * s, (min(h, y + TILE) - y) * s
                cx, cy = (x - x0) * s, (y - y0) * s
                out[:, :, y * s:y * s + th, x * s:x * s + tw] = r[:, :, cy:cy + th, cx:cx + tw]
    u8 = (out[0].permute(1, 2, 0).clamp(0, 1).numpy() * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(u8)


def upscale(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    lanczos = im.resize((PW, PH), Image.LANCZOS)
    ai = ai_upscale(im).resize((PW, PH), Image.LANCZOS)
    return Image.blend(lanczos, ai, AI_SHARE)


def cached(src: Path, dst: Path) -> Image.Image:
    """Peinture agrandie (cache PNG à côté du travail)."""
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return Image.open(dst).convert("RGB")
    im = upscale(Image.open(src))
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst)
    print(f"agrandi {src.name} → {im.width}×{im.height}", flush=True)
    return im


if __name__ == "__main__":
    # Pré-calcul (arrière-plan) : python upscale.py <source.png> <dossier de sortie> […]
    import sys

    *srcs, dst_dir = sys.argv[1:]
    for p in map(Path, srcs):
        cached(p, Path(dst_dir) / p.name)
