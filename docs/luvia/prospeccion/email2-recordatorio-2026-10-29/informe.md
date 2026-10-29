# [LUVIA] Email 2 (recordatorio): informe, 29-oct-2026

**Estado: BORRADOR. No se ha enviado ni programado nada, y no se ha escrito nada en la base de datos.**
Bloquea el envío lo mismo que en el email 1: falta documentar la base legal (LSSI art. 21, METODO-EDITORIAL §4).

## Ficheros
- `borradores.src.json`: 167 borradores (cuerpo, asunto «Re:», variante, hallazgo).
- `borradores-167.json`: lo mismo más el HTML renderizado con `renderEmail` (marca luvia).
- `preview-167.html`: vista de cada email tal como sale.
- `eligibles.sql`: de dónde sale la lista. `BRIEF.md`: las reglas de redacción. `qa.mjs`: junta, valida y renderiza.

## Números
- 179 clínicas recibieron el email 1 de Luvia (del 26-sep al 21-oct). Elegibles: **167**.
- Excluidas:
  - Respondieron: No Filters, Romina Castellano y Hermosilla. Noelia Duarte sí entra, porque su respuesta fue la automática de Booksy.
  - Rebote o baja: Lisbey Barreto, Capilaris, Macarena Torres y Clínica Gades.
  - Se llaman en vez de escribir: Parada Solano, Belice, Benaes y Fortuny.
  - Clindent: su email 1 era de [WEBS], de julio, con el mismo owner.
- Variantes del párrafo de solución:
  - B (web y «con WhatsApp todavía estamos en piloto»): 74.
  - A (solo web): 55.
  - C (web y asistente de voz para llamadas): 37.
  - Sin canal: 1 (La Bio Aesthetic, que tiene la web caída).
- El QA automático pasa en las 167: entre 110 y 140 palabras, 6 párrafos, una sola «?» (la de la CTA), 0 enlaces, 0 prohibidos, emails únicos y ningún canal atribuido a Luvia en la solución.

## Qué hay que revisar a mano antes de enviar
1. **Hallazgos que salían de reseñas en el email 1.** Se cambiaron por otro dato del mismo email, pero algunos aún huelen a reseña:
   - n 2, 3, 5, 6, 8, 18, 23, 26 y 40.
   - n 48, 52, 59, 68 y 71. El 68 (Doctora Marco) es el más débil.
   - n 87, 106, 116 y 123.
   - n 130, 141, 146, 147, 150, 151 y 158.
2. **Asuntos heredados que el método no permitiría en uno nuevo:**
   - Con «?»: n 83, 99 y 123.
   - Que nombran reseñas: n 59 y 68.
   - Con un dominio: n 41.

   Van en el mismo hilo, así que se dejaron tal cual. Decidir si se cambian.
3. **La Bio Aesthetic (n 41):** comprobar el día del envío si su web sigue caída.
4. **Variantes dudosas (el email 1 mezclaba canales):** n 6, 18, 25, 30, 39, 91, 95, 101, 110, 113, 118, 120, 133, 141, 149, 157 y 159.
5. **Datos que pueden caducar** (ofertas, horarios): volver a comprobarlos el día del envío (§4.5).
6. **Coherencia con el email 1:** el email 2 ya no promete WhatsApp ni teléfono «al momento». La frase «fui demasiado deprisa» es la que lo reconoce.

## Pendiente para poder enviar
Base legal documentada → crear los mensajes en `outreach_messages` (email_number = 2) → script de envío espaciado
en el mismo hilo (In-Reply-To del email 1), como `enviar-email1-capilar-lote4.mjs`.
