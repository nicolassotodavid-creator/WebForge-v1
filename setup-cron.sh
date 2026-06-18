#!/bin/bash
# setup-cron.sh — Instala el cron diario del Orquestador WebForge vía launchd.
# Ejecutar UNA sola vez desde la raíz del repo:
#   bash setup-cron.sh
#
# Para ver los logs después:
#   tail -f ~/Library/Logs/WebForge/run.log
#
# Para desactivar:
#   launchctl unload -w ~/Library/LaunchAgents/com.webforge.orquestador.plist

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_SRC="$SCRIPT_DIR/com.webforge.orquestador.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.webforge.orquestador.plist"
LOG_DIR="$HOME/Library/Logs/WebForge"
LABEL="com.webforge.orquestador"

# 1. Asegurarse de que el script de arranque es ejecutable
chmod +x "$SCRIPT_DIR/orquestador/run-daily.sh"
echo "✓ run-daily.sh → ejecutable"

# 2. Generar el plist con las rutas absolutas correctas
mkdir -p "$LOG_DIR"
cat > "$PLIST_SRC" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <!-- Ejecutar a las 08:00 todos los días -->
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>8</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SCRIPT_DIR}/orquestador/run-daily.sh</string>
  </array>

  <!-- Logs (stdout y stderr van al mismo fichero) -->
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/launchd.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/launchd.log</string>

  <!-- Reintentar si el Mac estaba apagado a las 08:00 -->
  <key>RunAtLoad</key>
  <false/>

  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
PLIST

echo "✓ plist generado → $PLIST_SRC"

# 3. Copiar/actualizar el plist en LaunchAgents
mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST_DST"
echo "✓ plist copiado → $PLIST_DST"

# 4. Cargar (o recargar si ya existía)
launchctl unload -w "$PLIST_DST" 2>/dev/null || true
launchctl load -w "$PLIST_DST"
echo "✓ launchd cargado"

echo ""
echo "══════════════════════════════════════════════════"
echo "  Cron instalado. Se ejecutará cada día a las 08:00."
echo ""
echo "  Logs:     tail -f ~/Library/Logs/WebForge/run.log"
echo "  Test NOW: bash orquestador/run-daily.sh"
echo "  Parar:    launchctl unload -w $PLIST_DST"
echo "══════════════════════════════════════════════════"
