# Dashboard "Bandeja de captación" — diseño

Fecha: 2026-06-20 · Estado: aprobado por el usuario

## Objetivo
Convertir el Dashboard del panel WebForge en una **bandeja tipo inbox**: marcar leads como
visto/no-visto, favoritos, filtros rápidos con contadores y persistencia de la vista.

## Datos
Migración `supabase/migrations/0008_lead_flags.sql`:
```sql
alter table leads
  add column if not exists is_favorite boolean not null default false,
  add column if not exists seen_at timestamptz;          -- null = no visto
create index if not exists idx_leads_favorite on leads (is_favorite) where is_favorite;
```
Tipo `Lead` (`app/src/lib/types.ts`): añadir `is_favorite: boolean` y `seen_at: string | null`.
Flags **globales** (no por-operador). El Dashboard ya hace `select *`, las columnas entran solas.

## Dashboard (`app/src/pages/Dashboard.tsx`)
- **Favorito**: columna ⭐ inicial por fila. Toggle optimista (`update is_favorite`); si falla,
  revierte + `alert`.
- **No visto**: nombre en **negrita** + punto índigo a la izquierda. Visto = normal.
- **Toggle manual** visto/no-visto por fila (icono ojo) junto al de borrar. Optimista + revert.
- **Chips rápidos** sobre la tabla con contadores vivos: `Todos · No vistos (N) · ⭐ Favoritos (N) ·
  Sin web (N)`. Estado `view`. El chip "Sin web" sustituye al checkbox `onlyNoWeb`.
- **Persistencia**: `search, statusFilter, city, category, view, sortKey, sortDir` en
  `localStorage` (`wf:dashboard:filters`). Lazy-init al montar, guardado en effect.
- **Degradación**: si las columnas no existen aún (pre-migración), `"is_favorite" in lead` es
  falso → se ocultan ⭐/visto y sus chips; la tabla se ve como antes. Post-migración aparecen.

## LeadDetail (`app/src/pages/LeadDetail.tsx`)
- **Auto-visto**: al cargar el lead, si `seen_at` es null → `update seen_at = now()`
  (fire-and-forget, sin bloquear UI).
- ⭐ favorito en la cabecera del detalle (coherencia con el Dashboard).

## Bordes
- Optimista local + persistencia en Supabase; error → revierte + `alert` (patrón del borrado).
- Requiere migración `0008` aplicada para persistir. Sin ella, degrada (ver arriba).
- El status `viewed` del pipeline (cliente vio su web) es independiente de `seen_at` (operador).

## Secuencia
1. Migración 0008 + tipo `Lead`.
2. Dashboard: estrella, no-visto, toggle, chips+contadores, persistencia, degradación.
3. LeadDetail: auto-visto + estrella.
4. Verificar: `tsc`/build + screenshot (ruta de preview temporal).
