# Vista de Pagos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un módulo separado `/pagos` al panel que liste cobros, enlace a la factura borrador de Holded y permita conciliar cada pago con el banco (híbrido: Stripe pre-rellena, el operador confirma).

**Architecture:** Migración aditiva sobre `bookings` (sin tablas nuevas). Lógica de estado/KPIs en funciones puras testeables (`app/src/lib/payments.ts`). Página React nueva e independiente (`Pagos.tsx`) que no toca el Dashboard. El webhook de Stripe gana 2 escrituras en Fase 1 y un manejador `payout.paid` en Fase 2 (inerte hasta que Stripe esté configurado).

**Tech Stack:** React 18 + react-router-dom 6, Tailwind, supabase-js, shadcn/ui (Badge, Button), lucide-react. Edge function en Deno. Tests sin framework (node --experimental-strip-types para el app; deno test para la función).

## Global Constraints

- Facturas en Holded SIEMPRE borrador (`status: 0`), nunca se emiten/publican.
- Módulo SEPARADO: NO modificar `Dashboard.tsx` ni su tabla de leads.
- El front PÚBLICO no escribe en DB directo; `Pagos.tsx` es panel interno autenticado y SÍ puede (igual que `LeadDetail.tsx`).
- Importes en céntimos (`deposit_amount`), se muestran en formato europeo con `Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" })`.
- `tsc` del app en verde antes de cualquier push (regla "Vercel build falla silencioso").
- RLS de `bookings` YA existe (`op_book ... for all using (auth.role()='authenticated')`) — no añadir política.
- Despliegue lo ejecuta el usuario: migración con `supabase db push`; función con `bash deploy.sh`; front con push a `master`.
- Precio actual del producto: `PRECIO_CENTS = 39700` (397 € IVA incl.), definido en `create-checkout`.
- Tests del app: patrón existente sin framework (ver `app/src/lib/leadFilters.test.ts`) — `assertEq` manual + contador `failures`, ejecutado con `node --experimental-strip-types`.

## File Structure

- Create: `supabase/migrations/0013_payments_reconciliation.sql` — columnas nuevas en `bookings`.
- Create: `app/src/lib/payments.ts` — tipo `Booking` + puras `deriveBankState`, `computeKpis`, `formatEuros`, `holdedInvoiceUrl`.
- Create: `app/src/lib/payments.test.ts` — tests de las puras.
- Create: `app/src/pages/Pagos.tsx` — la página (KPIs + tabla + confirmar + Holded).
- Modify: `app/src/App.tsx` — ruta `/pagos` dentro de `ProtectedRoute`.
- Modify: `app/src/components/Layout.tsx` — enlace de navegación "Pagos".
- Modify: `supabase/functions/stripe-webhook/index.ts` — Fase 1 (guardar `stripe_payment_intent` + `holded_invoice_id`) y Fase 2 (manejador `payout.paid` + helper puro `extractPaymentIntents`).
- Create: `supabase/functions/stripe-webhook/payout.test.ts` — test del helper puro.

---

### Task 1: Migración — columnas de conciliación en `bookings`

**Files:**
- Create: `supabase/migrations/0013_payments_reconciliation.sql`

**Interfaces:**
- Produces: columnas `stripe_payment_intent text`, `stripe_payout_id text`, `payout_arrival_date date`, `bank_confirmed_at timestamptz`, `holded_invoice_id text` en `bookings`.

- [ ] **Step 1: Escribir la migración**

```sql
-- 0013_payments_reconciliation.sql
-- Conciliación de pagos: vincula cada cobro con su payout de Stripe y permite
-- confirmar a mano la llegada al banco. Aditiva e idempotente.
-- RLS: 'bookings' ya tiene la política op_book (authenticated, for all) de 0001 — no se toca.

alter table bookings add column if not exists stripe_payment_intent text;
alter table bookings add column if not exists stripe_payout_id text;
alter table bookings add column if not exists payout_arrival_date date;
alter table bookings add column if not exists bank_confirmed_at timestamptz;
alter table bookings add column if not exists holded_invoice_id text;

create index if not exists idx_bookings_payment_intent on bookings (stripe_payment_intent);
create index if not exists idx_bookings_payout on bookings (stripe_payout_id);
```

- [ ] **Step 2: Verificar sintaxis localmente (sin aplicar)**

Run: `grep -c "add column if not exists" supabase/migrations/0013_payments_reconciliation.sql`
Expected: `5`

(La aplicación a prod la hace el usuario con `supabase db push` — ver sección de despliegue. No la ejecutes tú.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0013_payments_reconciliation.sql
git commit -m "feat(pagos): migración — columnas de conciliación en bookings"
```

---

### Task 2: Funciones puras de pagos + tests

**Files:**
- Create: `app/src/lib/payments.ts`
- Test: `app/src/lib/payments.test.ts`

**Interfaces:**
- Produces:
  - `interface Booking` (campos abajo).
  - `type BankState = "pending" | "with_stripe" | "in_transit" | "confirmed"`.
  - `deriveBankState(b: Booking): BankState`.
  - `interface Kpis { cobradoMes: number; pendienteBanco: number; confirmadoBanco: number; total: number }` (en céntimos).
  - `computeKpis(bookings: Booking[], now: Date): Kpis`.
  - `formatEuros(cents: number): string`.
  - `holdedInvoiceUrl(id: string): string`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// app/src/lib/payments.test.ts
// Sin framework: node --experimental-strip-types src/lib/payments.test.ts (desde app/)
import {
  deriveBankState,
  computeKpis,
  formatEuros,
  holdedInvoiceUrl,
  type Booking,
} from "./payments.ts";

let failures = 0;
function assertEq(actual: unknown, expected: unknown, msg: string) {
  const ok = actual === expected;
  console.log(`${ok ? "✓" : "✗"} ${msg}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
  if (!ok) failures++;
}

const base: Booking = {
  id: "x", lead_id: "l", name: null, deposit_amount: 39700,
  status: "paid", stripe_payment_status: "paid",
  stripe_payout_id: null, payout_arrival_date: null,
  bank_confirmed_at: null, holded_invoice_id: null,
  created_at: "2026-06-10T10:00:00.000Z", leads: null,
};

// deriveBankState
assertEq(deriveBankState({ ...base, status: "started" }), "pending", "started → pending");
assertEq(deriveBankState({ ...base }), "with_stripe", "paid sin payout → with_stripe");
assertEq(deriveBankState({ ...base, stripe_payout_id: "po_1" }), "in_transit", "con payout → in_transit");
assertEq(deriveBankState({ ...base, stripe_payout_id: "po_1", bank_confirmed_at: "2026-06-20T00:00:00Z" }), "confirmed", "confirmado → confirmed");

// computeKpis (now = junio 2026)
const now = new Date("2026-06-21T12:00:00.000Z");
const set: Booking[] = [
  { ...base, id: "a", deposit_amount: 39700, created_at: "2026-06-05T00:00:00Z" }, // paid, mes actual, sin confirmar
  { ...base, id: "b", deposit_amount: 39700, stripe_payout_id: "po", bank_confirmed_at: "2026-06-20T00:00:00Z", created_at: "2026-06-18T00:00:00Z" }, // confirmado, mes actual
  { ...base, id: "c", deposit_amount: 39700, created_at: "2026-05-30T00:00:00Z" }, // paid pero mes anterior
  { ...base, id: "d", status: "started", deposit_amount: 39700, created_at: "2026-06-19T00:00:00Z" }, // no pagado
];
const k = computeKpis(set, now);
assertEq(k.cobradoMes, 79400, "cobradoMes = a+b (mes actual, paid)");
assertEq(k.pendienteBanco, 79400, "pendienteBanco = a+c (paid sin confirmar)");
assertEq(k.confirmadoBanco, 39700, "confirmadoBanco = b");
assertEq(k.total, 119100, "total = a+b+c (todos los paid)");

// formato y url
assertEq(formatEuros(39700).replace(/ /g, " "), "397,00 €", "formatEuros 39700");
assertEq(holdedInvoiceUrl("inv_9"), "https://app.holded.com/doc/invoice/inv_9", "holded url");

console.log(failures === 0 ? "\nTODO OK" : `\n${failures} FALLO(S)`);
if (failures > 0) process.exit(1);
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run (desde `app/`): `node --experimental-strip-types src/lib/payments.test.ts`
Expected: FALLA — `Cannot find module './payments.ts'` (aún no existe).

- [ ] **Step 3: Implementar `payments.ts`**

```ts
// app/src/lib/payments.ts
// Lógica pura de la vista de pagos: estado de conciliación con el banco y KPIs.
// Sin dependencias de React ni de red → testeable en aislamiento.

export interface Booking {
  id: string;
  lead_id: string | null;
  name: string | null;
  deposit_amount: number | null; // céntimos
  status: string | null;          // 'started' | 'paid' | ...
  stripe_payment_status: string | null;
  stripe_payout_id: string | null;
  payout_arrival_date: string | null; // 'YYYY-MM-DD'
  bank_confirmed_at: string | null;    // ISO timestamptz
  holded_invoice_id: string | null;
  created_at: string;                  // ISO
  leads?: { name: string | null } | null; // join con leads
}

export type BankState = "pending" | "with_stripe" | "in_transit" | "confirmed";

/** Estado de la llegada al banco, derivado del booking. */
export function deriveBankState(b: Booking): BankState {
  if (b.status !== "paid") return "pending";
  if (b.bank_confirmed_at) return "confirmed";
  if (b.stripe_payout_id) return "in_transit";
  return "with_stripe";
}

export interface Kpis {
  cobradoMes: number;       // céntimos
  pendienteBanco: number;   // céntimos
  confirmadoBanco: number;  // céntimos
  total: number;            // céntimos
}

/** KPIs agregados (en céntimos). `now` se inyecta para poder testear. */
export function computeKpis(bookings: Booking[], now: Date): Kpis {
  const paid = bookings.filter((b) => b.status === "paid");
  const cents = (b: Booking) => b.deposit_amount ?? 0;
  const sameMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
  };
  return {
    cobradoMes: paid.filter((b) => sameMonth(b.created_at)).reduce((s, b) => s + cents(b), 0),
    pendienteBanco: paid.filter((b) => !b.bank_confirmed_at).reduce((s, b) => s + cents(b), 0),
    confirmadoBanco: paid.filter((b) => b.bank_confirmed_at).reduce((s, b) => s + cents(b), 0),
    total: paid.reduce((s, b) => s + cents(b), 0),
  };
}

/** Formatea céntimos a euros en formato español. */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** Enlace a la factura (borrador) en Holded. */
export function holdedInvoiceUrl(id: string): string {
  return `https://app.holded.com/doc/invoice/${id}`;
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run (desde `app/`): `node --experimental-strip-types src/lib/payments.test.ts`
Expected: `TODO OK` (todas las líneas con ✓, exit 0).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/payments.ts app/src/lib/payments.test.ts
git commit -m "feat(pagos): funciones puras de estado banco y KPIs + tests"
```

---

### Task 3: Página `/pagos` + ruta + navegación

**Files:**
- Create: `app/src/pages/Pagos.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `Booking`, `deriveBankState`, `computeKpis`, `formatEuros`, `holdedInvoiceUrl` de `@/lib/payments`.

- [ ] **Step 1: Crear `Pagos.tsx`**

```tsx
// app/src/pages/Pagos.tsx
import { useCallback, useEffect, useState } from "react";
import { Wallet, ExternalLink, Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type Booking,
  type BankState,
  deriveBankState,
  computeKpis,
  formatEuros,
  holdedInvoiceUrl,
} from "@/lib/payments";

const BANK_LABEL: Record<BankState, string> = {
  pending: "Pendiente",
  with_stripe: "Con Stripe",
  in_transit: "En tránsito",
  confirmed: "Confirmado en banco",
};
const BANK_VARIANT: Record<BankState, "secondary" | "default" | "outline" | "success"> = {
  pending: "secondary",
  with_stripe: "default",
  in_transit: "outline",
  confirmed: "success",
};

const COLS = "id, lead_id, name, deposit_amount, status, stripe_payment_status, stripe_payout_id, payout_arrival_date, bank_confirmed_at, holded_invoice_id, created_at, leads(name)";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES");
}

export default function Pagos() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select(COLS)
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setBookings((data ?? []) as unknown as Booking[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmBank(id: string) {
    setConfirming(id);
    const { error } = await supabase
      .from("bookings")
      .update({ bank_confirmed_at: new Date().toISOString() })
      .eq("id", id);
    setConfirming(null);
    if (error) {
      alert("No se pudo confirmar: " + error.message);
      return;
    }
    await load();
  }

  const kpis = computeKpis(bookings, new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pagos</h1>
          <p className="text-sm text-muted-foreground">
            Cobros, factura en Holded y conciliación con el banco.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ["Cobrado este mes", kpis.cobradoMes],
          ["Pendiente → banco", kpis.pendienteBanco],
          ["Confirmado banco", kpis.confirmadoBanco],
          ["Total acumulado", kpis.total],
        ] as const).map(([label, cents]) => (
          <div key={label} className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold">{formatEuros(cents)}</p>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay pagos.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Negocio</th>
                <th className="px-3 py-2">Importe</th>
                <th className="px-3 py-2">Fecha pago</th>
                <th className="px-3 py-2">Stripe</th>
                <th className="px-3 py-2">Banco</th>
                <th className="px-3 py-2">Holded</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const state = deriveBankState(b);
                return (
                  <tr key={b.id} className="border-t border-border/60">
                    <td className="px-3 py-2">{b.leads?.name ?? b.name ?? "—"}</td>
                    <td className="px-3 py-2">{formatEuros(b.deposit_amount ?? 0)}</td>
                    <td className="px-3 py-2">{b.status === "paid" ? fmtDate(b.created_at) : "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={b.status === "paid" ? "success" : "secondary"}>
                        {b.status === "paid" ? "Pagado" : "Pendiente"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={BANK_VARIANT[state]}>{BANK_LABEL[state]}</Badge>
                      {state === "in_transit" && b.payout_arrival_date && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          llega {fmtDate(b.payout_arrival_date)}
                        </span>
                      )}
                      {state === "confirmed" && b.bank_confirmed_at && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {fmtDate(b.bank_confirmed_at)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {b.holded_invoice_id ? (
                        <a
                          href={holdedInvoiceUrl(b.holded_invoice_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {b.status === "paid" && !b.bank_confirmed_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={confirming === b.id}
                          onClick={() => confirmBank(b.id)}
                        >
                          {confirming === b.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-1 h-4 w-4" />
                          )}
                          Confirmar en banco
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Añadir la ruta en `App.tsx`**

Añadir el import junto a los demás de páginas:

```tsx
import Pagos from "@/pages/Pagos";
```

Y dentro del grupo `<Route element={<ProtectedRoute />}>`, tras la línea de `/settings`:

```tsx
        <Route path="/pagos" element={<Pagos />} />
```

- [ ] **Step 3: Añadir el enlace de navegación en `Layout.tsx`**

Añadir `Wallet` al import de lucide-react:

```tsx
import { LayoutDashboard, Upload, Settings as SettingsIcon, LogOut, Moon, Sun, Wallet } from "lucide-react";
```

Y añadir el item al array `navItems` (después de Dashboard, antes de Importar):

```tsx
  { to: "/pagos", label: "Pagos", icon: Wallet, end: false },
```

- [ ] **Step 4: Verificar que compila (tsc + build)**

Run (desde `app/`): `npm run build`
Expected: build OK, sin errores de tipos. (El warning de chunk >500 kB es preexistente, se ignora.)

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/Pagos.tsx app/src/App.tsx app/src/components/Layout.tsx
git commit -m "feat(pagos): página /pagos (KPIs, tabla, Holded, confirmar banco) + nav"
```

---

### Task 4: Webhook Fase 1 — guardar `stripe_payment_intent` + `holded_invoice_id`

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts`

**Interfaces:**
- Consumes: columnas de Task 1. La factura borrador ya se crea (`createDraftHoldedInvoice`, `status: 0`).

- [ ] **Step 1: Guardar el payment_intent al marcar el booking pagado**

En el bloque `if (paymentStatus === "paid" && sessionId)`, sustituir el update de booking actual:

```ts
      await supabase
        .from("bookings")
        .update({ stripe_payment_status: "paid", status: "paid" })
        .eq("stripe_session_id", sessionId);
```

por:

```ts
      await supabase
        .from("bookings")
        .update({
          stripe_payment_status: "paid",
          status: "paid",
          stripe_payment_intent: String(session.payment_intent ?? "") || null,
        })
        .eq("stripe_session_id", sessionId);
```

- [ ] **Step 2: Guardar el id de la factura borrador en el booking**

Dentro del `try` de Holded, justo después de obtener `invoiceId` (tras `createDraftHoldedInvoice`) y antes/después del `events.insert` de `holded_draft_created`, añadir:

```ts
            await supabase
              .from("bookings")
              .update({ holded_invoice_id: invoiceId })
              .eq("stripe_session_id", sessionId);
```

- [ ] **Step 3: Verificar tipos de la función (Deno)**

Run: `deno check supabase/functions/stripe-webhook/index.ts`
Expected: sin errores. (Si `deno` no está instalado: `brew install deno`. La función es Deno; se despliega con `deploy.sh`.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat(pagos): webhook guarda payment_intent y holded_invoice_id en el booking"
```

---

### Task 5: Webhook Fase 2 — manejador `payout.paid` (pre-relleno de banco)

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts`
- Test: `supabase/functions/stripe-webhook/payout.test.ts`

**Interfaces:**
- Produces: `extractPaymentIntents(resp): string[]` (helper puro). Manejador del evento `payout.paid`.
- Consumes: `STRIPE_SECRET_KEY` del entorno; columnas `stripe_payout_id`, `payout_arrival_date`, `stripe_payment_intent`.

- [ ] **Step 1: Escribir el test del helper puro**

```ts
// supabase/functions/stripe-webhook/payout.test.ts
// Run: deno test supabase/functions/stripe-webhook/payout.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { extractPaymentIntents } from "./index.ts";

Deno.test("extractPaymentIntents saca los payment_intent de las balance transactions", () => {
  const resp = {
    data: [
      { source: { payment_intent: "pi_1" } },
      { source: { payment_intent: "pi_2" } },
      { source: {} },            // sin payment_intent → se ignora
      { source: null },          // sin source → se ignora
      {},                        // vacío → se ignora
    ],
  };
  assertEquals(extractPaymentIntents(resp), ["pi_1", "pi_2"]);
});

Deno.test("extractPaymentIntents tolera respuesta vacía", () => {
  assertEquals(extractPaymentIntents({}), []);
  assertEquals(extractPaymentIntents({ data: [] }), []);
});
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `deno test supabase/functions/stripe-webhook/payout.test.ts`
Expected: FALLA — `extractPaymentIntents` no exportado todavía.

- [ ] **Step 3: Implementar el helper puro (exportado) en `index.ts`**

Añadir cerca de los helpers de Holded, a nivel de módulo:

```ts
/** Saca los payment_intent (charges) de una respuesta de balance_transactions de Stripe. */
export function extractPaymentIntents(
  resp: { data?: Array<{ source?: { payment_intent?: string } | null } | null> },
): string[] {
  return (resp.data ?? [])
    .map((tx) => tx?.source?.payment_intent)
    .filter((pi): pi is string => typeof pi === "string" && pi.length > 0);
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `deno test supabase/functions/stripe-webhook/payout.test.ts`
Expected: PASS (2 tests OK).

- [ ] **Step 5: Añadir el manejador `payout.paid`**

Tras el bloque `if (event.type === "checkout.session.completed") { ... }`, añadir:

```ts
  // --- Procesar payout.paid (conciliación con el banco) ---
  if (event.type === "payout.paid") {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const payout = event.data.object as { id?: string; arrival_date?: number };
    const payoutId = String(payout.id ?? "");

    if (STRIPE_SECRET_KEY && payoutId) {
      const arrival = payout.arrival_date
        ? new Date(payout.arrival_date * 1000).toISOString().slice(0, 10)
        : null;
      try {
        // Recorrer las balance transactions (charges) del payout, con paginación.
        let startingAfter: string | undefined;
        const paymentIntents: string[] = [];
        do {
          const params = new URLSearchParams({
            payout: payoutId,
            type: "charge",
            limit: "100",
            "expand[]": "data.source",
          });
          if (startingAfter) params.set("starting_after", startingAfter);
          const res = await fetch(`https://api.stripe.com/v1/balance_transactions?${params}`, {
            headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
          });
          if (!res.ok) throw new Error(`Stripe balance_transactions → ${res.status}: ${await res.text()}`);
          const page = await res.json() as {
            data?: Array<{ id: string; source?: { payment_intent?: string } | null }>;
            has_more?: boolean;
          };
          paymentIntents.push(...extractPaymentIntents(page));
          startingAfter = page.has_more && page.data?.length ? page.data[page.data.length - 1].id : undefined;
        } while (startingAfter);

        // Marcar cada booking de ese payout (pre-relleno; el operador confirma luego).
        for (const pi of paymentIntents) {
          await supabase
            .from("bookings")
            .update({ stripe_payout_id: payoutId, payout_arrival_date: arrival })
            .eq("stripe_payment_intent", pi);
        }
      } catch (payoutErr) {
        // No romper el webhook: Stripe necesita 200 y reintenta.
        console.error("payout.paid error (no crítico):", payoutErr);
        await supabase.from("events").insert({
          type: "payout_error",
          payload: { payout_id: payoutId, error: String(payoutErr) },
        });
      }
    }
  }
```

- [ ] **Step 6: Verificar tipos (Deno)**

Run: `deno check supabase/functions/stripe-webhook/index.ts`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts supabase/functions/stripe-webhook/payout.test.ts
git commit -m "feat(pagos): webhook payout.paid pre-rellena la conciliación con el banco"
```

---

## Despliegue (lo ejecuta el usuario)

1. Migración a prod: el usuario corre `supabase db push` (el harness bloquea esto al asistente).
2. Edge function: `bash deploy.sh` (deploy a prod, requiere autorización explícita).
3. Front: push a `master` (Vercel publica desde master). Verificar `npm run build` verde antes.
4. Fase 2 operativa: dar de alta el evento `payout.paid` en el dashboard de Stripe y asegurar `STRIPE_SECRET_KEY` en el entorno de la función. Hasta entonces el manejador no se dispara (la vista funciona igual con confirmación manual).

## Self-Review

**Cobertura del spec:**
- Modelo de datos (§4) → Task 1. ✓
- Backend Fase 1 (§5) → Task 4. ✓
- Backend Fase 2 / payout.paid (§5) → Task 5. ✓
- Frontend `/pagos` separado (§6) → Task 3. ✓
- KPIs con definiciones exactas (§8) → Task 2 (computeKpis) + test. ✓
- Estados banco (§8) → Task 2 (deriveBankState) + test. ✓
- Enlace Holded (§6) → Task 2 (holdedInvoiceUrl) + Task 3 (botón). ✓
- RLS (§7) → ya existe (op_book); documentado, sin tarea. ✓
- Facturas siempre borrador → no se toca la creación; constraint global. ✓
- No tocar Dashboard → Task 3 crea archivo nuevo; constraint global. ✓

**Placeholders:** ninguno (todo el código está completo).

**Consistencia de tipos:** `Booking`, `BankState`, `Kpis`, `deriveBankState`, `computeKpis`, `formatEuros`, `holdedInvoiceUrl`, `extractPaymentIntents` se definen en Task 2/5 y se consumen con las mismas firmas en Task 3/5. ✓

**A verificar en implementación (riesgos del spec §13):** formato exacto de la URL de Holded; `STRIPE_SECRET_KEY` presente en el entorno de la función; `deposit_amount` = importe total cobrado.
