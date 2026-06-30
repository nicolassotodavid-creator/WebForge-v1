#!/bin/bash
# run-builds.sh — Tick FRECUENTE (cada minuto, vía launchd) que SOLO construye los leads que el
# operador ya aprobó (status 'build_queued'). Así un build aprobado arranca en <1 min sin esperar
# al run diario de las 08:00. NO hace scoring, briefs ni seguimientos (eso es run-daily.sh).
# launchd no solapa instancias: si un build sigue en curso, el siguiente tick se omite.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$HOME/Library/Logs/WebForge"
mkdir -p "$LOG_DIR"

# ── Detectar npm (mismo criterio que run-daily.sh) ───────────────────────────
find_npm() {
  if [ -x "/opt/homebrew/bin/npm" ]; then echo "/opt/homebrew/bin/npm"; return; fi
  if [ -x "/usr/local/bin/npm" ]; then echo "/usr/local/bin/npm"; return; fi
  local NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -d "$NVM_DIR/versions/node" ]; then
    local NVM_NPM
    NVM_NPM=$(find "$NVM_DIR/versions/node" -name npm -maxdepth 3 | sort -V | tail -1)
    if [ -x "$NVM_NPM" ]; then echo "$NVM_NPM"; return; fi
  fi
  if [ -x "$HOME/.volta/bin/npm" ]; then echo "$HOME/.volta/bin/npm"; return; fi
  if command -v npm &>/dev/null; then command -v npm; return; fi
  echo ""
}

NPM=$(find_npm)
if [ -z "$NPM" ]; then
  echo "$(date '+%H:%M:%S') ERROR: no se encontró npm" >> "$LOG_DIR/builds.log"
  exit 1
fi

cd "$SCRIPT_DIR"
# Solo registramos el tick si construye algo (filtramos el ruido de "sin leads en cola").
OUT=$("$NPM" start -- --builds-only 2>&1) || true
if ! echo "$OUT" | grep -q "No hay leads encolados para construir"; then
  echo "─── $(date '+%Y-%m-%d %H:%M:%S') ───" >> "$LOG_DIR/builds.log"
  echo "$OUT" >> "$LOG_DIR/builds.log"
fi
