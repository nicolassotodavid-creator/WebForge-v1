# WebForge · Puesta en marcha de las Fases 0 y 1 (guía detallada)

Esta guía es para ti, paso a paso y sin tecnicismos. Vamos **pantalla por pantalla**. Si en algún
punto te atascas, hazme una captura y te digo exactamente qué tocar.

Para estas dos fases **solo necesitas**:
- Una cuenta **gratuita de Supabase** (la base de datos y el login).
- **Node.js** instalado en tu Mac (para arrancar el panel).

El resto de cuentas (Anthropic, Lovable, Stripe, Resend, VPS) son para fases
posteriores. **Ahora NO hacen falta. No las crees todavía.**

---

## PARTE A · Supabase (todo en el navegador)

### A1. La pantalla "Create a new project" (donde estás ahora)

Rellena así, campo por campo:

| Campo | Qué haces |
|---|---|
| **Organization** | Déjalo como está (`Sass IA · FREE`). Nada que tocar. |
| **GitHub (optional)** | **NO lo toques.** Sáltalo (no conectes GitHub). |
| **Project name** | Escribe: `webforge` |
| **Database password** | Pulsa **“Generate a password”**. Se rellenará sola con una contraseña larga. **Cópiala y guárdala** en tus notas o gestor de contraseñas (la usarás muy de vez en cuando). |
| **Region** | Déjalo en **Europe** (lo mejor para España). |

**Security (las 3 casillas) — déjalas EXACTAMENTE como vienen:**
- ✅ **Enable Data API** → marcada. (El panel la necesita para leer/escribir.)
- ✅ **Automatically expose new tables** → marcada. *Aunque Supabase sugiera desactivarla, en
  nuestro caso debe quedarse marcada o el panel no podrá ver los datos. La seguridad real ya la
  pone nuestra migración (RLS).*
- ⬜ **Enable automatic RLS** → sin marcar. (Nuestra migración ya configura la seguridad por su
  cuenta.)

Luego pulsa el botón verde **“Create new project”**.

### A2. Espera a que se cree
Supabase tarda **1–2 minutos** en montar el proyecto (verás una pantalla de carga). No cierres la
pestaña. Cuando termine, verás el panel del proyecto.

### A3. Copia la URL y las claves (las necesitarás para el panel)
Tu proyecto usa el formato **nuevo** de claves de Supabase (Publishable / Secret). Necesitas 2
cosas para el panel y guardar 1 para más adelante:

1. **Project URL** → menú izquierdo **Data API** (bajo INTEGRATIONS). Arriba verás **Project URL**,
   algo como `https://abcd1234.supabase.co`. Cópiala.
   *(Alternativa: Settings → General → Reference ID; la URL es `https://<ese-id>.supabase.co`.)*
2. En **Settings → API Keys** (donde estás), pestaña **“Publishable and secret API keys”**:
   - **Publishable key** (`sb_publishable_...`) → pulsa el icono de **copiar** 📋. Es la clave
     PÚBLICA del panel (segura en el navegador porque tenemos RLS activado). → será tu
     `VITE_SUPABASE_ANON_KEY`.
   - **Secret key** (`sb_secret_...`) → pulsa el **ojo 👁** para revelarla y cópiala. Es SECRETA;
     **NO va en el frontend**. Guárdala para la Fase 3. Para esta prueba **no la necesitas**.

> 💡 El “código” de tu proyecto (lo llamaremos **TU_REF**) es la parte `abcd1234` de tu Project URL.
> También aparece en **Settings → General → Reference ID**. Lo necesitarás en la Parte C.

### A4. Crea las tablas (aplicar la migración)
1. Menú izquierdo: **SQL Editor**.
2. Pulsa **“+ New query”**.
3. En tu Mac, abre el archivo `supabase/migrations/0001_init.sql` (dentro de tu carpeta `webforge`)
   con cualquier editor de texto, **selecciona todo (Cmd+A) y copia (Cmd+C)**.
4. **Pega** ese texto en el SQL Editor y pulsa **“Run”** (o Cmd+Enter).
5. Debe aparecer **“Success. No rows returned”**. ✅ Ya están creadas las tablas.

### A5. Permite entrar sin verificar el correo
1. Menú izquierdo: **Authentication**.
2. Entra en **Sign In / Providers** (o **Providers**) → **Email**.
3. **Desactiva** la opción **“Confirm email”** y guarda. Así tu cuenta de operador entra al
   instante, sin tener que confirmar por correo.

---

## PARTE B · El panel en tu Mac

### B1. Comprueba que tienes Node
Abre la app **Terminal** (Cmd+Espacio, escribe “Terminal”, Enter) y escribe:
```bash
node -v
```
- Si responde algo como `v20.x` o `v22.x` → perfecto.
- Si da “command not found” → instala **Node LTS** desde https://nodejs.org (el botón grande de la
  izquierda), ábrelo y vuelve a probar `node -v`.

### B2. Pega tus claves PÚBLICAS
Abre el archivo `app/.env.local` (en tu carpeta `webforge/app`) con un editor de texto y déjalo así
(pegando tus valores después del `=`, sin espacios ni comillas):
```
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
```
Guarda el archivo. *(La **Secret key** `sb_secret_...` NO va aquí. Puedes pegarla en el archivo
`.env` de la raíz (variable `SUPABASE_SERVICE_ROLE_KEY`) para más adelante; ahora no es
obligatoria.)*

### B3. Instala y arranca el panel
En la Terminal, copia y pega estas líneas (una a una):
```bash
cd ~/webforge/app
npm install
npm run dev
```
- `npm install` tarda ~30 s la primera vez (descarga lo necesario).
- `npm run dev` deja el panel funcionando. Verás una línea tipo `Local: http://localhost:5173/`.
- Abre esa dirección **http://localhost:5173** en el navegador. (Para parar el panel: Ctrl+C en la
  Terminal. Para volver a arrancarlo: `npm run dev` otra vez.)

### B4. Crea tu cuenta de operador
En la pantalla de login del panel:
1. Pulsa **“¿Primera vez? Crear cuenta de operador”**.
2. Pon tu email y una contraseña (mínimo 6 caracteres).
3. Entra. Verás el Dashboard vacío (aún no hay leads).

---

## PARTE C · Subir la función `ingest-leads` (una sola vez)

La pantalla **Importar** habla con una pequeña función que vive en tu Supabase. Hay que subirla una
vez. En la Terminal, desde la **raíz** del proyecto:
```bash
cd ~/webforge
npx supabase login
```
- `npx supabase login` abre el navegador para que autorices (es tu propia cuenta). Acepta.
```bash
npx supabase link --project-ref TU_REF
```
- Cambia `TU_REF` por el código de tu proyecto (la parte `abcd1234` de tu URL).
- Si te pide la **contraseña de la base de datos**, puedes **dejarla en blanco y pulsar Enter**.
```bash
npx supabase functions deploy ingest-leads
```
- Al terminar dirá que la función `ingest-leads` se ha desplegado. ✅

> No necesitas configurar ningún secreto para esta prueba: Supabase ya le da a la función la clave
> que necesita, y la pantalla Importar se identifica con tu sesión.

---

## PARTE D · Probar que la Fase 1 funciona

1. En el panel, arriba, pulsa **Importar**.
2. Pulsa **“Rellenar con ejemplo”** y luego **“Importar”**.
3. Debe aparecer: **“Importación completada · Nuevos: 2”**.
4. Pulsa **“Ir al pipeline”**: verás **2 negocios** (Peluquería Marta y Bar El Rincón) en estado
   **Nuevo**.
5. Si vuelves a importar el mismo ejemplo, **no se duplican** (se actualizan), porque deduplica por
   `google_place_id`. 👍

✅ Si ves los 2 leads en la tabla, las Fases 0 y 1 están funcionando. Avísame y seguimos con la
Fase 2 (el análisis/brief de cada negocio).

---

## Si algo falla
Pégame el mensaje de error tal cual (o una captura) y te digo qué hacer. Errores típicos:
- **El panel dice que faltan variables** → revisa `app/.env.local` y reinicia `npm run dev`.
- **No cargan los leads / permiso denegado** → ¿aplicaste la migración (Parte A4)?
- **Importar falla** → ¿desplegaste la función (Parte C)?

## Recordatorio
Para estas fases NO hace falta Anthropic, Lovable, Stripe, Resend ni el VPS.
