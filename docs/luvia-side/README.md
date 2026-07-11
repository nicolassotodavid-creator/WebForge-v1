# Lado Luvia del puente (crear-cliente)

Estos ficheros van en **tu proyecto Supabase de Luvia**, NO en WebForge. Son la otra mitad del
puente `handoff-luvia`. Contrato completo:
`docs/superpowers/specs/2026-07-10-puente-luvia-handoff-design.md`.

## Qué hace
`POST /crear-cliente` con `Authorization: Bearer <LUVIA_HANDOFF_TOKEN>` y cuerpo:
`{ webforge_lead_id, nombre, categoria, telefono, whatsapp, email, direccion, ciudad, pais, rating, resenas, source }`.
Responde `{ cliente_id }`. **Idempotente** por `webforge_lead_id` (no duplica si se reenvía).

## Despliegue en el proyecto Luvia (3 pasos)
1. **Tabla:** aplica `clientes.sql` en el SQL Editor de Luvia. Si ya tienes tabla de clientes,
   no la crees: añade `webforge_lead_id text unique` y ajusta `CLIENTES_TABLE` + columnas en `index.ts`.
2. **Función:** copia `crear-cliente/index.ts` a `supabase/functions/crear-cliente/index.ts` de tu
   repo Luvia y despliega:
   `supabase functions deploy crear-cliente --project-ref <REF-LUVIA>`
3. **Secreto:** genera el token una vez (`openssl rand -hex 32`) y ponlo en Luvia:
   `supabase secrets set LUVIA_HANDOFF_TOKEN=<token> --project-ref <REF-LUVIA>`
   (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya existen por defecto en cada proyecto).

## Lado WebForge (para que el puente cierre el círculo)
1. **Secretos** (mismos que en el spec): en WebForge
   `supabase secrets set ADMIN_USER_ID=<uuid-admin> LUVIA_FUNCTIONS_URL=https://<REF-LUVIA>.supabase.co/functions/v1 LUVIA_HANDOFF_TOKEN=<el-MISMO-token> --project-ref khscikqchvjxyvoaruas`
2. **Migración 0021:** Actions → "Aplicar migración Luvia client (0021, manual)" → Run workflow.
3. **Desplegar `handoff-luvia`:** añadir `handoff-luvia` a la lista de `deploy.yml` (una línea; ahora
   mismo no está porque `deploy.yml` tiene WIP de cron-auth sin commitear) y llevar la feature a `main`
   (dispara el deploy de funciones + Vercel del panel).

## Prueba E2E (con un cliente de prueba, no real)
Con la cuenta Luvia, un lead de clínica de prueba → botón "Marcar como cliente" → aparece una fila en
`clientes` de Luvia, el lead pasa a `won` y el botón desaparece. Un segundo intento no duplica.
