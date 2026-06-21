# Vista de Pagos (panel WebForge) — Diseño

Fecha: 2026-06-21
Estado: aprobado (brainstorming)

## 1. Objetivo

Dar al operador una pantalla en el panel para ver **quién ha pagado**, abrir su **factura
borrador en Holded** y **conciliar el cobro con el banco** (cuándo el dinero de Stripe
aterriza en la cuenta). Hoy el único indicador de pago es el badge "Ganado" del lead; no
hay vista de pagos.

## 2. Alcance

**Dentro:**
- Página NUEVA y SEPARADA `/pagos` con su propia tabla. Es un módulo aparte.
- Lista de pagos: negocio, importe, fecha de pago, estado Stripe, estado banco.
- KPIs: cobrado este mes · pendiente de llegar al banco · confirmado en banco · total acumulado.
- Botón "Abrir en Holded" (factura borrador).
- Conciliación **híbrida**: Stripe pre-rellena el estado de llegada; el operador confirma a mano.

**Fuera (descartado explícitamente):**
- NO tocar la tabla de leads del Dashboard (no añadir columnas de pago ahí). El módulo es independiente.
- Sin filtros, sin export CSV, sin guardar datos fiscales en la tabla.
- No emitir/publicar facturas: en Holded SIEMPRE quedan en **borrador** (`status: 0`).

## 3. Requisitos confirmados (decisiones del brainstorming)

- "Banco" = **conciliación del payout**: pagan con tarjeta (Stripe), se quiere ver cuándo el
  dinero llega al banco.
- Conciliación **híbrida**: Stripe pre-rellena (en tránsito + fecha estimada), queda "pendiente
  de confirmar" hasta que el operador da el visto bueno en el panel.
- Implementación **en 2 fases** (enfoque A): primero la vista útil desde el día 1; el webhook de
  payouts se deja escrito e inerte hasta que Stripe esté configurado.
- Regla dura: **las facturas en Holded nunca se publican; siempre borrador.**

## 4. Modelo de datos — migración aditiva sobre `bookings`

`bookings` ya tiene: `id, lead_id, site_id, name, email, phone, plan, deposit_amount (int,
céntimos), stripe_session_id, stripe_payment_status, scheduled_at, status, created_at`.

Columnas nuevas (todas nullable, aditivas):

| columna | tipo | para qué |
|---|---|---|
| `stripe_payment_intent` | text | casar el pago con su payout vía balance transactions |
| `stripe_payout_id` | text | el payout de Stripe en el que se ingresó |
| `payout_arrival_date` | date | fecha de llegada al banco que da Stripe |
| `bank_confirmed_at` | timestamptz | null hasta que el operador confirma en el panel |
| `holded_invoice_id` | text | id de la factura borrador (hoy solo en `events`) |

Migración nueva: `supabase/migrations/00NN_payments_reconciliation.sql` (siguiente número libre).

## 5. Backend — `supabase/functions/stripe-webhook/index.ts`

**Fase 1 (al cobrar — `checkout.session.completed`, ya existe):**
- Además de lo actual (booking→paid, lead→won, evento, contacto+factura borrador en Holded),
  escribir en el booking: `stripe_payment_intent` (de `session.payment_intent`) y
  `holded_invoice_id` (el id de la factura borrador ya creada).
- Sin cambios en la factura: sigue `status: 0` borrador, nunca se emite.

**Fase 2 (nuevo manejador `payout.paid`):**
- Verificación de firma: reutiliza la verificación HMAC ya existente.
- Al recibir `payout.paid`: llamar a la API de Stripe
  `GET /v1/balance_transactions?payout={payout.id}&type=charge&limit=100&expand[]=data.source`
  con `STRIPE_SECRET_KEY`. Para cada charge → su `payment_intent`; actualizar
  `bookings WHERE stripe_payment_intent = pi` con `stripe_payout_id = payout.id` y
  `payout_arrival_date = payout.arrival_date`.
- Paginación: si el payout tiene >100 transacciones, iterar con `starting_after`.
- Tolerante a fallos: si la API de Stripe falla, registrar evento y devolver 200 (Stripe
  reintenta), igual que el patrón actual con Holded.
- El operador debe dar de alta el evento `payout.paid` en el dashboard de Stripe (se documenta;
  no se dispara hasta que Stripe esté configurado).

## 6. Frontend — `app/src/pages/Pagos.tsx` (módulo separado)

- Página nueva. Ruta `/pagos` añadida al router y enlace en la navegación del panel.
- **NO** modifica `Dashboard.tsx` ni su tabla de leads.
- Datos: `supabase.from('bookings').select('*, leads(name)')` (volumen bajo; cómputo en cliente).
- KPIs (4 tarjetas), calculados en cliente a partir de las filas.
- Tabla: Negocio · Importe (`deposit_amount/100` €, formato europeo) · Fecha de pago · Estado
  Stripe · Estado banco · Holded (botón) · Confirmar (botón).
- Botón "Confirmar en banco": `supabase.from('bookings').update({ bank_confirmed_at: <now> })
  .eq('id', id)` y refetch. Es el panel del operador (autenticado), que ya escribe en DB directo
  (p. ej. aprobar brief en `LeadDetail.tsx`). El front PÚBLICO no escribe directo; esto es interno.
- Enlace a Holded: `https://app.holded.com/doc/invoice/{holded_invoice_id}`.
  **Verificar el formato exacto de la URL de Holded en implementación** antes de dar por buena.

## 7. RLS

- `bookings` la escribe hoy la service key (webhook). Para el panel hace falta que el rol
  `authenticated` pueda `select` y `update` en `bookings`. Verificar/añadir la política en la
  migración (revisar 0001 y siguientes para no duplicar).

## 8. Estados — función pura para derivar

Extraer una función pura (testeable) que, dado un booking, devuelva el estado banco:

- sin pago (`status != 'paid'`) → **Pendiente**
- `status = 'paid'` y sin `stripe_payout_id` → **Con Stripe**
- `stripe_payout_id` presente y sin `bank_confirmed_at` → **En tránsito** (mostrar `payout_arrival_date`)
- `bank_confirmed_at` presente → **Confirmado en banco** (mostrar fecha)

La misma función (o una hermana) calcula los 4 KPIs (todos sobre `deposit_amount`, en €). Vive en
`app/src/lib/` para poder testearla sin render. Definiciones exactas:

- **Cobrado este mes**: Σ de bookings con `status = 'paid'` y `created_at` en el mes natural actual.
- **Pendiente de llegar al banco**: Σ de bookings `status = 'paid'` y `bank_confirmed_at IS NULL`
  (incluye los "Con Stripe" y los "En tránsito").
- **Confirmado en banco**: Σ de bookings con `bank_confirmed_at IS NOT NULL`.
- **Total acumulado**: Σ de todos los bookings con `status = 'paid'`.

## 9. Errores

- Frontend: si falla la carga, mostrar mensaje; si falla el `update` de confirmación, revertir el
  estado optimista y avisar (patrón ya usado en `LeadDetail.tsx`).
- Backend: `payout.paid` tolerante a fallos (evento + 200). No romper el webhook por Holded ni por
  la API de Stripe.

## 10. Pruebas

- Test unitario de la función pura de estado + KPIs (varios bookings en distintos estados).
- Manejador `payout.paid`: prueba con un payload de ejemplo de Stripe y la respuesta de
  balance_transactions mockeada.
- `tsc` del app en verde antes de cualquier push (regla "Vercel build falla silencioso").

## 11. Fases de entrega

- **Fase 1** (útil desde el día 1, no depende de que Stripe esté vivo): migración + página `/pagos`
  + KPIs + enlace Holded + confirmar manual + guardar `payment_intent`/`holded_invoice_id` en el
  webhook al cobrar + RLS.
- **Fase 2** (se activa sola cuando Stripe esté configurado): manejador `payout.paid` para el
  pre-relleno del estado de banco.

## 12. Despliegue (lo ejecuta el usuario, según sus reglas)

- Migración a prod: la corre el usuario (`supabase db push`).
- Edge function: `bash deploy.sh` (deploy a prod, requiere autorización explícita).
- Front: push a `master` (Vercel publica desde master).

## 13. Riesgos / a verificar en implementación

- Formato exacto de la URL de factura de Holded (`/doc/invoice/{id}` por confirmar).
- `STRIPE_SECRET_KEY` debe estar disponible en el entorno del webhook para la llamada de Fase 2.
- Dar de alta el evento `payout.paid` en el dashboard de Stripe al configurarlo.
- `deposit_amount` se asume = importe cobrado (céntimos). Confirmar que representa el total del
  cobro y no un depósito parcial al mostrarlo.
