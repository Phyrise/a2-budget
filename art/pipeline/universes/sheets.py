"""Description des planches de sprites (quelle case → quel fichier, quelle taille).

Une case = (nom de sortie, boîte en fractions de la planche (x0, y0, x1, y1),
mode de taille, cible en px, groupe d'échelle).
  mode 'h' : hauteur cible ; 'w' : largeur cible ; 'fit' : plus grand côté.
  Les cases d'un même groupe partagent UNE échelle (la plus petite qui respecte
  la cible pour chacune) : un personnage garde la même taille d'une pose à
  l'autre. Groupe None = échelle propre à la case.
Chaque composante connexe de l'alpha est attribuée à la case qui contient son
centre de masse (voir sprites.py) ; les boîtes servent donc seulement à
départager, elles peuvent être approximatives.

Ordre vérifié à l'œil sur les planches de contrôle out/qa/*.png : les
générations suivent la grille demandée, à deux nuances près, documentées ici :
  - b05 : la grille est 5×4 (6 pépites, 3 pièces, 10 kompeitō, dernière case
    vide) ; les kompeitō sont nommés par couleur (doublons suffixés -2).
  - k04 : 3×2, dernière case vide ; les cases ont des largeurs inégales.
  - k06 : le balai de « maison » touche la théière de « boissons » (coupe).
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Cell:
    name: str
    box: tuple[float, float, float, float]
    mode: str
    target: int
    group: str | None = None
    keep: int = 28          # rayon (px source) pour garder les petits fragments
    decon: bool = True      # défrangeage (False : lueurs, poussières)
    square: int = 0         # > 0 : toile carrée de ce côté, contenu centré (icônes)


@dataclass
class Sheet:
    file: str
    out: str                # sous-dossier de sortie : budget | courses
    cells: list[Cell]
    align: list[list[str]] = field(default_factory=list)  # même toile, calées en bas
    # Rectangles (x0, y0, x1, y1, px source) retirés du masque d'étiquetage
    # seulement : sépare deux objets qui se touchent sur la planche.
    cuts: list[tuple[int, int, int, int]] = field(default_factory=list)


def grid(names, cols, rows, mode, target, group=None, xs=None, ys=None, **kw) -> list[Cell]:
    """Grille régulière (ou coupes xs / ys explicites) ; None = case vide."""
    xs = xs or [i / cols for i in range(cols + 1)]
    ys = ys or [j / rows for j in range(rows + 1)]
    cells = []
    for k, n in enumerate(names):
        if n is None:
            continue
        i, j = k % cols, k // cols
        rx = xs[j] if isinstance(xs[0], list) else xs
        cells.append(Cell(n, (rx[i], ys[j], rx[i + 1], ys[j + 1]), mode, target, group, **kw))
    return cells


NOFACE = grid(["noface-calm", "noface-offering", "noface-content",
               "noface-shy", "noface-bow", "noface-fading"], 3, 2, "h", 360, "noface")
for c in NOFACE:
    if c.name == "noface-fading":
        c.keep = 260  # scintillements autour de la silhouette qui s'efface

SUSU = grid(["susuwatari-carry-pink", "susuwatari-carry-yellow", "susuwatari-carry-green",
             "susuwatari-carry-blue-duo", "susuwatari-jump-white", "susuwatari-hiding",
             "susuwatari-sleeping", "susuwatari-trio"], 4, 2, "h", 180, "susu", keep=40)

GOLD = grid(["gold-nugget-1", "gold-nugget-2", "gold-nugget-3", "gold-nugget-4", "gold-nugget-5",
             "gold-nugget-6", "gold-coin-1", "gold-coin-2", "gold-coin-3", "konpeito-pink",
             "konpeito-yellow", "konpeito-yellow-2", "konpeito-green", "konpeito-green-2",
             "konpeito-blue",
             "konpeito-blue-2", "konpeito-white", "konpeito-purple", "konpeito-purple-2", None],
            5, 4, "fit", 84, square=96)

KIKI = grid(["kiki-flying", "kiki-sweep-a", "kiki-sweep-b",
             "kiki-basket", "kiki-wave", "kiki-list"], 3, 2, "h", 360, "kiki",
            xs=[[0, 0.42, 0.70, 1], [0, 1 / 3, 2 / 3, 1]], ys=[0, 0.46, 1], keep=60)

JIJI = grid(["jiji-in-basket", "jiji-in-bag", "jiji-teacup",
             "jiji-on-basket", "jiji-sleeping", None], 3, 2, "h", 260, "jiji",
            xs=[[0, 0.33, 0.67, 1], [0, 0.33, 0.69, 1]], ys=[0, 0.47, 1])

BASKETS = grid(["basket-empty", "basket-half", "basket-full"], 3, 1, "h", 320, "basket",
               ys=[0, 0.47])
BROOM = [Cell("broom", (0, 0.47, 1, 0.64), "w", 520)]
FX = [Cell("dust", (0, 0.64, 0.66, 1), "w", 520, keep=400, decon=False),
      Cell("sparkles", (0.66, 0.64, 1, 1), "w", 400, keep=400, decon=False)]

CATEGORIES = grid(["category-fruits-legumes", "category-frais", "category-boulangerie",
                   "category-epicerie", "category-boissons", "category-surgeles",
                   "category-hygiene", "category-maison", "category-autre"], 3, 3, "fit", 116,
                  keep=40, square=128)

SHEETS = [
    Sheet("b03-noface-sheet.png", "budget", NOFACE),
    Sheet("b04-susuwatari-sheet.png", "budget", SUSU),
    Sheet("b05-gold-konpeito-sheet.png", "budget", GOLD),
    Sheet("k03-kiki-sheet.png", "courses", KIKI, align=[["kiki-sweep-a", "kiki-sweep-b"]]),
    Sheet("k04-jiji-basket-sheet.png", "courses", JIJI),
    Sheet("k05-basket-broom-sheet.png", "courses", BASKETS + BROOM + FX),
    # Le manche du balai (maison) passe sous la théière (boissons) : coupe sous la théière.
    Sheet("k06-category-icons.png", "courses", CATEGORIES, cuts=[(760, 667, 900, 669)]),
]
