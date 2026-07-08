# /book — que la página de venta venda de verdad

**Fecha:** 2026-07-08
**Estado:** aprobado por Nico, en implementación.

## Problema

`/book/:leadId` es la página de venta (diseño editorial de Nico, portado de Lovable). Su
CTA principal ("Reservar mi web por 397€") abre un `mailto:` → en escritorio sin cliente de
correo **no hace nada**, y en móvil es fricción. Nadie puede reservar ni pagar. Además la
pasarela de Stripe (`create-checkout` + `stripe-webhook`) está construida pero **desconectada**,
y exige datos fiscales (NIF, dirección) por adelantado — inviable para un lead frío.

## Decisión

Modelo de cobro: **Tarjeta (Stripe) como acción primaria + WhatsApp como respaldo.**
El caliente paga en el momento; el frío habla primero. Los datos fiscales los recoge Stripe
en su propia pantalla (no la nuestra), a coste cero de fricción.

## Diseño (a nivel ventas)

Principio: un lead frío tiene dos frenos — **fricción** y **desconfianza**. El rediseño
ataca ambos en el momento exacto de decidir.

1. **Tarjeta de decisión** (reemplaza el formulario en `#contact`):
   - Primaria: `Pagar y reservar · 397€` → Stripe Checkout (con estado de carga; nunca "muerta").
   - Respaldo: `¿Prefieres hablar antes? Escríbeme por WhatsApp` → WhatsApp pre-escrito.
   - Micro-confianza pegada al botón: pago seguro · garantía 7 días · respuesta <1h.
   - Reversión de riesgo (garantía) inmediatamente bajo el botón = palanca #1 del pago frío.
2. **Barra de compra fija en móvil**: `397€ · Pagar y reservar` + icono WhatsApp, siempre a un
   toque durante el scroll (reemplaza la barra sticky que hoy es solo-WhatsApp).
3. **Sin callejones sin salida**: si Stripe falla → mensaje claro + fallback WhatsApp; al pulsar
   WhatsApp → se registra la intención (`booking_started`) + acuse "te espero en WhatsApp".

## Cambios backend (mínimos, defensivos)

- `create-checkout`: requerir solo `lead_id`. `contact`/`fiscal` opcionales. Activar en Stripe
  `billing_address_collection=required` + `tax_id_collection` para que recoja NIF/dirección.
  `bookings.name/email` son nullable → insert seguro sin formulario.
- `stripe-webhook`: leer dirección/NIF desde `session.customer_details` (fallback al metadata)
  para la factura borrador de Holded. Si no hay NIF, se salta la factura sin petar (ya lo hace).
- `track-event`: permitir el evento público `booking_started` (intención de WhatsApp).

## Fuera de alcance (YAGNI)

No se toca el resto de la página (comparativa 1.500€ vs 397€, "qué incluye", sección de Nico,
FAQ, garantía). Solo se arregla el momento de compra.

## Despliegue

Push a `main` → GitHub Actions despliega edge functions + Vercel despliega la web. El merge a
`main` activa cobros reales: hacerlo tras revisar el tono en preview y con una transacción de prueba.
