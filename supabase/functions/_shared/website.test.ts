// node --experimental-strip-types supabase/functions/_shared/website.test.ts
import { detectWidgets } from "./website.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
}

// Bot-builder puro → hasBot true, y hasChat true (un bot ES un widget de chat).
const landbot = detectWidgets('<script src="https://static.landbot.io/landbot-3/x.js"></script>');
assert(landbot.hasBot === true, "Landbot → hasBot");
assert(landbot.hasChat === true, "Landbot → hasChat");
assert(landbot.vendors.includes("Landbot"), "Landbot en vendors");

const manychat = detectWidgets('<div class="mch_widget" data-manychat></div>');
assert(manychat.hasBot === true, "ManyChat → hasBot");

const chatfuel = detectWidgets('<script src="https://static.chatfuel.com/widget.js"></script>');
assert(chatfuel.hasBot === true, "Chatfuel → hasBot");

// Chat con humano → hasChat true pero hasBot FALSE.
const tawk = detectWidgets('<script src="https://embed.tawk.to/abc/default"></script>');
assert(tawk.hasChat === true, "Tawk → hasChat");
assert(tawk.hasBot === false, "Tawk → NO hasBot");

// WhatsApp sin chat.
const wa = detectWidgets('<a href="https://wa.me/34600111222">WhatsApp</a>');
assert(wa.hasWhatsapp === true, "wa.me → hasWhatsapp");
assert(wa.hasChat === false && wa.hasBot === false, "wa.me → sin chat ni bot");

// Web pelada → todo false.
const none = detectWidgets("<html><body>hola</body></html>");
assert(!none.hasChat && !none.hasWhatsapp && !none.hasBot, "web pelada → todo false");

console.log(failures === 0 ? "\nOK" : `\n${failures} FALLO(S)`);
if (failures) process.exit(1);
