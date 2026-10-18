// Probe SMTP gratis antes de un lote frío (cualquier producto): MX + EHLO/MAIL FROM/RCPT TO, sin DATA.
// Nunca se envía nada. Si una dirección da 55x, se repite con postmaster@ del mismo dominio: si
// postmaster también rechaza, es el servidor bloqueando el probe (p. ej. mx1.hostinger.com), no el buzón.
//
//   node orquestador/smtp-probe.mjs a@x.com b@y.es ...       → tabla por consola
//   node orquestador/smtp-probe.mjs --json lista.json        → lista = ["a@x.com", ...]; imprime JSON
import { promises as dns } from "node:dns";
import net from "node:net";
import { readFileSync } from "node:fs";

const FROM = "probe@nico-soto.es";
const HELO = "nico-soto.es";

function rcpt(mx, addresses, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const sock = net.createConnection(25, mx);
    const codes = [];
    let buf = "";
    let step = 0;
    const cmds = [`EHLO ${HELO}`, `MAIL FROM:<${FROM}>`, ...addresses.map((a) => `RCPT TO:<${a}>`), "QUIT"];
    const done = (r) => { clearTimeout(t); sock.destroy(); resolve(r); };
    const t = setTimeout(() => done({ error: "timeout", codes }), timeoutMs);
    sock.on("error", (e) => done({ error: e.code ?? "error", codes }));
    sock.on("close", () => done({ error: step < cmds.length ? "cerrada" : null, codes }));
    sock.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split("\r\n");
      buf = lines.pop();
      for (const l of lines) {
        if (!/^\d{3} /.test(l)) continue; // respuesta multilínea: solo cuenta la última
        if (step > 0) codes.push(l.slice(0, 3) + " " + l.slice(4, 60));
        if (step === 0 && !l.startsWith("2")) return done({ error: `banner ${l.slice(0, 3)}`, codes });
        if (step < cmds.length) sock.write(cmds[step++] + "\r\n");
      }
    });
  });
}

export async function probe(email) {
  const domain = email.split("@")[1];
  let mxs;
  try {
    mxs = (await dns.resolveMx(domain)).sort((a, b) => a.priority - b.priority);
  } catch {
    return { email, verdict: "SIN MX" };
  }
  if (!mxs.length) return { email, verdict: "SIN MX" };
  const mx = mxs[0].exchange;
  const fake = `zz-no-existe-${Date.now()}@${domain}`;
  const r = await rcpt(mx, [email, fake]);
  // codes: [EHLO, MAIL, RCPT real, RCPT falso, QUIT]
  const real = r.codes[2]?.slice(0, 3);
  const fakeC = r.codes[3]?.slice(0, 3);
  if (!real) return { email, mx, verdict: `sin señal (${r.error ?? "?"})` };
  if (real.startsWith("25")) return { email, mx, verdict: fakeC?.startsWith("25") ? "catch-all" : "OK" };
  if (real.startsWith("55")) {
    const pm = await rcpt(mx, [`postmaster@${domain}`]);
    const pmC = pm.codes[2]?.slice(0, 3);
    if (pmC?.startsWith("25")) return { email, mx, verdict: "RECHAZO", detalle: r.codes[2] };
    return { email, mx, verdict: `servidor bloquea probe (${real}/${pmC ?? "?"})` };
  }
  return { email, mx, verdict: `servidor bloquea probe (${real})`, detalle: r.codes[2] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const json = args[0] === "--json";
  const list = json ? JSON.parse(readFileSync(args[1], "utf8")) : args;
  const out = [];
  for (let i = 0; i < list.length; i += 6) {
    out.push(...(await Promise.all(list.slice(i, i + 6).map(probe))));
  }
  if (json) console.log(JSON.stringify(out, null, 1));
  else for (const r of out) console.log(`${r.verdict.padEnd(32)} ${r.email}`);
}
