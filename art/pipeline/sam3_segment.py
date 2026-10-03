"""Segmentation par concepts texte avec SAM 3 (CPU) — entrées des masques de scène.

À lancer avec l'environnement SAM 3 (pas l'env du pipeline) :
  CUDA_VISIBLE_DEVICES= ~/miniconda3/envs/sam3_local/bin/python sam3_segment.py

Pour chaque image et chaque concept, écrit une carte de probabilité 512×768
(union douce des instances détectées) dans out/work/sam3/<image>/<concept>.png
et les scores dans out/work/sam3/<image>/scores.json.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")

import numpy as np
import torch
from PIL import Image

ROOT = Path(os.environ.get("A2ART_ROOT", Path.home() / "a2art"))
SAM3_ROOT = Path(os.environ.get("SAM3_ROOT", Path.home() / "sam3_official"))
sys.path.insert(0, str(SAM3_ROOT))

from sam3 import build_sam3_image_model  # noqa: E402
from sam3.model.sam3_image_processor import Sam3Processor  # noqa: E402

ALIGNED = ROOT / "out" / "work" / "aligned"
OUTDIR = ROOT / "out" / "work" / "sam3"
MW, MH = 512, 768

# Concepts pour la scène maîtresse (stade 6) : eau, végétation mobile, éléments rigides, ciel.
MASTER_PROMPTS = [
    "water",
    "stream",
    "waterfall",
    "fern",
    "leaves",
    "foliage",
    "moss",
    "rock",
    "tree trunk",
    "tree root",
    "fallen log",
    "sky",
    "light rays",
    "giant tree",
]
# Pour chaque stade : l'arbre central (zone de croissance).
STAGE_PROMPTS = ["giant tree", "tree trunk", "tree stump", "young tree"]

JOBS: dict[str, list[str]] = {
    "01-master-portrait": MASTER_PROMPTS,
    "05-growth-0": STAGE_PROMPTS,
    "05-growth-1": STAGE_PROMPTS,
    "05-growth-2": STAGE_PROMPTS,
    "05-growth-3": STAGE_PROMPTS,
    "05-growth-4": STAGE_PROMPTS,
    "05-growth-6": STAGE_PROMPTS,
    "06-clean-plate": ["water", "fern", "foliage", "sky"],
}


def main() -> None:
    torch.set_num_threads(16)
    only = set(sys.argv[1:])
    t0 = time.time()
    bpe = SAM3_ROOT / "sam3" / "assets" / "bpe_simple_vocab_16e6.txt.gz"
    model = build_sam3_image_model(bpe_path=str(bpe), device="cpu")
    proc = Sam3Processor(model, device="cpu", confidence_threshold=0.25)
    print(f"modèle chargé {time.time() - t0:.0f}s", flush=True)
    for name, prompts in JOBS.items():
        if only and name not in only:
            continue
        img = Image.open(ALIGNED / f"{name}.png").convert("RGB")
        t1 = time.time()
        state = proc.set_image(img)
        print(f"{name}: image encodée {time.time() - t1:.0f}s", flush=True)
        out = OUTDIR / name
        out.mkdir(parents=True, exist_ok=True)
        scores = {}
        for p in prompts:
            proc.reset_all_prompts(state)
            st = proc.set_text_prompt(state=state, prompt=p)
            probs = st["masks_logits"][:, 0].float().numpy()  # N×H×W, sigmoïde
            sc = st["scores"].float().numpy()
            if len(sc):
                # Union douce : 1 − Π(1 − score·p).
                acc = np.ones(probs.shape[1:], np.float32)
                for m, s in zip(probs, sc):
                    acc *= 1.0 - np.clip(m * min(1.0, s / 0.5), 0, 1)
                u = 1.0 - acc
            else:
                u = np.zeros((img.height, img.width), np.float32)
            small = Image.fromarray(np.round(u * 255).astype(np.uint8)).resize((MW, MH), Image.BILINEAR)
            small.save(out / f"{p.replace(' ', '_')}.png")
            scores[p] = [round(float(s), 3) for s in sc]
            print(f"  {p:12s} {len(sc)} instances {scores[p][:6]}", flush=True)
        (out / "scores.json").write_text(json.dumps(scores, indent=1))
    print(f"total {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
