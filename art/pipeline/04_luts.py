"""LUT 3D 33³ par humeur (quiet, peaceful, lively, flourishing) et pour la nuit.

Source : peinture maîtresse (stade 6). Cibles : 03-vitality-*, 04-pause-night,
recalées sur la source par 01_align.py (out/work/aligned).

Méthode — régression couleur par paires de pixels :
  1. source et cible réduites (256×384, INTER_AREA) puis légèrement floutées
     (σ = 0,8) : ~98 000 paires (couleur source → couleur cible) ;
  2. chaque paire contribue aux 8 nœuds de la LUT qui entourent la couleur
     source (poids trilinéaires) : système creux A·x ≈ y ;
  3. régularisation : lissage d'ordre 2 dans l'espace LUT (‖L·x‖², L = laplacien
     3D) et rappel faible vers un repli affine global (tgt ≈ M·[r g b 1]) —
     les cases vides (couleurs absentes de la peinture) sont ainsi remplies
     de façon lisse, sans bande ni couleur aberrante ;
  4. moindres carrés repondérés (Huber, 3 itérations) : les détails propres à
     la cible (rayons, lucioles, lune) ne faussent pas la correspondance globale.

Format de sortie (PNG RGB 8 bits, 1089×33) : le pixel (x = r + 33·b, y = g)
contient la couleur de sortie pour l'entrée (r, g, b)/32, avec r, g, b ∈ 0..32.

Sorties : out/assets/luts/<nom>.png, out/work/luts.json (écarts),
          planches out/qa/04-*.
"""
from __future__ import annotations

import time

import cv2
import numpy as np
import scipy.sparse as sp
from PIL import Image
from scipy.sparse.linalg import splu

from common import ASSETS, LUT_TARGETS, QA, STAGE_SOURCES, WORK, grid, label, load_aligned, write_json

N = 33
K = N**3
OUTD = ASSETS / "luts"
OUTD.mkdir(parents=True, exist_ok=True)


def idx(r, g, b):
    return r + N * (g + N * b)


def trilinear_matrix(c: np.ndarray) -> sp.csr_matrix:
    """Matrice (n × K) des poids trilinéaires des couleurs c (n×3, 0..1)."""
    p = np.clip(c, 0, 1) * (N - 1)
    i0 = np.minimum(np.floor(p).astype(np.int64), N - 2)
    f = p - i0
    rows, cols, vals = [], [], []
    n = len(c)
    ar = np.arange(n)
    for dr in (0, 1):
        wr = f[:, 0] if dr else 1 - f[:, 0]
        for dg in (0, 1):
            wg = f[:, 1] if dg else 1 - f[:, 1]
            for db in (0, 1):
                wb = f[:, 2] if db else 1 - f[:, 2]
                rows.append(ar)
                cols.append(idx(i0[:, 0] + dr, i0[:, 1] + dg, i0[:, 2] + db))
                vals.append(wr * wg * wb)
    return sp.csr_matrix((np.concatenate(vals), (np.concatenate(rows), np.concatenate(cols))), shape=(n, K))


def laplacian() -> sp.csr_matrix:
    """Laplacien 3D (7 points, bords de Neumann) sur la grille 33³."""
    one = np.ones(N)
    d = sp.diags([one[:-1], -2 * one, one[:-1]], [-1, 0, 1], format="lil")
    d[0, 0] = -1
    d[N - 1, N - 1] = -1
    d = d.tocsr()
    I = sp.identity(N, format="csr")
    return (sp.kron(I, sp.kron(I, d)) + sp.kron(I, sp.kron(d, I)) + sp.kron(d, sp.kron(I, I))).tocsr()


def grid_colors() -> np.ndarray:
    v = np.linspace(0, 1, N)
    b, g, r = np.meshgrid(v, v, v, indexing="ij")
    return np.stack([r.ravel(), g.ravel(), b.ravel()], 1)  # ordre = idx(r, g, b)


def apply_lut(img: np.ndarray, lut: np.ndarray) -> np.ndarray:
    """Applique une LUT (K×3, ordre idx) à une image float (H×W×3) en trilinéaire."""
    h, w = img.shape[:2]
    A = trilinear_matrix(img.reshape(-1, 3))
    return (A @ lut).reshape(h, w, 3)


def fit(src: np.ndarray, tgt: np.ndarray, lam_rel=0.08, mu_rel=2e-3, delta=0.035, iters=4):
    x = src.reshape(-1, 3).astype(np.float64)
    y = tgt.reshape(-1, 3).astype(np.float64)
    A = trilinear_matrix(x)
    L = laplacian()
    LtL = (L.T @ L).tocsr()
    X1 = np.concatenate([x, np.ones((len(x), 1))], 1)
    G = grid_colors()
    G1 = np.concatenate([G, np.ones((K, 1))], 1)
    w = np.ones(len(x))
    lut = None
    for it in range(iters):
        # Repli affine global (pondéré).
        Mw = X1 * w[:, None]
        M = np.linalg.lstsq(Mw.T @ X1, Mw.T @ y, rcond=None)[0]
        aff = np.clip(G1 @ M, 0, 1)
        W = sp.diags(w)
        AtA = (A.T @ W @ A).tocsr()
        diag = AtA.diagonal()
        scale = float(diag[diag > 0].mean())
        lam, mu = lam_rel * scale, mu_rel * scale
        S = (AtA + lam * LtL + mu * sp.identity(K)).tocsc()
        solve = splu(S)
        rhs = A.T @ (w[:, None] * y) + mu * aff
        lut = np.stack([solve.solve(rhs[:, c]) for c in range(3)], 1)
        res = np.linalg.norm(A @ lut - y, axis=1)
        w = 1.0 / np.maximum(1.0, res / delta)  # Huber
        print(f"    it{it}: résidu médian {np.median(res):.4f}, p90 {np.percentile(res, 90):.4f}, λ={lam:.2f}")
    return np.clip(lut, 0, 1), M


def lut_to_png(lut: np.ndarray) -> np.ndarray:
    """K×3 (ordre idx) → image 33×1089 : pixel (x = r + 33·b, y = g)."""
    cube = lut.reshape(N, N, N, 3)  # [b, g, r]
    out = np.zeros((N, N * N, 3), np.float64)
    for b in range(N):
        out[:, b * N : (b + 1) * N] = cube[b]  # [g, r]
    return np.clip(np.round(out * 255), 0, 255).astype(np.uint8)


def png_to_lut(img: np.ndarray) -> np.ndarray:
    cube = np.zeros((N, N, N, 3), np.float64)
    for b in range(N):
        cube[b] = img[:, b * N : (b + 1) * N] / 255.0
    return cube.reshape(K, 3)


def test_ramp() -> np.ndarray:
    """Image d'essai : teintes × luminosités, + désaturé (détection de bandes)."""
    h, w = 192, 512
    hue = np.linspace(0, 179, w, dtype=np.float32)
    val = np.linspace(0, 255, h // 2, dtype=np.float32)
    H, V = np.meshgrid(hue, val)
    sat = np.full_like(H, 150)
    hsv = np.stack([H, sat, V], 2).astype(np.uint8)
    top = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB).astype(np.float32) / 255
    sat2 = np.full_like(H, 60)
    bot = cv2.cvtColor(np.stack([H, sat2, V], 2).astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32) / 255
    return np.concatenate([top, bot], 0)


def main() -> None:
    t0 = time.time()
    master = load_aligned(STAGE_SOURCES[6])
    small_src = cv2.GaussianBlur(cv2.resize(master, (256, 384), interpolation=cv2.INTER_AREA), (0, 0), 0.8)
    report = {}
    rows = []
    ramps = [label(Image.fromarray((test_ramp() * 255).astype(np.uint8)), "rampe d'essai (identité)")]
    view = cv2.resize(master, (240, 360), interpolation=cv2.INTER_AREA)
    for name, target in LUT_TARGETS.items():
        print(name, "←", target)
        tgt = load_aligned(target)
        small_tgt = cv2.GaussianBlur(cv2.resize(tgt, (256, 384), interpolation=cv2.INTER_AREA), (0, 0), 0.8)
        lut, M = fit(small_src, small_tgt)
        png = lut_to_png(lut)
        Image.fromarray(png).save(OUTD / f"{name}.png", optimize=True)
        lut_q = png_to_lut(png)  # ce que le moteur lira (quantifié 8 bits)
        # Contrôle pleine résolution réduite (512×768).
        src_m = cv2.resize(master, (512, 768), interpolation=cv2.INTER_AREA)
        tgt_m = cv2.resize(tgt, (512, 768), interpolation=cv2.INTER_AREA)
        out_m = apply_lut(src_m, lut_q)
        blur = lambda a: cv2.GaussianBlur(a, (0, 0), 2)  # noqa: E731
        e_lut = np.abs(blur(out_m) - blur(tgt_m)).mean()
        e_id = np.abs(blur(src_m) - blur(tgt_m)).mean()
        # Lissage de la LUT : saut max entre nœuds voisins (bandes / ruptures).
        cube = lut_q.reshape(N, N, N, 3)
        jumps = max(float(np.abs(np.diff(cube, axis=a)).max()) for a in range(3))
        report[name] = {
            "target": target,
            "mae_identity": round(float(e_id), 4),
            "mae_lut": round(float(e_lut), 4),
            "max_node_step": round(jumps, 4),
            "affine": np.round(M, 4).tolist(),
            "bytes": (OUTD / f"{name}.png").stat().st_size,
        }
        print("   ", {k: v for k, v in report[name].items() if k != "affine"})
        diff = np.clip(np.abs(out_m - tgt_m) * 3, 0, 1)
        tiles = [
            label(Image.fromarray((view * 255).astype(np.uint8)), "master"),
            label(Image.fromarray((cv2.resize(out_m, (240, 360)) * 255).astype(np.uint8)), f"LUT {name}"),
            label(Image.fromarray((cv2.resize(tgt_m, (240, 360)) * 255).astype(np.uint8)), "cible"),
            label(Image.fromarray((cv2.resize(diff, (240, 360)) * 255).astype(np.uint8)), "écart ×3"),
        ]
        rows.append(grid(tiles, 4))
        ramps.append(label(Image.fromarray((apply_lut(test_ramp(), lut_q) * 255).astype(np.uint8)), name))
    sheet = Image.new("RGB", (rows[0].width, sum(r.height for r in rows)))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height
    sheet.save(QA / "04-luts.jpg", quality=84)
    grid(ramps, 2).save(QA / "04-lut-ramps.jpg", quality=88)
    write_json(report, WORK / "luts.json")
    print(f"total {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
