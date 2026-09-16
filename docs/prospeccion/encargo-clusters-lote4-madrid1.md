# Encargo: asuntos por cluster para el lote 4 (València) y Madrid 1 — Home Estimator

Preparado el 16-sep-2026 desde el repo WebForge. Este documento es todo lo que hace falta: contexto, formato de salida, reglas y los datos de cada empresa.

## Qué es y qué ha pasado hasta ahora

- **Producto:** Home Estimator, un simulador de presupuesto para empresas de reformas. El cliente contesta en la web de la empresa metros, estancias, calidades y cuánto quiere invertir, y a la empresa le llega una estimación antes de la visita. Cada empresa tiene ya una demo con su marca en `presupuestos.nico-soto.es/demo/<slug>`. Precio 59 €/mes + IVA (no se menciona en el primer email).
- **Envía:** Nico Soto, desde hola@nico-soto.es, texto plano, uno a uno.
- **Lote 1** (València, 14 empresas): contactado por formulario el 25-ago (0 respuestas, 2 completaron la demo, 8 ni la abrieron). El 16-sep se les envió email con asunto por cluster.
- **Lotes 2 y 3** (València, 14 y 13 emails): CSV de clusters hechos, pendientes de enviar.
- **Lote 4 y Madrid 1**: demos montadas, **no consta ningún envío**, ni por formulario ni por email (Nico lo confirma antes de enviar). Falta este CSV.
- **Qué medimos:** respuestas y visitas a la demo por cluster de asunto. Madrid 1 sirve además para comparar zona (Madrid vs València) con los mismos clusters.

## Lo que tienes que devolver

Dos CSV, uno por tanda:

- `outreach_reformas_lote4.csv` (empresas 46–60)
- `outreach_reformas_madrid1.csv` (empresas 61–75)

Formato exacto (UTF-8, separador coma, todos los campos entre comillas dobles, comillas internas duplicadas, saltos de línea reales dentro de los campos):

```
empresa,ciudad,nota,email,cluster,asunto,cuerpo,followup_asunto,followup_cuerpo,enviar,aviso
```

- `email`: **copiar tal cual el "Email para el CSV" de cada ficha.** El script cruza por email con la cola para sacar el link de la demo. Si crees que el email está mal, déjalo igual, pon `enviar` FALSE y explícalo en `aviso`.
- `nota`: el Home Estimator Score.
- `cluster`: `Dolor`, `Curiosidad` o `Gancho`.
- `followup_asunto`: `Re: ` + asunto.
- `enviar`: `TRUE` o `FALSE`. Empresas sin email: incluirlas con FALSE y `aviso` "sin email".
- `aviso`: vacío salvo que haya algo que Nico deba revisar.
- En cuerpo y seguimiento el enlace va como `{link_demo}`, literal. El script lo sustituye.

## Reglas de los tres clusters

Dolor y Curiosidad usan **exactamente** estos textos (no cambiar ni una coma). Gancho cambia solo el asunto y la primera frase.

**Dolor**
- Asunto: `presupuestar sin saber los metros`
- Cuerpo:
```
Hola,

Una pregunta rápida: ¿cuántas visitas de medición hacéis al mes para reformas que luego no salen?

He montado una herramienta para eso. El cliente contesta en tu web unas preguntas (metros, estancias, calidades y cuánto quiere invertir) y te llega una estimación antes de mover el coche.

Así se ve: {link_demo}

¿Te encaja o lo estoy enfocando mal? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es
```
- Seguimiento:
```
Hola de nuevo,

Último mensaje, prometido. Si tienes un minuto, prueba la demo como si fueras un cliente que quiere reformar su piso: verás exactamente lo que te llegaría a ti.

{link_demo}

Si no es para vosotros, ningún problema. No escribo más.

Nico Soto
nico-soto.es
```

**Curiosidad**
- Asunto: `he probado tu formulario`
- Cuerpo:
```
Hola,

Entré en tu web a ver cómo se pide presupuesto (no te envié nada, tranquilo). Estoy montando algo para empresas de reformas y quería ver cómo lo hacéis.

La idea es que el cliente, en vez de dejar solo nombre y teléfono, conteste metros, estancias, calidades y presupuesto, y a ti te llegue una estimación antes de la visita.

Así se ve: {link_demo}

¿Te serviría o me estoy equivocando? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es
```
- Seguimiento:
```
Hola de nuevo,

Solo una pregunta, se contesta con una frase: cuando te entra una solicitud por la web, ¿llamas tú al cliente para preguntar metros y presupuesto, o vas directamente a verlo?

Me ayuda mucho saber cómo lo hacéis. Y si no te interesa el tema, lo dejo aquí.

Nico Soto
nico-soto.es
```
- Solo para empresas que **tienen formulario** en la web. Si solo hay WhatsApp o teléfono, no uses Curiosidad.

**Gancho**
- Asunto: corto, en minúscula, sacado de algo concreto y verificable de SU web (una promesa, un campo raro del formulario, un precio publicado). Ejemplos ya usados: `seis campos y ninguno de la obra`, `el DNI, pero no los metros`, `¿precio cerrado en 48 h?`, `sabes cuándo, pero no qué`.
- Cuerpo:
```
Hola,

<UNA O DOS FRASES CON EL DETALLE DE SU WEB>

Estoy montando una herramienta para empresas de reformas: el cliente contesta en tu web metros, estancias, calidades y cuánto quiere invertir, y te llega una estimación antes de la visita.

Así se ve: {link_demo}

¿Te encaja? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es
```
- Seguimiento:
```
Hola de nuevo,

¿Quién lleva los presupuestos en <NOMBRE CORTO Y NATURAL>? Si no eres tú, ¿me dices a quién le paso la demo?

{link_demo}

Si no os interesa, lo dejo aquí.

Nico Soto
nico-soto.es
```
- `<NOMBRE CORTO Y NATURAL>`: como lo diría una persona ("Iasa Design", no "IASA DESIGN S.L." ni "Reformas & Mantenimiento - Grupo G").

## Criterios

1. **Solo hechos que estén en la ficha.** Para Gancho, usa la evidencia, el ángulo, las notas y las citas del mensaje de formulario del 13-sep. En Madrid 1 las citas entre comillas de esos mensajes se comprobaron literales contra su web; en el lote 4 no, así que usa citas solo si salen en varias fuentes de la ficha, y si no, describe sin comillas.
2. **Nada de "vuestra marca" ni "demo personalizada"**: los textos de cluster no lo dicen, no lo añadas.
3. **Reparto equilibrado**, unos 5 Gancho / 5 Dolor / 4-5 Curiosidad por tanda. **No metas todas las notas altas en Gancho**: alterna, para que el cluster no se confunda con la calidad de la empresa. Si una empresa de nota alta no tiene gancho claro, va a Dolor o Curiosidad.
4. **Empresas que no son reforma residencial pura** (arquitectos, interiorismo, cocinas a medida, pladur): mejor Dolor o Curiosidad que un Gancho forzado. Si crees que no encaja en absoluto, `enviar` FALSE y dilo en `aviso`.
5. **Emails dudosos** (OLBE con email de otro dominio, Mesform con email de relleno, emails distintos entre cola y auditoría): márcalos en `aviso` y decide `enviar` con criterio.
6. Español de España, tuteo, sin emojis, sin signos raros. Asuntos de menos de ~40 caracteres.

## Ejemplo de salida ya aprobado (lote 3, completo)

```csv
empresa,ciudad,nota,email,cluster,asunto,cuerpo,followup_asunto,followup_cuerpo,enviar,aviso
"Renovat Reformas","Alzira","9.0","info@reformasrenovat.com","Gancho","seis campos y ninguno de la obra","Hola,

Vi que tu ""Pide presupuesto sin compromiso"" pide seis datos (nombre, apellidos, email, teléfono, asunto y mensaje) y ninguno es sobre la reforma.

Estoy montando una herramienta para empresas de reformas: el cliente contesta en tu web metros, estancias, calidades y cuánto quiere invertir, y te llega una estimación antes de la visita.

Así se ve: {link_demo}

¿Te encaja? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: seis campos y ninguno de la obra","Hola de nuevo,

¿Quién lleva los presupuestos en Renovat Reformas? Si no eres tú, ¿me dices a quién le paso la demo?

{link_demo}

Si no os interesa, lo dejo aquí.

Nico Soto
nico-soto.es","TRUE",""
"Reformas y Pintores Nico","Gandia","8.5","pintoresnico@gmail.com","Dolor","presupuestar sin saber los metros","Hola,

Una pregunta rápida: ¿cuántas visitas de medición hacéis al mes para reformas que luego no salen?

He montado una herramienta para eso. El cliente contesta en tu web unas preguntas (metros, estancias, calidades y cuánto quiere invertir) y te llega una estimación antes de mover el coche.

Así se ve: {link_demo}

¿Te encaja o lo estoy enfocando mal? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: presupuestar sin saber los metros","Hola de nuevo,

Último mensaje, prometido. Si tienes un minuto, prueba la demo como si fueras un cliente que quiere reformar su piso: verás exactamente lo que te llegaría a ti.

{link_demo}

Si no es para vosotros, ningún problema. No escribo más.

Nico Soto
nico-soto.es","TRUE",""
"Mestre Reformas","Gandia","8.5","info@mestrereformas.com","Gancho","¿precio cerrado en 48 h?","Hola,

Vi que prometes precios cerrados y presupuesto en menos de 48 horas, y que el formulario de contacto solo pide nombre, correo y mensaje.

Estoy montando una herramienta para empresas de reformas: el cliente contesta en tu web metros, estancias, calidades y cuánto quiere invertir, y te llega una estimación antes de la visita.

Así se ve: {link_demo}

¿Te encaja? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: ¿precio cerrado en 48 h?","Hola de nuevo,

¿Quién lleva los presupuestos en Mestre Reformas? Si no eres tú, ¿me dices a quién le paso la demo?

{link_demo}

Si no os interesa, lo dejo aquí.

Nico Soto
nico-soto.es","TRUE",""
"Macamon Reformas Integrales","Gandia","7.5","macamoncho@gmail.com","Dolor","presupuestar sin saber los metros","Hola,

Una pregunta rápida: ¿cuántas visitas de medición hacéis al mes para reformas que luego no salen?

He montado una herramienta para eso. El cliente contesta en tu web unas preguntas (metros, estancias, calidades y cuánto quiere invertir) y te llega una estimación antes de mover el coche.

Así se ve: {link_demo}

¿Te encaja o lo estoy enfocando mal? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: presupuestar sin saber los metros","Hola de nuevo,

Último mensaje, prometido. Si tienes un minuto, prueba la demo como si fueras un cliente que quiere reformar su piso: verás exactamente lo que te llegaría a ti.

{link_demo}

Si no es para vosotros, ningún problema. No escribo más.

Nico Soto
nico-soto.es","TRUE",""
"Hidro2 Grup","Gandia","7.5","info@hidro2grup.com","Gancho","medir en 48 horas","Hola,

Leí en tu web a un cliente que cuenta que fuisteis a medir en 48 horas y que tuvo el presupuesto en una semana. Me quedé pensando en cuántas de esas visitas acaban en nada.

Estoy montando una herramienta para empresas de reformas: el cliente contesta en tu web metros, estancias, calidades y cuánto quiere invertir, y te llega una estimación antes de la visita.

Así se ve: {link_demo}

¿Te encaja? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: medir en 48 horas","Hola de nuevo,

¿Quién lleva los presupuestos en Hidro2 Grup? Si no eres tú, ¿me dices a quién le paso la demo?

{link_demo}

Si no os interesa, lo dejo aquí.

Nico Soto
nico-soto.es","TRUE",""
"Reformas Antoine","Gandia","7.5","nikolaytsverkov@gmail.com","Curiosidad","he probado tu formulario","Hola,

Entré en tu web a ver cómo se pide presupuesto (no te envié nada, tranquilo). Estoy montando algo para empresas de reformas y quería ver cómo lo hacéis.

La idea es que el cliente, en vez de dejar solo nombre y teléfono, conteste metros, estancias, calidades y presupuesto, y a ti te llegue una estimación antes de la visita.

Así se ve: {link_demo}

¿Te serviría o me estoy equivocando? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: he probado tu formulario","Hola de nuevo,

Solo una pregunta, se contesta con una frase: cuando te entra una solicitud por la web, ¿llamas tú al cliente para preguntar metros y presupuesto, o vas directamente a verlo?

Me ayuda mucho saber cómo lo hacéis. Y si no te interesa el tema, lo dejo aquí.

Nico Soto
nico-soto.es","TRUE",""
"Reformas integrales Cuinex","Alzira","7.5","info@cuinexreformas.es","Gancho","el DNI, pero no los metros","Hola,

Vi que tu formulario pide el DNI del cliente, pero no qué quiere reformar ni cuántos metros tiene.

Estoy montando una herramienta para empresas de reformas: el cliente contesta en tu web metros, estancias, calidades y cuánto quiere invertir, y te llega una estimación antes de la visita.

Así se ve: {link_demo}

¿Te encaja? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: el DNI, pero no los metros","Hola de nuevo,

¿Quién lleva los presupuestos en Cuinex? Si no eres tú, ¿me dices a quién le paso la demo?

{link_demo}

Si no os interesa, lo dejo aquí.

Nico Soto
nico-soto.es","TRUE",""
"Jesbal Habitatge","Gandia","7.0","info@jesbalhabitatge.es","Gancho","una integral de 100 m²","Hola,

Vi que en tu web explicas cuánto tarda una integral de unos 100 m² y que ayudas con la financiación. Justo lo que el cliente quiere saber antes de pedir presupuesto.

Estoy montando una herramienta para empresas de reformas: el cliente contesta en tu web metros, estancias, calidades y cuánto quiere invertir, y te llega una estimación antes de la visita.

Así se ve: {link_demo}

¿Te encaja? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: una integral de 100 m²","Hola de nuevo,

¿Quién lleva los presupuestos en Jesbal Habitatge? Si no eres tú, ¿me dices a quién le paso la demo?

{link_demo}

Si no os interesa, lo dejo aquí.

Nico Soto
nico-soto.es","TRUE",""
"Gytech group","Llíria","7.0","info@gytechgroup.com","Dolor","presupuestar sin saber los metros","Hola,

Una pregunta rápida: ¿cuántas visitas de medición hacéis al mes para reformas que luego no salen?

He montado una herramienta para eso. El cliente contesta en tu web unas preguntas (metros, estancias, calidades y cuánto quiere invertir) y te llega una estimación antes de mover el coche.

Así se ve: {link_demo}

¿Te encaja o lo estoy enfocando mal? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: presupuestar sin saber los metros","Hola de nuevo,

Último mensaje, prometido. Si tienes un minuto, prueba la demo como si fueras un cliente que quiere reformar su piso: verás exactamente lo que te llegaría a ti.

{link_demo}

Si no es para vosotros, ningún problema. No escribo más.

Nico Soto
nico-soto.es","TRUE",""
"Construcciones y Reformas Génesis","L'Eliana","6.5","contacto@reformasgenesis.com.es","Curiosidad","he probado tu formulario","Hola,

Entré en tu web a ver cómo se pide presupuesto (no te envié nada, tranquilo). Estoy montando algo para empresas de reformas y quería ver cómo lo hacéis.

La idea es que el cliente, en vez de dejar solo nombre y teléfono, conteste metros, estancias, calidades y presupuesto, y a ti te llegue una estimación antes de la visita.

Así se ve: {link_demo}

¿Te serviría o me estoy equivocando? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: he probado tu formulario","Hola de nuevo,

Solo una pregunta, se contesta con una frase: cuando te entra una solicitud por la web, ¿llamas tú al cliente para preguntar metros y presupuesto, o vas directamente a verlo?

Me ayuda mucho saber cómo lo hacéis. Y si no te interesa el tema, lo dejo aquí.

Nico Soto
nico-soto.es","TRUE",""
"Reformas y Proyectos Sacaber","Torrent","6.5","sacaber@hotmail.com","Curiosidad","he probado tu formulario","Hola,

Entré en tu web a ver cómo se pide presupuesto (no te envié nada, tranquilo). Estoy montando algo para empresas de reformas y quería ver cómo lo hacéis.

La idea es que el cliente, en vez de dejar solo nombre y teléfono, conteste metros, estancias, calidades y presupuesto, y a ti te llegue una estimación antes de la visita.

Así se ve: {link_demo}

¿Te serviría o me estoy equivocando? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: he probado tu formulario","Hola de nuevo,

Solo una pregunta, se contesta con una frase: cuando te entra una solicitud por la web, ¿llamas tú al cliente para preguntar metros y presupuesto, o vas directamente a verlo?

Me ayuda mucho saber cómo lo hacéis. Y si no te interesa el tema, lo dejo aquí.

Nico Soto
nico-soto.es","TRUE",""
"Construcciones y Reformas Ramírez Castañeda","Catarroja","6.5","ramirezcastanedasl@gmail.com","Curiosidad","he probado tu formulario","Hola,

Entré en tu web a ver cómo se pide presupuesto (no te envié nada, tranquilo). Estoy montando algo para empresas de reformas y quería ver cómo lo hacéis.

La idea es que el cliente, en vez de dejar solo nombre y teléfono, conteste metros, estancias, calidades y presupuesto, y a ti te llegue una estimación antes de la visita.

Así se ve: {link_demo}

¿Te serviría o me estoy equivocando? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: he probado tu formulario","Hola de nuevo,

Solo una pregunta, se contesta con una frase: cuando te entra una solicitud por la web, ¿llamas tú al cliente para preguntar metros y presupuesto, o vas directamente a verlo?

Me ayuda mucho saber cómo lo hacéis. Y si no te interesa el tema, lo dejo aquí.

Nico Soto
nico-soto.es","TRUE",""
"Multiservicios AM Levante","Picassent","6.5","multiserviciosam375@gmail.com","Dolor","presupuestar sin saber los metros","Hola,

Una pregunta rápida: ¿cuántas visitas de medición hacéis al mes para reformas que luego no salen?

He montado una herramienta para eso. El cliente contesta en tu web unas preguntas (metros, estancias, calidades y cuánto quiere invertir) y te llega una estimación antes de mover el coche.

Así se ve: {link_demo}

¿Te encaja o lo estoy enfocando mal? Si no te interesa, dímelo y no vuelvo a escribir.

Nico Soto
nico-soto.es","Re: presupuestar sin saber los metros","Hola de nuevo,

Último mensaje, prometido. Si tienes un minuto, prueba la demo como si fueras un cliente que quiere reformar su piso: verás exactamente lo que te llegaría a ti.

{link_demo}

Si no es para vosotros, ningún problema. No escribo más.

Nico Soto
nico-soto.es","TRUE",""
```

## Lote 4 — València (46–60) · 15 empresas, 14 con email

Salen de lo que quedaba de las auditorías del 20-ago y 13-sep, con score 6,5 → 5,5. Es la cola de València: más flojo que los lotes anteriores y con más estudios de arquitectura e interiorismo. El score no está validado.

### 46. Ecerotres Arquitectos

| Campo | Valor |
|---|---|
| Ciudad | Alboraya |
| Home Estimator Score / clase | 6.5 / B |
| Google | 4.9 ⭐, 56 reseñas, categoría Reformas |
| Web | https://ecerotresarquitectos.com |
| Dónde pide presupuesto | https://ecerotresarquitectos.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | estudio@ecerotresarquitectos.com |
| Email que vio la auditoría | estudio@ecerotresarquitectos.com |
| Teléfono / WhatsApp en la web | +34 680 72 36 44 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/ecerotres |
| Cómo funciona hoy | formulario de contacto + teléfono directo + email visible |
| Campos del formulario (extracción cruda) | nombre nombre form-field-no, email correo electronico fo, telefono telefono form-fiel, textarea:mensaje mensaje form-field- |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 56 reseñas 4.9. Arquitectos que hacen reforma íntegra residencial y comercial. Form Elementor de 2 campos. |
| Por qué encaja | Hace reforma residencial pero mezclada con interiorismo, obra o comercio; el dolor existe aunque el encaje sea menos directo. |
| Ángulo de la auditoría | Recibes nombre, teléfono y un mensaje: todo el trabajo de cualificación empieza después de que llegue el lead. |
| Notas de la revisión | estudio de arquitectura con reformas íntegras |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Ecerotres Arquitectos:
> 
> En vuestra web explicáis bien el método: mediciones por partidas, presupuesto de obra, plan de obra y plazos. Pero antes de llegar ahí, el formulario solo os deja nombre, correo, teléfono y un mensaje, y cada solicitud empieza con una conversación para saber qué quiere reformar el cliente, cuántos metros tiene y con qué presupuesto cuenta. He montado una demo con vuestra marca para enseñaros cómo podría llegaros ese primer paso ya hecho:
> 
> https://presupuestos.nico-soto.es/demo/ecerotres
> 
> Son solo dos minutos y sin compromiso.

### 47. extraMURS Arquitectura

| Campo | Valor |
|---|---|
| Ciudad | Alboraya |
| Home Estimator Score / clase | 6.5 / B |
| Google | 4.2 ⭐, 28 reseñas, categoría Empresa constructora |
| Web | https://extramurs.com |
| Dónde pide presupuesto | https://extramurs.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | info@extramurs.com |
| Email que vio la auditoría | info@extramurs.com |
| Teléfono / WhatsApp en la web | +34 960 64 84 20 / sí |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/extramurs |
| Cómo funciona hoy | formulario de contacto + botón/enlace de WhatsApp + teléfono directo + email visible |
| Campos del formulario (extracción cruda) | nombre nombre, correo correo electronico, phone telefono, textarea:mensaje ¿que necesitas? |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 28 reseñas 4.2. Constructora + arquitectura, obra nueva y reforma. Form nombre/correo/teléfono/'¿qué necesitas?'. |
| Por qué encaja | Hace reforma residencial pero mezclada con interiorismo, obra o comercio; el dolor existe aunque el encaje sea menos directo. |
| Ángulo de la auditoría | El cliente solo puede explicar su reforma en un textarea de 'cuéntanos tu proyecto'. Tú lo traduces a presupuesto a mano. |
| Notas de la revisión | constructora + arquitectura, también obra nueva |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de extraMURS:
> 
> Vuestro blog responde cuánto cuesta construir una casa o una licencia de obra, y ofrecéis calcular una estimación de precio y plazos. Pero quien llega al formulario solo puede contaros en "¿Qué necesitas?" lo que tiene en mente, y esa estimación la preparáis vosotros después, a mano. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada, con metros, alcance, plazo e inversión:
> 
> https://presupuestos.nico-soto.es/demo/extramurs
> 
> Son solo dos minutos y sin compromiso.

### 48. Proyecta Lara

| Campo | Valor |
|---|---|
| Ciudad | Paterna |
| Home Estimator Score / clase | 6.5 / B |
| Google | 4.4 ⭐, 25 reseñas, categoría Reformas |
| Web | https://proyectalara.es |
| Dónde pide presupuesto | https://proyectalara.es/contacta-con-nosotros/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | comercial@proyectalara.es |
| Email que vio la auditoría | comercial@proyectalara.es |
| Teléfono / WhatsApp en la web | +34 960 17 00 78 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/proyecta-lara |
| Cómo funciona hoy | formulario de contacto + teléfono directo + email visible |
| Campos del formulario (extracción cruda) | email escribe tu email form, field_08dd044 form-field-f |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 25 reseñas 4.4. Interiorismo con 'reformas 360º' para hogar y negocio. Form Elementor email + campo suelto. |
| Por qué encaja | Hace reforma residencial pero mezclada con interiorismo, obra o comercio; el dolor existe aunque el encaje sea menos directo. |
| Ángulo de la auditoría | Recibes nombre, teléfono y un mensaje: todo el trabajo de cualificación empieza después de que llegue el lead. |
| Notas de la revisión | interiorismo; "Contacta con nosotros" no tiene formulario; formulario al pie de la home (reCAPTCHA) |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Proyecta Lara:
> 
> Prometéis reformas llave en mano con plazo y presupuesto cerrado, ajustadas a lo que puede invertir cada cliente. Pero para pediros información, en la web solo se puede dejar un email y poco más: no sabéis qué quiere reformar, cuántos metros tiene ni con cuánto cuenta hasta que habláis con él. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada proyecto ya definido:
> 
> https://presupuestos.nico-soto.es/demo/proyecta-lara
> 
> Son solo dos minutos y sin compromiso.

### 49. Construcciones OLBE

| Campo | Valor |
|---|---|
| Ciudad | Aldaia |
| Home Estimator Score / clase | 6.5 / A |
| Google | 4.4 ⭐, 13 reseñas, categoría Constructor |
| Web | https://www.construccionesolbe.com |
| Dónde pide presupuesto | https://www.construccionesolbe.com |
| **Email para el CSV (el de la cola, copiar tal cual)** | info@construccionesoliver.es |
| Email que vio la auditoría | info@construccionesoliver.es |
| Teléfono / WhatsApp en la web | +34 653 13 02 87 / sí |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/construcciones-olbe |
| Cómo funciona hoy | formulario de contacto + botón/enlace de WhatsApp |
| Campos del formulario (extracción cruda) | name_0 name, email_0 email address et_p, textarea:message_0 message et_pb_co |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 13 reseñas 4.4. Form Divi name/email. |
| Por qué encaja | Reforma residencial con demanda real y una solicitud de presupuesto que no recoge nada de lo que determina el precio: Home Estimator lo sustituye entero. |
| Ángulo de la auditoría | Recibes nombre, teléfono y un mensaje: todo el trabajo de cualificación empieza después de que llegue el lead. |
| Notas de la revisión | el email de la ficha es de otro dominio |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Construcciones OLBE:
> 
> Hacéis desde obra pequeña, una cocina o un baño, hasta reformas integrales llave en mano y trabajos en fincas, y todo os llega por el mismo formulario de nombre, email y mensaje. Hasta que no habláis con el cliente no sabéis cuál de todos es ni si merece la pena ir a verlo. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada solicitud ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/construcciones-olbe
> 
> Son solo dos minutos y sin compromiso.

### 50. Construcciones y Reformas Clurjor

| Campo | Valor |
|---|---|
| Ciudad | Aldaia |
| Home Estimator Score / clase | 6.5 / A |
| Google | 4.6 ⭐, 13 reseñas, categoría Empresa constructora |
| Web | http://www.clurjor.com |
| Dónde pide presupuesto | http://clurjor.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | info@clurjor.com |
| Email que vio la auditoría | info@clurjor.com |
| Teléfono / WhatsApp en la web | +34 961 51 33 07 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/clurjor |
| Cómo funciona hoy | formulario de contacto + teléfono directo + email visible |
| Campos del formulario (extracción cruda) | your-name nombre, your-email email, your-subject ¿que necesitas?, textarea:your-message explicanos un poco mas |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 13 reseñas 4.6, 20 años. CF7 nombre/email/asunto/mensaje. |
| Por qué encaja | Reforma residencial con demanda real y una solicitud de presupuesto que no recoge nada de lo que determina el precio: Home Estimator lo sustituye entero. |
| Ángulo de la auditoría | Recibes nombre, teléfono y un mensaje: todo el trabajo de cualificación empieza después de que llegue el lead. |
| Notas de la revisión | también obra nueva, locales y naves |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Clurjor:
> 
> Vuestro formulario pregunta "¿Qué necesitas?" y "Explícanos un poco más", que ya es más que muchos. Pero ahí cabe igual un baño que un local entero, y los metros, el plazo o la inversión los tenéis que sacar después, llamada a llamada. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/clurjor
> 
> Son solo dos minutos y sin compromiso.

### 51. NCA Interiores

| Campo | Valor |
|---|---|
| Ciudad | Alaquàs |
| Home Estimator Score / clase | 6.5 / B |
| Google | 4.4 ⭐, 13 reseñas, categoría Reformas de cocinas |
| Web | https://ncainteriores.es |
| Dónde pide presupuesto | https://ncainteriores.es/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | administracion@ncainteriores.es |
| Email que vio la auditoría | administracion@ncainteriores.es |
| Teléfono / WhatsApp en la web | +34 962 01 09 54 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/nca-interiores |
| Cómo funciona hoy | formulario de contacto + teléfono directo + email visible |
| Campos del formulario (extracción cruda) | your-name nombre*, your-surname apellidos*, your-email email*, tel telf* tel, textarea:mensaje mensaje*, [1[first wpforms-977-f, [1[last wpforms-977-fi, [7 wpforms-977-field_7, [4 wpforms-977-field_4, [2 wpforms-977-field_2 |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 13 reseñas 4.4. Cocinas y armarios a medida con 'precio cerrado y 3D previo' — ya venden cierre de precio, pero lo hacen a mano. |
| Por qué encaja | Hace reforma residencial pero mezclada con interiorismo, obra o comercio; el dolor existe aunque el encaje sea menos directo. |
| Ángulo de la auditoría | Ya vendes precio cerrado y 3D previo: el cliente entiende el valor de saber el precio antes. Pero para llegar a ese precio cerrado sigues haciendo todo a mano. |
| Notas de la revisión | cocinas y armarios a medida, 3D previo; reCAPTCHA |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de NCA Interiores:
> 
> Ya enseñáis la cocina en un 3D realista antes de hacerla, así que vuestro cliente entiende el valor de saber cómo quedará antes de decidir. Pero para llegar a ese punto la solicitud sigue siendo nombre, teléfono y un comentario, y las medidas, el alcance y la inversión los recogéis vosotros después. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada proyecto ya explicado:
> 
> https://presupuestos.nico-soto.es/demo/nca-interiores
> 
> Son solo dos minutos y sin compromiso.

### 52. Obralis

| Campo | Valor |
|---|---|
| Ciudad | València |
| Home Estimator Score / clase | 6.5 / A |
| Google | 5 ⭐, 8 reseñas, categoría Reformas |
| Web | https://obralis.es |
| Dónde pide presupuesto | https://obralis.es/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | **SIN EMAIL → fila con enviar FALSE** |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 960 73 02 72 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/obralis |
| Cómo funciona hoy | formulario de contacto + teléfono directo + email visible |
| Campos del formulario (extracción cruda) | name *nombre y apellidos fo, field_719ed13 *numero de te, field_7b023a6 *localidad fo, email *email form-field-ema, field_57e836a *asunto form- |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 8 reseñas 5.0, marca su CTA como '【Presupuesto Ahora】' y lleva a un form de nombre y número. |
| Por qué encaja | Reforma residencial con demanda real y una solicitud de presupuesto que no recoge nada de lo que determina el precio: Home Estimator lo sustituye entero. |
| Ángulo de la auditoría | Tu botón es '【Presupuesto Ahora】' pero el 'ahora' no existe: después viene la llamada, la visita y los días de preparación. |
| Notas de la revisión | sin email en la ficha; WhatsApp en la web |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Obralis:
> 
> Vuestra web promete "Presupuesto Ahora" y un presupuesto ágil y gratis, pero el formulario pide nombre, teléfono, email y asunto, y después toca llamar y hacer la visita. El "ahora" empieza varios días más tarde. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada antes de coger el teléfono:
> 
> https://presupuestos.nico-soto.es/demo/obralis
> 
> Son solo dos minutos y sin compromiso.

### 53. Mesform Interiorismo

| Campo | Valor |
|---|---|
| Ciudad | Cullera |
| Home Estimator Score / clase | 6.0 / B |
| Google | 5 ⭐, 24 reseñas, categoría Reformas |
| Web | http://mesform.es |
| Dónde pide presupuesto | https://www.mesform.es/contactame/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | info@mesform.es |
| Email que vio la auditoría | contacto@ejemplo.com |
| Teléfono / WhatsApp en la web | +34 617 85 08 27 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/mesform |
| Cómo funciona hoy | formulario de contacto (Webnode) + teléfono |
| Campos del formulario (extracción cruda) | nombre*, email*, mensaje |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 24 reseñas 5.0; 'Interiorismo a medida': muebles, armarios, vestidores, cocinas, steel framing y reformas integrales/pisos/baños; 'Contáctame' es nombre/email/mensaje. |
| Por qué encaja | Interiorismo/carpintería a medida con reformas: encaje menos directo pero form vacío. |
| Ángulo de la auditoría | Haces desde vestidores a medida hasta reformas integrales, y tu 'Contáctame' lo recibe todo igual: nombre, email y mensaje. |
| Notas de la revisión | email de ficha de relleno; el real es info@mesform.es |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Mesform:
> 
> Hacéis desde muebles y vestidores a medida hasta reformas integrales, y vuestro "Contáctame" lo recibe todo igual: nombre, email y mensaje. Hasta que no habláis con el cliente no sabéis si es un armario o un piso entero. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada proyecto ya explicado:
> 
> https://presupuestos.nico-soto.es/demo/mesform
> 
> Son solo dos minutos y sin compromiso.

### 54. Tres i Tres Interiorismo

| Campo | Valor |
|---|---|
| Ciudad | Paterna |
| Home Estimator Score / clase | 6.0 / B |
| Google | 4.4 ⭐, 20 reseñas, categoría Empresa constructora |
| Web | http://3itres.com |
| Dónde pide presupuesto | https://3itres.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | info@3itres.com |
| Email que vio la auditoría | info@3itres.com |
| Teléfono / WhatsApp en la web | +34 658 07 03 01 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/tres-i-tres |
| Cómo funciona hoy | formulario de contacto |
| Campos del formulario (extracción cruda) | your-name, your-email, tel-781, your-subject, textarea:your-message, textarea:g-recaptcha-response aqui la respuesta d |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 20 reseñas 4.4. Interiorismo + 'reformas integrales'. CF7 estándar. |
| Por qué encaja | Hace reforma residencial pero mezclada con interiorismo, obra o comercio; el dolor existe aunque el encaje sea menos directo. |
| Ángulo de la auditoría | Recibes nombre, teléfono y un mensaje: todo el trabajo de cualificación empieza después de que llegue el lead. |
| Notas de la revisión | reCAPTCHA |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Tres i Tres:
> 
> Ponéis mucho el foco en la gestión de plazos y en garantizar las fechas de entrega, pero cada "pídenos presupuesto" os llega como nombre, email, teléfono, asunto y mensaje. Los días que se van en entender qué quiere el cliente antes de presupuestar también cuentan en el plazo. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/tres-i-tres
> 
> Son solo dos minutos y sin compromiso.

### 55. Reformas Escrivá Sanjuan

| Campo | Valor |
|---|---|
| Ciudad | Gandia |
| Home Estimator Score / clase | 6.0 / A |
| Google | 4.9 ⭐, 14 reseñas, categoría Reformas |
| Web | http://www.escrivasanjuan.com |
| Dónde pide presupuesto | https://escrivasanjuan.com/contacto |
| **Email para el CSV (el de la cola, copiar tal cual)** | comercial@escrivasanjuan.com |
| Email que vio la auditoría | comercial@escrivasanjuan.com |
| Teléfono / WhatsApp en la web | +34 607 64 14 32 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/escriva-sanjuan |
| Cómo funciona hoy | formulario de contacto (web renderizada por JS) + teléfono 'Llámanos ahora' |
| Campos del formulario (extracción cruda) | nombre y apellido*, email*, teléfono, asunto, mensaje |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 14 reseñas 4.9; 'Especialistas en reformas de baños, cocinas, albañilería y fontanería. Solicita presupuesto sin compromiso.'; form definido en JSON del builder: nombre/email/teléfono/asunto. |
| Por qué encaja | Reforma integral residencial con form sin cualificación; pocas reseñas. |
| Ángulo de la auditoría | Tu web invita a 'Solicitar presupuesto sin compromiso' y el formulario pregunta nombre, email, teléfono y asunto, pero nada de la reforma. |
| Notas de la revisión | 35 años; WhatsApp |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Reformas Escrivá Sanjuan:
> 
> Lleváis más de 35 años haciendo reformas en Gandia y la Safor y ofrecéis presupuesto sin compromiso, pero el formulario pregunta nombre, email, teléfono y asunto, y nada de la reforma. Todo lo que determina el presupuesto lo averiguáis después. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada solicitud ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/escriva-sanjuan
> 
> Son solo dos minutos y sin compromiso.

### 56. M&A Instaladores

| Campo | Valor |
|---|---|
| Ciudad | Torrent |
| Home Estimator Score / clase | 6.0 / B |
| Google | 5 ⭐, 13 reseñas, categoría Empresa de construcción |
| Web | https://myainstaladores.com |
| Dónde pide presupuesto | https://myainstaladores.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | tecnicoacustermic@gmail.com |
| Email que vio la auditoría | tecnicoacustermic@gmail.com |
| Teléfono / WhatsApp en la web | +34 632 08 49 45 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/mya-instaladores |
| Cómo funciona hoy | formulario de contacto |
| Campos del formulario (extracción cruda) | name_0 nombre et_pb_contac, tlf_0 telefono et_pb_conta, email_0 correo electronico, textarea:message_0 mensaje et_pb_co |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 13 reseñas 5.0. Pladur + reformas integrales. Form Divi nombre/teléfono. |
| Por qué encaja | Hace reforma residencial pero mezclada con interiorismo, obra o comercio; el dolor existe aunque el encaje sea menos directo. |
| Ángulo de la auditoría | El cliente solo puede explicar su reforma en un textarea de 'cuéntanos tu proyecto'. Tú lo traduces a presupuesto a mano. |
| Notas de la revisión | pladur y aislamientos además de reformas |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de M&A Instaladores:
> 
> Hacéis pladur, aislamiento y reformas integrales, y la web le pide al cliente que os "cuente su proyecto" en un mensaje. Luego sois vosotros los que tenéis que traducir ese texto a metros, trabajos y presupuesto antes de saber si merece la pena. He montado una demo con vuestra marca para enseñaros cómo podría llegaros ya estructurado:
> 
> https://presupuestos.nico-soto.es/demo/mya-instaladores
> 
> Son solo dos minutos y sin compromiso.

### 57. Vimoa

| Campo | Valor |
|---|---|
| Ciudad | Burjassot |
| Home Estimator Score / clase | 6.0 / A |
| Google | 4.5 ⭐, 8 reseñas, categoría Reformas |
| Web | http://www.vimoa.es |
| Dónde pide presupuesto | https://vimoa.es/contacto |
| **Email para el CSV (el de la cola, copiar tal cual)** | vicente@vimoa.es |
| Email que vio la auditoría | vicente@vimoa.es |
| Teléfono / WhatsApp en la web | +34 617 56 74 75 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/vimoa |
| Cómo funciona hoy | formulario de contacto + chat web |
| Campos del formulario (extracción cruda) | contactform-email info@vimoa.es contactf, textarea:contactform-message contactform-message |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 8 reseñas 4.5. Form de email + mensaje, sin teléfono siquiera. |
| Por qué encaja | Reforma residencial con demanda real y una solicitud de presupuesto que no recoge nada de lo que determina el precio: Home Estimator lo sustituye entero. |
| Ángulo de la auditoría | Recibes nombre, teléfono y un mensaje: todo el trabajo de cualificación empieza después de que llegue el lead. |
| Notas de la revisión | formulario de solo email + mensaje; reCAPTCHA |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Vimoa:
> 
> Vuestro formulario de contacto pide solo un email y un mensaje, ni siquiera un teléfono. Y hacéis de todo, desde carpintería y armarios hasta reformas integrales, así que cada solicitud empieza con varios correos de ida y vuelta para saber qué quiere el cliente. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/vimoa
> 
> Son solo dos minutos y sin compromiso.

### 58. DLUXE Solutions · Reformas en Oliva

| Campo | Valor |
|---|---|
| Ciudad | Oliva |
| Home Estimator Score / clase | 6.0 / A |
| Google | 5 ⭐, 6 reseñas, categoría Reformas |
| Web | https://reformasenoliva.es |
| Dónde pide presupuesto | https://reformasenoliva.es/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | info@reformasenoliva.es |
| Email que vio la auditoría | info@reformasenoliva.es |
| Teléfono / WhatsApp en la web | +34 679 37 36 75 / sí |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/dluxesolutions |
| Cómo funciona hoy | formulario en home + WhatsApp + 'Llamar ahora' |
| Campos del formulario (extracción cruda) | nombre*, email*, teléfono*, código postal*, mensaje '¿Qué tipo de reforma necesitas?' (CF7) |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | Title 'Reformas en Oliva 【Presupuesto AHORA】' y 'solicita tu presupuesto para tu reforma en Oliva y sorpréndete con el precio'; form nombre/email/teléfono/CP + textarea. Solo 6 reseñas. |
| Por qué encaja | Reforma integral residencial con contradicción muy clara ('Presupuesto AHORA'), pero muy pocas reseñas. |
| Ángulo de la auditoría | Tu web dice 'solicita tu presupuesto y sorpréndete con el precio', pero el formulario solo recoge nombre, email, teléfono y código postal. |
| Notas de la revisión | "sorpréndete con el precio" |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de DLUXE Solutions:
> 
> Vuestra web dice "solicita tu presupuesto y sorpréndete con el precio", pero el formulario solo recoge nombre, email, teléfono, código postal y qué tipo de reforma quiere. La sorpresa llega después de llamar, medir y preparar el presupuesto. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada, con metros, alcance, plazo e inversión:
> 
> https://presupuestos.nico-soto.es/demo/dluxesolutions
> 
> Son solo dos minutos y sin compromiso.

### 59. Construcciones y Reformas Salvicar

| Campo | Valor |
|---|---|
| Ciudad | Carlet |
| Home Estimator Score / clase | 5.5 / A |
| Google | 4.7 ⭐, 14 reseñas, categoría Constructor |
| Web | http://www.salvicar.com |
| Dónde pide presupuesto | https://reformas.salvicar.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | salvicar@ono.com |
| Email que vio la auditoría | salvicar@ono.com |
| Teléfono / WhatsApp en la web | +34 610 54 75 94 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/salvicar |
| Cómo funciona hoy | formulario de contacto (Jimdo) |
| Campos del formulario (extracción cruda) | nombre*, email*, mensaje* + captcha |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 14 reseñas 4.7; salvicar.com redirige a reformas.salvicar.com 'Por fin, tenemos la solución para tus reformas'; 'PIDE PRESUPUESTO SIN COMPROMISO' con form nombre/email/mensaje + código antispam. |
| Por qué encaja | Web orientada a reformas con form vacío, pero constructora con pocas reseñas. |
| Ángulo de la auditoría | Tu web dice 'Pide presupuesto sin compromiso' y lo único que puede mandarte el cliente es nombre, email y un mensaje, después de resolver un captcha. |
| Notas de la revisión | captcha Jimdo |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Salvicar:
> 
> Vuestra web dice "Por fin, tenemos la solución para tus reformas" y que personalizáis cada proyecto y presupuesto. Pero para pedirlo, el cliente solo puede dejar nombre, email y un mensaje, después de resolver un captcha. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/salvicar
> 
> Son solo dos minutos y sin compromiso.

### 60. ObraEstil

| Campo | Valor |
|---|---|
| Ciudad | Ontinyent |
| Home Estimator Score / clase | 5.5 / A |
| Google | 4.9 ⭐, 9 reseñas, categoría Reformas |
| Web | http://www.obraestil.es |
| Dónde pide presupuesto | https://obraestil.es/contact/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | obraestil@gmail.com |
| Email que vio la auditoría | obraestil@gmail.com |
| Teléfono / WhatsApp en la web | +34 669 42 39 58 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/obraestil |
| Cómo funciona hoy | formulario de contacto (CF7) |
| Campos del formulario (extracción cruda) | nombre*, email*, asunto*, mensaje* |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 9 reseñas 4.9; 'Especialistas en revestimientos, cocinas y baños', '+80 proyectos'; form nombre/email/asunto/mensaje sin teléfono. |
| Por qué encaja | Reforma de vivienda (cocinas, baños) con form vacío; muy pocas reseñas. |
| Ángulo de la auditoría | Te presentas como especialista en cocinas y baños, y tu formulario pide nombre, email, asunto y mensaje, sin teléfono ni nada de la obra. |
| Notas de la revisión | entró por la baja de Gala Projectes |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de ObraEstil:
> 
> Os presentáis como especialistas en revestimientos, cocinas y baños, pero el formulario pide nombre, email, asunto y mensaje, sin teléfono ni nada de la obra. Cada solicitud empieza escribiendo al cliente para preguntarle lo básico. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/obraestil
> 
> Son solo dos minutos y sin compromiso.


## Madrid 1 — sur y este de Madrid (61–75) · 15 empresas, 11 con email

Búsqueda nueva "reformas integrales" en 18 municipios de la periferia (sur, este y norte cercano), solo con web y 10+ reseñas. 196 empresas, 194 auditadas; estas son las 15 mejores, revisadas en Chrome. Todas son empresas de reformas residenciales con volumen de reseñas alto.

Avisos de la revisión: Varada, Iasa Design y Foydecor tienen mucha estructura de marketing y reciben muchas propuestas. 12 de 15 llevan captcha, lo que no importa para email.

### 61. Reformas Blancor

| Campo | Valor |
|---|---|
| Ciudad | Alcorcón |
| Home Estimator Score / clase | 9.0 / A |
| Google | 4.8 ⭐, 174 reseñas, categoría Reformas |
| Web | https://reformasblancor.es |
| Dónde pide presupuesto | https://reformasblancor.es/presupuesto-para-reforma-integral-en-madrid/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | info@reformasblancor.es |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 911 13 47 11 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/reformas-blancor |
| Cómo funciona hoy | Formulario genérico con nombre, email, teléfono y mensaje libre, sin preguntas sobre la obra |
| Campos del formulario (extracción cruda) | Nombre, Email, Teléfono, Mensaje (opcional) |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 174 reseñas con media 4.8 en Google (aunque su widget interno muestra 128). Tienen una página específica de presupuesto que explica que el coste varía según 'metros cuadrados, calidad de materiales, complejidad y acabados', pero el formulario solo recoge nombre, email, teléfono y un mensaje libre. |
| Por qué encaja | Empresa de reforma residencial integral consolidada (chalets, pisos, cocinas, baños) con altísima reputación y una página de presupuesto que argumenta exactamente los mismos factores que cualifica Home Estimator, pero cuyo formulario no recoge ninguno de ellos. |
| Ángulo de la auditoría | En vuestra página de presupuesto escribís que el coste varía según 'metros cuadrados de la vivienda, calidad de los materiales y complejidad de la redistribución', pero el formulario justo debajo solo pide nombre, email, teléfono y un mensaje opcional: Home Estimator recoge exactamente esos datos antes de que el lead os llame. |
| Notas de la revisión | Ángulo: explica que el precio depende de m², materiales y redistribución; su formulario no pregunta nada de eso. Sin captcha. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Reformas Blancor:
> 
> En vuestra página de presupuesto explicáis que el coste de una reforma integral varía según los metros cuadrados de la vivienda, la calidad de los materiales y la complejidad de la redistribución. Pero el formulario solo pide nombre, email, teléfono y un mensaje opcional, así que todo eso lo tenéis que averiguar vosotros después, llamada a llamada. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma con esos datos ya contestados:
> 
> https://presupuestos.nico-soto.es/demo/reformas-blancor
> 
> Son solo dos minutos y sin compromiso.

### 62. Varada Reformas

| Campo | Valor |
|---|---|
| Ciudad | Torrejón de Ardoz |
| Home Estimator Score / clase | 9.0 / A |
| Google | 4.5 ⭐, 163 reseñas, categoría Reformas |
| Web | https://varada.es |
| Dónde pide presupuesto | https://varada.es/?utm_source=gmb&utm_medium=organic&utm_campaign=gmb_torrejon |
| **Email para el CSV (el de la cola, copiar tal cual)** | **SIN EMAIL → fila con enviar FALSE** |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 916 56 78 90 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/varada |
| Cómo funciona hoy | Formulario genérico con nombre, email, asunto y mensaje de texto libre; sin preguntas sobre tipo de reforma, m², plazo ni presupuesto del cliente |
| Campos del formulario (extracción cruda) | your-name, your-email, your-subject, your-message, acceptance (política de privacidad) |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | Varada tiene 163 reseñas en Google (4,5★) y menciona 301 reseñas reales en web, ofrece reformas integrales de viviendas, cocinas, baños y locales en Madrid y Guadalajara. Su web repite hasta cinco veces 'Presupuesto Gratis' y promete 'Respuesta en menos de 24h', pero el único formulario recoge nombre, email, asunto y mensaje libre, sin ningún dato de la obra. |
| Por qué encaja | Empresa residencial integral consolidada (163+ reseñas, equipo propio, presupuesto cerrado) cuyo formulario no cualifica en absoluto al lead, generando contactos sin información previa de m², estancias ni inversión. |
| Ángulo de la auditoría | Vuestra web promete 'Respuesta en menos de 24h' y 'Presupuesto cerrado', pero el formulario solo pide nombre, email y un campo de mensaje libre: el cliente no ha indicado m², estancias ni presupuesto, así que el primer contacto real lo hacéis vosotros a ciegas. |
| Notas de la revisión | Ángulo: "Respuesta en menos de 24h" y "Presupuesto cerrado" con un formulario de nombre, email, asunto y mensaje. reCAPTCHA. Mucha estructura de marketing (fichas en Madrid y Guadalajara). |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Varada:
> 
> Prometéis "Respuesta en menos de 24h" y "Presupuesto cerrado", pero el formulario solo pide nombre, email, asunto y mensaje. Esas 24 horas empiezan con una llamada para saber qué quiere reformar el cliente, cuántos metros tiene y con qué presupuesto cuenta. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/varada
> 
> Son solo dos minutos y sin compromiso.

### 63. Raynadecor

| Campo | Valor |
|---|---|
| Ciudad | Móstoles |
| Home Estimator Score / clase | 9.0 / A |
| Google | 4.5 ⭐, 126 reseñas, categoría Reformas |
| Web | https://raynadecor.es |
| Dónde pide presupuesto | https://raynadecor.es/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | info@raynadecor.es |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 912 62 34 02 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/raynadecor |
| Cómo funciona hoy | Formulario genérico (Nombre, Email, Teléfono, Mensaje) con reCAPTCHA; sin ninguna pregunta sobre m², tipo de estancia, plazo ni inversión |
| Campos del formulario (extracción cruda) | Nombre*, Email*, Teléfono*, Mensaje, checkbox legal |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 126 reseñas en Google (4,5★), enfocada en reforma integral residencial en Móstoles; su web promete 'Calculamos tu Presupuesto sin Compromiso' y 'Recibirás un presupuesto personalizado', pero el formulario solo recoge nombre, email, teléfono y un campo de mensaje libre. |
| Por qué encaja | Reforma integral residencial pura (pisos, baños, cocinas, chalets) con llave en mano como propuesta central, altísimo volumen de reseñas y promesa explícita de presupuesto online que su formulario genérico no puede cumplir. |
| Ángulo de la auditoría | Su home dice literalmente 'Calculamos tu Presupuesto sin Compromiso' y 'Recibirás un presupuesto personalizado', pero el formulario solo pide nombre, email, teléfono y un campo de mensaje: Home Estimator cierra esa distancia recogiendo m², tipo de reforma, plazo e inversión antes de que usted coja el teléfono. |
| Notas de la revisión | Ángulo: "Calculamos tu Presupuesto sin Compromiso", sin ningún dato para calcularlo. reCAPTCHA. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Raynadecor:
> 
> Vuestra web dice "Calculamos tu Presupuesto sin Compromiso" y que cada cliente recibirá un presupuesto personalizado. Pero para calcularlo, el formulario solo os deja nombre, email, teléfono y un mensaje: qué reforma es, cuántos metros tiene y con cuánto cuenta lo tenéis que preguntar después. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/raynadecor
> 
> Son solo dos minutos y sin compromiso.

### 64. Construcciones J.D.M.

| Campo | Valor |
|---|---|
| Ciudad | Alcobendas |
| Home Estimator Score / clase | 9.0 / A |
| Google | 4.7 ⭐, 122 reseñas, categoría Reformas |
| Web | https://construccionesjdm.com |
| Dónde pide presupuesto | https://construccionesjdm.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | **SIN EMAIL → fila con enviar FALSE** |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 667 81 02 95 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/construcciones-jdm |
| Cómo funciona hoy | Formulario genérico (nombre, apellidos, teléfono, email, asunto, mensaje) sin ninguna pregunta sobre la obra |
| Campos del formulario (extracción cruda) | Nombre, Apellidos, Teléfono, Email, Asunto, Mensaje |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 122 reseñas en Google (4,7★), especialización clara en reformas integrales residenciales en Alcobendas. La página de contacto se titula 'Pide ya tu presupuesto' y promete 'presupuesto personalizado para tu próxima reforma', pero el formulario solo recoge nombre, apellidos, teléfono, email, asunto y mensaje libre. |
| Por qué encaja | Empresa de reformas integrales residenciales con volumen alto de leads potenciales y formulario que no cualifica nada: no pregunta m², tipo de reforma, plazo ni inversión. |
| Ángulo de la auditoría | Su página de contacto se llama 'Pide ya tu presupuesto' y promete un 'presupuesto personalizado para tu próxima reforma', pero el formulario no pregunta ni los m², ni el tipo de reforma, ni el plazo: cualquier mensaje de texto libre llega igual que si fuera una consulta genérica. |
| Notas de la revisión | Ángulo: página "Pide ya tu presupuesto" con seis campos y ninguno de la obra. reCAPTCHA. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Construcciones J.D.M.:
> 
> Vuestra página de contacto se llama "Pide ya tu presupuesto" y promete un presupuesto personalizado para cada reforma, pero el formulario pide nombre, apellidos, teléfono, email, asunto y mensaje: nada de la vivienda ni de la obra. Lo personalizado empieza después, preguntando lo básico. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/construcciones-jdm
> 
> Son solo dos minutos y sin compromiso.

### 65. Reformas Integrales Areal

| Campo | Valor |
|---|---|
| Ciudad | Alcorcón |
| Home Estimator Score / clase | 9.0 / A |
| Google | 4.7 ⭐, 83 reseñas, categoría Reformas |
| Web | https://reformasintegralesareal.es |
| Dónde pide presupuesto | https://reformasintegralesareal.es/contacto-reformas-integral-madrid |
| **Email para el CSV (el de la cola, copiar tal cual)** | arealsl@arealsl.es |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 916 11 47 83 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/reformas-areal |
| Cómo funciona hoy | Formulario genérico con nombre, email, teléfono y mensaje libre; sin preguntas sobre m², tipo de reforma, plazo ni inversión |
| Campos del formulario (extracción cruda) | Nombre, Teléfono, Correo electrónico, Mensaje libre ('Cuéntanos qué necesitas') |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 83 reseñas con 4,7 estrellas; empresa especializada en reformas integrales residenciales en Alcorcón y sur de Madrid. Su página de contacto promete 'presupuesto sin compromiso' y 'te responderemos lo antes posible', pero el formulario solo recoge nombre, teléfono, email y un campo de texto libre. |
| Por qué encaja | Reforma integral residencial pura (pisos, cocinas y baños) para particulares, con 83 reseñas y promesa de presupuesto rápido que su formulario genérico no puede sostener sin cualificar al lead |
| Ángulo de la auditoría | Su página de contacto dice 'Pedir presupuesto' y promete respuesta 'lo antes posible', pero el formulario no pregunta ni los m², ni las estancias, ni el plazo: Home Estimator recoge todo eso antes de que llegue el lead. |
| Notas de la revisión | Ángulo: presupuesto sin compromiso y respuesta "lo antes posible", con nombre, email, teléfono y mensaje. Sin captcha. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Reformas Areal:
> 
> En vuestra página de contacto ofrecéis presupuesto sin compromiso y responder lo antes posible, pero el formulario solo recoge nombre, email, teléfono y un mensaje. Antes de poder contestar con algo concreto os toca preguntar los metros, las estancias y cuándo quiere empezar el cliente. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/reformas-areal
> 
> Son solo dos minutos y sin compromiso.

### 66. Quality Reform

| Campo | Valor |
|---|---|
| Ciudad | Fuenlabrada |
| Home Estimator Score / clase | 8.5 / A |
| Google | 4.7 ⭐, 136 reseñas, categoría Reformas |
| Web | https://qualityreform.com |
| Dónde pide presupuesto | http://qualityreform.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | **SIN EMAIL → fila con enviar FALSE** |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 643 85 91 35 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/quality-reform |
| Cómo funciona hoy | Formulario con nombre, apellidos, email, teléfono, código postal y comentario libre; sin preguntar m², tipo de reforma, plazo ni inversión |
| Campos del formulario (extracción cruda) | Nombre, Apellidos, Email, Teléfono, Código Postal, Comentario |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | Quality Reform tiene 136 reseñas con 4.7★ en Fuenlabrada, opera en toda la Comunidad de Madrid y se define como experta en reformas integrales residenciales (cocinas, baños, integrales de piso). Su página de contacto invita con '¡Pide presupuesto sin compromiso!' y ofrece 'presupuesto gratuito para tu obra', pero el formulario solo recoge nombre, email, teléfono, código postal y un campo de comentario libre. |
| Por qué encaja | Reforma residencial integral pura para particulares con 136 reseñas y promesa explícita de presupuesto gratuito/sin compromiso, pero el formulario no cualifica nada de la obra. |
| Ángulo de la auditoría | Vuestra página promete 'presupuesto gratuito para tu obra' y pide que rellenen el formulario, pero los campos solo recogen nombre, teléfono y código postal: Home Estimator añade antes de esa llamada las preguntas de m², estancias, calidades y plazo para que el lead ya llegue cualificado. |
| Notas de la revisión | Ángulo: "Pide presupuesto sin compromiso": integrales y pequeñas reparaciones entran igual. Turnstile. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Quality Reform:
> 
> Vuestra página de contacto dice "Pide presupuesto sin compromiso" y pide rellenar el formulario, pero el formulario solo recoge los datos de contacto y un comentario. Hacéis desde reformas integrales hasta pequeñas reparaciones, y por ahí os entra todo igual hasta que habláis con el cliente. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/quality-reform
> 
> Son solo dos minutos y sin compromiso.

### 67. Iasa Design

| Campo | Valor |
|---|---|
| Ciudad | Rivas-Vaciamadrid |
| Home Estimator Score / clase | 8.5 / A |
| Google | 4.8 ⭐, 132 reseñas, categoría Reformas |
| Web | https://www.iasadesign.com |
| Dónde pide presupuesto | https://www.iasadesign.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | contacto@iasadesign.com |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 916 66 12 02 / sí |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/iasa-design |
| Cómo funciona hoy | Formulario genérico (Nombre, Email, Teléfono, Mensaje) + WhatsApp, sin preguntar tipo de reforma, m², plazo ni inversión |
| Campos del formulario (extracción cruda) | Nombre, Email, Teléfono, Mensaje |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 132 reseñas con 4.8 de media; su CTA principal es 'PEDIR PRESUPUESTO SIN COMPROMISO' y ofrecen promociones con precios desde 4.850 € hasta 29.850 €, pero el formulario de contacto solo recoge Nombre, Email, Teléfono y Mensaje, sin ningún dato de la obra. |
| Por qué encaja | Reforma residencial integral en Madrid con amplio volumen de clientes (132 reseñas), servicios de interiorismo y calidades premium; el lead llega completamente sin cualificar a pesar de que publican precios orientativos en su web. |
| Ángulo de la auditoría | Tenéis el botón 'PEDIR PRESUPUESTO SIN COMPROMISO' en portada y publicáis precios desde 4.850 € hasta 29.850 €, pero el formulario de contacto solo pide Nombre, Email, Teléfono y Mensaje: el cliente llega sin deciros ni cuántos m² tiene ni qué quiere reformar. |
| Notas de la revisión | Ángulo: publica promociones desde 4.850 € a 29.850 €, pero el formulario no pregunta qué ni cuántos metros. reCAPTCHA. Mucha estructura de marketing (Kit Digital). |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Iasa Design:
> 
> Ya publicáis promociones con precio, desde 4.850 € un baño hasta 29.850 € una integral, así que quien os escribe quiere una cifra pronto. Pero al pulsar "Pedir presupuesto sin compromiso" llega a un formulario de nombre, email, teléfono y mensaje, sin decir qué quiere reformar ni cuántos metros tiene. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/iasa-design
> 
> Son solo dos minutos y sin compromiso.

### 68. Reformas Foydecor

| Campo | Valor |
|---|---|
| Ciudad | Móstoles |
| Home Estimator Score / clase | 8.5 / A |
| Google | 4.2 ⭐, 120 reseñas, categoría Reformas |
| Web | https://foydecor.com |
| Dónde pide presupuesto | https://foydecor.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | foydecor@gmail.com |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 916 46 51 26 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/foydecor |
| Cómo funciona hoy | Formulario genérico (nombre, email, teléfono, asunto, mensaje) sin preguntar tipo de reforma, m², plazo ni inversión. También exponen email y teléfonos directos. |
| Campos del formulario (extracción cruda) | nombre, email, teléfono, asunto, mensaje (texto libre) |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | Foydecor tiene 120 reseñas en Google (4.2★), se presenta como empresa de 'reformas integrales y diseño de cocinas y baños' con más de dos décadas de experiencia, y promete proyectos 'adaptados a su presupuesto' y financiación sin intereses; sin embargo, su formulario de contacto solo recoge nombre, email, teléfono, asunto y un campo de texto libre, sin ninguna pregunta sobre la obra. |
| Por qué encaja | Reforma residencial integral clara (pisos, cocinas, baños) para particulares en el área metropolitana de Madrid, con volumen de reseñas alto (120) que indica demanda activa, pero el formulario no cualifica en absoluto al lead. |
| Ángulo de la auditoría | En su web prometen proyectos 'adaptados a su presupuesto' y ofrecen financiación, pero su formulario de contacto solo pide nombre, email, teléfono y 'escriba aquí su consulta': cualquier persona que rellene ese formulario llega sin cualificar. |
| Notas de la revisión | Ángulo: proyectos "a su presupuesto" y financiación, sin preguntar el presupuesto. reCAPTCHA. Anuncio en Telemadrid. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Foydecor:
> 
> Prometéis proyectos adaptados a las necesidades de cada cliente "y, como no, a su presupuesto", y además financiáis sin intereses. Pero el formulario pide nombre, correo, teléfono, asunto y "Escriba aquí su consulta": con cuánto cuenta el cliente y qué quiere reformar lo tenéis que preguntar después. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/foydecor
> 
> Son solo dos minutos y sin compromiso.

### 69. Reformas El Baúl

| Campo | Valor |
|---|---|
| Ciudad | Móstoles |
| Home Estimator Score / clase | 8.5 / A |
| Google | 4.4 ⭐, 112 reseñas, categoría Reformas |
| Web | https://www.reformaselbaul.com |
| Dónde pide presupuesto | https://www.reformaselbaul.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | elbaul@reformaselbaul.com |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 916 47 71 52 / sí |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/reformas-el-baul |
| Cómo funciona hoy | Formulario genérico (nombre, email, teléfono, mensaje) + WhatsApp + teléfono. Sin ninguna pregunta sobre la obra. |
| Campos del formulario (extracción cruda) | Nombre, email, teléfono, mensaje |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | Empresa de reformas integrales residenciales en Móstoles con 112 reseñas y nota 4.4; su página de contacto solo recoge nombre, email, teléfono y mensaje, sin ningún dato de la obra. |
| Por qué encaja | Reformas integrales, cocinas y baños para particulares en Móstoles; 112 reseñas demuestran volumen de demanda, pero el formulario no cualifica: cualquier lead llega igual de frío. |
| Ángulo de la auditoría | Su web invita a 'Llámenos y le daremos el mejor presupuesto' y 'Consúltenos cualquier duda sobre su proyecto', pero el formulario solo pide nombre, email, teléfono y mensaje: Home Estimator les daría esa información antes de la primera llamada. |
| Notas de la revisión | Ángulo: "Llámenos y le daremos el mejor presupuesto"; quien escribe no cuenta nada de la obra. reCAPTCHA. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Reformas El Baúl:
> 
> Vuestra web dice "Llámenos y le daremos el mejor presupuesto", pero quien prefiere escribir llega a un formulario de nombre, email, teléfono y mensaje. Sin saber qué quiere reformar ni cuántos metros tiene, ese mejor presupuesto empieza con varias llamadas. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/reformas-el-baul
> 
> Son solo dos minutos y sin compromiso.

### 70. Reformas AlcoMad

| Campo | Valor |
|---|---|
| Ciudad | Alcorcón |
| Home Estimator Score / clase | 8.5 / A |
| Google | 4.9 ⭐, 86 reseñas, categoría Reformas de baños |
| Web | https://www.reformasalcomad.es |
| Dónde pide presupuesto | https://www.reformasalcomad.es/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | contacto@reformasalcomad.es |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 910 72 00 92 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/reformas-alcomad |
| Cómo funciona hoy | Formulario con nombre, teléfono, email, selector de tipo de reforma y mensaje libre; sin preguntar m², calidades, plazo ni inversión |
| Campos del formulario (extracción cruda) | nombre, telefono, email, select (Reforma Integral / Cocina / Baño / Local / Otros), textarea mensaje |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / sí / no / no / no |
| Evidencia de la auditoría | 86 reseñas con 4,9 estrellas en Google; la web invita a '¡Solicite presupuesto sin compromiso!' pero el formulario solo recoge nombre, teléfono, email, tipo de reforma y un mensaje libre, sin preguntar m², calidades, plazo ni presupuesto disponible. |
| Por qué encaja | Reformas integrales residenciales muy activas (cocinas, baños, pisos completos en Madrid) con altísimo volumen de reseñas y formulario que no cualifica al lead más allá del tipo de reforma. |
| Ángulo de la auditoría | Vuestro botón dice '¡Solicite presupuesto sin compromiso!' pero el formulario no pregunta los m², las calidades ni cuándo se quiere hacer la obra, así que cada lead que entra necesita una llamada para lo básico antes de poder estimar nada. |
| Notas de la revisión | Ángulo: ya pregunta el tipo de reforma, pero no metros, calidades ni plazo. Sin captcha. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de AlcoMad:
> 
> Vuestro formulario ya pregunta si es reforma integral, cocina, baño o local, que es más de lo que pregunta la mayoría. Pero después de "¡Solicite presupuesto sin compromiso!" seguís sin saber los metros, las calidades ni cuándo quiere empezar el cliente, y eso sale en la primera llamada. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/reformas-alcomad
> 
> Son solo dos minutos y sin compromiso.

### 71. Reformas Marian

| Campo | Valor |
|---|---|
| Ciudad | Torrejón de Ardoz |
| Home Estimator Score / clase | 8.5 / A |
| Google | 4.8 ⭐, 79 reseñas, categoría Reformas |
| Web | https://reformasmarian.es |
| Dónde pide presupuesto | https://reformasmarian.es/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | hola@reformasmarian.es |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 691 16 13 29 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/reformas-marian |
| Cómo funciona hoy | Formulario genérico (nombre, email, teléfono, mensaje) sin ninguna pregunta sobre la obra; el formulario de contacto dice literalmente 'pedir un presupuesto sin compromiso' pero no recoge m², estancia, plazo ni inversión. |
| Campos del formulario (extracción cruda) | nombre, email, asunto (usado para teléfono), mensaje libre |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | Reformas Marian tiene 79 reseñas en Google con 4.8 de media y ofrece reformas integrales, cocinas, baños y locales en Madrid; su formulario de presupuesto solo pide nombre, email, teléfono y mensaje libre, sin ningún dato de la obra. |
| Por qué encaja | Empresa de reformas residenciales integrales con mucho volumen de leads entrantes (79 reseñas, 4.8★) que promete 'presupuesto sin compromiso' pero no cualifica al cliente en ningún momento antes de la llamada. |
| Ángulo de la auditoría | Vuestro formulario invita a 'pedir un presupuesto sin compromiso' pero no pregunta ni los metros, ni la estancia, ni el plazo: Home Estimator recoge esos datos antes de que el cliente os contacte, así solo atendéis a quien ya sabe lo que quiere. |
| Notas de la revisión | Ángulo: invita a "pedir un presupuesto sin compromiso" con nombre, email, móvil y mensaje. reCAPTCHA. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Reformas Marian:
> 
> En vuestra página de contacto invitáis a "pedir un presupuesto sin compromiso", pero el formulario solo pide nombre, email, móvil y mensaje. Hasta que no habláis con el cliente no sabéis si es un baño, una cocina o un piso entero, ni cuántos metros tiene. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/reformas-marian
> 
> Son solo dos minutos y sin compromiso.

### 72. Support Home

| Campo | Valor |
|---|---|
| Ciudad | Valdemoro |
| Home Estimator Score / clase | 8.5 / A |
| Google | 4.8 ⭐, 78 reseñas, categoría Reformas |
| Web | https://supporthome.es |
| Dónde pide presupuesto | https://supporthome.es/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | servicios@supporthome.es |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 667 93 95 11 / sí |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/support-home |
| Cómo funciona hoy | Formulario genérico (nombre, email, teléfono, asunto, mensaje) + WhatsApp + llamada; ningún campo cualifica la obra |
| Campos del formulario (extracción cruda) | nombre, email, teléfono, asunto, archivo adjunto, mensaje |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / sí |
| Evidencia de la auditoría | 78 reseñas con 4.8 en Google, reformas integrales residenciales claras (pisos, casas, cocinas, baños); su web dice 'Entregamos presupuesto con total transparencia' y 'Solicita presupuesto sin compromiso' pero el formulario de contacto solo pide nombre, email, teléfono, asunto y mensaje, sin ningún dato de la obra. |
| Por qué encaja | Residencial integral puro con alto volumen de reseñas y promesa explícita de presupuesto transparente que su formulario genérico no puede cumplir. |
| Ángulo de la auditoría | Vuestra web promete 'presupuesto con total transparencia en cuanto a materiales, mano de obra y tiempo de ejecución', pero el formulario solo recoge nombre, email y un campo libre de mensaje, sin preguntar ni m², ni tipo de reforma, ni plazo. |
| Notas de la revisión | Ángulo: presupuesto "con total transparencia" que empieza sin saber qué se reforma. reCAPTCHA invisible. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Support Home:
> 
> Decís que entregáis el presupuesto "con total transparencia en cuanto a materiales, mano de obra y tiempo de ejecución", pero para pedirlo el formulario solo recoge nombre, email, teléfono, asunto y un mensaje. Esa transparencia empieza después de preguntarle al cliente qué quiere reformar y cuántos metros tiene. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/support-home
> 
> Son solo dos minutos y sin compromiso.

### 73. Remacen Reparaciones

| Campo | Valor |
|---|---|
| Ciudad | Alcalá de Henares |
| Home Estimator Score / clase | 8.5 / A |
| Google | 4.9 ⭐, 69 reseñas, categoría Reformas |
| Web | https://www.reformasmadridcentro.com |
| Dónde pide presupuesto | https://www.reformasmadridcentro.com/contacto |
| **Email para el CSV (el de la cola, copiar tal cual)** | reformasmadridcentro@gmail.com |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 601 23 84 93 / sí |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/remacen |
| Cómo funciona hoy | Formulario genérico (Nombre, Apellidos, Email, Teléfono, Mensaje) más WhatsApp y teléfono; sin preguntas sobre obra |
| Campos del formulario (extracción cruda) | Nombre, Apellidos, Email, Teléfono, Mensaje |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | Remacen Reparaciones Sl tiene 69 reseñas con 4,9 de media y más de 15 años en reformas integrales de pisos, casas y locales en Madrid. Su página de contacto invita a 'solicitar un presupuesto gratuito' pero el formulario solo recoge Nombre, Apellidos, Email, Teléfono y Mensaje, sin ningún dato de la obra. |
| Por qué encaja | Empresa residencial integral consolidada (reformas de pisos y casas, cocinas, baños, alicatado, tarima, fontanería, electricidad) con alta reputación; el formulario genérico no cualifica en absoluto al lead antes de que la empresa tenga que invertir tiempo en él. |
| Ángulo de la auditoría | En su página de contacto prometen 'presupuesto gratuito' y 'respuesta rápida', pero su formulario solo pide nombre y mensaje: cualquier persona que escribe 'quiero reformar mi piso' llega sin m², sin tipo de reforma y sin inversión estimada. |
| Notas de la revisión | Ángulo: presupuesto gratuito y respuesta rápida, sin nada de la obra en el formulario. reCAPTCHA invisible. Web reformasmadridcentro.com. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Remacen:
> 
> En vuestra web ofrecéis presupuesto gratuito y respuesta rápida, pero el formulario pide nombre, apellidos, email, teléfono y mensaje, sin nada de la obra. Esa respuesta rápida empieza preguntando lo básico: qué reforma es, cuántos metros tiene y con qué presupuesto cuenta el cliente. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/remacen
> 
> Son solo dos minutos y sin compromiso.

### 74. Reformas Vegam

| Campo | Valor |
|---|---|
| Ciudad | Alcobendas |
| Home Estimator Score / clase | 8.5 / A |
| Google | 5 ⭐, 67 reseñas, categoría Reformas |
| Web | https://www.reformasvegam.es |
| Dónde pide presupuesto | https://www.reformasvegam.es/contacto |
| **Email para el CSV (el de la cola, copiar tal cual)** | **SIN EMAIL → fila con enviar FALSE** |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 659 20 10 03 / sí |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/reformas-vegam |
| Cómo funciona hoy | Formulario genérico con campos Nombre, Email, Teléfono y Mensaje, más WhatsApp y email directo. Ningún campo cualifica la obra. |
| Campos del formulario (extracción cruda) | Nombre*, Email*, Teléfono, Mensaje* |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | Reformas Vegam tiene 67 reseñas con nota 5 en Google y lleva más de 20 años en Alcobendas ofreciendo reformas integrales residenciales, cocinas, baños y terrazas. Su web promete 'Presupuestos sin compromiso. Claridad total desde el primer momento' y un CTA '¡Empieza tu reforma hoy mismo! Pide tu presupuesto sin compromiso', pero el formulario solo recoge Nombre, Email, Teléfono y Mensaje. |
| Por qué encaja | Empresa de reforma residencial integral consolidada (20 años, 67 reseñas a 5 estrellas) cuyo único canal de captación es un formulario genérico que no cualifica al lead en absoluto. |
| Ángulo de la auditoría | Su web promete 'Claridad total desde el primer momento' en presupuestos, pero el formulario solo pide nombre, email y un campo de mensaje libre: el cliente no sabe qué contar y Vegam no sabe nada de la obra hasta llamarle. |
| Notas de la revisión | Ángulo: "Claridad total desde el primer momento" con un formulario genérico. reCAPTCHA invisible. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Reformas Vegam:
> 
> Entre lo que os distingue ponéis "Presupuestos sin compromiso" y "Claridad total desde el primer momento". Pero ese primer momento es un formulario de nombre, email, teléfono y mensaje, y la claridad llega después, cuando ya habéis preguntado qué quiere reformar el cliente y cuántos metros tiene. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/reformas-vegam
> 
> Son solo dos minutos y sin compromiso.

### 75. Grupo León Reformas

| Campo | Valor |
|---|---|
| Ciudad | Getafe |
| Home Estimator Score / clase | 8.5 / A |
| Google | 4.6 ⭐, 66 reseñas, categoría Contratista general |
| Web | https://grupoleonreformas.com |
| Dónde pide presupuesto | https://grupoleonreformas.com/contacto/ |
| **Email para el CSV (el de la cola, copiar tal cual)** | grupoleon.gerencia.getafe@gmail.com |
| Email que vio la auditoría | — |
| Teléfono / WhatsApp en la web | +34 633 06 33 88 / no |
| Link de la demo (no lo pongas: va {link_demo}) | https://presupuestos.nico-soto.es/demo/grupo-leon-reformas |
| Cómo funciona hoy | Formulario genérico con Nombre, Email, Teléfono y campo libre de Información; sin preguntas sobre tipo de reforma, m², plazo ni inversión |
| Campos del formulario (extracción cruda) | Nombre, Email, Número de teléfono, Información (textarea libre) |
| Pregunta m² / tipo / plazo / presupuesto / fotos | no / no / no / no / no |
| Evidencia de la auditoría | 66 reseñas (4.6★) con menciones explícitas a reforma integral de vivienda, baños y demoliciones; la web promete 'Consigue Tu Presupuesto Sin Compromiso' y botones 'Contactar ahora' que llevan a un formulario de solo 4 campos (nombre, email, teléfono, texto libre). |
| Por qué encaja | Reforma residencial integral clara (viviendas desde cero, baños, cocinas, fontanería, carpintería) con una promesa de presupuesto sin compromiso que su formulario no puede cumplir: no recoge ni tipo de reforma, ni m², ni plazo, ni inversión. |
| Ángulo de la auditoría | Vuestro botón dice 'Consigue Tu Presupuesto Sin Compromiso', pero el formulario solo pide nombre, email, teléfono y un campo de texto libre: Home Estimator recoge tipo de reforma, m², estancias, calidades, plazo e inversión antes de que el cliente os contacte, así llegáis con el lead ya cualificado. |
| Notas de la revisión | Ángulo: "Consigue Tu Presupuesto Sin Compromiso" y un campo libre de "Información". Turnstile. |

Mensaje de formulario que se preparó el 13-sep (no consta como enviado; úsalo como fuente de datos de su web):

> Hola, equipo de Grupo León Reformas:
> 
> Vuestro botón dice "Consigue Tu Presupuesto Sin Compromiso", pero el formulario pide nombre, email, teléfono e "Información", un campo libre. Cada solicitud os obliga a volver a preguntar qué quiere reformar el cliente, cuántos metros tiene y con qué presupuesto cuenta. He montado una demo con vuestra marca para enseñaros cómo podría llegaros cada reforma ya explicada:
> 
> https://presupuestos.nico-soto.es/demo/grupo-leon-reformas
> 
> Son solo dos minutos y sin compromiso.

