"""Planches réduites pour l'inspection : qa/<motif>.jpg → qa_small/ (≤ MAX px).

  python views.py [motif] [max]   # défauts : « * », 1100
"""
from __future__ import annotations

import sys

from PIL import Image

from scommon import QA, ROOT

pattern = sys.argv[1] if len(sys.argv) > 1 else "*"
side = int(sys.argv[2]) if len(sys.argv) > 2 else 1100
out = ROOT / "qa_small"
out.mkdir(exist_ok=True)
for p in sorted(QA.glob(f"{pattern}.jpg")):
    im = Image.open(p).convert("RGB")
    s = min(1.0, side / max(im.size))
    im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS).save(out / p.name, quality=72)
    print(p.name, im.size)
