# Secretos cifrados (git-crypt)

Los ficheros con claves viajan **cifrados** dentro de este repo mediante `git-crypt`.
En GitHub son ilegibles (ni Vercel, ni la Action de Supabase, ni un bot pueden leerlos);
solo se descifran en un ordenador que tenga la **llave maestra**.

Ficheros cifrados (ver `.gitattributes`):

| En el repo (cifrado)     | Se restaura como      |
|--------------------------|-----------------------|
| `secrets/root.env`       | `.env` (raíz)         |
| `secrets/app.env.local`  | `app/.env.local`      |

> La llave maestra **NUNCA** se sube a GitHub. Se transfiere aparte (AirDrop / USB / gestor de contraseñas).
> Si pierdes la llave y no tienes ningún ordenador ya desbloqueado, los secretos son irrecuperables.

## Montar en un ordenador nuevo

```sh
git clone https://github.com/nicolassotodavid-creator/WebForge-v1.git webforge
cd webforge
brew install git-crypt
git-crypt unlock /ruta/a/webforge-gitcrypt.key   # la llave que transferiste aparte
sh restore-secrets.sh                            # copia los .env descifrados a su sitio
npm install
```

## Cambiar / rotar un secreto

1. Edita el `.env` (o `app/.env.local`) de trabajo.
2. Copia el cambio a `secrets/`:
   ```sh
   cp .env secrets/root.env
   cp app/.env.local secrets/app.env.local
   ```
3. Commit + push (git-crypt cifra automáticamente al hacer commit):
   ```sh
   git add secrets/ && git commit -m "chore: actualizar secretos" && git push
   ```
