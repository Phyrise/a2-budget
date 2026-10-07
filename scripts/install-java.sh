#!/usr/bin/env bash
# Installe un Java 21 (Eclipse Temurin, JRE) pour les émulateurs Firebase,
# SANS toucher au système : ni sudo, ni brew link, ni PATH global.
# Le JRE est simplement décompressé dans un dossier personnel :
#   ${A2_JAVA_DIR:-$HOME/.cache/a2home/java-21}
# `scripts/with-java.sh` le trouve tout seul. Supprimer le dossier suffit à
# tout désinstaller.
#
# Pourquoi pas `brew install openjdk@21` : sur un Mac Intel, Homebrew ne
# fournit plus de bouteilles pour ses dépendances ; il recompilerait une
# trentaine de paquets et mettrait à jour openssl/python partagés.
set -euo pipefail

DEST="${A2_JAVA_DIR:-$HOME/.cache/a2home/java-21}"

if [ -x "$DEST/bin/java" ]; then
  echo ">> Java déjà présent : $DEST"
  "$DEST/bin/java" -version 2>&1 | head -1
  exit 0
fi

case "$(uname -s)" in
  Darwin) OS=mac ;;
  Linux) OS=linux ;;
  *) echo "Système non pris en charge : $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) ARCH=x64 ;;
  arm64 | aarch64) ARCH=aarch64 ;;
  *) echo "Architecture non prise en charge : $(uname -m)" >&2; exit 1 ;;
esac

API="https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=$ARCH&image_type=jre&os=$OS&vendor=eclipse"
echo ">> Recherche du JRE Temurin 21 ($OS/$ARCH)"
# Lien, nom et somme SHA-256 publiés par Adoptium (lus avec node, déjà requis).
read -r LINK NAME SUM < <(curl -fsSL "$API" | node -e '
  let s = ""; process.stdin.on("data", (c) => (s += c)).on("end", () => {
    const p = JSON.parse(s)[0].binary.package;
    console.log(p.link, p.name, p.checksum);
  });')

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo ">> Téléchargement de $NAME"
curl -fL --progress-bar -o "$TMP/$NAME" "$LINK"
echo "$SUM  $TMP/$NAME" | shasum -a 256 -c - >/dev/null
echo ">> Somme SHA-256 vérifiée"

mkdir -p "$TMP/x"
tar -xzf "$TMP/$NAME" -C "$TMP/x"
TOP="$(find "$TMP/x" -mindepth 1 -maxdepth 1 -type d | head -1)"
# macOS : <jdk>/Contents/Home ; Linux : <jdk> directement.
HOME_DIR="$TOP"
[ -d "$TOP/Contents/Home" ] && HOME_DIR="$TOP/Contents/Home"

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
mv "$HOME_DIR" "$DEST"
"$DEST/bin/java" -version 2>&1 | head -1
echo ">> OK : $DEST"
