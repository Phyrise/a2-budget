"""Écrit apps/web/src/themes/manifest.ts depuis report.json (Python standard,
s'exécute en local après `remote.sh pull`). Vérifie que chaque fichier attendu
par le contrat (types.ts) existe dans apps/web/src/themes/assets."""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
THEMES = REPO / "apps/web/src/themes"
ASSETS = THEMES / "assets"
REPORT = json.loads((HERE / "report.json").read_text())

KONPEITO = ["pink", "yellow", "yellow-2", "green", "green-2", "blue", "blue-2",
            "white", "purple", "purple-2"]
CATEGORIES = ["fruits-legumes", "frais", "boulangerie", "epicerie", "boissons",
              "surgeles", "hygiene", "maison", "autre"]

imports: list[str] = []


def ident(path: str) -> str:
    parts = re.split(r"[/\-.]", path.removesuffix(".webp"))
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def ref(path: str) -> str:
    if not (ASSETS / path).exists():
        raise SystemExit(f"asset manquant : {path}")
    name = ident(path)
    line = f"import {name} from './assets/{path}';"
    if line not in imports:
        imports.append(line)
    return name


def key(k: str) -> str:
    return k if re.fullmatch(r"[A-Za-z_]\w*", k) else f"'{k}'"


def obj(pairs: dict[str, str], indent: int) -> str:
    pad = " " * indent
    body = "".join(f"{pad}  {key(k)}: {v},\n" for k, v in pairs.items())
    return "{\n" + body + pad + "}"


def size(prefix: str) -> str:
    """Résumé des tailles (px) d'un groupe de fichiers pour l'en-tête."""
    hits = sorted((k, v) for k, v in REPORT.items() if k.startswith(prefix))
    ws = sorted({v["w"] for _, v in hits})
    hs = sorted({v["h"] for _, v in hits})
    kb = sum(v["bytes"] for _, v in hits) / 1024
    fmt = lambda xs: str(xs[0]) if len(xs) == 1 else f"{xs[0]}–{xs[-1]}"
    return f"{fmt(ws)}×{fmt(hs)} px, {kb:.0f} Ko"


def main() -> None:
    b = "budget/"
    budget = {
        "banners": obj({"landscape": ref(b + "banner-landscape.webp"),
                        "portrait": ref(b + "banner-portrait.webp")}, 2),
        "scene": ref(b + "scene-bridge.webp"),
        "noFace": obj({k: ref(f"{b}noface-{k}.webp") for k in
                       ["calm", "offering", "content", "shy", "bow", "fading"]}, 2),
        "susuwatari": obj({
            "carryPink": ref(b + "susuwatari-carry-pink.webp"),
            "carryYellow": ref(b + "susuwatari-carry-yellow.webp"),
            "carryGreen": ref(b + "susuwatari-carry-green.webp"),
            "carryBlueDuo": ref(b + "susuwatari-carry-blue-duo.webp"),
            "jumpWhite": ref(b + "susuwatari-jump-white.webp"),
            "hiding": ref(b + "susuwatari-hiding.webp"),
            "sleeping": ref(b + "susuwatari-sleeping.webp"),
            "trio": ref(b + "susuwatari-trio.webp")}, 2),
        "gold": obj({
            "nuggets": "[" + ", ".join(ref(f"{b}gold-nugget-{i}.webp") for i in range(1, 7)) + "]",
            "coins": "[" + ", ".join(ref(f"{b}gold-coin-{i}.webp") for i in range(1, 4)) + "]",
            "konpeito": obj({k: ref(f"{b}konpeito-{k}.webp") for k in KONPEITO}, 4)}, 2),
    }
    c = "courses/"
    courses = {
        "banners": obj({"landscape": ref(c + "banner-landscape.webp"),
                        "portrait": ref(c + "banner-portrait.webp")}, 2),
        "kiki": obj({"flying": ref(c + "kiki-flying.webp"), "sweepA": ref(c + "kiki-sweep-a.webp"),
                     "sweepB": ref(c + "kiki-sweep-b.webp"), "basket": ref(c + "kiki-basket.webp"),
                     "wave": ref(c + "kiki-wave.webp"), "list": ref(c + "kiki-list.webp")}, 2),
        "jiji": obj({"inBasket": ref(c + "jiji-in-basket.webp"), "inBag": ref(c + "jiji-in-bag.webp"),
                     "teacup": ref(c + "jiji-teacup.webp"), "onBasket": ref(c + "jiji-on-basket.webp"),
                     "sleeping": ref(c + "jiji-sleeping.webp")}, 2),
        "basket": obj({k: ref(f"{c}basket-{k}.webp") for k in ["empty", "half", "full"]}, 2),
        "broom": ref(c + "broom.webp"),
        "dust": ref(c + "dust.webp"),
        "sparkles": ref(c + "sparkles.webp"),
        "categories": obj({k: ref(f"{c}category-{k}.webp") for k in CATEGORIES}, 2),
    }
    total = sum(v["bytes"] for v in REPORT.values()) / 1024 / 1024
    per = {u: sum(v["bytes"] for k, v in REPORT.items() if k.startswith(u)) / 1024
           for u in ("budget/", "courses/")}
    header = f"""/**
 * Assets des univers Budget (Le Voyage de Chihiro) et Courses (Kiki la petite
 * sorcière) — GÉNÉRÉ par art/pipeline/universes/gen_manifest.py.
 * Ne pas éditer à la main : voir art/pipeline/universes/README.md.
 *
 * Poids total : {total:.2f} Mo ({len(REPORT)} fichiers) — budget {per['budget/']:.0f} Ko · courses {per['courses/']:.0f} Ko.
 *
 * Formats :
 * - Bandeaux (banners, scene) : WebP opaque qualité 82 ; paysage 1536×1024
 *   (définition native des sources, pas d'agrandissement), portrait 1024×1536.
 *   Budget : paysage {size(b + 'banner-landscape')}, portrait
 *   {size(b + 'banner-portrait')}, scène du pont {size(b + 'scene')}.
 *   Courses : paysage {size(c + 'banner-landscape')}, portrait
 *   {size(c + 'banner-portrait')}.
 * - Sprites : WebP RGBA non prémultiplié, détourés par composantes connexes de
 *   l'alpha, défrangés, réduits en alpha prémultiplié, couleurs propagées sous
 *   l'alpha nul ; marge transparente de 6 px. Même échelle pour toutes les
 *   poses d'un même personnage (tailles = toile, marge comprise) :
 *   Sans-Visage {size(b + 'noface')} (hauteur utile 360) ;
 *   Noiraudes {size(b + 'susuwatari')} (hauteur utile 180) ;
 *   Kiki {size(c + 'kiki')} (hauteur utile 360 ; sweepA / sweepB sur la même
 *   toile, calées en bas : bascule directe pour l'animation) ;
 *   Jiji {size(c + 'jiji')} (hauteur utile 260) ;
 *   paniers {size(c + 'basket')} (hauteur utile 320) ;
 *   balai {size(c + 'broom')} ; poussière {size(c + 'dust')} ;
 *   étincelles {size(c + 'sparkles')}.
 * - Petits objets sur toile carrée, contenu centré : pépites / pièces /
 *   kompeitō 96×96 (contenu ≤ 84) ; icônes de rayons 128×128 (contenu ≤ 116).
 * - Clés de `categories` = GROCERY_CATEGORIES de @a2/core (home/groceries.ts).
 */
import type {{ BudgetTheme, CoursesTheme }} from './types';
"""

    def render(name: str, typ: str, d: dict[str, str]) -> str:
        return f"export const {name}: {typ} = " + obj(d, 0) + ";\n"

    body = render("budgetTheme", "BudgetTheme", budget) + "\n" + render("coursesTheme", "CoursesTheme", courses)
    out = header + "\n".join(imports) + "\n\n" + body
    (THEMES / "manifest.ts").write_text(out)
    print(f"manifest.ts : {len(imports)} imports, {total:.2f} Mo")


if __name__ == "__main__":
    main()
