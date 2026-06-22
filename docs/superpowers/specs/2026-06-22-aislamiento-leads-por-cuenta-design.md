# Aislamiento de leads por cuenta

Fecha: 2026-06-22
Estado: diseño aprobado (pendiente de revisión del usuario)

## Objetivo

Que cada operador entre con su correo y vea **solo sus leads**, mientras el admin (David)
ve **todos**. Caso concreto: Miguel entra con `miguel@gmail.com` y ve solo lo que él
importó/scrapeó; David entra con `nicolassotodavid@gmail.com` y ve todo. Mismo panel,
mismo funcionamiento — solo cambia *qué* leads ve cada uno.

El login ya existe (Supabase Auth + `Login.tsx` + `ProtectedRoute`). Esto **no es construir
un login**; es **dar dueño a cada lead y aislarlos en la base de datos**.

## Decisiones tomadas

- **Reparto:** cada lead pertenece a quien lo crea (scrape/importación bajo su sesión).
- **Admin:** David ve todo. Las demás cuentas ven solo lo suyo. Asimétrico.
- **Admin = por email**, sin tabla de roles ni perfiles. `nicolassotodavid@gmail.com`.
- **Alta de cuentas:** a mano en el panel de Supabase. **Sin** pantalla "Cuentas" ni
  función de alta (descartado por simplicidad).
- **Aislamiento completo a nivel de BD** (no solo la lista de leads): también las tablas
  que leen Pagos (`bookings`) y Emails (`outreach_messages`), para que no se filtren por
  esas pantallas ni por la API.

## Por qué la seguridad va en la base de datos (RLS), no en el frontend

Filtrar en el frontend (`.eq('owner', userId)`) se salta cualquiera con la anon key
llamando a la API directamente. La regla tiene que vivir en Postgres (Row Level Security)
para que sea real. El frontend casi no cambia: al pedir `select *`, la BD ya devuelve solo
las filas permitidas.

## Modelo de datos

- Nueva columna `leads.owner uuid references auth.users(id)`. **Única fuente de verdad** del
  dueño. Las tablas hijas no llevan columna de dueño: lo heredan a través de su `lead_id`.
- Sin tabla `profiles` ni columna `role`. El admin se identifica por email vía una función
  `public.is_admin()` que lee el claim `email` del JWT y lo compara con el correo del admin.

```sql
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'nicolassotodavid@gmail.com'
$$;
```

## Reglas RLS (migración 0015)

Se reescriben las políticas (hoy todas `auth.role()='authenticated'`, que dejan ver todo):

- `leads`: visible/editable si `owner = auth.uid()` **o** `is_admin()`.
- `briefs`, `sites`, `outreach_messages`, `events`: visibles si el lead asociado
  (`lead_id`) es del usuario o es admin (subconsulta `exists (select 1 from leads ...)`).
- `bookings`: igual vía `lead_id`. Si `lead_id` es null (reservas públicas sin lead),
  solo admin. (Verificar en el plan que esto no rompe el flujo de pagos del operador.)
- El **service role** (Orquestador, Edge Functions, checkout público) sigue saltándose RLS.
  No se rompe nada de eso; solo deben **grabar el `owner` correcto** al crear leads.

## Sellado del dueño al crear leads

- `ingest-leads` ya valida la sesión del operador → sella `owner = user.id` en las filas
  insertadas. En el **upsert** (leads que ya existen por `google_place_id`) **no se pisa**
  el `owner` existente — mismo patrón que ya se usa para no pisar `status`. Mecanismo
  candidato: trigger `before update on leads` que conserve `OLD.owner` (a decidir en el plan).
- `run-scrape` ya autentica al operador y llama a `ingest-leads` server-to-server: pasa el
  `owner` (o el token) para que se selle correctamente.
- **Importación manual** (`Import.tsx` → `ingest-leads`): mismo sellado automático.
- **Scrapes automáticos por cron** (sin operador): el lead va al admin (David) por defecto.
- **Leads existentes** en la BD hoy: backfill → owner = David, en la migración.

## Frontend

- **Sin cambios en las consultas.** Dashboard, Pagos, Emails y el detalle de lead siguen
  pidiendo `select *`; la BD filtra. Miguel ve su panel solo con lo suyo; David lo ve todo.
- No se añade pantalla "Cuentas" ni se toca el menú.
- `Login.tsx` se queda igual (no hay formulario de registro que quitar).

## Operación (una vez, sin código)

1. Crear `miguel@gmail.com` con contraseña desde Supabase → Authentication → Add user.
2. Cerrar el registro abierto: Supabase Auth `disable_signup = true`, para que nadie más se
   registre solo (hoy está abierto — riesgo conocido).

## Fuera de alcance (YAGNI)

- Tabla de perfiles / sistema de roles.
- Pantalla "Cuentas" en el panel y función de alta de usuarios.
- Reasignar leads entre cuentas desde la UI.
- Que un scrape programado por cron caiga en un sector concreto (se puede afinar luego).

## Riesgos / verificación

- **Despliegue:** la migración cambia RLS en producción. Probar que el Orquestador y los
  seguimientos (`cron-followups`, service key) siguen leyendo/escribiendo. No envía correos
  a clientes.
- **Prueba de aislamiento:** con sesión de Miguel, confirmar que **no** ve ni un lead, pago
  ni email de David (ni en UI ni consultando la API con su anon key). Con sesión de David,
  confirmar que ve todo.
- **Sellado:** un lead importado por Miguel queda con `owner = Miguel`; uno importado por
  David, con `owner = David`; un upsert sobre un lead existente no cambia su dueño.
