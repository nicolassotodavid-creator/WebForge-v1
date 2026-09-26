# Home Estimator — Madrid 6: 24 empresas del pool ya auditado

**Preparado:** 2026-09-26 · **Lanzamiento:** miércoles 30-sep-2026 (lo lanza Nico) · **Sin enviar.**

Madrid 5, 6 y 7 salen del mismo pool: las empresas de `events` (`type = 'home_estimator_audit'`, lotes `madrid-1` y `madrid-4`)
con clase A o B que siguen en `status = 'new'`, con email, sin ningún envío previo y sin `do_not_contact`. No hizo falta scrape ni auditoría nueva.
Se repartieron **en espiral por score (1,2,3,3,2,1…)** para que los tres lotes tengan la misma calidad (score medio 6.90 en este).

## Filtros aplicados (87 → 71 entre los tres lotes)

Salían 87 candidatas (M1: 2 A + 49 B; M4: 14 A + 22 B). Se descartaron 16: 5 por no encajar (Designio Interior: ya tiene botón «Calcular Reforma»;
GARMA Milenium: ventanas PVC; DR Carpintería: carpintero de mueble; CM Invest: pladur; Varada: ya estaba en la cola de Madrid 1), 9 porque su negocio no es reforma residencial
(Sialser: limpieza industrial; Cuevas Grima: obra pública; A. Moreno y OGR: comunidades y fachadas; STROTEC: trabajos verticales; Cocinas Tavira y DAVANNI: showroom de cocinas;
LK Interiorismo y Mi Decoradora: interiorismo), 1 email de agencia de marketing (Reformas Quality Hurtado: marcavyseo@gmail.com) y 1 buzón inexistente (Reformas Monbas, SMTP 550).
Sin duplicados de dominio ni de email. Salen 71 en vez de 87, así que los lotes son de 23 / 24 / 24 y no de 29.

## Buzones (SMTP RCPT desde este Mac, 26-sep)

15 confirmados · 1 en dominio que acepta todo (Reformas en Collado Villalba) · 8 sin verificar (IONOS/1und1, Hotmail/Outlook, Yahoo o servidor que no responde): Madrileña de Pinturas y Reformas, Zeta 2 Reformas, Construcciones Integrales Tres Cantos, Decoreforma3c, Reformas Factory, Studio77, Rubic Constructora, Grupo Procelco.

## Marcas

16 logos sacados de su web con Playwright (`extraer-logos-reformas.mjs`, revisados a ojo con lámina de contactos) y 8 con wordmark en tinta: Ofara, Reformas en Collado Villalba, Reformas y Rehabilitaciones Andrés Corral, Multiservicios Morosan, Rubic Constructora, EcoReforma360, Mihovi, MB Reformas.
Color = tono dominante del logo oscurecido hasta contraste 4,5 con texto blanco (nunca del CSS). Cerodisa y Olcasa se ajustaron a mano (el automático los leía como monocromos o cogía el color de su empresa hermana).
24 filas en `organizations` de reform-wizard → `https://presupuestos.nico-soto.es/demo/<slug>`.

## Copy

El de dolor aprobado (`copy-dolor-madrid.mjs madrid6`): asunto A «¿Pagas por leads que reciben 4?» (12) y B «Presupuestos que no te contestan» (12), alternando por score dentro del lote. E2 y E3 van como «Re:». El copy no lleva citas entrecomilladas de la web de la empresa, solo su nombre y sus servicios (`madrid-servicios.json`); precio y garantía no aparecen en E1-E3.
Numeración de la cola `n` 189-212 (Madrid 4 acabó en 165); `email_number` 101/102/103 como siempre.

## Las 24

| # | Score | Empresa | Municipio | Reseñas | Origen/clase | Asunto |
|---|---|---|---|---|---|---|
| 189 | 8.5 | [Madrileña de Pinturas y Reformas](https://mdepinturasyreformas.com/) | Pozuelo de Alarcón | 50 | M4/A | A (¿Pagas por leads que reciben 4?) |
| 190 | 8.5 | [Zeta 2 Reformas](https://zeta2reformas.com/) | Algete | 28 | M4/A | B (Presupuestos que no te contestan) |
| 191 | 8.5 | [Construcciones Integrales Tres Cantos](https://www.construccionestrescantos.com/) | Madrid | 19 | M4/A | A (¿Pagas por leads que reciben 4?) |
| 192 | 8.5 | [Decoreforma3c](https://www.decoreforma3c.es/) | Tres Cantos | 15 | M4/A | B (Presupuestos que no te contestan) |
| 193 | 7.5 | [Vivienda Sana](http://www.viviendasana.es/) | San Sebastián de los Reyes | 58 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 194 | 7 | [Escarpa Reparaciones](https://escarpareparaciones.es/) | Arganda del Rey | 260 | M1/B | B (Presupuestos que no te contestan) |
| 195 | 7 | [Reformas Factory](https://reformasfactory.es/) | Parla | 84 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 196 | 7 | [Studio77](http://www.studio77.es/) | Alcalá de Henares | 47 | M1/B | B (Presupuestos que no te contestan) |
| 197 | 7 | [Decoraciones Valdavia](https://decoracionesvaldavia.es/) | San Sebastián de los Reyes | 31 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 198 | 7 | [Ofara](http://www.ofara.es/) | Leganés | 19 | M1/B | B (Presupuestos que no te contestan) |
| 199 | 6.5 | [Duchanova](https://www.duchanova.es/) | Rivas-Vaciamadrid | 353 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 200 | 6.5 | [Reformas en Collado Villalba](http://www.reformasencolladovillalba.net/) | Collado Villalba | 63 | M4/B | B (Presupuestos que no te contestan) |
| 201 | 6.5 | [Reformas y Rehabilitaciones Andrés Corral](https://reformasyrehabilitacionesmadrid.es/) | Colmenar Viejo | 45 | M4/B | A (¿Pagas por leads que reciben 4?) |
| 202 | 6.5 | [Multiservicios Morosan](https://multiserviciosmorosan.com/) | Arganda del Rey | 33 | M1/B | B (Presupuestos que no te contestan) |
| 203 | 6.5 | [Reformas Go](https://www.reformasgo.es/) | Torrejón de Ardoz | 27 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 204 | 6.5 | [TCE Reformas](https://tcereformas.com/?utm_source=gmb&utm_medium=organic&utm_campaign=google-my-business) | Pinto | 23 | M1/B | B (Presupuestos que no te contestan) |
| 205 | 6.5 | [Alicia Mesa](https://aliciamesa.es/?utm_source=google&utm_medium=organic&utm_campaign=gmb-web) | Alcobendas | 23 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 206 | 6.5 | [Producasa](http://producasa.es/) | Pozuelo de Alarcón | 22 | M4/B | B (Presupuestos que no te contestan) |
| 207 | 6.5 | [Refor Obras y Reformas](http://www.reforobrasyreformas.com/) | Alcorcón | 18 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 208 | 6.5 | [Rubic Constructora](https://rubicconstructora.es/) | Villaviciosa de Odón | 14 | M4/B | B (Presupuestos que no te contestan) |
| 209 | 6.5 | [EcoReforma360](https://www.ecoreforma360.com/) | Arganda del Rey | 11 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 210 | 6 | [Mihovi](https://mihovi.com/) | Galapagar | 16 | M4/B | B (Presupuestos que no te contestan) |
| 211 | 6 | [MB Reformas](https://www.mbreformas.es/) | San Sebastián de los Reyes | 11 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 212 | 5.5 | [Grupo Procelco](https://gestcelco.com/) | Boadilla del Monte | 30 | M4/B | B (Presupuestos que no te contestan) |

## Cómo se lanza

```
node docs/prospeccion/verificar-lote-madrid2.mjs --lote madrid6            # solo lectura, no envía
node docs/prospeccion/enviar-email-lote.mjs --lote madrid6 --enviar        # email 1 (miércoles 30-sep-2026)
node docs/prospeccion/enviar-email-lote.mjs --lote madrid6 --seguimiento --enviar   # email 2, sin fecha
node docs/prospeccion/enviar-email-lote.mjs --lote madrid6 --email3 --enviar        # email 3, sin fecha
```

Calendario: Madrid 5 martes 29-sep · Madrid 6 miércoles 30-sep · Madrid 7 jueves 1-oct.

## Dónde están los datos

- Pool: `madrid6-pool.json` · marca: `madrid6-marca.json` · copy: `outreach_reformas_madrid6.csv` · cola con enlaces: `home-estimator-outreach-madrid6.csv`.
- Logos: `app/public/demo/logos/` (servidos desde `www.nico-soto.es/demo/logos/`).
- Selección completa (los 3 lotes, antes del reparto): `seleccion-madrid567.json`; reparto: `preparar-lotes-madrid567.mjs`.

## A/B de canal (26-sep): formulario vs email

La mitad del lote va por el **formulario de su web** (lo envía Cowork) y la otra mitad por email. Mismo asunto y mismo texto; solo cambia el canal.
Reparto: `repartir-canal-madrid567.mjs`, por parejas de score y al azar con semilla fija. Las de formulario tienen `enviar=FALSE` en `outreach_reformas_madrid6.csv`, así que `enviar-email-lote.mjs` las salta.
Lista y encargo para Cowork: `cowork-formularios/` (`ENCARGO.md`, `formularios-madrid567.csv`, `resultados.csv`). Las que tengan CAPTCHA las envía Nico a mano.
Se compara por sesiones en la demo (tabla `leads` de reform-wizard, por slug).
