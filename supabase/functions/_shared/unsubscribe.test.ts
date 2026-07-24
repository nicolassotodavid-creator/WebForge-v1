// Tests del helper de baja one-click. Correr: deno test supabase/functions/_shared/unsubscribe.test.ts
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { signUnsubscribe, unsubscribeUrl, verifyUnsubscribe } from "./unsubscribe.ts";

const SECRET = "clave-de-servidor-de-prueba";
const LEAD = "9334c48a-0000-0000-0000-000000000000";

Deno.test("la firma valida contra sí misma (roundtrip)", async () => {
  const sig = await signUnsubscribe(LEAD, SECRET);
  assert(await verifyUnsubscribe(LEAD, sig, SECRET));
});

Deno.test("firma estable: mismo lead+clave → misma firma", async () => {
  assertEquals(await signUnsubscribe(LEAD, SECRET), await signUnsubscribe(LEAD, SECRET));
});

Deno.test("rechaza firma de OTRO lead (no se puede reusar el token)", async () => {
  const sig = await signUnsubscribe(LEAD, SECRET);
  assertEquals(await verifyUnsubscribe("otro-lead-id", sig, SECRET), false);
});

Deno.test("rechaza firma manipulada", async () => {
  const sig = await signUnsubscribe(LEAD, SECRET);
  const tampered = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
  assertEquals(await verifyUnsubscribe(LEAD, tampered, SECRET), false);
});

Deno.test("rechaza firma con OTRA clave (la clave separa a webforge de cualquier copia)", async () => {
  const sig = await signUnsubscribe(LEAD, SECRET);
  assertEquals(await verifyUnsubscribe(LEAD, sig, "otra-clave"), false);
});

Deno.test("rechaza vacíos", async () => {
  assertEquals(await verifyUnsubscribe("", "abc", SECRET), false);
  assertEquals(await verifyUnsubscribe(LEAD, "", SECRET), false);
});

Deno.test("la URL apunta a la función y lleva lead+sig", async () => {
  const sig = await signUnsubscribe(LEAD, SECRET);
  const url = unsubscribeUrl("https://ref.supabase.co", LEAD, sig);
  assertStringIncludes(url, "/functions/v1/unsubscribe?");
  assertStringIncludes(url, `lead=${LEAD}`);
  assertStringIncludes(url, `sig=${sig}`);
});

Deno.test("la URL no duplica la barra si SUPABASE_URL trae barra final", () => {
  const url = unsubscribeUrl("https://ref.supabase.co/", LEAD, "deadbeef");
  assert(!url.includes(".co//functions"));
});
