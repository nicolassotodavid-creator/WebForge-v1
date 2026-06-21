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
