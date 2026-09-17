// replyMatch.ts — Saca el remitente de un aviso de "email recibido" (webhook de Zoho Mail u otro
// reenviador) para casarlo con un lead. Puro, sin dependencias: lo usa mark-replied (Deno) y su
// test (node --experimental-strip-types supabase/functions/_shared/replyMatch.test.ts).

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// Dominios de correo gratuito: casar por dominio aquí juntaría a negocios distintos.
const FREE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es",
  "live.com", "yahoo.com", "yahoo.es", "icloud.com", "me.com", "msn.com", "aol.com",
  "protonmail.com", "proton.me", "gmx.com", "gmx.es", "telefonica.net", "movistar.es",
]);

export function isFreeDomain(domain: string): boolean {
  return FREE_DOMAINS.has(domain.toLowerCase());
}

/** Correos nuestros: nunca son la respuesta de un lead (reenvíos, copias, rebotes). */
export function isOwnAddress(email: string, ownDomains: string[]): boolean {
  const d = email.split("@")[1]?.toLowerCase() ?? "";
  return ownDomains.some((o) => d === o || d.endsWith(`.${o}`)) ||
    /mailer-daemon|postmaster|no-?reply/i.test(email);
}

/**
 * Remitente del aviso. Mira primero los campos con nombre de remitente (fromAddress, from, sender…,
 * a cualquier profundidad) y, si no hay, el primer email del cuerpo que no sea nuestro.
 */
export function extractSender(payload: unknown, ownDomains: string[]): string | null {
  const preferred: string[] = [];
  const others: string[] = [];
  const walk = (v: unknown, key: string, depth: number) => {
    if (depth > 5 || v == null) return;
    if (typeof v === "string") {
      const found = v.match(EMAIL_RE) ?? [];
      (/^(from|fromaddress|from_address|sender|reply_?to|return_?path)$/i.test(key) ? preferred : others)
        .push(...found);
    } else if (Array.isArray(v)) {
      v.forEach((x) => walk(x, key, depth + 1));
    } else if (typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, k, depth + 1);
    }
  };
  walk(payload, "", 0);
  const pick = (list: string[]) => list.map((e) => e.toLowerCase()).find((e) => !isOwnAddress(e, ownDomains));
  return pick(preferred) ?? pick(others) ?? null;
}

export function subjectOf(payload: unknown): string | null {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const s = p.subject ?? p.Subject;
    if (typeof s === "string") return s.slice(0, 200);
  }
  return null;
}
