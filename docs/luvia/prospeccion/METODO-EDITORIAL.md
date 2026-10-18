# [LUVIA] Método editorial de prospección (regla permanente)

Aprobado por Nico el 18-oct-2026. Se aplica a **toda** investigación y campaña comercial de Luvia:
email frío, formularios de contacto, guiones de llamada y seguimientos. Primer lote hecho con él:
`anunciantes-2026-10-18/`. Si una regla de aquí choca con un lote viejo, manda esta.

## 1. Estructura obligatoria (6 piezas, en este orden)

| # | Pieza | Qué tiene que llevar | Qué no puede llevar |
|---|---|---|---|
| 1 | **Asunto** | Un detalle real de esa clínica: su anuncio, su oferta, su botón, su horario. Entre 35 y 65 caracteres. Único en el lote. | «Gratis», interrogación, condición de salud, nombre de Luvia como gancho. |
| 2 | **Apertura** | «Soy Nico, de Luvia.» + un hallazgo **público y comprobable** que demuestre que hemos estudiado su negocio o su publicidad. Cita literal entre «» cuando sea posible. | Reseñas ni notas de Google como argumento, cifras sin fuente, frases que valdrían para cualquier clínica. |
| 3 | **Dolor** | Un solo problema comercial concreto, planteado en **condicional** («puede tener que esperar», «quizá consulte a otra clínica»). | Afirmar que lo sufren («nadie contesta», «perdéis llamadas»). Deducir gasto, leads o llamadas perdidas del número de anuncios. |
| 4 | **Solución** | Luvia con capacidades **verificadas hoy** (ver §3). «Estamos trabajando / poniendo en marcha con las primeras clínicas…». Lo médico o clínico se queda siempre con su equipo. | Funciones sin validar de punta a punta, integraciones que no existen, precios, garantías, porcentajes. |
| 5 | **CTA** | Una sola pregunta, sin enlaces. Preferida: **«¿Te interesa que te enseñe cómo funcionaría en vuestra clínica?»** | Dos CTA, enlaces a la web o a wa.me, «probadla», «No os lo creáis». |
| 6 | **Firma** | `Nico · Luvia IA` | Cargos, eslóganes, teléfonos. El pie legal y la baja los pone `send-email`. |

Longitud del cuerpo (saludo a CTA, sin firma): **110–140 palabras**. Es un rango de partida, a validar con datos.
Saludo: «Hola, <nombre>:» solo si el nombre consta en una fuente; si no, «Hola, equipo de <clínica>:». Trato de tú/vosotros.

## 2. Cómo se adapta el argumento

| Lo que busca su publicidad o su web | Argumento principal |
|---|---|
| **Llamadas** (botón de llamada, «Call Now», teléfono como CTA) | Atención telefónica con IA: atiende cuando el equipo no llega y deja la solicitud anotada. |
| **Formularios** («Pedir presupuesto», «Obtener oferta», formulario de Meta) | Lo importante que es contestar rápido. **No** prometer conexión con formularios de Meta. Luvia responde en su web y ordena la solicitud. |
| **Tratamiento de alto valor** (injerto, implantes, ofertas con precio) | Lo que vale comercialmente cada oportunidad, usando **su** dato público (su precio, su oferta). Nunca cálculos de retorno con precios de Luvia. |
| **Mensajes de Instagram o WhatsApp** | Decir la verdad: hoy funciona en la web; Instagram está en desarrollo y WhatsApp en piloto. |
| **Sin web propia** (solo Facebook o Gmail) | No nombrar un canal concreto de Luvia. Se concreta en la demo. |

## 3. Capacidades que se pueden nombrar (actualizar cuando cambien)

Estado a 18-oct-2026, sacado de `revision-141/informe-final-2026-10-18.md` §5:

- **Sí:** chat con IA en la web de la clínica (responde con la información que aprueba la clínica, deriva lo médico y avisa al equipo); página de reserva online con huecos reales; CRM con bandeja, agenda, fichas y bonos; asistente de voz como demo controlada («estamos poniendo en marcha»).
- **No, como funcionando:** WhatsApp de la clínica (sin validar de punta a punta), Instagram (sin desplegar), recordatorios a pacientes, agenda automática, voz en otros idiomas.

## 4. Antes de enviar o programar nada (bloqueante)

1. **Base legal documentada para el email comercial (LSSI art. 21).** Hoy NO existe: es la condición que bloquea todo envío. Que el email sea público no es consentimiento. Si no hay documento de habilitación, el lote se queda en borrador.
2. **Pie legal completo:** razón social, NIF, domicilio y aviso legal publicado (`LUVIA_SENDER_IDENTITY` y `LUVIA_LEGAL_URL`). Información del RGPD art. 14 (origen de los datos y derechos).
3. **Deduplicación:** contra `leads` y `outreach_messages` de WebForge (email, dominio y nombre), contra los ficheros de `docs/luvia/prospeccion/`, contra el CRM de Luvia (`contacts`, `clientes`, `organizations`) y contra el Gmail enviado. Excluir cualquier `do_not_contact` o baja.
4. **Destinatario:** el email tiene que estar publicado en su web o en su aviso legal (anotar la fuente). Probe SMTP con `orquestador/smtp-probe.mjs`. Un buzón de redes sociales o un Gmail se marca.
5. **Hechos:** volver a comprobar el día del envío lo que puede caducar (anuncio activo, oferta, web caída).
6. **Render:** pasar los textos por `renderEmail` (marca `luvia`) de `supabase/functions/_shared/emailTemplate.ts` y mirarlos.
7. **Lotes separados:** cada lote en su carpeta y con su script. Nunca reutilizar un job programado de otro lote.

## 5. Qué se entrega en cada lote

Una carpeta `docs/luvia/prospeccion/<lote>-<fecha>/` con:
- `borradores.src.json`: por clínica, destinatario y su fuente, SMTP, asunto, cuerpo, hechos con su fuente e hipótesis.
- `borradores-10.json` (o `-N`): lo mismo más el HTML renderizado.
- `preview-N.html`: vista de cada email tal como sale.
- `informe.md`: preparados, elegibles, excluidos y por qué, estado del envío.

QA automático mínimo: rango de palabras, una sola «?», CTA al final, firma, 0 enlaces en el cuerpo,
0 patrones prohibidos (24/7, «al momento» atribuido a Luvia, recordatorios, agenda automática, precios de Luvia,
«clienta», «No os lo creáis»), asuntos únicos entre 35 y 65 caracteres y emails únicos.
