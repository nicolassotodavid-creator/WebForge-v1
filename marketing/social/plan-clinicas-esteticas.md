# Plan de comunicación — Clínicas estéticas (web → upsell WhatsApp/Luvia)

**Fecha:** 2026-07-06 · **Estado:** propuesta, pendiente de OK de Nico
**Relación con lo existente:** especializa el canal IG/TikTok ya diseñado
(`docs/superpowers/specs/2026-07-06-canal-contenido-ig-tiktok-design.md`) en el nicho
de clínicas estéticas. Mismo sistema (lote semanal con `/lote-contenido`, gate de
aprobación, publicación semi-manual); cambian el público, la mezcla de formatos y la
línea editorial.

---

## 1. La estrategia en una frase

**Entrar en clínicas estéticas con la web (pago único, riesgo cero: la ven antes de
pagar) y, a los 30–60 días, hacer upsell de Luvia (recepcionista IA de llamadas y
WhatsApp, recurrente) usando los datos que la propia web genera.**

### Por qué clínicas estéticas como primer nicho

- **Ticket alto por paciente**: una valoración son cientos de euros; un tratamiento,
  miles. Recuperar 2-3 pacientes/mes ya paga web + Luvia. El argumento de venta es
  aritmética, no diseño.
- **Decisión emocional y nocturna**: la paciente decide desde el sofá, a las 22:00,
  comparando 3 clínicas en Instagram. Quien deja reservar en 2 toques, gana.
- **Recepción estructuralmente desbordada**: la recepcionista cobra, coge el teléfono
  y contesta WhatsApp a la vez. Las llamadas perdidas no son negligencia, son sistema.
- **Ya viven en Instagram**: invierten en contenido y ads, pero el embudo muere en un
  "link en bio → WhatsApp que contesta mañana". Nuestra oferta repara ese embudo.
- **Luvia ya está nichada ahí**: luvia-ia.es tiene testimonios reales, métricas y
  compliance (GDPR, AI Act, datos en UE). El upsell no parte de cero: parte de prueba
  social existente.

### La escalera de valor

| Escalón | Producto | Modelo | Dolor que ataca |
|---|---|---|---|
| 1. Entrada | Web con reservas 24h (pipeline WebForge) | Pago único, "la ves antes de pagar", sin permanencia | Pacientes que no pueden reservar fuera de horario; web de plantilla que no convierte |
| 2. Upsell | Luvia — recepcionista IA (llamadas + WhatsApp) | Recurrente (MRR) | Llamadas perdidas, WhatsApp tarde, no-shows, huecos sin rellenar |

**La sinergia que lo une todo:** la web se entrega con el botón de WhatsApp desde el
día 1. A los 30-60 días, el upsell se apoya en datos reales de SU web: *"tu web ha
recibido N visitas fuera de horario este mes — ¿quién contesta a esas pacientes?"*.
La web es el caballo de Troya y el generador del argumento del upsell.

---

## 2. Puntos de dolor del nicho (base del mensaje)

Extraídos de luvia-ia.es (testimonios y métricas reales) + realidad operativa del sector:

1. **Llamadas perdidas** — "Esa llamada perdida era una valoración de cientos de euros
   que no vuelve a llamar." Testimonio real: *"Antes perdíamos el 40% de las llamadas"*
   (Marta Ruiz, Clínica Marta Ruiz).
2. **WhatsApp contestado tarde** — a las 3 horas, la paciente ya reservó en la
   competencia. En estética se compra en caliente; contestar frío = no vender.
3. **Fuera de horario** — la mayor parte de la decisión ocurre cuando la clínica está
   cerrada. Métrica Luvia: **+38% de mensajes contestados fuera de horario**.
4. **No-shows y huecos** — cancelaciones de última hora sin lista de espera; **−27% de
   no-shows con recordatorios automáticos**. Testimonio real: *"Llenó tres huecos el
   primer sábado"* (Nuria Vidal, Studio Nuria).
5. **Campañas que desbordan** — la clínica paga ads, llegan 30 consultas a la vez, se
   contestan 12. El ad genera pacientes… para la clínica de al lado.
6. **Web-folleto** — foto de stock, "solicita información", sin precios orientativos,
   sin reservas. La paciente que compara tres clínicas descarta la que no deja reservar.
7. **Miedo al robot** (objeción, no dolor) — neutralizada con el testimonio real:
   *"Mis pacientes creen que contesta Sara, mi recepcionista"* (Laura Cano, Belle Estética).

**Línea editorial del canal (versión nicho):**
> *"Tu clínica pierde pacientes cada día sin que lo sepas: fuera de horario, en llamadas
> perdidas y en WhatsApps contestados tarde. Una web que reserva sola y una recepcionista
> IA lo arreglan."*

### Reglas de contenido específicas del nicho (importante)

- **Cero claims médicos.** Hablamos de gestión y captación, nunca de resultados de
  tratamientos. Nada de antes/después de caras o cuerpos (publicidad sanitaria regulada
  en España). Nuestros "antes/después" son **de webs**, no de pacientes.
- **El avatar no viste de sanitario** (ni bata ni uniforme clínico): no somos médicos y
  no aparentamos serlo. Look consultora/business casual elegante.
- **Solo testimonios reales** (los de luvia-ia.es o clientes propios verificables). Las
  recreaciones con avatar se etiquetan "creado con IA" y "testimonio real, imagen
  recreada". **Nunca se inventa una review.**
- **Cifras solo verificables** (las de Luvia: 40% llamadas, +38%, −27%, 3,2×, <2 min).
  Si no hay fuente, se reformula como pregunta ("cuenta las llamadas que perdiste esta
  semana"), regla ya vigente en `hooks.md`.

---

## 3. Los tres pilares de mensaje

- **P1 — La paciente invisible.** A las pacientes que pierdes no las ves: no se quejan,
  no llegan. Deciden de noche, llaman una vez, escriben y nadie contesta a tiempo.
- **P2 — Tu recepción tiene un límite.** No es un problema de personas sino de sistema:
  nadie puede atender mostrador + teléfono + WhatsApp a la vez. La IA no sustituye a tu
  recepcionista: le quita lo que la desborda.
- **P3 — Prueba y transformación.** Webs reales, métricas reales, testimonios reales.
  Y el modelo sin riesgo: "te enseño tu web terminada antes de que pagues nada".

Arco narrativo del mes: **S1 dolor (P1) → S2 la web, producto de entrada (P3) → S3 la
recepción IA, siembra del upsell (P2) → S4 prueba + objeciones + cierre (P3)**.

---

## 4. El embudo completo

```
IG/TikTok (reels podcast + carruseles + reviews)          ← este plan
        │
        ▼
Perfil → link en bio → landing nicho                       ← "tu web antes de pagar"
        │                                                     + demo de Luvia hablando
        ▼
DM / WhatsApp / formulario  (SIEMPRE manual — regla dura: nada de DMs automatizados)
        │
        ▼
VENTA 1: web construida antes de la llamada (pipeline WebForge de siempre)
        │  · la web sale con botón WhatsApp + reservas desde el día 1
        │  · outreach frío por email a clínicas sigue en paralelo (canal existente)
        ▼
30–60 días con datos de la web (visitas fuera de horario, clics a teléfono/WhatsApp)
        │
        ▼
VENTA 2 (upsell): Luvia — demo real con los precios y huecos DE SU clínica
```

**Guion del upsell (para ese momento, no para el canal):**
> "Tu web ha recibido N visitas fuera de horario este mes. Son pacientes mirando
> tratamientos cuando la clínica está cerrada. ¿Quién les contesta? Te enseño a Luvia
> respondiendo con tus precios y tus huecos reales — 10 minutos, y juzgas tú."

**Decisión de marca pendiente (única decisión abierta para Nico):** bajo qué paraguas
va el canal del nicho. Recomendación: **marca Luvia** (ya nichada, con landing,
testimonios y compliance; la web de entrada se vende como servicio del mismo equipo).
Alternativa: marca personal Nico (consultor) vendiendo ambos. Lo que NO recomiendo:
canal genérico WebForge para este nicho — el nicho convierte porque se siente aludido.

---

## 5. Plan de contenidos — mezcla 60/20/20

**Cadencia: 5 posts/semana** → la mezcla sale exacta: **3 reels modo podcast + 1
carrusel infografía + 1 review** por semana. Mes de 4 semanas = 20 posts (12 + 4 + 4).

| Formato | % | Piezas/mes | Descripción |
|---|---|---|---|
| **A. Reel modo podcast** | 60% | 12 | Avatar presentadora en set de podcast (mesa, micro, 9:16), 25-40s, un tema por clip, hook en los 2 primeros segundos, subtítulos grandes |
| **B. Carrusel infografía** | 20% | 4 | 5-7 slides 4:5, dato + historia + CTA, paleta fija del nicho |
| **C. Review de clientes** | 20% | 4 | Testimonios REALES (Luvia) en tarjeta animada o clip con VO; etiqueta IA si hay recreación |

Si los créditos no dan para 3 reels/semana (ver §8), la mezcla degradada mantiene las
proporciones en el cómputo mensual: 2 reels + 1 carrusel una semana, 3 reels + 1 review
la siguiente.

---

## 6. Calendario editorial — 4 semanas con guiones completos

Convenciones: VO = voz en off / a cámara del avatar. Todos los reels cierran con CTA
suave a bio salvo los de cierre (S4), que llevan CTA directa. Duraciones estimadas
para ritmo conversacional (~2,5 palabras/seg).

### SEMANA 1 — El dolor invisible (P1)

#### R1 · Reel podcast — "La paciente de las 22:14"
**Hook (texto en pantalla):** «Tu mejor paciente te descartó anoche a las 22:14»
**Guion (~30s):**
> Anoche a las diez y cuarto, una mujer decidió que quería quitarse las ojeras de una
> vez. Cogió el móvil y comparó tres clínicas de su zona. Dos tenían un "llámanos
> mañana". Una tenía un botón: "Reserva tu valoración". ¿Adivinas cuál va a cobrar el
> tratamiento? Tu clínica no compite en horario de apertura. Compite a la hora del sofá.

**Caption:** La decisión se toma de noche. La valoración se la lleva quien deja reservar en dos toques. #clinicaestetica #medicinaestetica #esteticaavanzada #gestiondeclinicas
**CTA final:** «¿Cuántas pacientes de las 22:14 pierdes al mes? → bio»

#### R2 · Reel podcast — "El 40% de las llamadas"
**Hook:** «Una clínica real perdía el 40% de sus llamadas. La tuya, ¿lo sabe?»
**Guion (~35s):**
> Una directora de clínica nos dijo esta frase: "antes perdíamos el cuarenta por ciento
> de las llamadas". Cuarenta por ciento. Y no porque su equipo fuera vago — al revés.
> Su recepcionista estaba cobrando a una paciente, o acompañando a otra a cabina. El
> teléfono sonaba en el peor momento, que en una clínica es… siempre. En estética una
> llamada perdida no es una llamada: es una valoración de cientos de euros que no
> vuelve a llamar. Marca en tu clínica: ¿alguien sabe cuántas llamadas se pierden?

**Caption:** El 40% de las llamadas perdidas no las pierde tu equipo. Las pierde el sistema. #clinicaestetica #recepcion #medicinaestetica #negociosestetica

#### C1 · Carrusel — "Los 4 agujeros por los que tu clínica pierde pacientes"
**Slides (7):**
1. (Portada) **Tu clínica pierde pacientes por 4 agujeros. Ninguno se ve desde recepción.**
2. **Agujero 1 — La llamada perdida.** Suena mientras cobráis a una paciente. No deja recado. Reserva en la siguiente clínica de Google.
3. **Agujero 2 — El WhatsApp tardío.** Contestáis a las 3 horas. Ella escribió a 3 clínicas. Ganó la que respondió en 2 minutos.
4. **Agujero 3 — La noche y el domingo.** La mayoría decide fuera de tu horario. Tu clínica, a esas horas, no existe.
5. **Agujero 4 — El no-show.** Sin recordatorio automático, la cabina se queda vacía y ese hueco ya no se vende.
6. **La cuenta:** cada agujero son 2-5 pacientes/mes. Ticket medio de un tratamiento: haz tú la multiplicación.
7. (Cierre, marca) **Web que reserva sola + recepción que contesta siempre. Empezamos por la web: la ves antes de pagar. → bio**

**Caption:** Ninguno de estos agujeros aparece en tu cierre de mes. Todos te cuestan pacientes. #clinicaestetica #gestiondeclinicas #esteticaprofesional

#### RV1 · Review — Marta Ruiz, Clínica Marta Ruiz (testimonio real Luvia)
**Formato:** tarjeta de cita animada (zoom lento) + VO del avatar (~20s).
**Cita en pantalla:** *"Antes perdíamos el 40% de las llamadas."* — Marta Ruiz, directora de clínica
**VO:**
> Esto nos lo dijo la directora de una clínica antes de automatizar su recepción. Hoy
> su IA contesta cada llamada y cada WhatsApp, propone huecos reales de su agenda y
> confirma la cita. El cuarenta por ciento ya no se pierde: se agenda.

**Caption:** Testimonio real. La imagen es recreación. Lo que ya no pierde su clínica: el 40% de sus llamadas. #clinicaestetica #testimonios #recepcionvirtual
**Nota producción:** etiqueta IA activada; rótulo "testimonio real · imagen recreada".

---

### SEMANA 2 — La web: el producto de entrada (P3)

#### R3 · Reel podcast — "Tu Instagram no es tu web"
**Hook:** «Tienes 10.000 seguidores y una agenda con huecos. Te explico el porqué»
**Guion (~30s):**
> Instagram te trae miradas, pero las miradas no pagan cabina. Cuando una paciente por
> fin se decide, toca tu link de la bio… y aterriza en un WhatsApp que contesta mañana.
> Ahí muere el embudo. La web es donde la curiosidad se convierte en reserva: precios
> orientativos, reseñas, y un botón de reservar que funciona a las once de la noche.
> Instagram enamora. La web cierra. Necesitas las dos.

**Caption:** Seguidores no es lo mismo que agenda llena. El puente entre una cosa y la otra es tu web. #clinicaestetica #marketingestetico #medicinaestetica

#### R4 · Reel podcast — "La web-folleto"
**Hook:** «Si tu web dice "solicita información", estás pagando por espantar pacientes»
**Guion (~35s):**
> Abre la web de tu clínica y mírala como paciente. Foto de stock de una mujer sonriendo,
> un texto que dice "tecnología de vanguardia", y un formulario de "solicita información".
> Eso no es una web: es un folleto. La paciente de hoy compara tres clínicas desde el
> móvil y elige la que le pone fácil el siguiente paso: ver tratamientos con precios
> desde, leer reseñas de verdad, y reservar la valoración en dos toques. Sin llamar. Sin
> esperar a mañana. Si tu web no hace eso, no te está trayendo pacientes: se los está
> pasando a la de al lado.

**Caption:** Test de 30 segundos: ¿se puede reservar una valoración en tu web un domingo a las 23:00? #clinicaestetica #webparaclinicas #esteticaavanzada

#### R5 · Reel podcast — "La ves antes de pagar" (modelo WebForge)
**Hook:** «Construimos tu web ANTES de que pagues un euro. Sí, en serio»
**Guion (~35s):**
> Así trabajamos, y sé que suena raro: construimos la web de tu clínica antes de
> cobrarte nada. Con tus tratamientos, tus reseñas reales y tu botón de reserva
> funcionando. Te la enseñamos terminada, navegas por ella, y decides. ¿Que te gusta?
> Pago único, sin permanencia, y está online en días, no en meses. ¿Que no? No pasa
> nada, no has firmado nada. El riesgo lo asumimos nosotros porque sabemos cómo acaba:
> cuando ves tu clínica con una web que reserva sola, no quieres volver al folleto.

**Caption:** Tu web terminada antes de pagar. La ves y decides. Sin permanencia. #clinicaestetica #webparaclinicas #reservasonline
**CTA final:** «Pídela en el link de la bio: te la enseñamos en días.»

#### C2 · Carrusel — "Anatomía de una web de clínica que convierte"
**Slides (7):**
1. (Portada) **7 cosas que tiene una web de clínica que llena agenda (y la tuya quizá no).**
2. **Reserva online 24h.** El botón más rentable de tu negocio. Sin él, tu web es decorativa.
3. **Tratamientos con "precios desde".** El misterio no genera llamadas: genera desconfianza.
4. **Reseñas reales visibles.** Tus pacientes venden mejor que tu copy.
5. **Fotos de TU clínica.** El stock huele a stock. Tu cabina real inspira más que una modelo de banco de imágenes.
6. **WhatsApp a un toque.** Y alguien (o algo) que conteste en minutos, no en horas.
7. (Cierre) **Nuestras webs llevan todo esto de serie. Y la ves terminada antes de pagar. → bio**

**Caption:** Una web de clínica no se mide en bonita: se mide en valoraciones agendadas. #clinicaestetica #webdesign #medicinaestetica

#### RV2 · Review — transformación de web real
**Formato:** screen-recording/scroll narrado de una web real del pipeline (30s). ⚠️ **En
la sesión de lote:** elegir web `approved` del panel con `live_url`; si aún no hay
clínica estética entre las construidas, construir 1 web de muestra de clínica con el
pipeline y presentarla como "así queda una web nuestra" (demo, sin inventar cliente).
**VO (plantilla):**
> Este negocio reservaba solo por teléfono, en horario de apertura. Esta es su web
> ahora: [scroll] tratamientos claros, reseñas reales, y reservas a cualquier hora.
> Se construyó en días y el dueño no tocó un ordenador. La vio terminada… y luego decidió.

**Caption:** De "llámanos mañana" a reservas 24h. Así queda. #antesydespues #webparaclinicas #reservasonline

---

### SEMANA 3 — La recepción IA: siembra del upsell (P2)

#### R6 · Reel podcast — "Tu recepcionista no puede estar en tres sitios"
**Hook:** «Tu recepcionista no es lenta. Está en tres sitios a la vez»
**Guion (~35s):**
> Defendamos un momento a las recepcionistas. A las once de la mañana, la tuya está
> cobrando a una paciente, con el teléfono sonando y catorce WhatsApps sin leer. Elija
> lo que elija, pierde algo. Eso no es un problema de personas: es un problema de
> sistema. La solución no es contratar a otra persona para que se sature igual. Es que
> lo repetitivo — contestar, dar huecos, confirmar citas — lo haga una IA al instante,
> y tu equipo se quede con lo que una máquina no puede hacer: cuidar a la paciente que
> tiene delante.

**Caption:** No necesitas más manos en recepción. Necesitas que el teléfono y el WhatsApp se atiendan solos. #clinicaestetica #recepcionvirtual #inteligenciaartificial

#### R7 · Reel podcast — "¿Quién contesta tu WhatsApp a las 21:00?"
**Hook:** «+38% de mensajes contestados fuera de horario. Así cambia una clínica»
**Guion (~35s):**
> Las pacientes escriben cuando salen de trabajar, cuando acuestan a los niños, cuando
> por fin tienen cinco minutos. O sea: cuando tu clínica está cerrada. En las clínicas
> que automatizan su WhatsApp, más de un tercio de las conversaciones que acaban en
> cita empiezan fuera de horario. La IA contesta en segundos, con los precios y los
> huecos reales de TU agenda, y deja la cita confirmada. Tú llegas por la mañana y en
> vez de catorce mensajes pendientes tienes tres valoraciones nuevas en el calendario.

**Caption:** Tu horario comercial y el horario en el que deciden tus pacientes no coinciden. La IA trabaja en el segundo. #clinicaestetica #whatsappbusiness #automatizacion

#### R8 · Reel podcast — "Los no-shows no son mala suerte"
**Hook:** «El hueco vacío de las 17:00 se decidió hace tres días»
**Guion (~35s):**
> Una cabina vacía a las cinco de la tarde no es mala suerte. Es una paciente que
> quiso anular hace tres días, le dio pereza llamar, y simplemente no vino. Con
> recordatorios automáticos por WhatsApp, los no-shows caen en torno a un veintisiete
> por ciento: confirmar o cambiar la cita cuesta un toque. Y cuando alguien cancela,
> el sistema ofrece ese hueco a la lista de espera, solo. Una clínica nos contó que
> llenó tres huecos su primer sábado. Tres huecos que antes eran cero euros.

**Caption:** −27% de no-shows con recordatorios que se mandan solos. El hueco vacío es opcional. #clinicaestetica #noshow #gestiondecitas

#### C3 · Carrusel — "Recepcionista humana vs recepción con IA (la comparativa honesta)"
**Slides (6):**
1. (Portada) **¿La IA va a sustituir a tu recepcionista? No. Va a hacer lo que ella no puede.**
2. **Lo que tu recepcionista hace mejor que ninguna IA:** recibir con nombre y apellido, calmar nervios antes de un tratamiento, resolver lo delicado.
3. **Lo que la IA hace mejor que cualquier humano:** contestar a las 23:47, atender 30 consultas de una campaña a la vez, no olvidar jamás un recordatorio.
4. **El error:** pedirle a una persona que haga de máquina. Así se queman los equipos y se pierden las llamadas.
5. **El acierto:** la IA filtra, informa, agenda y confirma. Tu equipo cuida. Cada uno en lo suyo.
6. (Cierre) **Primero una web que reserva sola. Luego una recepción que contesta siempre. Por ese orden. → bio**

**Caption:** No es humano O máquina. Es cada uno haciendo aquello en lo que es imbatible. #clinicaestetica #inteligenciaartificial #equipos

#### RV3 · Review — Nuria Vidal, Studio Nuria (testimonio real Luvia)
**Formato:** tarjeta de cita animada + VO (~20s).
**Cita en pantalla:** *"Llenó tres huecos el primer sábado."* — Nuria Vidal, Studio Nuria
**VO:**
> Primer fin de semana con la recepción automatizada. Tres cancelaciones de sábado —
> el día que más duele un hueco. El sistema avisó a la lista de espera y los tres
> huecos se llenaron solos, mientras el equipo atendía cabina. Eso, antes, eran cero euros.

**Caption:** Testimonio real, primer sábado con IA en recepción. #clinicaestetica #testimonios #automatizacion
**Nota producción:** etiqueta IA; rótulo "testimonio real · imagen recreada".

---

### SEMANA 4 — Prueba, objeciones y cierre (P3)

#### R9 · Reel podcast — objeción "Ya tengo web"
**Hook:** «"Ya tengo web". Vale. Hazle este test de 30 segundos»
**Guion (~30s):**
> Cuando me dicen "ya tengo web", propongo un test de treinta segundos. Abre tu web un
> domingo a las once de la noche, como tus pacientes, y responde: ¿puedo ver qué
> tratamientos hacéis y desde cuánto cuestan? ¿Puedo leer opiniones de pacientes
> reales? Y la importante: ¿puedo salir de aquí con una valoración reservada, sin
> hablar con nadie? Si alguna respuesta es no, no tienes una web. Tienes un folleto
> con dominio. Y el folleto no rellena agenda.

**Caption:** Tener web y tener una web que vende son dos negocios distintos. #clinicaestetica #webparaclinicas #marketingestetico

#### R10 · Reel podcast — objeción "Una IA sonará a robot"
**Hook:** «"Mis pacientes creen que contesta Sara, mi recepcionista"»
**Guion (~35s):**
> La frase del título no es nuestra. Es de la dueña de una clínica estética, hablando
> de su IA: "mis pacientes creen que contesta Sara, mi recepcionista". Y es la
> respuesta a la objeción que todos tenemos — "va a sonar a robot". Una IA genérica,
> sí. Una entrenada con los tratamientos, los precios y los huecos reales de tu
> clínica, que escribe y habla en un español natural, no. La prueba no te la tengo que
> contar yo: pide una demo y habla tú con ella. Si notas el robot, no la quieres. Aún
> no ha pasado.

**Caption:** La objeción del robot se cura con una demo de 5 minutos. #clinicaestetica #inteligenciaartificial #recepcionvirtual
**CTA final:** «Demo real en el link de la bio.»

#### R11 · Reel podcast — "La cuenta que lo cierra todo" (3,2×)
**Hook:** «3,2 veces más citas agendadas. Hagamos la cuenta de tu clínica»
**Guion (~40s):**
> Cerramos con números de clínicas reales. Con la recepción automatizada: tres coma
> dos veces más citas agendadas que con la recepción a mano. Un treinta y ocho por
> ciento más de mensajes contestados fuera de horario. Respuesta media por debajo de
> dos minutos. Y un veintisiete por ciento menos de no-shows. Ahora tu cuenta: si tu
> valoración media son doscientos euros, ¿cuántas pacientes recuperadas al mes
> necesitas para que esto se pague solo? ¿Dos? ¿Tres? Eso es un fin de semana de
> mensajes bien contestados. Empezamos por tu web — te la enseñamos antes de pagar —
> y cuando quieras, le ponemos la recepción IA encima.

**Caption:** 3,2× más citas · +38% fuera de horario · −27% no-shows · <2 min de respuesta. La cuenta sale sola. #clinicaestetica #medicinaestetica #resultados
**CTA final:** «Tu web antes de pagar + demo de la IA → bio.»

#### C4 · Carrusel — "La cuenta de la vieja" (infografía numérica)
**Slides (6):**
1. (Portada) **¿Cuánto te cuesta cada mes no contestar? Cuenta de la vieja, sin humo.**
2. **Llamadas perdidas:** 5/semana × 4 semanas = 20 llamadas. (Hay clínicas que pierden el 40%.)
3. **De esas 20, solo 1 de cada 4 era valoración:** 5 valoraciones/mes que no se agendaron.
4. **Ticket medio de valoración → tratamiento: 200–600 €.** 5 × 300 € = **1.500 €/mes** que no ves en ningún informe.
5. **Y eso sin contar** WhatsApps tardíos, no-shows y los domingos por la noche.
6. (Cierre) **Web con reservas 24h + recepción IA: se paga con 2 pacientes recuperadas. Lo demás es margen. → bio**

**Caption:** El dinero que no entra no sale en el cierre de mes. Pero es tuyo y lo estás perdiendo. #clinicaestetica #gestiondeclinicas #rentabilidad
**Nota:** los importes son ejemplo ilustrativo y se presentan como tal en la slide 4 ("ticket medio orientativo"); las únicas cifras presentadas como dato son las de Luvia.

#### RV4 · Review — Laura Cano, Belle Estética (testimonio real Luvia)
**Formato:** tarjeta de cita animada + VO (~20s). El mejor testimonio del mes, cierra el arco.
**Cita en pantalla:** *"Mis pacientes creen que contesta Sara, mi recepcionista."* — Laura Cano, Belle Estética
**VO:**
> Cuando automatizó su WhatsApp, su miedo era ese: que se notara la máquina. Meses
> después, sus pacientes siguen dando las gracias a Sara. Sara existe — pero ahora
> solo atiende lo importante. Del resto se encarga una IA que conoce cada tratamiento
> y cada hueco de la agenda. ¿Quieres oírla? Demo en la bio.

**Caption:** Testimonio real. El miedo al robot dura hasta la primera demo. #clinicaestetica #testimonios #whatsapp
**Nota producción:** etiqueta IA; rótulo "testimonio real · imagen recreada".

---

## 7. Brief técnico para Higgsfield (pasar tal cual a la sesión de lote)

### 7.0 Estado de cuenta y coste

- Saldo verificado 2026-07-06: **525,64 créditos, plan Pro**.
- En el primer lote: generar 1 reel completo ANTES que el resto y anotar su coste real.
  Regla: si el lote semanal (3 reels + 1 carrusel + 1 review) supera ~25% del saldo
  disponible, degradar a 2 reels esa semana y compensar la mezcla en el cómputo mensual.
- El workflow `podcast-flow` NO está en el catálogo MCP actual (solo `video-explainer`,
  verificado 2026-07-06). El modo podcast se monta con herramientas base (abajo).
  Re-comprobar el catálogo (`get_workflow_instructions` sin argumento) en cada lote por
  si aparece.

### 7.1 Identidad fija (setup una vez, se anota en `SETUP.md`)

1. **Avatar presentadora** — `generate_image`, prompt base:
   > Retrato fotorrealista vertical de una mujer española de 38-45 años, elegante y
   > cercana, business casual (blusa de seda color crema, sin bata ni uniforme
   > sanitario), sentada en un estudio de podcast cálido: mesa de madera clara,
   > micrófono de brazo articulado, taza blanca, fondo desenfocado con luz cálida,
   > plantas y tonos beige/rosa empolvado. Mirada a cámara, sonrisa leve, luz suave de
   > estudio. 9:16.

   Generar 3 candidatas variando edad/estilo; Nico elige 1 → esa imagen es la
   **referencia de identidad** de TODOS los reels.
2. **Voz fija** — `create_voice`: española peninsular, mujer, 35-45, cálida y
   conversacional, ritmo tranquilo (~2,5 palabras/seg). Anotar `voice_id`.
3. **Preset Shorts Studio** — `shorts_studio_create_preset`: 9:16, subtítulos grandes
   (2-4 palabras por línea, alto contraste, sin emojis), paleta beige/rosa
   empolvado/blanco roto, ritmo de corte suave. Anotar ID.
4. **Set B y C del mismo estudio** (variación visual): misma escena con encuadre plano
   corto y ángulo lateral 30°. Los reels alternan A/B/C para que el feed no sea
   monótono manteniendo identidad.

### 7.2 Pipeline por reel podcast (formato A)

1. Guion aprobado (§6) → **`generate_audio`** (TTS con la voz fija). Un archivo por reel.
2. **`generate_video`** con modelo de avatar hablante / lip-sync sobre la imagen de
   identidad (elegir modelo con `models_explore(action:'recommend')` indicando
   "talking head avatar from reference image + audio, Spanish, 9:16" la primera vez;
   fijar el modelo elegido en `SETUP.md` y no cambiarlo). Si el modelo limita la
   duración por clip, trocear el audio en bloques de ≤15s y coser en Shorts Studio.
3. **Shorts Studio** con el preset fijo: subtítulos, hook como rótulo inicial (2s),
   rótulo CTA final.
4. **`virality_predictor`** opcional sobre el resultado; regenerar máximo 1 vez por
   asset sin re-consultar a Nico (regla del skill existente).
5. Export 9:16 → Drive `WebForge Social/<año>-W<semana>/`.

### 7.3 Carruseles (formato B)

- **`generate_image`**, 4:5 (1080×1350), una llamada por slide.
- Estilo fijo (incluir en cada prompt): fondo blanco roto/beige, acentos rosa
  empolvado y terracota suave, tipografía elegante tipo editorial (serif para
  titulares, sans para datos), MUCHO aire, sin fotos de stock sonrientes; iconografía
  lineal fina. Texto de la slide GRANDE y legible en móvil (máx. 20 palabras/slide).
- Slide de cierre siempre con marca + CTA "→ bio".
- Los textos por slide están en §6 (C1-C4); pegar literalmente.

### 7.4 Reviews (formato C)

- **Tarjeta de cita animada**: `generate_image` de tarjeta elegante con la cita
  literal y nombre real (paleta del canal) → `generate_video` (imagen a vídeo, zoom
  lento/parallax sutil, 8-10s en loop) + VO (`generate_audio` con la voz fija, guiones
  en §6) montado en Shorts Studio con subtítulos.
- **Obligatorio en todos:** etiqueta "creado con IA" al publicar + rótulo en el propio
  vídeo: "Testimonio real · imagen recreada".
- RV2 (transformación de web) no usa avatar: es screen-recording/scroll de la web real
  con VO. Si Higgsfield no graba scroll, generarlo fuera (grabación de pantalla del
  móvil) y usar Higgsfield solo para VO + subtítulos.

### 7.5 Captions y hashtags

- Caption corto, humano, sin pinta de plantilla (mismo criterio que el outreach de
  WebForge). Los de §6 son borradores aprobables.
- Hashtags: 3-5, del nicho (#clinicaestetica #medicinaestetica #esteticaavanzada
  #gestiondeclinicas + 1 rotativo por tema). Nada de #fyp ni ruido genérico.

---

## 8. Operativa semanal (sin cambios de sistema)

El flujo es el del skill **`/lote-contenido`** ya montado (reconciliar métricas →
`balance` → proponer guiones → **gate de aprobación de Nico** → generar → captions →
Drive + calendario). Cambios de esta especialización:

1. El lote pasa de 4 a **5 posts** (3A + 1B + 1C) salvo mezcla degradada por créditos.
2. Los guiones de las 4 primeras semanas ya están escritos (§6): las sesiones de lote
   del primer mes solo aprueban/ajustan y generan.
3. `hooks.md` y `calendario.md` se re-apuntan al nicho (ver §10).

## 9. Métricas y criterio de éxito

- **Por post:** views, retención a 3s (el hook), guardados, compartidos.
- **Por semana:** visitas al perfil, clics al link de bio, DMs entrantes.
- **Del negocio (las que mandan):** conversaciones reales con clínicas, demos de web
  enseñadas, webs vendidas; más adelante, upsells de Luvia cerrados.
- **Criterio fase 1 (igual que el canal original):** tras 4 lotes (~20 posts), decidir
  con datos: escalar (fase 2: publicación por API, panel), seguir igual, o re-nichar.
  Señal mínima esperable para seguir: crecimiento sostenido de visitas al perfil +
  ≥2-3 DMs/conversaciones de clínicas reales en el mes.

## 10. Qué queda para el arranque (pendiente de OK de Nico)

1. **Decisión de marca del canal** (§4): Luvia (recomendado) vs marca personal. Afecta
   a handle, bio y link de `SETUP.md`.
2. **Re-apuntar `hooks.md`** al nicho: añadir las familias de este plan (paciente
   invisible / recepción desbordada / web que convierte / prueba Luvia) manteniendo el
   formato de tabla e IDs.
3. **Re-escribir la semana activa de `calendario.md`** con S1 de este plan (R1, R2,
   C1, RV1) — los guiones ya están en §6.
4. **Setup de identidad** (§7.1) en la primera sesión de `/lote-contenido`: candidatas
   de avatar, voz, preset, modelo de lip-sync.
5. **Landing del nicho** para el link de bio: opción rápida = luvia-ia.es + sección
   "tu web antes de pagar"; opción pipeline = web de muestra de clínica construida con
   WebForge. (Decisión junto con la de marca.)
6. **Verificar permiso de uso** de los testimonios de luvia-ia.es en redes (son del
   mismo proyecto de Nico, pero confirmar que los clientes aceptan aparecer en IG/TikTok).
