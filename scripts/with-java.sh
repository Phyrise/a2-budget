#!/usr/bin/env bash
# Lance une commande avec un Java 21+ (émulateurs Firebase), sans rien
# changer au système : JAVA_HOME et PATH ne valent que pour cette commande.
#   scripts/with-java.sh firebase emulators:start
# Ordre de recherche : $JAVA_HOME, le JRE de scripts/install-java.sh,
# Homebrew openjdk@21 (keg-only), /usr/libexec/java_home, `java` du PATH.
set -euo pipefail

major() { # numéro de version majeure d'un exécutable java, 0 si absent
  local v
  v="$("$1" -version 2>&1 | head -1)" || true
  if [[ $v =~ version\ \"([0-9]+) ]]; then echo "${BASH_REMATCH[1]}"; else echo 0; fi
}

candidates=()
[ -n "${JAVA_HOME:-}" ] && candidates+=("$JAVA_HOME")
candidates+=("${A2_JAVA_DIR:-$HOME/.cache/a2home/java-21}")
if command -v brew >/dev/null 2>&1; then
  p="$(brew --prefix openjdk@21 2>/dev/null || true)"
  [ -n "$p" ] && candidates+=("$p/libexec/openjdk.jdk/Contents/Home" "$p")
fi
if [ -x /usr/libexec/java_home ]; then
  p="$(/usr/libexec/java_home -v 21+ 2>/dev/null || true)"
  [ -n "$p" ] && candidates+=("$p")
fi

found=""
for home in "${candidates[@]}"; do
  if [ -x "$home/bin/java" ] && [ "$(major "$home/bin/java")" -ge 21 ]; then
    found="$home"
    break
  fi
done

if [ -z "$found" ] && command -v java >/dev/null 2>&1 \
  && [ "$(major "$(command -v java)")" -ge 21 ]; then
  exec "$@" # le java du PATH convient
fi

if [ -z "$found" ]; then
  echo "Java 21+ introuvable (exigé par l'émulateur Firestore)." >&2
  echo "Installe-le sans toucher au système : scripts/install-java.sh" >&2
  exit 1
fi

export JAVA_HOME="$found"
export PATH="$found/bin:$PATH"
exec "$@"
