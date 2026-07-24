// svix.ts — Verificación de la firma Svix (el esquema que usa Resend para firmar sus webhooks).
// Formato: cabeceras svix-id, svix-timestamp, svix-signature. La firma es
//   base64( HMAC-SHA256( base64decode(secret sin "whsec_"), `${id}.${timestamp}.${body}` ) )
// y svix-signature es una lista separada por espacios de "v1,<firma>" (puede traer varias
// durante una rotación de secreto). Aislado aquí para poder testearlo con el vector oficial.

/** Comparación en tiempo constante (evita timing attacks al validar la firma). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** Calcula la firma Svix esperada (base64) para un contenido dado. */
export async function svixSign(
  secret: string, // whsec_<base64> (o el base64 pelado)
  id: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const secretB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

/** True si alguna de las firmas del header svix-signature cuadra con la esperada. */
export async function verifySvixSignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string, // "v1,<b64> v1,<b64>..."
): Promise<boolean> {
  if (!secret || !id || !timestamp || !signatureHeader) return false;
  const expected = await svixSign(secret, id, timestamp, body);
  for (const part of signatureHeader.split(" ")) {
    const [, sig] = part.split(",");
    if (sig && timingSafeEqual(sig, expected)) return true;
  }
  return false;
}
