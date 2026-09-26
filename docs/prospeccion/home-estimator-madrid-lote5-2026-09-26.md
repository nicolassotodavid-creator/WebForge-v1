# Home Estimator — Madrid 5: 23 empresas del pool ya auditado

**Preparado:** 2026-09-26 · **Lanzamiento:** martes 29-sep-2026 (lo lanza Nico) · **Sin enviar.**

Madrid 5, 6 y 7 salen del mismo pool: las empresas de `events` (`type = 'home_estimator_audit'`, lotes `madrid-1` y `madrid-4`)
con clase A o B que siguen en `status = 'new'`, con email, sin ningún envío previo y sin `do_not_contact`. No hizo falta scrape ni auditoría nueva.
Se repartieron **en espiral por score (1,2,3,3,2,1…)** para que los tres lotes tengan la misma calidad (score medio 6.93 en este).

## Filtros aplicados (87 → 71 entre los tres lotes)

Salían 87 candidatas (M1: 2 A + 49 B; M4: 14 A + 22 B). Se descartaron 16: 5 por no encajar (Designio Interior: ya tiene botón «Calcular Reforma»;
GARMA Milenium: ventanas PVC; DR Carpintería: carpintero de mueble; CM Invest: pladur; Varada: ya estaba en la cola de Madrid 1), 9 porque su negocio no es reforma residencial
(Sialser: limpieza industrial; Cuevas Grima: obra pública; A. Moreno y OGR: comunidades y fachadas; STROTEC: trabajos verticales; Cocinas Tavira y DAVANNI: showroom de cocinas;
LK Interiorismo y Mi Decoradora: interiorismo), 1 email de agencia de marketing (Reformas Quality Hurtado: marcavyseo@gmail.com) y 1 buzón inexistente (Reformas Monbas, SMTP 550).
Sin duplicados de dominio ni de email. Salen 71 en vez de 87, así que los lotes son de 23 / 24 / 24 y no de 29.

## Buzones (SMTP RCPT desde este Mac, 26-sep)

13 confirmados · 2 en dominio que acepta todo (Reformas DG, Rez-Estudio) · 8 sin verificar (IONOS/1und1, Hotmail/Outlook, Yahoo o servidor que no responde): AJ Reformas, Brico&Más, Cerodisa, Armahome, Olcasa Obras y Construcciones, Cecilia Caro, BAUS21, EDCM Proyectos y Obras.

## Marcas

13 logos sacados de su web con Playwright (`extraer-logos-reformas.mjs`, revisados a ojo con lámina de contactos) y 10 con wordmark en tinta: AJ Reformas, Brico&Más, Armahome, Reformas Mavisan, Transformaya, WannaHome, Rez-Estudio, Crisreformas, Némesis Reformas, Construcción, Decoración y Rehabilitación.
Color = tono dominante del logo oscurecido hasta contraste 4,5 con texto blanco (nunca del CSS). Cerodisa y Olcasa se ajustaron a mano (el automático los leía como monocromos o cogía el color de su empresa hermana).
23 filas en `organizations` de reform-wizard → `https://presupuestos.nico-soto.es/demo/<slug>`.

## Copy

El de dolor aprobado (`copy-dolor-madrid.mjs madrid5`): asunto A «¿Pagas por leads que reciben 4?» (12) y B «Presupuestos que no te contestan» (11), alternando por score dentro del lote. E2 y E3 van como «Re:». El copy no lleva citas entrecomilladas de la web de la empresa, solo su nombre y sus servicios (`madrid-servicios.json`); precio y garantía no aparecen en E1-E3.
Numeración de la cola `n` 166-188 (Madrid 4 acabó en 165); `email_number` 101/102/103 como siempre.

## Las 23

| # | Score | Empresa | Municipio | Reseñas | Origen/clase | Asunto |
|---|---|---|---|---|---|---|
| 166 | 8.5 | [AJ Reformas](https://www.ajreformas.net/) | Galapagar | 56 | M4/A | A (¿Pagas por leads que reciben 4?) |
| 167 | 8.5 | [Brico&Más](http://www.bricomas.net/) | Tres Cantos | 24 | M4/A | B (Presupuestos que no te contestan) |
| 168 | 8.5 | [Cerodisa](http://www.reformascerodisa.com/contacto.aspx?ID=5798) | Pozuelo de Alarcón | 20 | M4/A | A (¿Pagas por leads que reciben 4?) |
| 169 | 8 | [Armahome](https://armahomeproyectosyobras.com/) | Las Rozas de Madrid | 22 | M4/A | B (Presupuestos que no te contestan) |
| 170 | 7.5 | [Olcasa Obras y Construcciones](https://www.olcasa.com/) | San Sebastián de los Reyes | 64 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 171 | 7 | [Reformar Renovación](https://reformarrenovacion.es/) | Fuenlabrada | 100 | M1/B | B (Presupuestos que no te contestan) |
| 172 | 7 | [Reformas Mavisan](https://mavisan.com/) | Arganda del Rey | 87 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 173 | 7 | [Transformaya](https://transformaya.com/) | Arganda del Rey | 42 | M1/B | B (Presupuestos que no te contestan) |
| 174 | 7 | [Budia Obras](http://www.budiaobras.es/) | Coslada | 37 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 175 | 7 | [ASC Construcciones y Reformas](https://construccionesasc.com/) | Torrejón de Ardoz | 13 | M1/B | B (Presupuestos que no te contestan) |
| 176 | 6.5 | [WannaHome](https://www.wannahome.es/) | Pozuelo de Alarcón | 396 | M4/B | A (¿Pagas por leads que reciben 4?) |
| 177 | 6.5 | [Reformas DG](http://reformasdg.es/) | Colmenar Viejo | 58 | M4/B | B (Presupuestos que no te contestan) |
| 178 | 6.5 | [Rez-Estudio](http://www.rez-estudio.com/) | Las Rozas de Madrid | 57 | M4/B | A (¿Pagas por leads que reciben 4?) |
| 179 | 6.5 | [Cecilia Caro](https://ceciliacaro.com/) | Alcobendas | 30 | M1/B | B (Presupuestos que no te contestan) |
| 180 | 6.5 | [Reformas Integrales Alejandro](http://www.reformasintegralesalejandro.es/) | Alcorcón | 27 | M1/A | A (¿Pagas por leads que reciben 4?) |
| 181 | 6.5 | [Crisreformas](http://www.crisreformas.com/) | Alcorcón | 23 | M1/B | B (Presupuestos que no te contestan) |
| 182 | 6.5 | [NoMasBanera](http://www.nomasbanera.com/) | Alcalá de Henares | 23 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 183 | 6.5 | [Némesis Reformas](https://www.nemesisleganes.com/) | Leganés | 19 | M1/B | B (Presupuestos que no te contestan) |
| 184 | 6.5 | [Grupo Edma](https://www.grupoedma.info/) | Arganda del Rey | 19 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 185 | 6.5 | [BAUS21](http://www.baus21.com/) | Fuenlabrada | 12 | M1/B | B (Presupuestos que no te contestan) |
| 186 | 6.5 | [Construcción, Decoración y Rehabilitación](http://www.estudioarq.com/) | Alcalá de Henares | 11 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 187 | 6 | [EDCM Proyectos y Obras](http://edcmpyo.com/) | Colmenar Viejo | 13 | M4/B | B (Presupuestos que no te contestan) |
| 188 | 6 | [Amira Construcciones](https://www.amiraconstrucciones.com/) | Madrid | 11 | M1/B | A (¿Pagas por leads que reciben 4?) |

## Cómo se lanza

```
node docs/prospeccion/verificar-lote-madrid2.mjs --lote madrid5            # solo lectura, no envía
node docs/prospeccion/enviar-email-lote.mjs --lote madrid5 --enviar        # email 1 (martes 29-sep-2026)
node docs/prospeccion/enviar-email-lote.mjs --lote madrid5 --seguimiento --enviar   # email 2, sin fecha
node docs/prospeccion/enviar-email-lote.mjs --lote madrid5 --email3 --enviar        # email 3, sin fecha
```

Calendario: Madrid 5 martes 29-sep · Madrid 6 miércoles 30-sep · Madrid 7 jueves 1-oct.

## Dónde están los datos

- Pool: `madrid5-pool.json` · marca: `madrid5-marca.json` · copy: `outreach_reformas_madrid5.csv` · cola con enlaces: `home-estimator-outreach-madrid5.csv`.
- Logos: `app/public/demo/logos/` (servidos desde `www.nico-soto.es/demo/logos/`).
- Selección completa (los 3 lotes, antes del reparto): `seleccion-madrid567.json`; reparto: `preparar-lotes-madrid567.mjs`.

## A/B de canal (26-sep): formulario vs email

La mitad del lote va por el **formulario de su web** (lo envía Cowork) y la otra mitad por email. Mismo asunto y mismo texto; solo cambia el canal.
Reparto: `repartir-canal-madrid567.mjs`, por parejas de score y al azar con semilla fija. Las de formulario tienen `enviar=FALSE` en `outreach_reformas_madrid5.csv`, así que `enviar-email-lote.mjs` las salta.
Lista y encargo para Cowork: `cowork-formularios/` (`ENCARGO.md`, `formularios-madrid567.csv`, `resultados.csv`). Las que tengan CAPTCHA las envía Nico a mano.
Se compara por sesiones en la demo (tabla `leads` de reform-wizard, por slug).
