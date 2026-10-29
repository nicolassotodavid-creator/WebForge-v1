# Brief para redactar el email 2 (recordatorio) de Luvia

Contexto: Luvia IA vende a clínicas estéticas/capilares/fisio. A 179 clínicas se les mandó un email 1 (18–21 oct 2026).
Ese email 1 se escribió antes del método editorial y prometía de más (WhatsApp y teléfono «al momento», cita en la agenda,
«No os lo creáis», enlaces). El email 2 va en el mismo hilo y corrige con calma: solo dice lo que funciona hoy.
Lee `docs/luvia/prospeccion/METODO-EDITORIAL.md` y `borrador.md` (esta carpeta) antes de empezar.

## Datos
Ejecuta `eligibles.sql` (esta carpeta) en el proyecto Supabase `khscikqchvjxyvoaruas` con la herramienta
mcp__Supabase__execute_sql (cárgala con ToolSearch "select:mcp__Supabase__execute_sql"), añadiendo al final un filtro por tu rango
de `n` (envuelve la consulta: `select * from (<consulta sin el order by final>) t where n between A and B order by n`).
SOLO LECTURA: no escribas nada en la base de datos ni envíes nada.

## Qué escribir por clínica
Cuerpo = 6 párrafos separados por una línea en blanco:

1. Saludo: copia el saludo del email 1 tal cual (su primera línea, «Hola, …:»). Si no empieza por «Hola», usa «Hola, equipo de <nombre corto de la clínica>:».
2. «Te escribí la semana pasada por {hallazgo}. Te lo cuento mejor, porque en aquel correo fui demasiado deprisa.»
   {hallazgo} = el detalle concreto de SU clínica que abría el email 1, resumido en una línea. Solo hechos que aparecen en el email 1;
   no añadas datos nuevos. Si el email 1 citaba algo literal entre «», puedes mantener la cita.
3. Dolor: una frase, en CONDICIONAL («puede que…», «quizá…»), ligada a ese hallazgo. Debe acabar en la idea de que quien escribe/llama
   puede tener que esperar y quizá pregunte en otra clínica (dilo con naturalidad, no siempre con las mismas palabras exactas).
   Prohibido afirmar que lo sufren («nadie contesta», «perdéis llamadas»).
4. Solución — elige la variante por el tema del hallazgo:
   - A (por defecto, web/formulario/reserva/consulta): «Con las primeras clínicas estamos poniendo en marcha Luvia en su propia web: un chat con IA que responde con la información que vosotros aprobáis, pasa al equipo todo lo médico y os avisa, y una página de reserva con vuestros huecos reales. Lo clínico sigue siendo siempre cosa vuestra.»
   - B (si el hallazgo va de WhatsApp): la A + « Con WhatsApp todavía estamos en piloto.» (añadida antes de «Lo clínico…» o al final del párrafo).
   - C (si el hallazgo va de teléfono/llamadas/fijo): «Con las primeras clínicas estamos poniendo en marcha Luvia: un chat con IA en su web que responde con la información que vosotros aprobáis, pasa al equipo todo lo médico y os avisa, y un asistente de voz para las llamadas que el equipo no llega a coger. Lo clínico sigue siendo siempre cosa vuestra.»
5. «Si ahora no es el momento, dímelo y no vuelvo a escribirte.»
6. «¿Te interesa que te enseñe cómo funcionaría en vuestra clínica?»

Firma (aparte, no en el cuerpo): «Nico · Luvia IA».

## Reglas duras (QA automático después)
- 110–140 palabras del saludo a la CTA (sin firma). Ajusta {hallazgo}/dolor para caer dentro.
- Una sola «?» en todo el cuerpo (la de la CTA). Nada de interrogaciones en el hallazgo.
- 0 enlaces, 0 «http», 0 «wa.me».
- Prohibido: «24/7», «al momento», «en segundos», «recordatorio», «agenda automática», precios, «clienta», «No os lo creáis», «probadla», «gratis», reseñas o notas de Google como argumento, cifras inventadas.
- No digas que Luvia funciona por WhatsApp, Instagram o teléfono (salvo las variantes B/C literales).
- Trato: tú/vosotros como en la plantilla. Fisioterapia: «paciente», nunca «clienta».

## Salida
Escribe `parte-<A>-<B>.json` en esta carpeta: array JSON, un objeto por clínica, en orden de n:
{"n", "lead_id", "email1_id", "name", "email", "subject": "Re: " + subject del email 1 (tal cual), "variante": "A"|"B"|"C",
 "hallazgo": "<frase del párrafo 2 sin el marco>", "body": "<cuerpo completo con \n\n entre párrafos, sin firma>"}
Valida tú mismo con un script de node (palabras, «?», prohibidos) antes de terminar. Responde solo con: cuántas escritas, cuántas por variante,
y las que tuvieran algo raro (email 1 sin hallazgo claro, etc.). No hagas commit.
