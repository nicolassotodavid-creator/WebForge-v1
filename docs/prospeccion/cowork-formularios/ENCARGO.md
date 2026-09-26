# Encargo para Cowork: enviar el formulario de contacto de 142 empresas de reformas

Eres el asistente de Nico Soto (nico-soto.es). Nico ha preparado para cada una de estas empresas de reformas de Madrid
una demo de un simulador de presupuestos con su marca. Tu trabajo: entrar en la web de cada empresa y mandarle el mensaje
por **su formulario de contacto**. El texto de cada empresa ya está escrito y no se toca.

La columna `tipo` dice qué es cada fila (a ti no te cambia nada, es para que entiendas el orden):
- `ab_canal` (35): prueba de canal; la otra mitad de ese grupo recibe el mismo mensaje por email. **Van primero.**
- `primer` (14): nunca les llegó nada (no tienen email o les rebotó).
- `rescate` (93): se les mandó un email que no consta que abrieran.

## Ficheros

- `formularios-todos.csv` → la lista (142 filas), en el orden en que hay que hacerlas. **Solo lectura.**
  (`formularios-madrid567.csv` es solo el origen de las 35 primeras: no lo uses.)
- `resultados.csv` → aquí apuntas cada empresa al terminarla (una línea por empresa). Columnas:
  `n,empresa,estado,fecha_hora,url_formulario,notas`

Antes de empezar cada empresa, mira `resultados.csv`: **si su `n` ya está, sáltala.** Nunca mandes dos veces a la misma.

## Para cada empresa

1. Abre la columna `web`. Busca el formulario de contacto (enlace «Contacto», «Contáctanos», «Presupuesto», o al pie de la home).
2. Rellena:
   - **Nombre:** Nico Soto
   - **Email:** hola@nico-soto.es
   - **Teléfono:** solo si es obligatorio → 600 78 22 11
   - **Empresa:** nico-soto.es (si lo pide)
   - **Asunto:** la columna `asunto` (si hay campo de asunto)
   - **Mensaje:** la columna `mensaje`, tal cual, con sus saltos de línea. Si el campo tiene límite de caracteres y no cabe, usa `mensaje_corto`.
   - **Desplegables** (motivo, tipo de obra, cómo nos conociste…): la opción más neutra: «Otros», «Información», «Consulta general».
     Si solo hay tipos de obra, la primera opción razonable y apúntalo en notas.
   - **Casilla de privacidad / aviso legal:** márcala si es obligatoria para enviar.
   - **Casilla de newsletter / comunicaciones comerciales:** NO la marques.
3. Envía y comprueba que sale el mensaje de «enviado» / «gracias». Apunta `enviado`.

## Estados para `resultados.csv`

| estado | cuándo |
|---|---|
| `enviado` | salió la confirmación de envío |
| `captcha` | hay «No soy un robot», reCAPTCHA, hCaptcha, puzzle o similar → **NO lo resuelvas ni intentes saltarlo.** Deja el formulario, apunta la URL del formulario y sigue con la siguiente. Nico lo hará a mano. |
| `sin_formulario` | la web solo tiene email, teléfono o WhatsApp, o no hay formulario |
| `web_caida` | la web no carga, da error o redirige a otra cosa |
| `error` | enviaste y dio error, o no apareció confirmación (explica en notas) |

`fecha_hora` = cuándo lo enviaste (formato `2026-09-26 18:40`). `url_formulario` = la página donde está el formulario.

## Lo que NO debes hacer

- No resolver ni esquivar CAPTCHAs ni verificaciones de «soy humano».
- No usar otros canales: ni chat de la web, ni WhatsApp, ni email, ni redes sociales. Solo el formulario.
- No crear cuentas ni registrarte en nada.
- No cambiar el texto del mensaje (salvo usar `mensaje_corto` si no cabe).
- No mandar a la misma empresa dos veces (aunque tenga dos formularios).
- No aceptar cookies más allá de lo necesario para ver la página («Rechazar» o «Solo necesarias» si existe).

## Al terminar

Deja un resumen en el chat: cuántas `enviado`, y la lista de las `captcha` y `error` con su `url_formulario`, para que Nico las haga a mano.
