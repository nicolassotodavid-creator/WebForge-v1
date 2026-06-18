#!/bin/bash
# run-daily.sh — Wrapper que launchd ejecuta cada día a las 08:00.
# Detecta el path de node/npm (Homebrew Intel / Apple Silicon / nvm / sistema).
# Logs en ~/Library/Logs/WebForge/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$HOME/Library/Logs/WebForge"
mkdir -p "$LOG_DIR"

echo "─── $(date '+%Y-%m-%d %H:%M:%S') — WebForge Orquestador ───" | tee -a "$LOG_DIR/run.log"

# ── Detectar npm ────────────────────────────────────────────────────────────
find_npm() {
  # Apple Silicon Homebrew
  if [ -x "/opt/homebrew/bin/npm" ]; then echo "/opt/homebrew/bin/npm"; return; fi
  # Intel Homebrew
  if [ -x "/usr/local/bin/npm" ]; then echo "/usr/local/bin/npm"; return; fi
  # nvm (busca la versión activa o la última instalada)
  local NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -d "$NVM_DIR/versions/node" ]; then
    local NVM_NPM
    NVM_NPM=$(find "$NVM_DIR/versions/node" -name npm -maxdepth 3 | sort -V | tail -1)
    if [ -x "$NVM_NPM" ]; then echo "$NVM_NPM"; return; fi
  fi
  # Volta
  if [ -x "$HOME/.volta/bin/npm" ]; then echo "$HOME/.volta/bin/npm"; return; fi
  # PATH estándar
  if command -v npm &>/dev/null; then command -v npm; return; fi
  echo ""
}

NPM=$(find_npm)
if [ -z "$NPM" ]; then
  echo "ERROR: no se encontró npm. Instala Node.js con Homebrew: brew install node" | tee -a "$LOG_DIR/run.log"
  exit 1
fi
echo "npm: $NPM ($(${NPM} --version 2>/dev/null))" | tee -a "$LOG_DIR/run.log"

# ── Ejecutar ────────────────────────────────────────────────────────────────
cd "$SCRIPT_DIR"
"$NPM" start 2>&1 | tee -a "$LOG_DIR/run.log"
echo "─── Fin: $(date '+%Y-%m-%d %H:%M:%S') ───" | tee -a "$LOG_DIR/run.log"
