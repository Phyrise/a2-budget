"""Écrit apps/web/src/themes/manifest.ts depuis report.json (Python standard,
s'exécute en local après `remote.sh pull`). Vérifie que chaque fichier attendu
par le contrat (types.ts) existe dans apps/web/src/themes/assets.

Univers du Calendrier (Totoro, V4) : assets/calendar/*.webp et
art/pipeline/v4/report.json, produits par art/pipeline/v4/ (totoro.py + sync.py).

Bandeaux de saison (facultatifs) : assets/seasons/season-<budget|courses>-
<autumn|winter>-<landscape|portrait>.webp, produits par art/pipeline/seasons/
(remote.sh pull). Une saison n'est déclarée que si ses deux cadres existent."""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
THEMES = REPO / "apps/web/src/themes"
ASSETS = THEMES / "assets"
REPORT = json.loads((HERE / "report.json").read_text())
V4_REPORT = json.loads((HERE.parent / "v4/report.json").read_text())
CALENDAR = {k: v for k, v in V4_REPORT.items() if k.startswith("calendar/")}

SEASONS = ["autumn", "winter"]
KONPEITO = ["pink", "yellow", "yellow-2", "green", "green-2", "blue", "blue-2",
            "white", "purple", "purple-2"]
# Natures d'événement (CALENDAR_KINDS de @a2/core) → icône t05.
CALENDAR_KINDS = ["repas", "sortie", "anniversaire", "rdv", "voyage", "maison", "autre"]
TOTORO = {"umbrella": "totoro-umbrella", "gift": "totoro-gift", "joy": "totoro-joy",
          "sleeping": "totoro-sleeping", "chuAcorns": "chu-totoro-acorns",
          "chibiPeek": "chibi-totoro-peek"}
CATBUS = ["running", "waiting", "sign", "leap"]
CATEGORIES = ["fruits-legumes", "frais", "boulangerie", "epicerie", "boissons",
              "surgeles", "hygiene", "maison", "autre"]

imports: list[str] = []


def ident(path: str) -> str:
    # seasons/season-budget-autumn-landscape.webp → seasonBudgetAutumnLandscape
    parts = re.split(r"[/\-.]", path.removeprefix("seasons/").removesuffix(".webp"))
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


def size(prefix: str, report: dict | None = None) -> str:
    """Résumé des tailles (px) d'un groupe de fichiers pour l'en-tête."""
    hits = sorted((k, v) for k, v in (report or REPORT).items() if k.startswith(prefix))
    ws = sorted({v["w"] for _, v in hits})
    hs = sorted({v["h"] for _, v in hits})
    kb = sum(v["bytes"] for _, v in hits) / 1024
    fmt = lambda xs: str(xs[0]) if len(xs) == 1 else f"{xs[0]}–{xs[-1]}"
    return f"{fmt(ws)}×{fmt(hs)} px, {kb:.0f} Ko"


def season_banners(theme: str) -> tuple[str | None, list[str]]:
    """Objet `seasons` d'un thème (None si aucun bandeau de saison) + notes."""
    found, notes = {}, []
    for season in SEASONS:
        files = {f: f"seasons/season-{theme}-{season}-{f}.webp" for f in ("landscape", "portrait")}
        if all((ASSETS / p).exists() for p in files.values()):
            found[season] = obj({f: ref(p) for f, p in files.items()}, 4)
            kb = sum((ASSETS / p).stat().st_size for p in files.values()) / 1024
            notes.append(f"{theme} {season} {kb:.0f} Ko")
    return (obj(found, 2) if found else None), notes


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
    season_b, notes_b = season_banners("budget")
    if season_b:
        budget = {"banners": budget.pop("banners"), "seasons": season_b, **budget}
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
    season_c, notes_c = season_banners("courses")
    if season_c:
        courses = {"banners": courses.pop("banners"), "seasons": season_c, **courses}
    notes = notes_b + notes_c
    t = "calendar/"
    calendar = {
        "banners": obj({"landscape": ref(t + "banner-landscape.webp"),
                        "portrait": ref(t + "banner-portrait.webp")}, 2),
        "totoro": obj({k: ref(f"{t}{v}.webp") for k, v in TOTORO.items()}, 2),
        "catbus": obj({k: ref(f"{t}catbus-{k}.webp") for k in CATBUS}, 2),
        "kinds": obj({k: ref(f"{t}icon-{k}.webp") for k in CALENDAR_KINDS}, 2),
        "extras": obj({"umbrella": ref(t + "icon-parapluie.webp"),
                       "sprout": ref(t + "icon-pousse.webp")}, 2),
    }
    cal_kb = sum(v["bytes"] for v in CALENDAR.values()) / 1024
    season_doc = "" if not notes else f""" *
 * Bandeaux de saison (hors précache) : {' · '.join(notes)}.
 * - Fichiers assets/seasons/season-<thème>-<saison>-<cadre>.webp, émis au build
 *   sous assets/season-*-<hash>.webp : MOTIF À EXCLURE DU PRÉCACHE
 *   (globIgnores: 'assets/season-*'), servis par le cache à l'exécution.
 * - Mêmes formats et mêmes cadrages recommandés que banners (WebP opaque
 *   qualité 82, paysage 1536×1024, portrait 1024×1536).
"""
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
 *
 * Calendrier (Mon voisin Totoro, V4 — art/pipeline/v4/) : {cal_kb:.0f} Ko ({len(CALENDAR)} fichiers).
 * - Bandeaux : arrêt de bus sous la pluie, paysage {size(t + 'banner-landscape', CALENDAR)},
 *   portrait {size(t + 'banner-portrait', CALENDAR)}. Cadrages
 *   recommandés (object-position ; art/pipeline/v4/totoro.py) : bandeau
 *   mobile 60 % 40 % (paysage) ou 50 % 36 % (portrait), fond 16:9 50 % 55 %,
 *   fond téléphone 55 % 50 % (portrait) : Totoro et l'abri restent dans le cadre.
 * - Totoro {size(t + 'totoro', CALENDAR)} et Chu / Chibi-Totoro
 *   (même échelle, hauteur utile 360 pour le plus grand ; les petits restent petits) ;
 *   Chatbus {size(t + 'catbus', CALENDAR)} (plus grand côté 420, même échelle).
 * - Icônes 128×128 (contenu ≤ 116) : `kinds` (clés = CALENDAR_KINDS de
 *   @a2/core) + `extras` (parapluie rouge, pousse).
{season_doc} */
import type {{ BudgetTheme, CalendarTheme, CoursesTheme }} from './types';
"""

    def render(name: str, typ: str, d: dict[str, str]) -> str:
        return f"export const {name}: {typ} = " + obj(d, 0) + ";\n"

    body = (render("budgetTheme", "BudgetTheme", budget) + "\n"
            + render("coursesTheme", "CoursesTheme", courses) + "\n"
            + render("calendarTheme", "CalendarTheme", calendar))
    out = header + "\n".join(imports) + "\n\n" + body
    (THEMES / "manifest.ts").write_text(out)
    print(f"manifest.ts : {len(imports)} imports, {total:.2f} Mo")


if __name__ == "__main__":
    main()
