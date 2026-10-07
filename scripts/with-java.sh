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

run_with() { # lance la commande avec ce Java s'il convient
  if [ -x "$1/bin/java" ] && [ "$(major "$1/bin/java")" -ge 21 ]; then
    export JAVA_HOME="$1"
    export PATH="$1/bin:$PATH"
    exec "${@:2}"
  fi
}

[ -n "${JAVA_HOME:-}" ] && run_with "$JAVA_HOME" "$@"
run_with "${A2_JAVA_DIR:-$HOME/.cache/a2home/java-21}" "$@"
if command -v brew >/dev/null 2>&1; then
  p="$(brew --prefix openjdk@21 2>/dev/null || true)"
  if [ -n "$p" ]; then
    run_with "$p/libexec/openjdk.jdk/Contents/Home" "$@"
    run_with "$p" "$@"
  fi
fi
if [ -x /usr/libexec/java_home ]; then
  p="$(/usr/libexec/java_home -v 21+ 2>/dev/null || true)"
  [ -n "$p" ] && run_with "$p" "$@"
fi
if command -v java >/dev/null 2>&1 && [ "$(major "$(command -v java)")" -ge 21 ]; then
  exec "$@" # le java du PATH convient
fi

echo "Java 21+ introuvable (exigé par l'émulateur Firestore)." >&2
echo "Installe-le sans toucher au système : scripts/install-java.sh" >&2
exit 1
