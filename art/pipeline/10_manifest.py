"""Génère apps/web/src/world/manifest.ts (contrat WorldManifest de world/types.ts).

Entrées : out/assets/** (fichiers produits par 02–07), out/work/placements.resolved.json
(08_placements.py), placements.json (ordre des sprites de kodama).
Sortie  : out/manifest.ts (copié dans le dépôt par `remote.sh pull`).

Chaque asset est importé via Vite (URL hachée au build). Le fichier généré
documente les formats (profondeur, masques, LUT, effets) pour le moteur.
"""
from __future__ import annotations

import re

from common import ASSETS, OUT, PIPE, STAGE_SOURCES, WORK, read_json

FX_COUNTS = {"fog": 3, "rays": 3, "drips": 6, "needles": 4, "motes": 6, "halos": 2}
POSES = ["idle", "happy", "proud", "sleepy", "curious"]
CREATURES = ["moss-ling", "seed-spirit", "leaf-sprite", "ember-wisp", "mushroom-pip", "water-drip"]
LUTS = ["quiet", "peaceful", "lively", "flourishing", "night"]

imports: list[tuple[str, str]] = []
sizes: dict[str, int] = {}


def ident(rel: str) -> str:
    """Nom d'import lisible et unique : stages/stage-1.webp → stage1."""
    stem = rel.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    folder = rel.split("/")[0] if "/" in rel else ""
    base = stem
    if folder == "depth":
        base = f"depth-{stem.replace('stage-', '')}"
    elif folder == "luts":
        base = f"lut-{stem}"
    elif folder == "banners":
        base = f"banner-{stem}"
    elif folder == "fx":
        base = f"fx-{stem}"
    parts = re.split(r"[^A-Za-z0-9]+", base)
    name = parts[0].lower() + "".join(p[:1].upper() + p[1:] for p in parts[1:])
    if name[0].isdigit():
        name = "a" + name
    return name


def asset(rel: str) -> str:
    p = ASSETS / rel
    if not p.exists():
        raise SystemExit(f"asset manquant : {rel}")
    name = ident(rel)
    if (rel, name) not in imports:
        imports.append((rel, name))
        sizes[rel] = p.stat().st_size
    return name


def first(*cands: str) -> str:
    for c in cands:
        if (ASSETS / c).exists():
            return asset(c)
    raise SystemExit(f"asset manquant : {cands}")


def num(v: float) -> str:
    s = f"{v:.3f}".rstrip("0").rstrip(".")
    return s if s not in ("-0", "") else "0"


def prop(key: str, value: str) -> str:
    """Propriété d'objet, en raccourci quand le nom d'import est la clé."""
    return key if key == value else f"{key}: {value}"


def point(p: dict) -> str:
    out = f"x: {num(p['x'])}, y: {num(p['y'])}, depth: {num(p['depth'])}"
    if "scale" in p:
        out += f", scale: {num(p['scale'])}"
    return "{ " + out + " }"


def main() -> None:
    pl = read_json(WORK / "placements.resolved.json")
    raw = read_json(PIPE / "placements.json")

    stages = []
    for s in sorted(STAGE_SOURCES):
        c = asset(f"stages/stage-{s}.webp")
        d = first(f"depth/stage-{s}.webp", f"depth/stage-{s}.png")
        stages.append(f"    {s}: {{ color: {c}, depth: {d} }},")

    masks = asset("masks.png")
    masks_light = asset("masks-light.png")
    fg = asset("foreground.webp")
    luts = [f"    {n}: {asset(f'luts/{n}.png')}," for n in LUTS]

    # Kodama : d'abord les sprites des emplacements (le moteur associe
    # l'emplacement i au sprite i), puis les autres poses.
    order = [k.get("sprite") for k in raw["kodamaSpots"] if k.get("sprite")]
    allk = [f"kodama-{i}" for i in range(1, 9)]
    order += [k for k in allk if k not in order]
    kodama = [asset(f"sprites/{k}.webp") for k in order]
    creatures = [f"      '{c}': {asset(f'sprites/{c}.webp')}," for c in CREATURES]
    guardian = asset("sprites/guardian.webp")
    comp = {
        who: ", ".join(f"{p}: {asset(f'sprites/{name}-{p}.webp')}" for p in POSES)
        for who, name in (("a", "jiji"), ("b", "calcifer"))
    }
    fx = []
    for g, n in FX_COUNTS.items():
        names = [asset(f"fx/{g}-{i}.webp") for i in range(1, n + 1)]
        fx.append(f"    {g}: [{', '.join(names)}],")
    budget = asset("banners/budget.webp")
    courses = asset("banners/courses.webp")
    placeholder = asset("placeholder.webp")

    total = sum(sizes.values())
    by_group: dict[str, int] = {}
    for rel, b in sizes.items():
        g = rel.split("/")[0] if "/" in rel else rel.rsplit(".", 1)[0]
        by_group[g] = by_group.get(g, 0) + b
    breakdown = " · ".join(f"{g} {b / 1024:.0f} Ko" for g, b in sorted(by_group.items(), key=lambda kv: -kv[1]))

    anchors = "\n".join(f"    {point(a)}," for a in pl["anchors"])
    kspots = "\n".join(f"    {point(k)}," for k in pl["kodamaSpots"])
    cspots = "\n".join(f"    '{cid}': {point(c)}," for cid, c in pl["creatureSpots"].items())
    ls = pl["lightSource"]

    head = f'''/**
 * Manifest des assets du monde — GÉNÉRÉ par art/pipeline/10_manifest.py.
 * Ne pas éditer à la main : modifier le pipeline (art/pipeline/README.md) puis
 * régénérer (`art/pipeline/remote.sh all`).
 *
 * Poids total : {total / 1024 / 1024:.2f} Mo ({len(sizes)} fichiers) — {breakdown}.
 *
 * Formats :
 * - stages[n].color : peinture du stade, WebP 1024×1536 (recalée sur le stade 6).
 * - stages[n].depth : profondeur 512×768 en niveaux de gris (R = G = B), sans
 *   perte, blanc = près ; même échelle pour tous les stades (calée sur le stade 6).
 * - masks : PNG RGB opaque 512×768 : R = eau (écoulement), G = feuillage /
 *   fougères / mousse fine (vent), B = zone du cèdre (union des changements
 *   entre stades). masksLight : PNG niveaux de gris 512×768 = trouées de
 *   lumière dans la canopée (canal A recomposé par le moteur). Deux fichiers
 *   opaques car WebKit perd le RGB d'un PNG RGBA là où l'alpha est nul. Bords doux.
 * - luts : LUT 3D 33³ en bande PNG 1089×33 (RGB 8 bits) : le pixel
 *   (x = r + 33·b, y = g), avec r, g, b ∈ 0..32, contient la couleur de sortie
 *   pour l'entrée (r, g, b) / 32. Source : peinture du stade 6 ; cibles :
 *   03-vitality-* (humeurs) et 04-pause-night (nuit). Interpolation trilinéaire.
 * - sprites, companions, foreground : WebP RGBA non prémultiplié (couleurs
 *   propagées sous l'alpha nul, pas de liseré), rognés avec une petite marge.
 * - fx : WebP RGBA ; RGB = élément sur noir pur (mélange additif ONE, ONE en
 *   ignorant l'alpha) ; A = luminance normalisée, RGB ≤ A (le même fichier
 *   s'utilise en alpha prémultiplié ONE, ONE_MINUS_SRC_ALPHA). Ne pas laisser le
 *   navigateur reprémultiplier (premultiplyAlpha: 'none'), sinon franges assombries.
 * - Placements : coordonnées normalisées du cadrage portrait (0..1, origine en
 *   haut à gauche), y = point de pose ; depth lue dans la carte du stade 6 ;
 *   scale = hauteur du sprite / hauteur d'image.
 */
import type {{ WorldManifest }} from './types';
'''
    imp = "\n".join(f"import {name} from './assets/{rel}';" for rel, name in imports)
    body = f'''
export const manifest: WorldManifest = {{
  size: {{ w: 1024, h: 1536 }},
  stages: {{
{chr(10).join(stages)}
  }},
  {prop('masks', masks)},
  {prop('masksLight', masks_light)},
  {prop('foreground', fg)},
  luts: {{
{chr(10).join(luts)}
  }},
  anchors: [
{anchors}
  ],
  kodamaSpots: [
{kspots}
  ],
  creatureSpots: {{
{cspots}
  }},
  lightSource: {{ x: {num(ls['x'])}, y: {num(ls['y'])} }},
  guardianSpot: {point(pl['guardianSpot'])},
  sprites: {{
    kodama: [{', '.join(kodama)}],
    creatures: {{
{chr(10).join(creatures)}
    }},
    {prop('guardian', guardian)},
  }},
  companions: {{
    a: {{ {comp['a']} }},
    b: {{ {comp['b']} }},
  }},
  fx: {{
{chr(10).join(fx)}
  }},
  banners: {{ budget: {budget}, courses: {courses} }},
  {prop('placeholder', placeholder)},
}};
'''
    (OUT / "manifest.ts").write_text(head + imp + "\n" + body)
    print(f"manifest.ts : {len(imports)} imports, {total / 1024 / 1024:.2f} Mo — {breakdown}")


if __name__ == "__main__":
    main()
