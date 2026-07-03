#!/bin/sh
# Restaura los secretos descifrados a sus rutas de trabajo.
#
# En un ordenador nuevo, antes de ejecutar esto:
#   1) git clone https://github.com/nicolassotodavid-creator/WebForge-v1.git webforge && cd webforge
#   2) brew install git-crypt
#   3) git-crypt unlock /ruta/a/webforge-gitcrypt.key   (la llave transferida aparte, NO en GitHub)
#
# Luego:  sh restore-secrets.sh
set -e
cd "$(dirname "$0")"

if git-crypt status secrets/root.env 2>/dev/null | grep -qi 'encrypted'; then
  echo "ERROR: el repo sigue BLOQUEADO. Ejecuta primero: git-crypt unlock <llave>" >&2
  exit 1
fi

cp secrets/root.env .env
cp secrets/app.env.local app/.env.local
echo "OK: .env y app/.env.local restaurados desde secrets/."
