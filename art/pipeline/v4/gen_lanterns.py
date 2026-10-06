"""Écrit apps/web/src/themes/lanterns.ts depuis art/pipeline/v4/{report,lanterns}.json
(Python standard). Vérifie que chaque fichier existe dans themes/assets/lanterns."""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
THEMES = REPO / "apps/web/src/themes"
ASSETS = THEMES / "assets"
REPORT = json.loads((HERE / "report.json").read_text())
META = json.loads((HERE / "lanterns.json").read_text())

# Ordre = LANTERNS de @a2/core (packages/core/src/home/lanterns.ts).
IDS = ["kasuga-moss", "yukimi", "oribe", "kotoji", "tachi-carved", "ancient-shrine", "spirit-light"]
KODAMA = ["kodama-sit", "kodama-lying", "kodama-pair", "kodama-wave"]
KINDS = ("unlit", "lit", "silhouette")

imports: list[str] = []


def ident(path: str) -> str:
    parts = re.split(r"[/\-.]", path.removesuffix(".webp"))[1:]
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def ref(path: str) -> str:
    if not (ASSETS / path).exists():
        raise SystemExit(f"asset manquant : {path}")
    name = ident(path)
    imports.append(f"import {name} from './assets/{path}';")
    return name


def kb(prefix: str, suffix: str = "") -> float:
    return sum(v["bytes"] for k, v in REPORT.items() if k.startswith(prefix) and k.endswith(suffix)) / 1024


def pt(p: dict) -> str:
    return f"{{ x: {p['x']}, y: {p['y']} }}"


def main() -> None:
    lanterns = META["lanterns"]
    missing = [i for i in IDS if i not in lanterns]
    if missing:
        raise SystemExit(f"modèles manquants : {missing}")
    rows = []
    for i in IDS:
        m = lanterns[i]
        files = {k: ref(f"lanterns/lantern-{i}-{k}.webp") for k in KINDS}
        rows.append(
            f"  '{i}': {{\n"
            f"    unlit: {files['unlit']},\n    lit: {files['lit']},\n    silhouette: {files['silhouette']},\n"
            f"    roof: {pt(m['roof'])},\n    fire: {pt(m['fire'])},\n"
            f"    aspect: {m['aspect']},\n    scale: {m['scale']},\n"
            f"    width: {m['w']},\n    height: {m['h']},\n  }},\n")
    kod = []
    for k in KODAMA:
        kod.append(f"  {{ pose: '{k.removeprefix('kodama-')}', src: {ref(f'lanterns/{k}.webp')}, "
                   f"seat: {META['kodama'][k]['seat']} }},\n")
    sizes = ", ".join(f"{i} {lanterns[i]['w']}×{lanterns[i]['h']}" for i in IDS)
    aligns = ", ".join(f"{i} {lanterns[i]['align']['iou_after']:.3f}" for i in IDS)
    total = sum(v["bytes"] for k, v in REPORT.items() if k.startswith("lanterns/")) / 1024
    poses = " | ".join(f"'{k.removeprefix('kodama-')}'" for k in KODAMA)
    ids = " | ".join(f"'{i}'" for i in IDS)
    out = f"""/**
 * Lanternes de pierre (tōrō) — peintures et ancres (V4).
 * GÉNÉRÉ par art/pipeline/v4/gen_lanterns.py : ne pas éditer à la main
 * (voir art/pipeline/v4/README.md).
 *
 * Clés = identifiants de `LANTERNS` (@a2/core, home/lanterns.ts).
 * Poids : {total:.0f} Ko — éteintes {kb('lanterns/lantern-', '-unlit.webp'):.0f} Ko, allumées
 * {kb('lanterns/lantern-', '-lit.webp'):.0f} Ko, silhouettes {kb('lanterns/lantern-', '-silhouette.webp'):.0f} Ko, kodama {kb('lanterns/kodama-'):.0f} Ko.
 *
 * Formats (WebP RGBA non prémultiplié, couleurs propagées sous l'alpha nul,
 * marge transparente de 6 px) :
 * - `unlit` / `lit` / `silhouette` d'un même modèle partagent EXACTEMENT la
 *   même toile (largeur, hauteur, cadrage) : on les superpose et l'on fond
 *   l'une dans l'autre sans saut. L'allumée est recalée sur l'éteinte
 *   (corrélation de phase + ECC, IoU de l'alpha : {aligns})
 *   puis recomposée « éteinte + lumière » : hors de la zone éclairée, les
 *   pixels sont ceux de l'éteinte.
 * - Les sept modèles sont à la MÊME échelle (celle de la planche) : le plus
 *   haut fait 420 px utiles. Toiles : {sizes}.
 *   `scale` = hauteur de la toile / celle du plus haut modèle : à multiplier
 *   par la hauteur d'affichage choisie pour garder les tailles relatives.
 * - `silhouette` : alpha de l'éteinte légèrement flouté, rempli d'un ton de
 *   brume sombre ; aucun détail. Pour le Carnet tant que le modèle n'est pas
 *   débloqué : n'importer / afficher QUE la silhouette (la vraie image n'est
 *   jamais chargée avant le déblocage).
 *
 * Ancres, en coordonnées normalisées de la toile (0..1, origine en haut à
 * gauche, marge comprise) :
 * - `fire` : centre de la chambre à feu (barycentre de la lumière ajoutée) —
 *   y centrer la lueur vivante (halo qui respire, lucioles qui tournent) ;
 * - `roof` : point de la surface du toit, à droite du fleuron — y poser le
 *   point d'assise (`seat`) d'un kodama de `kodamaOnLantern`.
 *
 * Kodama sur la lanterne : 4 poses (~200 px de haut, même échelle), `seat` =
 * hauteur de l'assise en fraction de la toile du sprite (depuis le haut) :
 * placer le sprite en (roof.x·W − w/2, roof.y·H − seat·h). Taille
 * conseillée : le plus grand sprite ≈ 0,18–0,2 × la hauteur du plus haut
 * modèle affiché (rendu dans art/pipeline/out/v4/out/qa/lantern-anchors.png).
 */
{chr(10).join(imports)}

export type LanternId = {ids};
export type KodamaPose = {poses};

export interface LanternPoint {{
  x: number;
  y: number;
}}

export interface LanternArt {{
  unlit: string;
  lit: string;
  silhouette: string;
  /** Assise d'un kodama sur le toit (coordonnées normalisées de la toile). */
  roof: LanternPoint;
  /** Centre de la chambre à feu (coordonnées normalisées de la toile). */
  fire: LanternPoint;
  /** Largeur / hauteur de la toile. */
  aspect: number;
  /** Hauteur de la toile / hauteur du plus haut modèle (tailles relatives). */
  scale: number;
  /** Taille de la toile en px. */
  width: number;
  height: number;
}}

export interface KodamaOnLantern {{
  pose: KodamaPose;
  src: string;
  /** Hauteur de l'assise, fraction de la hauteur du sprite (depuis le haut). */
  seat: number;
}}

export const LANTERN_ART: Record<LanternId, LanternArt> = {{
{''.join(rows)}}};

/** Accès par identifiant quelconque (undefined si inconnu) : ex. `lanternArt[focus.selectedLantern]`. */
export const lanternArt: Partial<Record<string, LanternArt>> = LANTERN_ART;

/** Kodama à poser sur le toit : assis, allongé, à deux, qui salue. */
export const KODAMA_ON_LANTERN: readonly KodamaOnLantern[] = [
{''.join(kod)}];

/** URL des sprites de kodama sur lanterne (même ordre que KODAMA_ON_LANTERN). */
export const kodamaOnLantern: string[] = KODAMA_ON_LANTERN.map((k) => k.src);
"""
    (THEMES / "lanterns.ts").write_text(out)
    print(f"lanterns.ts : {len(imports)} imports, {total:.0f} Ko")


if __name__ == "__main__":
    main()
