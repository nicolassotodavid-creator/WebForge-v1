# Home Estimator — Madrid 2: 40 empresas del pool ya auditado

**Fecha:** 2026-09-17 · **Por qué:** la tanda del 16-17 sep (65 emails) salió con un test de asunto
que no se puede leer —"Gancho" eran 25 asuntos distintos, uno por empresa, contra dos asuntos fijos—,
así que no dice si compensa personalizar. Este lote existe para contestar esa pregunta con n suficiente
y para seguir afinando quién es el cliente que sí entra en la demo.

**Coste:** cero de scrape y cero de auditoría. Estas 40 ya estaban auditadas desde el 13-sep.

## De dónde salen

De la misma auditoría que Madrid 1 (`events`, `type = 'home_estimator_audit'`,
`payload->>'lote' = 'madrid-1'`): 194 empresas auditadas, de las que solo se contactaron 15. De las
**77 de clase A**, 65 tienen email y 11 ya recibieron email → quedaban **54 sin tocar**. Se cogen las
**40 con Home Estimator Score ≥ 7**; las 12 restantes quedan de reserva.

Tres de ellas (Construcciones J.D.M., Quality Reform y Reformas Vegam) estaban elegidas en Madrid 1 pero
se quedaron fuera por no tener email en la cola. El email sí estaba en su ficha de auditoría, y su demo
ya existía: se reutiliza tal cual.

## El A/B de asunto

Esta vez sí es legible: **el cuerpo del email es el mismo en las dos variantes** y solo cambia el asunto.
Se reparten alternando por score, para que las dos lleven fichas igual de buenas (en la tanda anterior
los asuntos personalizados se llevaron las mejores fichas y eso contaminaba la comparación).

- **A (20) — asunto fijo:** `he probado tu formulario`. Es el que mejor fue el 16-17 sep (cluster
  Curiosidad: 3 de 19 entraron en su demo, frente a 2 de 21 y 1 de 25).
- **B (20) — asunto a medida:** escrito con un dato que solo vale para esa empresa (su promesa literal,
  su ciudad, lo que anuncian). Los 20 son distintos entre sí.

La pregunta que contesta: **¿compensa el trabajo de personalizar el asunto?** Si B no gana a A, en las
siguientes tandas se manda el fijo y se ahorra ese paso.

## Cómo se escribió el copy

`generar-copy-madrid2.mjs` (Sonnet). El modelo solo escribe el párrafo con la cita de su web y el asunto B;
el resto de la plantilla es fija y es la misma que la de València y Madrid 1. **Toda cita entrecomillada se
comprueba contra el texto que la auditoría leyó de su web**: si el modelo se la inventa, la fila sale marcada
como `enviar=FALSE` y no se manda. Saltó una (Reformas Valentín, "solicite un presupuesto gratuito y sin
compromiso"): se abrió su `/CONTACTO/` y la frase estaba, pero conjugada de otra forma
("solicitarnos"), así que se corrigió a la literal en vez de descartarla.

## Las marcas de las demos

32 logos bajados de su propia web, 3 reutilizados del lote anterior y **5 sin logo utilizable**
(Waris, Reformas Torrejón, Caldisban, Reformas Pío y Juan Salcedo: lo que publican es una foto de obra o un
recorte de banner) → wordmark en tinta, que es lo que ya se hacía en València.

Los colores salen **del logo, nunca del CSS**. El automático se equivocó en varios y se revisaron a ojo uno
a uno con una lámina de contactos: leía como monocromos los logos multicolor (Gesamarcos, Cocinas Plaza,
Jukave, Integral DGM, MLC) y en tres webs se había tragado **el icono de Google del sello de reseñas** como
si fuera la marca de la empresa.

## Las 40

| # | Score | Empresa | Municipio | Reseñas | Variante | Asunto |
|---|---|---|---|---|---|---|
| 76 | 9 | [Construcciones J.D.M.](https://construccionesjdm.com/) | Alcobendas | 122 | A (fijo) | he probado tu formulario |
| 77 | 8.5 | [Quality Reform](http://qualityreform.com/) | Fuenlabrada | 136 | B (a medida) | presupuesto con solo el código postal |
| 78 | 8.5 | [IRC Service](https://reformasentorrejon.com/) | Torrejón de Ardoz | 106 | A (fijo) | he probado tu formulario |
| 79 | 8.5 | [Sigueplac SGP Home](https://sigueplac.com/) | Alcorcón | 81 | B (a medida) | "completamente personalizado" con un campo de texto |
| 80 | 8.5 | [Reformas Vegam](https://www.reformasvegam.es/) | Alcobendas | 67 | A (fijo) | he probado tu formulario |
| 81 | 8.5 | [Refordomus Obras y Servicios](https://refordomus.es/) | Móstoles | 64 | B (a medida) | "presupuesto online" sin saber el piso |
| 82 | 8.5 | [Rehabiliti](https://rehabiliti.com/) | San Sebastián de los Reyes | 61 | A (fijo) | he probado tu formulario |
| 83 | 8.5 | [ReformaX](https://reformax.es/) | San Sebastián de los Reyes | 55 | B (a medida) | vuestro 'sin compromiso' cuesta llamadas |
| 84 | 8.5 | [Spacioh](https://spacioh.com/) | Fuenlabrada | 42 | A (fijo) | he probado tu formulario |
| 85 | 8.5 | [Reformas Europa](https://www.reformaseuropa.es/) | Torrejón de Ardoz | 42 | B (a medida) | el mejor precio sin saber los m² |
| 86 | 8 | [Reformas Integrales DecoJust](https://decojust.es/) | Móstoles | 72 | A (fijo) | he probado tu formulario |
| 87 | 8 | [Juropa Reformas](https://www.juropareformas.es/) | Fuenlabrada | 61 | B (a medida) | elegir materiales sin saber los m² |
| 88 | 8 | [Fusión Reformas](https://fusionreformas.com/) | Móstoles | 47 | A (fijo) | he probado tu formulario |
| 89 | 8 | [Gesamarcos](https://www.gesamarcos.es/) | Rivas-Vaciamadrid | 46 | B (a medida) | ese 'presupuesto orientativo' sin saber los m² |
| 90 | 8 | [AreaReforma](https://areareforma.com/) | Leganés | 44 | A (fijo) | he probado tu formulario |
| 91 | 8 | [Reformas Sucon](https://reformassucon.com/) | Parla | 42 | B (a medida) | visita a parla sin saber los m² |
| 92 | 8 | [Midan Home](https://reformasmidanhome.com/) | Getafe | 41 | A (fijo) | he probado tu formulario |
| 93 | 8 | [HomeTailor](https://hometailor.es/) | San Sebastián de los Reyes | 39 | B (a medida) | vuestra propuesta detallada sin los m² |
| 94 | 8 | [Integral DGM](https://reformainterior.es/) | Móstoles | 34 | A (fijo) | he probado tu formulario |
| 95 | 8 | [Waris Reformas](https://warisreformas.com/) | Rivas-Vaciamadrid | 32 | B (a medida) | presupuesto gratis sin saber los m² |
| 96 | 8 | [Construpolis](https://construpolis.net/) | Alcalá de Henares | 28 | A (fijo) | he probado tu formulario |
| 97 | 8 | [Narvoa Construcciones](https://narvoa.com/) | Alcobendas | 27 | B (a medida) | ¿plazos garantizados sin saber los metros? |
| 98 | 7.5 | [Reformas Torrejón de Ardoz](https://reformastorrejondeardoz.com/) | Torrejón de Ardoz | 59 | A (fijo) | he probado tu formulario |
| 99 | 7.5 | [Jukave Construcciones y Reformas](https://cys-construccionesyreformasjukave.com/) | Coslada | 56 | B (a medida) | "presupuesto sin compromiso" sin saber qué reforma |
| 100 | 7.5 | [Cocinas y Reformas Plaza](https://cocinasyreformasplaza.com/) | Rivas-Vaciamadrid | 49 | A (fijo) | he probado tu formulario |
| 101 | 7.5 | [Caldisban](http://www.caldisban.com/) | Alcobendas | 42 | B (a medida) | 'solicite presupuesto' y un teléfono |
| 102 | 7.5 | [Pro Reforma](https://www.proreforma.es/) | Rivas-Vaciamadrid | 41 | A (fijo) | he probado tu formulario |
| 103 | 7.5 | [Grupo García Romero e Hijos](https://www.reformasgarciaromero.es/) | Rivas-Vaciamadrid | 39 | B (a medida) | reforma integral en rivas sin metros |
| 104 | 7.5 | [180 Grados Obras y Proyectos](https://180grados.es/) | Alcobendas | 36 | A (fijo) | he probado tu formulario |
| 105 | 7.5 | [A-Reformas](http://www.areformas.es/) | Alcobendas | 31 | B (a medida) | presupuestos sin compromiso… ¿y sin preguntas? |
| 106 | 7.5 | [CLC Reformas](https://clcreformas.com/) | Arganda del Rey | 30 | A (fijo) | he probado tu formulario |
| 107 | 7.5 | [Reformas Valentín](https://www.reformasvalentin.es/) | Coslada | 27 | B (a medida) | ese presupuesto gratuito en coslada |
| 108 | 7.5 | [Reformas Integrales Pío](https://www.reformasintegralespio.es/) | Mejorada del Campo | 25 | A (fijo) | he probado tu formulario |
| 109 | 7.5 | [Reformas Vélez](https://reformasvelez.es/) | Fuenlabrada | 24 | B (a medida) | presupuesto a medida sin saber los m² |
| 110 | 7.5 | [Auge Reformas Madrid](https://augereformasmadrid.com/) | Getafe | 23 | A (fijo) | he probado tu formulario |
| 111 | 7.5 | [Reformas Juan Salcedo](https://reformasjuansalcedo.com/) | Alcalá de Henares | 19 | B (a medida) | ese campo de mensaje libre en alcalá |
| 112 | 7.5 | [Hegasa Construcciones y Reformas](https://reformasintegralesmadridhegasa.com/) | Fuenlabrada | 12 | A (fijo) | he probado tu formulario |
| 113 | 7.5 | [MHD Reformas Integrales](https://mhdreformasintegrales.com/) | Valdemoro | 11 | B (a medida) | presupuesto personalizado sin saber los metros |
| 114 | 7 | [Decoración y Reformas Daniel](https://reformasdaniel.net/) | Leganés | 30 | A (fijo) | he probado tu formulario |
| 115 | 7 | [MLC Trabajos Integrales](https://mlctrabajosintegrales.com/) | Móstoles | 29 | B (a medida) | sin compromiso... pero sin saber qué reformáis |

## Cómo se lanza

```
node docs/prospeccion/verificar-lote-madrid2.mjs          # comprueba los CSV, no envía
node docs/prospeccion/enviar-email-lote.mjs --lote madrid2            # simulación
node docs/prospeccion/enviar-email-lote.mjs --lote madrid2 --enviar   # email 1
```

El envío lo lanza Nico: el clasificador no deja que Claude ejecute ese script.

## Dónde están los datos

- Pool y marca: `madrid2-pool.json` (auditoría) y `madrid2-marca.json` (logo y colores por empresa).
- Copy: `outreach_reformas_madrid2.csv` · Cola con los enlaces: `home-estimator-outreach-madrid2.csv`.
- Demos: filas en `organizations` del proyecto Lovable `reform-wizard`, en
  `https://presupuestos.nico-soto.es/demo/<slug>` (las 40 comprobadas, HTTP 200).
- Logos: `app/public/demo/logos/`, servidos desde `www.nico-soto.es` (los 33 comprobados, HTTP 200).

## Antes de enviar, dos cosas

1. **Las aperturas siguen sin medirse.** La `RESEND_API_KEY` es de solo envío. Si se lanza esta tanda sin
   el webhook de eventos de Resend, el A/B solo se podrá leer por quién entra en la demo (que es la señal
   buena, pero llega muy poca: 6 de 63 en la tanda anterior). Lo está montando Cowork.
2. **El seguimiento de la tanda anterior va antes.** 65 personas recibieron el email 1 el 16-17 sep y su
   seguimiento está escrito y sin enviar. Sale más barato que una tanda nueva.
