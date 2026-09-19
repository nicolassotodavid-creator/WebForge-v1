# Home Estimator — Madrid 3: 20 empresas más del pool ya auditado

**Fecha:** 2026-09-19 · **Coste:** cero de scrape y cero de auditoría. Salen de la misma auditoría del
13-sep (`events`, `type = 'home_estimator_audit'`, `payload->>'lote' = 'madrid-1'`, sur y este de Madrid).

## De dónde salen

Cruzada la auditoría con todo lo ya enviado o preparado (lotes 1-4, Madrid 1 y Madrid 2), quedaban
**25 de clase A sin tocar**, casi todas sin email en la ficha. Se les sacó el email de su propia web
(home, /contacto, aviso legal) y 15 lo tienen. Las 5 que faltan para 20 son de clase B, elegidas porque
su formulario es genérico (el discurso encaja igual que con una A); se descartaron las B cuyo formulario
ya pregunta m² o tipo de reforma (Arko, Vivienda Sana, Doviflor, DeReformas, Olcasa).

Siguen sin email, y por tanto fuera: Reformas Integrales Arias (9), Crisan (8,5), Reformas Gabriel (8,5),
Manitas Euro Reforma, Reforfast, Sancrist, El Valajo y Reformas TBM. Si se quiere llegar a ellas es por
formulario de contacto.

## El A/B de asunto

El mismo que Madrid 2, para sumar muestra: cuerpo idéntico, A = `he probado tu formulario` (10),
B = asunto a medida (10, todos distintos). Zasert y DCI no tienen formulario (solo WhatsApp), así que no
pueden llevar el asunto A: se cambiaron con Reform You y Excot.

## Correcciones a mano sobre lo que escribió Sonnet

- Cabacor: el modelo metió una cifra inventada ("una cocina de 2.000 €") → quitada.
- Novaintéria y Akiando: dos frases cojas.
- Tres asuntos B repetidos → reescritos.

Todas las citas entrecomilladas pasan la comprobación contra el texto de la auditoría.

## Marcas

15 logos de su web (el de Protrux estaba en `data-src` con carga diferida; el de Akiando es su sello
cuadrado). Cabacor (solo publica un icono de casa en blanco), Excot y DCI → wordmark en tinta. Colores
sacados del logo y revisados con lámina de contactos; cuando el color del logo no aguanta texto blanco
(Villarreal naranja, Ramms dorado, Duchaestilo cian) `primary` es ese tono oscurecido y el literal va en
`secondary`.

## Las 20

| # | Score | Empresa | Municipio | Reseñas | Clase | Variante | Asunto |
|---|---|---|---|---|---|---|---|
| 116 | 8 | [Villarreal Decor](https://www.decormadrid.es/) | Fuenlabrada | 44 | A | A | he probado tu formulario |
| 117 | 8 | [Reformas TVM](http://reformastvm.es/) | Parla | 44 | A | B | contactos sin datos de obra |
| 118 | 8 | [Protrux Reformas](https://www.protrux.es/) | Alcobendas | 32 | A | A | he probado tu formulario |
| 119 | 7 | [Ramms Reform](https://www.rammsreform.es/) | Valdemoro | 20 | A | B | formulario de presupuesto sin datos de obra |
| 120 | 7 | [Akiando Reforma](https://www.akiandoreforma.com/) | Alcorcón | 19 | A | A | he probado tu formulario |
| 121 | 7 | [J&M Construcción](http://www.jmconstruccion.es/) | Rivas-Vaciamadrid | 19 | A | B | formulario que no filtra nada |
| 122 | 7 | [Reformas Cabacor](http://www.reformascabacor.es/) | Móstoles | 25 | A | A | he probado tu formulario |
| 123 | 7 | [Reformas Galo](https://reformasgalo.es/) | Parla | 24 | A | B | formulario sin datos de la obra |
| 124 | 7 | [Zasert](http://www.zasert.es/) | Alcorcón | 28 | A | B | presupuesto detallado por whatsapp |
| 125 | 7 | [Reform You](https://reformyou.es/) | Rivas-Vaciamadrid | 13 | A | A | he probado tu formulario |
| 126 | 7 | [Asimetría Reformas](https://asimetria.es/) | Torrejón de Ardoz | 24 | A | A | he probado tu formulario |
| 127 | 7 | [Reformas Atlanta](https://reformaspisosmadrid.es/) | Getafe | 27 | A | B | formulario de contacto y presupuestos |
| 128 | 7 | [Reformas Verli](https://cys-reformasverli.com/) | Mejorada del Campo | 22 | A | A | he probado tu formulario |
| 129 | 7 | [Reformas Marai](http://www.reformasmarai.com/) | Móstoles | 22 | A | B | un formulario que no pide los metros |
| 130 | 7 | [Prialum Reformas](https://reformasprialum.es/) | Torrejón de Ardoz | 30 | A | A | he probado tu formulario |
| 131 | 7.5 | [Duchaestilo](https://duchaestilo.com/) | Alcorcón | 212 | B | B | el tasador no tasa nada |
| 132 | 7.5 | [Novaintéria](http://www.novainteria.es/) | San Fernando de Henares | 211 | B | A | he probado tu formulario |
| 133 | 7.5 | [Reformas Excot](https://reformasexcot.com/) | Fuenlabrada | 121 | B | A | he probado tu formulario |
| 134 | 7.5 | [DCI Reformas Madrid](http://dcireformasmadrid.es/) | Madrid | 89 | B | B | un precio exacto sin saber los m² |
| 135 | 7.5 | [Arte en Baño](http://www.arteenbano.es/) | Coslada | 95 | B | B | solicita presupuesto… ¿de qué obra? |

## Cómo se lanza

```
node docs/prospeccion/verificar-lote-madrid2.mjs --lote madrid3 --ver 3   # comprueba, no envía
node docs/prospeccion/enviar-email-lote.mjs --lote madrid3                # simulación
node docs/prospeccion/enviar-email-lote.mjs --lote madrid3 --enviar       # email 1
```

Lo lanza Nico (el clasificador no deja a Claude ejecutar el envío).

## Dónde están los datos

- Pool: `madrid3-pool.json` · Marca: `madrid3-marca.json`
- Copy: `outreach_reformas_madrid3.csv` · Cola: `home-estimator-outreach-madrid3.csv`
- Generador: `generar-copy-madrid2.mjs --lote madrid3` (el mismo de Madrid 2, ahora parametrizado).
- Demos: filas en `organizations` del proyecto Lovable `reform-wizard` → `presupuestos.nico-soto.es/demo/<slug>`.
- Logos: `app/public/demo/logos/`, servidos desde `www.nico-soto.es`.
