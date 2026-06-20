# WhatsApp Business — perfil listo para pegar

> **Estado (2026-06-26):** botón de WhatsApp **YA activo** en `/book` con el número personal
> **+34 600 78 22 11** (`WHATSAPP_NUMBER` en `app/src/lib/business.ts`). De momento se usa el
> número personal directamente — la app **WhatsApp Business** y su perfil quedan aplazados.
> Cuando se monte WhatsApp Business, este doc es la guía; el número del botón no cambia.

Todo esto va en la app **WhatsApp Business** (Ajustes → Herramientas para empresas / Perfil de empresa).
No necesita el número todavía: tenlo listo y, cuando actives la SIM, lo pegas en 2 minutos.

> Tono: el mismo de la página `/book` — cercano, persona real, sin pinta de agencia. Sin emojis de más.

---

## 1) Perfil de empresa

- **Nombre para mostrar:** `Nico Soto`
- **Recado / Estado (about):** `Webs a medida para negocios locales · Valencia`
- **Categoría:** `Diseño web` (o "Servicios de internet" si no aparece)
- **Descripción** (máx. 256 car.):
  ```
  Soy Nico, diseñador web en Valencia. Construyo la web de tu negocio antes de presentarme: la ves, y si te gusta, me dices. Sin contratos ni permanencias. Pago único, garantía de 7 días.
  ```
- **Web:** `https://nico-soto.es`
- **Email:** `hola@nico-soto.es`
- **Dirección:** Valencia (pon ciudad/zona; no hace falta dirección exacta)
- **Horario de atención:** _ajústalo_ — sugerencia: L–V 9:00–19:00

---

## 2) Mensaje de bienvenida (automático)

Se envía solo la primera vez que alguien te escribe (o tras 14 días sin hablar).
Actívalo en: Herramientas para empresas → **Mensaje de bienvenida**.

```
¡Hola! Soy Nico. Gracias por escribir.
Si es por la web que te preparé, dime el nombre de tu negocio y te paso el enlace para verla.
Te contesto yo en persona en cuanto pueda.
```

---

## 3) Mensaje de ausencia (fuera de horario)

Herramientas para empresas → **Mensaje de ausencia**.

```
Ahora mismo no estoy disponible, pero he visto tu mensaje y te respondo yo personalmente en cuanto vuelva (normalmente el mismo día).
```

---

## 4) Respuestas rápidas (atajos con "/")

Herramientas para empresas → **Respuestas rápidas**. Escribes el atajo y se expande.

| Atajo | Texto |
|-------|-------|
| `/precio` | `Son 397 € pago único, IVA incluido. Entra el dominio, un mes de soporte y garantía de 7 días: si no te convence, te devuelvo el dinero entero.` |
| `/incluye` | `Web a medida con tus servicios, fotos y reseñas reales (nada de plantillas). Publicada bajo tu dominio en 24 h. Un mes de soporte: me escribes cambios y los hago el mismo día.` |
| `/como` | `Muy fácil: la web ya está hecha, la ves en el enlace. Si te gusta, reservas desde la página (pago seguro con Stripe) y en 24 h la dejo publicada bajo tu dominio.` |
| `/garantia` | `Garantía de 7 días: si no estás contento, te devuelvo el dinero completo, sin preguntas. El riesgo es mío, no tuyo.` |
| `/web` | `Aquí la tienes 👉 [pega aquí el enlace /book del negocio]` |

---

## 5) Cuando el número esté activo — checklist

1. Registrar WhatsApp Business con el número nuevo (SMS de verificación).
2. Pegar perfil + mensajes + respuestas rápidas de este doc.
3. ~~**Botón en `/book`:** poner el número en `app/src/lib/business.ts`.~~ ✅ **HECHO 2026-06-26**
   (`WHATSAPP_NUMBER = "34600782211"`). Llega a producción al hacer push a `main`.
4. **(Opcional, NO activado a propósito) Footer en el email:** se decidió dejar el email frío
   limpio (regla "NADA de WhatsApp en frío"). El WhatsApp solo vive en `/book`.
5. Activar **WhatsApp Web** para responder desde el ordenador.
