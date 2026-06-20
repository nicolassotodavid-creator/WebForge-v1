# Rediseño de la plantilla de email — "Personal pulido"

**Fecha:** 2026-06-20
**Estado:** Aprobado, listo para implementar

## Problema

El email en frío que envía WebForge (Email 1 vía `send-email`; Email 2/3 vía `cron-followups`)
se ve "feo a rabiar" y, peor, **resta respuestas** porque parece publicidad/newsletter en lugar
de un mensaje 1:1 escrito por una persona. Defectos concretos detectados:

- **Firma duplicada**: la plantilla añade un bloque "Nico / Diseño webs para negocios locales"
  cuando el cuerpo (del `OUTREACH_PROMPT`) ya termina firmando igual → sale dos veces.
- **Dos CTAs que chocan**: botón negro "Ver la web" + botón verde "Escribirme por WhatsApp"
  → patrón anuncio, dispersa el foco y sube la señal comercial.
- **Caja gris sobre fondo gris** → pinta de newsletter.
- **Footer vago** ("Has recibido este email porque…") → ni personal ni opt-out real (LSSI/RGPD).
- **Tipografía apretada** y remitente sin nombre (`hola@nico-soto.es` en vez de `Nico <…>`).

Además, el HTML está **triplicado** en `send-email`, `cron-followups` y `followup-mailer.ts`.

## Dirección elegida

**"Personal pulido"**: que parezca un email real escrito a mano, pero limpio. NO plantilla con marca.
Alineado con la regla del `CLAUDE.md`: "texto plano, humano, corto… sin pinta de plantilla".

## Diseño

Email-safe (tablas + estilos inline, una columna):

- **Fondo blanco**, sin caja. Contenedor centrado, máx ~560px, padding cómodo.
- **Tipografía**: stack web-safe (Arial/Helvetica), 16px, line-height 1.6, negro suave (#1a1a1a),
  ~18px de separación entre párrafos.
- **UNA sola CTA**: la URL del cuerpo se renderiza como un botón oscuro **slim** "Ver la web →".
  Sin botón de WhatsApp en el Email 1 (decisión del usuario).
- **Sin bloque de firma en la plantilla**: el cuerpo ya firma ("Nico / Diseño webs para negocios
  locales") y se renderiza como texto plano → una sola firma, look de persona, no de empresa.
- **Footer = una línea gris pequeña que sirve de opt-out**:
  *"Si no te encaja, respóndeme y no vuelvo a escribir."*
- **Píxel de apertura invisible**: se mantiene (alimenta la lógica del Email 3).
- **Remitente**: `Nico <hola@nico-soto.es>` (nombre visible → más confianza/aperturas).

## Cambio técnico

Extraer plantilla compartida `supabase/functions/_shared/emailTemplate.ts`:

- `bodyToHtml(text)`: párrafos por línea en blanco; una línea que es solo una URL → botón slim.
- `renderEmail({ bodyText, trackingPixelUrl, subject })`: devuelve el HTML completo (cuerpo +
  hr + línea opt-out + píxel). Sin bloque de firma propio. Sin WhatsApp.

Consumidores:
- `send-email/index.ts`: usa `renderEmail`; quita WhatsApp/firma/footer locales; `from = Nico <…>`.
- `cron-followups/index.ts`: usa `renderEmail` (sustituye su `buildHtml` local); `from = Nico <…>`.
- `followup-mailer.ts` (orquestador): quedó **redundante** al pasar los seguimientos a la nube
  (pg_cron → cron-followups). Se deja como está; borrarlo es decisión aparte del usuario.

## Alcance

Email 1, 2 y 3 con la **misma** plantilla limpia. **No** se toca copy ni lógica de envío/secuencia.

## Verificación

Enviar un email de prueba real (borrador de YuriCar) al Gmail del operador y comprobar visualmente
el render: una firma, un botón, sin WhatsApp, fondo blanco, línea de opt-out.
