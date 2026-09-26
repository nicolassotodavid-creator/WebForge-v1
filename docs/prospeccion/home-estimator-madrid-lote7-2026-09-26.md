# Home Estimator — Madrid 7: 24 empresas del pool ya auditado

**Preparado:** 2026-09-26 · **Lanzamiento:** jueves 1-oct-2026 (lo lanza Nico) · **Sin enviar.**

Madrid 5, 6 y 7 salen del mismo pool: las empresas de `events` (`type = 'home_estimator_audit'`, lotes `madrid-1` y `madrid-4`)
con clase A o B que siguen en `status = 'new'`, con email, sin ningún envío previo y sin `do_not_contact`. No hizo falta scrape ni auditoría nueva.
Se repartieron **en espiral por score (1,2,3,3,2,1…)** para que los tres lotes tengan la misma calidad (score medio 6.88 en este).

## Filtros aplicados (87 → 71 entre los tres lotes)

Salían 87 candidatas (M1: 2 A + 49 B; M4: 14 A + 22 B). Se descartaron 16: 5 por no encajar (Designio Interior: ya tiene botón «Calcular Reforma»;
GARMA Milenium: ventanas PVC; DR Carpintería: carpintero de mueble; CM Invest: pladur; Varada: ya estaba en la cola de Madrid 1), 9 porque su negocio no es reforma residencial
(Sialser: limpieza industrial; Cuevas Grima: obra pública; A. Moreno y OGR: comunidades y fachadas; STROTEC: trabajos verticales; Cocinas Tavira y DAVANNI: showroom de cocinas;
LK Interiorismo y Mi Decoradora: interiorismo), 1 email de agencia de marketing (Reformas Quality Hurtado: marcavyseo@gmail.com) y 1 buzón inexistente (Reformas Monbas, SMTP 550).
Sin duplicados de dominio ni de email. Salen 71 en vez de 87, así que los lotes son de 23 / 24 / 24 y no de 29.

## Buzones (SMTP RCPT desde este Mac, 26-sep)

9 confirmados · 0 en dominio que acepta todo · 15 sin verificar (IONOS/1und1, Hotmail/Outlook, Yahoo o servidor que no responde): Easy Hogar, Fixhogar, Civissa, Escala Reformas, Reformas Doviflor, ATZ Reformas, Reformas Gualda, Reformas BG, Grupo Galaxy, Reforalya, DCC Proyectos e Interiorismo, Asesora Reformas, Honrados, OneReformas, Saneamientos Lozano Morales.

## Marcas

19 logos sacados de su web con Playwright (`extraer-logos-reformas.mjs`, revisados a ojo con lámina de contactos) y 5 con wordmark en tinta: Reformas Arko, Romat Reformas Integrales, JJ García Reformas, DCC Proyectos e Interiorismo, adosA2.
Color = tono dominante del logo oscurecido hasta contraste 4,5 con texto blanco (nunca del CSS). Cerodisa y Olcasa se ajustaron a mano (el automático los leía como monocromos o cogía el color de su empresa hermana).
24 filas en `organizations` de reform-wizard → `https://presupuestos.nico-soto.es/demo/<slug>`.

## Copy

El de dolor aprobado (`copy-dolor-madrid.mjs madrid7`): asunto A «¿Pagas por leads que reciben 4?» (12) y B «Presupuestos que no te contestan» (12), alternando por score dentro del lote. E2 y E3 van como «Re:». El copy no lleva citas entrecomilladas de la web de la empresa, solo su nombre y sus servicios (`madrid-servicios.json`); precio y garantía no aparecen en E1-E3.
Numeración de la cola `n` 213-236 (Madrid 4 acabó en 165); `email_number` 101/102/103 como siempre.

## Las 24

| # | Score | Empresa | Municipio | Reseñas | Origen/clase | Asunto |
|---|---|---|---|---|---|---|
| 213 | 8.5 | [Easy Hogar](https://www.easyhogar.es/) | Torrelodones | 41 | M4/A | A (¿Pagas por leads que reciben 4?) |
| 214 | 8.5 | [Fixhogar](https://www.fixhogar.com/) | Pozuelo de Alarcón | 28 | M4/A | B (Presupuestos que no te contestan) |
| 215 | 8.5 | [Civissa](https://www.civissa.es/) | Boadilla del Monte | 15 | M4/A | A (¿Pagas por leads que reciben 4?) |
| 216 | 8.5 | [Escala Reformas](http://www.reformasescala.com/) | Villaviciosa de Odón | 15 | M4/A | B (Presupuestos que no te contestan) |
| 217 | 7.5 | [Reformas Doviflor](http://www.reformasdoviflor.com/) | Alcorcón | 39 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 218 | 7.5 | [Reformas Arko](https://reformasarko.com/) | Coslada | 27 | M1/B | B (Presupuestos que no te contestan) |
| 219 | 7 | [ATZ Reformas](http://www.atzreformas.com/) | San Fernando de Henares | 79 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 220 | 7 | [Romat Reformas Integrales](http://www.romatreformasintegrales.es/) | Fuenlabrada | 52 | M1/B | B (Presupuestos que no te contestan) |
| 221 | 7 | [SGH Interiorismo](https://sghinteriorismo.es/) | Torrejón de Ardoz | 28 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 222 | 7 | [Reformas Gualda](https://www.reformasgualda.com/) | Alcalá de Henares | 25 | M1/B | B (Presupuestos que no te contestan) |
| 223 | 6.5 | [Reformas BG](https://reformasbgmadrid.es/) | Getafe | 148 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 224 | 6.5 | [JJ García Reformas](http://cocinasjjgarcia.es/) | Móstoles | 91 | M1/B | B (Presupuestos que no te contestan) |
| 225 | 6.5 | [Grupo Galaxy](http://www.grupogalaxy.es/) | Collado Villalba | 42 | M4/B | A (¿Pagas por leads que reciben 4?) |
| 226 | 6.5 | [Reforalya](https://www.reformasenmostoles.es/) | Móstoles | 35 | M1/B | B (Presupuestos que no te contestan) |
| 227 | 6.5 | [DCC Proyectos e Interiorismo](https://cerezocortijo.com/) | Alcobendas | 25 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 228 | 6.5 | [Neagoe Reformas](https://reformasintegralesboadilladelmonte.com/) | Boadilla del Monte | 24 | M1/B | B (Presupuestos que no te contestan) |
| 229 | 6.5 | [Asesora Reformas](https://asesorareformas.es/) | Alcorcón | 22 | M1/B | A (¿Pagas por leads que reciben 4?) |
| 230 | 6.5 | [Honrados](https://www.honra2.com/) | Pozuelo de Alarcón | 22 | M4/B | B (Presupuestos que no te contestan) |
| 231 | 6.5 | [Reformas Sierra Madrid](https://reformasierramadrid.es/) | Collado Villalba | 18 | M4/B | A (¿Pagas por leads que reciben 4?) |
| 232 | 6.5 | [OneReformas](https://onereformas.es/) | Móstoles | 14 | M1/B | B (Presupuestos que no te contestan) |
| 233 | 6 | [Saneamientos Lozano Morales](http://www.lozanoreformasypiscinas.com/) | Torrelodones | 32 | M4/B | A (¿Pagas por leads que reciben 4?) |
| 234 | 6 | [adosA2](http://www.adosa2.es/) | Boadilla del Monte | 24 | M4/B | B (Presupuestos que no te contestan) |
| 235 | 5.5 | [Redecora Tu Casa](https://www.redecoratucasa.com/?utm_source=GMB&utm_medium=organic) | Las Rozas de Madrid | 153 | M4/B | A (¿Pagas por leads que reciben 4?) |
| 236 | 5.5 | [Atrio Reformas](http://atrioreformasmajadahonda.com/) | Majadahonda | 54 | M4/B | B (Presupuestos que no te contestan) |

## Cómo se lanza

```
node docs/prospeccion/verificar-lote-madrid2.mjs --lote madrid7            # solo lectura, no envía
node docs/prospeccion/enviar-email-lote.mjs --lote madrid7 --enviar        # email 1 (jueves 1-oct-2026)
node docs/prospeccion/enviar-email-lote.mjs --lote madrid7 --seguimiento --enviar   # email 2, sin fecha
node docs/prospeccion/enviar-email-lote.mjs --lote madrid7 --email3 --enviar        # email 3, sin fecha
```

Calendario: Madrid 5 martes 29-sep · Madrid 6 miércoles 30-sep · Madrid 7 jueves 1-oct.

## Dónde están los datos

- Pool: `madrid7-pool.json` · marca: `madrid7-marca.json` · copy: `outreach_reformas_madrid7.csv` · cola con enlaces: `home-estimator-outreach-madrid7.csv`.
- Logos: `app/public/demo/logos/` (servidos desde `www.nico-soto.es/demo/logos/`).
- Selección completa (los 3 lotes, antes del reparto): `seleccion-madrid567.json`; reparto: `preparar-lotes-madrid567.mjs`.

## A/B de canal (26-sep): formulario vs email

La mitad del lote va por el **formulario de su web** (lo envía Cowork) y la otra mitad por email. Mismo asunto y mismo texto; solo cambia el canal.
Reparto: `repartir-canal-madrid567.mjs`, por parejas de score y al azar con semilla fija. Las de formulario tienen `enviar=FALSE` en `outreach_reformas_madrid7.csv`, así que `enviar-email-lote.mjs` las salta.
Lista y encargo para Cowork: `cowork-formularios/` (`ENCARGO.md`, `formularios-madrid567.csv`, `resultados.csv`). Las que tengan CAPTCHA las envía Nico a mano.
Se compara por sesiones en la demo (tabla `leads` de reform-wizard, por slug).
