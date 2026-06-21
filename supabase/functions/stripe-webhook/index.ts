// stripe-webhook — Recibe eventos de Stripe y actualiza DB.
// checkout.session.completed → booking.paid, lead.status='won', evento 'booking_paid'.
// También crea contacto + factura BORRADOR en Holded (revisión manual: no la emite ni la cobra).
// payout.paid → pre-rellena stripe_payout_id y payout_arrival_date en bookings (conciliación bancaria).
// IMPORTANTE: este endpoint no lleva CORS (no lo llama el browser, lo llama Stripe).
// Verificación HMAC-SHA256 de la firma (Stripe-Signature header).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractPaymentIntents } from "./payout-utils.ts";

// ── Holded API ──────────────────────────────────────────────────────────────
const HOLDED_BASE = "https://api.holded.com/api";

async function holdedRequest(
  path: string,
  method: "GET" | "POST" | "PUT",
  apiKey: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${HOLDED_BASE}${path}`, {
    method,
    headers: { key: apiKey, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Holded ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

/** Crea o reutiliza contacto en Holded. Devuelve el contactId. */
async function upsertHoldedContact(
  apiKey: string,
  fiscal: { empresa: string; nif: string; direccion: string; cp: string; ciudad: string; provincia: string; email: string },
): Promise<string> {
  // Buscar por NIF primero
  const search = await holdedRequest(
    `/contacts/v1/contacts?vatNumber=${encodeURIComponent(fiscal.nif)}`,
    "GET",
    apiKey,
  ) as { list?: { id: string }[] };

  if (search?.list?.length) return search.list[0].id;

  // Crear contacto nuevo
  const created = await holdedRequest("/contacts/v1/contacts", "POST", apiKey, {
    name: fiscal.empresa,
    vatnumber: fiscal.nif,
    email: fiscal.email,
    address: fiscal.direccion,
    city: fiscal.ciudad,
    postalCode: fiscal.cp,
    province: fiscal.provincia,
    country: "ES",
    type: "client",
  }) as { id: string };

  return created.id;
}

/** Crea factura en borrador en Holded a partir del total cobrado (IVA incluido).
 *  No la emite ni la cobra — revisión manual obligatoria. */
async function createDraftHoldedInvoice(
  apiKey: string,
  contactId: string,
  leadName: string,
  totalCents: number, // total cobrado por Stripe, IVA incluido (céntimos)
): Promise<string> {
  const dateNum = Math.floor(Date.now() / 1000);
  // El precio de Stripe lleva el IVA incluido → desglosamos la base imponible.
  const baseEuros = Math.round(totalCents / 1.21) / 100;

  const invoice = await holdedRequest("/invoices/v1/invoices", "POST", apiKey, {
    contactId,
    date: dateNum,
    dueDate: dateNum,
    currency: "EUR",
    status: 0, // 0 = borrador en Holded
    items: [
      {
        name: `Web profesional a medida — ${leadName}`,
        units: 1,
        subtotal: baseEuros,
        tax: 21,
      },
    ],
  }) as { id: string };

  return invoice.id;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!SUPABASE_URL || !SERVICE_KEY || !WEBHOOK_SECRET) {
    return jsonResponse({ error: "Config incompleta (SUPABASE_URL, SERVICE_KEY, STRIPE_WEBHOOK_SECRET)." }, 500);
  }

  if (req.method !== "POST") return jsonResponse({ error: "Solo POST." }, 405);

  // Leer el body como texto ANTES de verificar la firma (no consumir el stream dos veces).
  const body = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  // --- Verificar firma Stripe (HMAC-SHA256) ---
  // Formato de Stripe-Signature: t=<unix_ts>,v1=<hex_hmac>[,v1=<hex_hmac2>]
  const parts: Record<string, string> = {};
  for (const piece of sigHeader.split(",")) {
    const [k, v] = piece.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const timestamp = parts["t"];
  const signature = parts["v1"];

  if (!timestamp || !signature) {
    return jsonResponse({ error: "Cabecera Stripe-Signature malformada." }, 400);
  }

  // Rechazar webhooks con más de 5 minutos de antigüedad (protección replay).
  const ts = Number(timestamp);
  if (Date.now() / 1000 - ts > 300) {
    return jsonResponse({ error: "Webhook demasiado antiguo." }, 400);
  }

  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected !== signature) {
    return jsonResponse({ error: "Firma Stripe inválida." }, 401);
  }

  // --- Parsear evento ---
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const HOLDED_API_KEY = Deno.env.get("HOLDED_API_KEY") ?? "";
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // --- Procesar checkout.session.completed ---
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const sessionId = String(session.id ?? "");
    const metadata = (session.metadata ?? {}) as Record<string, string>;
    const leadId = metadata.lead_id ?? "";
    const paymentStatus = String(session.payment_status ?? "");
    const customerEmail = String(session.customer_email ?? metadata.contact_name ?? "");

    if (paymentStatus === "paid" && sessionId) {
      // Marcar booking como pagado
      await supabase
        .from("bookings")
        .update({
          stripe_payment_status: "paid",
          status: "paid",
          stripe_payment_intent: String(session.payment_intent ?? "") || null,
          paid_at: new Date().toISOString(),
        })
        .eq("stripe_session_id", sessionId);

      if (leadId) {
        // Obtener nombre del lead para la factura
        const { data: lead } = await supabase
          .from("leads")
          .select("name")
          .eq("id", leadId)
          .maybeSingle();

        // Lead → won
        await supabase
          .from("leads")
          .update({ status: "won", updated_at: new Date().toISOString() })
          .eq("id", leadId);

        // Evento de auditoría
        await supabase.from("events").insert({
          lead_id: leadId,
          type: "booking_paid",
          payload: { stripe_session_id: sessionId },
        });

        // ── Holded: crear contacto + factura + marcar cobrada ──
        if (HOLDED_API_KEY && metadata.fiscal_nif) {
          try {
            const contactId = await upsertHoldedContact(HOLDED_API_KEY, {
              empresa: metadata.fiscal_empresa ?? lead?.name ?? "Cliente",
              nif: metadata.fiscal_nif,
              direccion: metadata.fiscal_direccion ?? "",
              cp: metadata.fiscal_cp ?? "",
              ciudad: metadata.fiscal_ciudad ?? "",
              provincia: metadata.fiscal_provincia ?? "",
              email: customerEmail,
            });
            const invoiceId = await createDraftHoldedInvoice(
              HOLDED_API_KEY,
              contactId,
              lead?.name ?? "Cliente",
              Number(session.amount_total ?? 0), // total cobrado (IVA incl.) en céntimos
            );
            // Guardar el id de la factura borrador en el booking
            await supabase
              .from("bookings")
              .update({ holded_invoice_id: invoiceId })
              .eq("stripe_session_id", sessionId);
            // Guardar el id de la factura borrador para referencia
            await supabase.from("events").insert({
              lead_id: leadId,
              type: "holded_draft_created",
              payload: { holded_invoice_id: invoiceId, holded_contact_id: contactId },
            });
          } catch (holdedErr) {
            // No fallar el webhook si Holded falla — Stripe necesita 200
            console.error("Holded error (no crítico):", holdedErr);
            await supabase.from("events").insert({
              lead_id: leadId,
              type: "holded_error",
              payload: { error: String(holdedErr) },
            });
          }
        }
      }
    }
  }

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
        try {
          await supabase.from("events").insert({
            type: "payout_error",
            payload: { payout_id: payoutId, error: String(payoutErr) },
          });
        } catch (insertErr) {
          console.error("payout_error insert falló:", insertErr);
        }
      }
    }
  }

  // Stripe espera 200 para confirmar recepción.
  return jsonResponse({ received: true });
});
