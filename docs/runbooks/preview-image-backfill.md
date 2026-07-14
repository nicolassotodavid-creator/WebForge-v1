# Runbook — webs aprobadas SIN captura (`preview_image_url` = null)

**Severidad:** media, pero **silenciosa** (nadie se entera hasta abrir el email/la propuesta).
**Primera aparición:** 2026-07-14 (un lead del lote de energía del 2026-07-08; identificadores
concretos fuera de este doc por ser datos de cliente).

---

## Síntoma

- En la ficha del lead, el email de contacto sale en **texto plano**: sin el bloque *showcase*
  (captura de la web enmarcada en mini-navegador + los 2 CTAs).
- En `/book/:leadId` la propuesta muestra el **fallback**, no la captura de la web del cliente.

> El textarea "CUERPO" del panel **siempre** muestra el borrador en crudo. El showcase es HTML
> que `send-email` envuelve **al enviar** (`_shared/emailTemplate.ts` → `renderEmail`), así que la
> ausencia no se ve ahí: se ve en `/book` y en el email real.

## Causa raíz

El bloque showcase y la captura de `/book` dependen de **`sites.preview_image_url`**. Esa columna
la rellena el Orquestador al construir, re-hospedando la captura de Lovable en el bucket
`site-previews`. Si un build se interrumpe a medias (p. ej. el lote de energía del **2026-07-08**:
corte por crédito de Anthropic + re-deploy por slug>45), el site queda `approved` con `live_url` y
`lovable_project_id` pero **sin** `preview_image_url`. El pipeline normal funciona (44/77 sites la
tenían); lo que faltó fue el paso de re-hospedar en esos casos concretos.

**No es un bug del render ni de la plantilla.** Es un dato que falta.

## Detección

Solo Supabase, no toca Lovable. Devuelve exit **1** si hay webs aprobadas a medias:

```bash
cd orquestador
npm run check-previews            # lista legible
npm run check-previews -- --json  # para CI/alertas
```

SQL equivalente (Supabase SQL editor):

```sql
select s.id, l.name, s.live_url, s.created_at
from sites s join leads l on l.id = s.lead_id
where s.status = 'approved'
  and s.live_url is not null
  and s.preview_image_url is null
order by s.created_at;
```

## Arreglo

Necesita el token de Lovable (baja `latest_screenshot_url`, re-hospeda en `site-previews`, escribe
la URL). Idempotente y con dry-run:

```bash
cd orquestador
npm run backfill-previews -- --dry-run   # qué haría, sin escribir
npm run backfill-previews                # re-hospeda y guarda
```

## Verificación

1. `npm run check-previews` → debe salir **✅ … exit 0**.
2. La URL guardada responde **HTTP 200** (`.../storage/v1/object/public/site-previews/<lead_id>.png`).
3. `/book/<lead_id>` muestra la captura (consumida vía la Edge Function `get-booking-info`).
4. Opcional, ver el email sin tocar la DB:
   `npx tsx orquestador/send-test-email.ts --lead <lead_id> --to tu@correo`

## Por qué el arreglo NO está automatizado en CI

`backfill-previews` necesita Lovable, y el **refresh del token de Lovable se persiste en `.env`**
(`orquestador/lovable.ts`, con rotación del refresh token). En GitHub Actions ese `.env` no
persiste entre runs → el auto-fix sería frágil. Además CLAUDE.md prohíbe meter la service key en
GitHub. Por eso: **detección** puede ir a la nube (solo Supabase / vía Edge Function + `CRON_SECRET`),
pero el **arreglo** se dispara en local/VPS donde vive el token de Lovable.

## Prevención (pendiente / propuesta)

Alarma automática en la nube siguiendo el patrón de `daily-brief.yml`:
Edge Function `check-previews` (usa su service role interno) + workflow programado que la llama con
`CRON_SECRET`, y que avise (o falle en rojo) si `count > 0`. Mientras tanto, `npm run check-previews`
es la vigilancia manual.
