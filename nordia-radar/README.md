# Radar comercial NORDIA

Detecta despachos de abogados españoles pequeños (3-5 abogados) con señales públicas de querer mejorar sus
operaciones, los puntúa de 0 a 100 de forma explicable y exporta una tabla para decidir a quién llamar.

Es **independiente del producto NORDIA**: no toca su código, sus repositorios ni sus bases de datos. No
contacta a nadie, no envía nada y no tiene tareas programadas activas.

## Qué hay

| Ruta | Qué es |
|---|---|
| `out/radar-nordia.csv` | **La tabla.** Los 30 mejores, con las 16 columnas pedidas y 4 extra (Top 10, desglose, qué falta, origen). Se abre en Google Sheets con Archivo → Importar |
| `out/top10.md` | Los 10 primeros explicados: señales con enlace, qué no puntúa y qué comprobar antes de llamar |
| `out/verificar-a-mano.csv` | Lista de comprobaciones de un clic: publicidad en Meta y Google, y el anunciante y la fecha de cada oferta de portal |
| `out/reserva.csv` · `out/descartados.csv` | Los válidos por debajo del puesto 30 · los descartados con su motivo (para no volver a mirarlos) |
| `out/radar-nordia.json` | Todo, con la puntuación desglosada por señal |
| `config/scoring.json` | Pesos y reglas del scoring (editable) |
| `data/research/*.json` | Fichas de despachos (una por investigador o lote; cualquier JSON con el esquema de `docs/brief-investigacion.md`) |
| `data/manual/` | Lo que se comprueba a mano: `publicidad.csv`, `hallazgos.csv`, `revision.csv` (plantillas en `*.example.csv`) |
| `docs/fuentes.md` | Auditoría de fuentes: qué se puede consultar de forma autorizada, cómo desbloquear el resto y el marco legal |
| `docs/google-atc-bigquery.sql` | Consulta para el dataset público de Google Ads Transparency en BigQuery (sin probar: requiere el sandbox) |

`data/` y `out/` no van a git: contienen nombres de despachos y de decisores. Se quedan en este Mac.

## Uso (Node 22, sin dependencias)

```bash
cd nordia-radar
node src/radar.mjs build            # une investigación + manual + caché → out/
node src/radar.mjs ads-checklist    # (re)genera data/manual/publicidad.csv con enlaces de Meta y Google
node src/radar.mjs web [dominio]    # pasada ligera por las webs (robots.txt, 1 pág/s) → data/cache/web/
node src/radar.mjs borme 20261013 20261016   # actos BORME de sociedades de abogados (Madrid, Barcelona, Valencia)
node src/radar.mjs meta-api         # Meta Ad Library oficial (necesita META_ADLIB_TOKEN)
node src/radar.mjs infojobs "administrativo despacho abogados" madrid   # InfoJobs oficial (INFOJOBS_CLIENT_ID/SECRET)
```

### Rutina de mantenimiento (15-20 min por lote)
1. **Publicidad:** abre `out/verificar-a-mano.csv` y, para cada despacho, mira los dos enlaces. En
   `data/manual/publicidad.csv` escribe `sí` o `no` en `meta_activa` y `google_activa`, la fecha y, si hay
   anuncio, su enlace en `*_evidencia_url`.
2. **Ofertas:** abre cada oferta de la lista y confirma que la publica el despacho y la fecha. Si no es suya
   o ha caducado, apúntalo en `data/manual/hallazgos.csv` (o corrige la ficha en `data/research/`).
3. **Revisión:** en `data/manual/revision.csv` pon el estado por dominio (p. ej. `Revisado - llamar`,
   `Descartar`, `Llamado 21-oct`).
4. `node src/radar.mjs build` y vuelve a abrir la tabla.

## Cómo se puntúa (0-100)

| Bloque | Máx. | Cuándo puntúa |
|---|---|---|
| Contratación administrativa u operativa | 25 | Oferta verificada de administrativo/a, secretaría, paralegal o gestor/a de expedientes: 25 si tiene 6 meses o menos; 15 si tiene hasta 18 meses o no tiene fecha |
| Publicidad activa | 20 | Solo si alguien la ha visto en Meta Ad Library o Google Ads Transparency (o por la API oficial). Hoy: nadie |
| Tamaño y perfil | 20 | 3-5 abogados: 15 si está confirmado, 10 si es estimado; 2 o 6-8 abogados: 8 / 5. Decisor publicado con cargo de decisión: +5 |
| Carga documental | 15 | Según la especialidad publicada (extranjería y segunda oportunidad 15, laboral y familia 13, penal 12…). Es una estimación por especialidad, no una medida |
| Crecimiento | 10 | Oficina nueva, incorporación u oferta de abogado en los últimos 24 meses (sin fecha: 2 como máximo) |
| Necesidad tecnológica o intención | 10 | 10 si busca software en público; 6 si una oferta describe trabajo manual de expedientes, plazos o LexNET |

Reglas: **nada puntúa sin una señal `verificado` con URL**. Las hipótesis se ven en la tabla con
`[hipótesis]` y 0 puntos. La necesidad de NORDIA de cada fila es siempre una hipótesis. La puntuación sirve
para ordenar, no es una probabilidad de conversión. Hoy el máximo práctico es 80, porque la publicidad
está sin comprobar en todos.

## Contacto: lo que permite la ley (resumen de `docs/fuentes.md`)
- **Email comercial en frío: no.** El art. 21 de la LSSI exige consentimiento previo también a personas jurídicas (SL/SLP).
- **Llamada de una persona: sí**, con interés legítimo (art. 66.1.b LGTel), comprobando antes la Lista Robinson.
- También valen el correo postal y LinkedIn manual, sin pitch en la primera nota.
- Guardar el nombre y el cargo profesional publicados está amparado por el art. 19 de la LOPDGDD.
- El radar no automatiza ningún contacto.

## Evolución hacia un radar periódico (propuesta, nada activado)

1. **Desbloquear fuentes oficiales.** Lo tiene que hacer Nico; las tres son gratis:
   - InfoJobs: registrar una app en developer.infojobs.net y guardar `INFOJOBS_CLIENT_ID/SECRET`. Es la señal de más peso (25 puntos) y hoy depende del buscador.
   - Meta: verificar la identidad en facebook.com/ID y crear una app → `META_ADLIB_TOKEN`.
   - Google: sandbox de BigQuery para `docs/google-atc-bigquery.sql`.
2. **Cadencia semanal (lunes):**
   - `borme` de la semana: sociedades nuevas, ampliaciones de capital y cambios de domicilio de despachos.
   - `infojobs` con 4-5 búsquedas por ciudad: ofertas nuevas, que se trían a mano.
   - `web` sobre los despachos ya fichados: páginas de empleo nuevas y cambios en la página de equipo.
   - `meta-api` y `build`.
   - Programarlo con launchd, como los envíos de Luvia, solo cuando Nico lo apruebe.
3. **Alertas por cambio, no listados.** Lo valioso es «este despacho ha publicado una oferta administrativa esta
   semana» o «ha cambiado de sede». El siguiente paso es guardar una foto por semana y avisar solo de las
   diferencias, con un resumen en Trello.
4. **Ampliar el embudo de entrada:** ciudades medianas (Alicante, Murcia, Zaragoza, Bilbao…) con el
   scrape de Google Maps de `docs/nordia/prospeccion/scrape.mjs`, cuando vuelva el saldo de Apify (29-oct).
   Esos despachos pasarían por las mismas señales.
5. **Calibrar el scoring con resultados reales.** Tras 20-30 llamadas, apuntar en `revision.csv` quién
   contestó o mostró interés y ajustar los pesos de `config/scoring.json` con esos datos.
