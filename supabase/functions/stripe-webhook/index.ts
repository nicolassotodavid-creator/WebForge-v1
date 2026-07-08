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

/** Comparación de strings hex en tiempo constante (evita timing attacks en la firma). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
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
  // Stripe puede enviar varios v1= durante una rotación del signing secret: acumúlalos todos.
  let timestamp = "";
  const signatures: string[] = [];
  for (const piece of sigHeader.split(",")) {
    const [k, v] = piece.split("=");
    if (!k || !v) continue;
    const key = k.trim();
    const val = v.trim();
    if (key === "t") timestamp = val;
    else if (key === "v1") signatures.push(val);
  }

  if (!timestamp || signatures.length === 0) {
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

  // Comparación en tiempo constante contra cada v1 (evita timing attacks).
  const valid = signatures.some((sig) => timingSafeEqualHex(sig, expected));
  if (!valid) {
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
    // Datos que Stripe recoge en su pantalla (email, dirección de facturación, NIF/tax_id).
    // Son el fallback cuando la reserva vino de /book sin datos fiscales por adelantado.
    const details = (session.customer_details ?? {}) as {
      email?: string;
      name?: string;
      address?: { line1?: string; line2?: string; city?: string; postal_code?: string; state?: string; country?: string };
      tax_ids?: Array<{ type?: string; value?: string }>;
    };
    const customerEmail = String(session.customer_email ?? details.email ?? "");
    const stripeNif = details.tax_ids?.find((t) => t?.value)?.value ?? "";

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
        // Preferimos el metadata (si algún día llega); si no, usamos lo que Stripe recogió.
        // Sin NIF por ninguna vía, se salta la factura sin petar (el operador la hace a mano).
        const addr = details.address ?? {};
        const fiscalNif = metadata.fiscal_nif || stripeNif;
        if (HOLDED_API_KEY && fiscalNif) {
          try {
            const contactId = await upsertHoldedContact(HOLDED_API_KEY, {
              empresa: metadata.fiscal_empresa || details.name || lead?.name || "Cliente",
              nif: fiscalNif,
              direccion: metadata.fiscal_direccion || [addr.line1, addr.line2].filter(Boolean).join(", ") || "",
              cp: metadata.fiscal_cp || addr.postal_code || "",
              ciudad: metadata.fiscal_ciudad || addr.city || "",
              provincia: metadata.fiscal_provincia || addr.state || "",
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
