// unsubscribe.ts — Enlaces de baja con UN click (RFC 8058 List-Unsubscribe).
//
// Por qué existe: Gmail/Yahoo (feb-2024) priorizan fuerte a los remitentes que ofrecen una
// baja legible por máquina. La cabecera `List-Unsubscribe` + `List-Unsubscribe-Post` pinta el
// botón "Cancelar suscripción" nativo del cliente y baja las quejas de spam → mejor bandeja.
// El pie "responde BAJA" (LSSI/RGPD) sigue estando; esto es la vía automática que complementa.
//
// Seguridad: el enlace lleva una FIRMA HMAC-SHA256 sobre "unsub:v1:<leadId>". Así un tercero
// no puede dar de baja leads a los que no tiene el enlace (los IDs son UUID, ya no adivinables;
// la firma cierra el caso aunque un ID se filtre en un log). La clave es una clave de servidor
// (reutilizamos SUPABASE_SERVICE_ROLE_KEY, presente ya en el runtime de todas las funciones):
//  - HMAC es de un solo sentido → el token NUNCA revela la clave.
//  - La etiqueta "unsub:v1:" separa dominios → el token no vale para ninguna otra cosa.
//  - Cero secretos nuevos → cero fricción de despliegue (no hay que ir a poner un secret).

const ENC = new TextEncoder();

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENC.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, ENC.encode(message));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Firma corta: 20 hex = 80 bits. De sobra para que un enlace de baja no sea adivinable
// (y el peor caso de una firma acertada es una baja reversible desde el panel, no una fuga).
export async function signUnsubscribe(leadId: string, secret: string): Promise<string> {
  return (await hmacHex(`unsub:v1:${leadId}`, secret)).slice(0, 20);
}

/** Comparación en tiempo constante (evita timing attacks al validar la firma). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyUnsubscribe(
  leadId: string,
  sig: string,
  secret: string,
): Promise<boolean> {
  if (!leadId || !sig) return false;
  return timingSafeEqual(sig, await signUnsubscribe(leadId, secret));
}

// URL absoluta de baja para la cabecera List-Unsubscribe y el enlace del pie del email.
// `supabaseUrl` = SUPABASE_URL (p.ej. https://<ref>.supabase.co).
export function unsubscribeUrl(supabaseUrl: string, leadId: string, sig: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/functions/v1/unsubscribe?lead=${encodeURIComponent(leadId)}&sig=${encodeURIComponent(sig)}`;
}
