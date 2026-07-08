// create-checkout — Crea sesión de Stripe Checkout para que el negocio pague.
// Input (POST JSON): { lead_id, contact: { name, email, phone? } }
// Output: { checkout_url }
// PÚBLICO: sin auth. El negocio llega desde el enlace del email, sin sesión.
// Secrets: STRIPE_SECRET_KEY, APP_URL (o SUPABASE_URL fallback).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Precio: 397 € de BASE + 21 % IVA = 480,37 € total. Stripe cobra el total (bruto) y el webhook
// desglosa la base (total / 1,21 = 397 €) para la factura de Holded.
const PRECIO_BASE_CENTS = 39700; // 397 € base imponible
const IVA = 0.21;
const PRECIO_CENTS = Math.round(PRECIO_BASE_CENTS * (1 + IVA)); // 48037 = 480,37 € (IVA incl.)
const PLAN = "web-starter";
const PRODUCT_NAME = "Web profesional a medida";
const PRODUCT_DESC = "Web one-page mobile-first, lista para publicar. Primer mes de soporte incluido. Precio: 397 € + 21 % IVA.";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  // APP_URL es la URL pública del panel (ej: https://webforge.vercel.app).
  // En desarrollo apunta a localhost.
  const APP_URL = (Deno.env.get("APP_URL") ?? "http://localhost:5173").replace(/\/$/, "");

  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: "Config Supabase incompleta." }, 500);
  if (!STRIPE_SECRET_KEY) {
    return jsonResponse(
      { error: "Falta STRIPE_SECRET_KEY. Configúrala: npx supabase secrets set STRIPE_SECRET_KEY=sk_..." },
      500,
    );
  }

  // --- Input ---
  let body: {
    lead_id?: string;
    contact?: { name?: string; email?: string; phone?: string };
    fiscal?: { empresa?: string; nif?: string; direccion?: string; cp?: string; ciudad?: string; provincia?: string };
  };
  try { body = await req.json(); }
  catch { return jsonResponse({ error: "JSON inválido." }, 400); }

  const { lead_id, contact, fiscal } = body ?? {};
  if (!lead_id) return jsonResponse({ error: "Falta lead_id." }, 400);
  // contact y fiscal son OPCIONALES por diseño: Stripe Checkout recoge email, dirección de
  // facturación y NIF (tax_id) en su propia pantalla. La página /book no pide nada por adelantado
  // → cero fricción. `bookings.name/email` son nullable, así que el registro no se rompe sin datos.
  const contactName = contact?.name?.trim() || "";
  const contactEmail = contact?.email?.trim() || "";
  const contactPhone = contact?.phone?.trim() || "";

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // --- Lead ---
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, status")
    .eq("id", lead_id)
    .maybeSingle();
  if (!lead) return jsonResponse({ error: "Lead no encontrado." }, 404);

  // --- Site (para asociar al booking) ---
  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("lead_id", lead_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // --- Stripe Checkout Session ---
  // Usamos la API REST de Stripe (form-encoded) sin SDK para evitar dependencias.
  const stripeParams = new URLSearchParams({
    mode: "payment",
    "payment_method_types[0]": "card",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(PRECIO_CENTS),
    "line_items[0][price_data][product_data][name]": `${PRODUCT_NAME} — ${lead.name}`,
    "line_items[0][price_data][product_data][description]": PRODUCT_DESC,
    // Stripe recoge en su pantalla lo que antes exigíamos por adelantado (dirección + NIF).
    // El webhook los lee de session.customer_details para la factura de Holded.
    "billing_address_collection": "required",
    "tax_id_collection[enabled]": "true",
    "customer_creation": "always",
    "metadata[lead_id]": lead_id,
    "metadata[contact_name]": contactName,
    "metadata[contact_phone]": contactPhone,
    success_url: `${APP_URL}/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/book/${lead_id}`,
  });
  // Pre-rellenos opcionales: si nos llegan datos, se pasan; si no, Stripe los pide.
  if (contactEmail) stripeParams.set("customer_email", contactEmail);
  if (fiscal?.empresa?.trim()) stripeParams.set("metadata[fiscal_empresa]", fiscal.empresa.trim());
  if (fiscal?.nif?.trim()) stripeParams.set("metadata[fiscal_nif]", fiscal.nif.trim());
  if (fiscal?.direccion?.trim()) stripeParams.set("metadata[fiscal_direccion]", fiscal.direccion.trim());
  if (fiscal?.cp?.trim()) stripeParams.set("metadata[fiscal_cp]", fiscal.cp.trim());
  if (fiscal?.ciudad?.trim()) stripeParams.set("metadata[fiscal_ciudad]", fiscal.ciudad.trim());
  if (fiscal?.provincia?.trim()) stripeParams.set("metadata[fiscal_provincia]", fiscal.provincia.trim());

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: stripeParams.toString(),
  });

  const session = await stripeRes.json();
  if (!stripeRes.ok) {
    return jsonResponse(
      { error: `Stripe: ${(session as { error?: { message?: string } }).error?.message ?? "error desconocido"}` },
      502,
    );
  }

  // --- Booking ---
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .insert({
      lead_id,
      site_id: site?.id ?? null,
      name: contactName || null,
      email: contactEmail || null,
      phone: contactPhone || null,
      plan: PLAN,
      deposit_amount: PRECIO_CENTS,
      stripe_session_id: (session as { id: string }).id,
      stripe_payment_status: "pending",
      status: "started",
    })
    .select("id")
    .single();

  // Sin booking, un pago posterior quedaría HUÉRFANO: el webhook casa por stripe_session_id
  // y no encontraría fila. Mejor fallar ANTES de entregar el checkout_url que cobrar sin registro.
  if (bookingErr || !booking) {
    console.error("create-checkout: fallo al insertar booking:", bookingErr?.message);
    return jsonResponse({ error: "No se pudo registrar la reserva. Inténtalo de nuevo en un momento." }, 500);
  }

  // --- Lead → booked (si no está en un estado más avanzado) ---
  const advancedStatuses = ["booked", "won", "nurture"];
  if (!advancedStatuses.includes(lead.status)) {
    await supabase
      .from("leads")
      .update({ status: "booked", updated_at: new Date().toISOString() })
      .eq("id", lead_id);
  }

  // --- Evento de analítica ---
  await supabase.from("events").insert({
    lead_id,
    type: "booking_started",
    payload: { booking_id: booking.id, stripe_session_id: (session as { id: string }).id },
  });

  return jsonResponse({ checkout_url: (session as { url: string }).url });
});
