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
