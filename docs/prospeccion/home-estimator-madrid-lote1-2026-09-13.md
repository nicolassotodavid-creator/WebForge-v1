# Home Estimator — Madrid 1: 15 empresas de reformas del sur y el este

**Fecha:** 2026-09-13 · **Por qué:** València ya no da más (de las 72 empresas de reformas con web solo quedaba 1 sin
auditar) y el lote 1 dio 0 respuestas con 15 envíos, así que no sabemos si falla la zona, el sector o el mensaje.
Madrid 1 se envía **el mismo día que el lote 2 de València**, con el mismo tipo de mensaje, para comparar zonas.

**Hipótesis:** en Madrid hay más competencia entre empresas de reformas (más necesidad de filtrar y responder
rápido) pero también más gente vendiéndoles herramientas. Se va a la periferia (sur, este y norte cercano), no al
centro, para quedarse con la parte buena de lo primero sin lo peor de lo segundo.

## De dónde salen

- **Búsqueda:** `orquestador/scrape-batch.ts`, término "reformas integrales", 18 municipios (Getafe, Leganés,
  Alcorcón, Móstoles, Fuenlabrada, Parla, Pinto, Valdemoro, Arroyomolinos, Alcalá de Henares, Torrejón de Ardoz,
  Coslada, San Fernando de Henares, Rivas-Vaciamadrid, Arganda del Rey, Mejorada del Campo, Alcobendas y
  San Sebastián de los Reyes), solo con web y al menos 10 reseñas, filtro de categoría reformas/construcción.
  424 fichas → **196 empresas únicas** ingeridas en WebForge (status `new`). Arroyomolinos no devolvió nada.
- **Auditoría:** mismo método que la del [20-ago](home-estimator-reformas-2026-08-20.md): home + hasta 3 páginas de
  contacto/presupuesto, campos del formulario, WhatsApp, captcha, embebidos y calculadoras; clase A/B/C,
  Home Estimator Score y ángulo por Sonnet con los datos extraídos. **194 auditadas: 77 A, 70 B, 47 C**
  (15 de las C son webs caídas o sin contenido útil).
- **Revisión:** los 15 elegidos y 8 reservas abiertos en Chrome (formulario visible, captcha). Cada cita de su web
  que aparece en los mensajes está comprobada contra el texto real de la página; las que no salían literales se
  reescribieron con el texto que sí está.

## Los 15

| # | Score | Empresa | Municipio | Reseñas | Dónde se le escribe | Ángulo |
|---|---|---|---|---|---|---|
| 61 | **9** | [Reformas Blancor](https://reformasblancor.es) | Alcorcón | 174 | [página de presupuesto](https://reformasblancor.es/presupuesto-para-reforma-integral-en-madrid/) (sin captcha) | Explica que el precio depende de m², materiales y redistribución; su formulario no pregunta nada de eso. |
| 62 | **9** | [Varada Reformas](https://varada.es) | Torrejón de Ardoz | 163 | formulario de la home (reCAPTCHA) | "Respuesta en menos de 24h" y "Presupuesto cerrado" con un formulario de nombre, email, asunto y mensaje. |
| 63 | **9** | [Raynadecor](https://raynadecor.es) | Móstoles | 126 | [/contacto](https://raynadecor.es/contacto/) (reCAPTCHA) | "Calculamos tu Presupuesto sin Compromiso", sin ningún dato para calcularlo. |
| 64 | **9** | [Construcciones J.D.M.](https://construccionesjdm.com) | Alcobendas | 122 | [/contacto](https://construccionesjdm.com/contacto/) (reCAPTCHA) | Página "Pide ya tu presupuesto" con seis campos y ninguno de la obra. |
| 65 | **9** | [Reformas Integrales Areal](https://reformasintegralesareal.es) | Alcorcón | 83 | [contacto](https://reformasintegralesareal.es/contacto-reformas-integral-madrid) (sin captcha) | Presupuesto sin compromiso y respuesta "lo antes posible", con nombre, email, teléfono y mensaje. |
| 66 | **8.5** | [Quality Reform](https://qualityreform.com) | Fuenlabrada | 136 | [/contacto](http://qualityreform.com/contacto/) (Turnstile) | "Pide presupuesto sin compromiso": integrales y pequeñas reparaciones entran igual. |
| 67 | **8.5** | [Iasa Design](https://www.iasadesign.com) | Rivas-Vaciamadrid | 132 | [/contacto](https://www.iasadesign.com/contacto/) (reCAPTCHA) | Publica promociones desde 4.850 € a 29.850 €, pero el formulario no pregunta qué ni cuántos metros. |
| 68 | **8.5** | [Reformas Foydecor](https://foydecor.com) | Móstoles | 120 | [/contacto](https://foydecor.com/contacto/) (reCAPTCHA) | Proyectos "a su presupuesto" y financiación, sin preguntar el presupuesto. |
| 69 | **8.5** | [Reformas El Baúl](https://www.reformaselbaul.com) | Móstoles | 112 | [/contacto](https://www.reformaselbaul.com/contacto/) (reCAPTCHA) | "Llámenos y le daremos el mejor presupuesto"; quien escribe no cuenta nada de la obra. |
| 70 | **8.5** | [Reformas AlcoMad](https://www.reformasalcomad.es) | Alcorcón | 86 | formulario de la home (sin captcha) | Ya pregunta el tipo de reforma, pero no metros, calidades ni plazo. |
| 71 | **8.5** | [Reformas Marian](https://reformasmarian.es) | Torrejón de Ardoz | 79 | [/contacto](https://reformasmarian.es/contacto/) (reCAPTCHA) | Invita a "pedir un presupuesto sin compromiso" con nombre, email, móvil y mensaje. |
| 72 | **8.5** | [Support Home](https://supporthome.es) | Valdemoro | 78 | [/contacto](https://supporthome.es/contacto/) (reCAPTCHA invisible) | Presupuesto "con total transparencia" que empieza sin saber qué se reforma. |
| 73 | **8.5** | [Remacen Reparaciones](https://www.reformasmadridcentro.com) | Alcalá de Henares | 69 | [/contacto](https://www.reformasmadridcentro.com/contacto) (reCAPTCHA invisible) | Presupuesto gratuito y respuesta rápida, sin nada de la obra en el formulario. |
| 74 | **8.5** | [Reformas Vegam](https://www.reformasvegam.es) | Alcobendas | 67 | [/contacto](https://www.reformasvegam.es/contacto) (reCAPTCHA invisible) | "Claridad total desde el primer momento" con un formulario genérico. |
| 75 | **8.5** | [Grupo León Reformas](https://grupoleonreformas.com) | Getafe | 66 | [/contacto](https://grupoleonreformas.com/contacto/) (Turnstile) | "Consigue Tu Presupuesto Sin Compromiso" y un campo libre de "Información". |

**Reservas, por si alguna cae:** Refordomus (Móstoles, 8.5), ReformaX (San Sebastián de los Reyes, 8.5),
Spacioh (Fuenlabrada, 8.5, sin captcha), Reformas Europa (Torrejón, 8.5), Reformas Gabriel (Torrejón, 8.5,
"Presupuesto en 24h"), DecoJust (Móstoles, 8), Juropa (Fuenlabrada, 8), Fusión Reformas (Móstoles, 8).
Solo WhatsApp, sin formulario: Reformas Integrales Arias (Móstoles, 9) e IRC Service (Torrejón, 8.5).

## Antes de enviar

- **Tres con más estructura de marketing:** Varada (fichas en Madrid y Guadalajara con enlaces de campaña),
  Iasa Design (promociones con precio, Kit Digital) y Foydecor (anuncio en Telemadrid). Son justo el perfil que más
  propuestas recibe; si no contestan, no sacar conclusiones de la zona por ellas.
- **Competencia real encontrada:** Finalis Reformas (Fuenlabrada, 684 reseñas) ya tiene un configurador de precio
  de 11 pasos para baños. Descartada (C). Es la primera empresa con herramienta propia que sale en las auditorías
  desde Tu Reforma Mola.
- **Sin logo en imagen:** Marian, Remacen y Grupo León escriben el nombre en texto; la demo compone el nombre
  (Marian con su amarillo, Remacen con su dorado, Grupo León en tinta). Iasa Design tiene el logo en blanco: su demo
  usa `iasa-design-fondo.png`.
- **Captcha:** 12 de 15 llevan reCAPTCHA o Turnstile. Envío manual, como siempre.
- **Descartadas al elegir:** Proyectos Crisan (la web no carga contenido), Manitas Euro Reforma (multiservicio y su
  web es un enlace de WhatsApp), Reforfast y Rehabiliti (no se ve formulario; mirar a mano si hacen falta),
  SIGUEPLAC (formulario raro de un solo campo).
- **Coste:** los 196 leads entran en WebForge como `new`, así que el orquestador de las 08:00 les generará brief
  con Sonnet (API). No construye ninguna web sin aprobación en el panel.

## Dónde están los datos

- Tabla `events`, `type = 'home_estimator_audit'`, `payload->>'lote' = 'madrid-1'` y
  `payload->>'zona' = 'madrid-sur-este'` (las A y B llevan además `cohort = 'home_estimator_reformas'`).
- Demos: filas en `organizations` del proyecto Lovable `reform-wizard`; logos en `app/public/demo/logos/`.
- Cola: [cola-envio-home-estimator.html](cola-envio-home-estimator.html) (grupo "Madrid 1", justo debajo del
  lote 2), hoja "Madrid 1 (61-75)" del Excel y
  [home-estimator-outreach-madrid-61-75.csv](home-estimator-outreach-madrid-61-75.csv).
