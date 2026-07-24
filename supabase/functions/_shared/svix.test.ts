// Verificación de la firma Svix contra el VECTOR OFICIAL de la doc de Svix/Resend.
// Correr: deno test supabase/functions/_shared/svix.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { svixSign, verifySvixSignature } from "./svix.ts";

// Vector oficial (https://docs.svix.com/receiving/verifying-payloads/how-manual):
const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const ID = "msg_p5jXN8AQM9LWM0D4loKWxJek";
const TS = "1614265330";
const PAYLOAD = '{"test": 2432232314}';
const EXPECTED = "g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";

Deno.test("svixSign reproduce la firma del vector oficial", async () => {
  assertEquals(await svixSign(SECRET, ID, TS, PAYLOAD), EXPECTED);
});

Deno.test("verifySvixSignature acepta el header oficial (v1,<firma>)", async () => {
  assert(await verifySvixSignature(SECRET, ID, TS, PAYLOAD, `v1,${EXPECTED}`));
});

Deno.test("acepta cuando hay varias firmas (rotación de secreto)", async () => {
  const header = `v1,firmaVieja v1,${EXPECTED}`;
  assert(await verifySvixSignature(SECRET, ID, TS, PAYLOAD, header));
});

Deno.test("rechaza body manipulado", async () => {
  assertEquals(
    await verifySvixSignature(SECRET, ID, TS, '{"test": 999}', `v1,${EXPECTED}`),
    false,
  );
});

Deno.test("rechaza timestamp distinto (protege contra replay con otro ts)", async () => {
  assertEquals(
    await verifySvixSignature(SECRET, ID, "1614265999", PAYLOAD, `v1,${EXPECTED}`),
    false,
  );
});

Deno.test("rechaza header vacío o sin v1", async () => {
  assertEquals(await verifySvixSignature(SECRET, ID, TS, PAYLOAD, ""), false);
});
