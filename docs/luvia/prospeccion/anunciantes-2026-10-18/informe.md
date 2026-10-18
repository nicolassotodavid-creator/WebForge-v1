# [LUVIA] Lote «clínicas anunciantes» (10) — informe (18-oct-2026)

**Estado: 10 borradores locales. NO programados, NO enviados, NO escritos en ninguna base.**
Lote separado de los 141 (`revision-141/`) y del envío del martes 20-oct, que sigue desactivado
(`com.luvia.email1-capilar-lote4.plist.DISABLED-2026-10-18`, sin tocar).

Fuente: informe de investigación de la sesión del 18-oct (Biblioteca de anuncios de Meta + Centro de
Transparencia de Google + webs). Método: `../METODO-EDITORIAL.md`.

## 1. Condición legal: NO se cumple → envío bloqueado

- No hay ningún documento de habilitación para el email comercial (LSSI art. 21). Lo que consta en Nico OS
  (18-oct, 17:27 y 17:42) es justo lo contrario: «lote 135 congelado por revisión legal» y
  «enfoque aprobado para preparación, no para envíos».
- La excepción del art. 21.2 no aplica: ninguna es cliente. Que el email sea público no es consentimiento.
- Además, el pie de Luvia sigue sin aviso legal (faltan NIF y domicilio: `LUVIA_LEGAL_URL` sin configurar),
  y falta la información del RGPD art. 14.
- Por eso no se ha creado ningún lead, ningún `outreach_message`, ningún launchd ni ningún script de envío.

## 2. Comprobaciones hechas (todas de solo lectura)

| Comprobación | Resultado |
|---|---|
| Duplicados dentro del lote | 0 (10 emails y 10 asuntos únicos) |
| WebForge `leads` (email, dominio y nombre) + `outreach_messages` | 0 coincidencias → nadie ha recibido un correo nuestro por la vía de Resend |
| Bajas (`do_not_contact`, `unsubscribed_at`) | 0 (no existen como leads) |
| CRM Luvia (`contacts`, `clientes`, `organizations`) | 0 |
| Gmail (enviados y recibidos, `in:anywhere`) | 0 hilos |
| Ficheros de prospección | 3 dominios (MCapilar, Frontela, DrB) solo en `capilar/candidatos-2026-10-18.json`, el bruto del scrape. Se descartaron antes de la preselección (cadenas). Nunca contactados. |
| Render HTML con `renderEmail` (marca luvia) | 10/10 bien: todos los párrafos, la CTA, la firma y el pie (identidad + «Darte de baja»). Solo 2 enlaces: luvia-ia.es en el pie y la baja. |
| QA del texto | 10/10: 120–140 palabras, una sola «?», CTA preferida al final, 0 enlaces en el cuerpo, 0 promesas prohibidas, asuntos de 47 a 59 caracteres |

## 3. Elegibilidad

**Elegibles para envío hoy: 0 de 10**, por el bloqueo legal. Si se levantara, así quedan por datos:

| ID | Clínica | Destinatario | Fuente / SMTP | Por datos |
|---|---|---|---|---|
| AN-02 | Capilex Madrid | info@capilexmadrid.es | su web / OK | **Listo** |
| AN-09 | Dr. Alfredo Villanueva | info@doctoralfredovillanueva.com | su web / OK | **Listo** (el email dice que Instagram aún no) |
| AN-03 | Neocapilar | info@neocapilar.es | su web / timeout | **Listo** (SMTP sin señal, no es rechazo) |
| AN-06 | Cirugiacapilar.es (DrB) | info@cirugiacapilar.es | su web / el servidor bloquea el probe | **Listo** (grupo con varias sedes) |
| AN-01 | Clínica Horta Nord | direccion@clinicahortanord.es | aviso legal / catch-all | **Listo**. Cambiado: el `administracion@` del informe no está en su web; `direccion@` es el del titular. |
| AN-05 | Clínica Frontela (Málaga) | malaga@injertocapilarfrontela.com | Facebook / timeout | **Revisar**: el email no está en su web y es una cadena de unas 9 sedes (la regla del 16-oct era descartar cadenas). |
| AN-04 | MCapilar | rrss@clinicamcapilar.com | Facebook / OK | **Revisar**: es el buzón de redes sociales, no de dirección; 4 sedes. Buscar un email de gerencia. |
| AN-07 | Dra. Karen Ochoa | clinica.drakarenochoa@gmail.com | Facebook / OK | **Revisar**: Gmail de una persona física (más RGPD), dirección de la clínica sin comprobar. |
| AN-08 | Vicente Sepúlveda Fisioterapia | vsfisioterapiaavanzada@gmail.com | Facebook / OK | **Revisar**: Gmail de persona física; confirmar «Moncada» o «Montcada» en el anuncio. |
| AN-10 | Trasplante Capilar MN | capilarmn@gmail.com | Facebook / OK | **Revisar**: Gmail; su web da 404 (el email lo cita: volver a comprobarlo el día del envío). |

## 4. Qué asunto y qué cuerpo va a cada destinatario

El registro completo (asunto, cuerpo, hechos con fuente, hipótesis y HTML) está en `borradores-10.json`.
Vista previa de cada email tal como sale: `preview-10.html`.

| ID | Para | Asunto | Argumento |
|---|---|---|---|
| AN-01 | direccion@clinicahortanord.es | Las consultas de injerto que llegan después de las 19:00 | formulario + alto valor + horario publicado |
| AN-02 | info@capilexmadrid.es | Vuestro implante a 2.749 € y el botón «Pedir presupuesto» | formulario + precio del propio anuncio |
| AN-03 | info@neocapilar.es | Del diagnóstico gratuito anunciado a la cita en C/ Alcalá | varios canales de entrada |
| AN-04 | rrss@clinicamcapilar.com | Vuestras campañas de diagnóstico médico gratuito | formularios + varias sedes |
| AN-05 | malaga@injertocapilarfrontela.com | Vuestros anuncios con botón de llamada en Málaga | **llamada → voz con IA** |
| AN-06 | info@cirugiacapilar.es | El «Obtener oferta» de vuestro paquete de otoño | oferta con fecha |
| AN-07 | clinica.drakarenochoa@gmail.com | Las consultas de tu anuncio de glúteos con hialurónico | consultas mientras está en consulta |
| AN-08 | vsfisioterapiaavanzada@gmail.com | Quien pide cita desde tu anuncio de dolor de hombro | reserva + página con huecos reales |
| AN-09 | info@doctoralfredovillanueva.com | Los mensajes de vuestro anuncio de línea de nacimiento | mensajes de Instagram (dicho que aún no) |
| AN-10 | capilarmn@gmail.com | Vuestro anuncio de consulta gratuita y la web, que da error | aviso de la web caída |

## 5. Para poder enviar (GO por separado)

1. Base legal documentada (abogado) para el email comercial B2B, o cambiar de vía: pedir permiso antes por
   teléfono (humano) o por el formulario de su web, y mandar el email solo a quien diga que sí.
2. Pie legal completo de Luvia (NIF, domicilio, aviso legal publicado) e información del RGPD art. 14.
3. Resolver los 5 «Revisar» de §3.
4. Volver a comprobar ese día que los anuncios siguen activos (las ofertas de Capilex y DrB solo están en el anuncio).
5. Solo entonces: crear los leads como `owner` Luvia + 10 `outreach_messages` en `draft`, con un script
   propio de este lote y su log (el de los 141 no se reutiliza).
