# Radar despachos de abogados: auditoría de fuentes de datos

Fecha: **2026-10-18**. Ámbito: Madrid, Barcelona y Valencia.
Método: documentación oficial, robots.txt descargados hoy y llamadas sin credenciales a los endpoints (sin crear cuentas, sin login, sin pagar).

Leyenda: **[V]** = verificado hoy contra la fuente oficial o una llamada real. **[D]** = deducido o tomado de fuentes secundarias, sin confirmar en la fuente oficial.

## Qué pasó en la práctica al investigar los 30 (18-oct)

- **Publicidad:** no se ha comprobado en ningún despacho. Meta y Google no tienen consulta automática autorizada sin cuentas que solo puede abrir Nico. El radar lo deja todo en «no comprobada» y prepara los enlaces (`data/manual/publicidad.csv`, `out/verificar-a-mano.csv`). Ningún despacho suma esos 20 puntos hasta que alguien lo mire.
- **Ofertas de empleo:** InfoJobs, Indeed, Jooble y Glassdoor bloquean la lectura automática (robots o 403).
  - Cuando una oferta solo se vio en el buscador, va como **hipótesis** y no puntúa.
  - Se dieron por **verificadas** las vistas en la web del propio despacho, en bolsas de colegios (ICATER), en agregadores que se dejan leer (Jobeka, JobToday, Bebee) y algunas de InfoJobs.
  - Uno de los investigadores leyó varias ofertas de InfoJobs abriéndolas en el navegador, como lo haría una persona. Va más allá de la norma «solo buscador» que se le dio, así que esas ofertas también están en `out/verificar-a-mano.csv`: se confirma el anunciante y la fecha antes de usarlas.
- **Prensa jurídica** (Confilegal, Lawyerpress, Economist & Jurist): solo cubre movimientos de firmas grandes. Para despachos de 3-5 abogados apenas da señales.
- **Cupo de búsquedas:** los investigadores agotaron el cupo de búsquedas web del turno. Por eso Madrid se quedó en 10 despachos válidos. Con cupo nuevo se puede seguir.
- **BORME:** conector funcionando (`node src/radar.mjs borme AAAAMMDD`). Del 13 al 16-oct salieron 15 actos de sociedades con nombre de despacho en las tres provincias. Es lista para triar, no señal automática.

---

## Tabla resumen

| Fuente | ¿Acceso automatizado autorizado? | Requisito para desbloquearlo | Qué usamos en v1 |
|---|---|---|---|
| **BORME (BOE datos abiertos)** | **Sí**: API oficial gratuita y sin clave [V] | Ninguno. Citar la fuente y cumplir el RGPD [V] | **Fuente principal automatizada**: sumario diario + texto HTML (`txt.php`) de la Sección A, porque el robots.txt del BOE excluye `xml.php?`, de Madrid (28), Barcelona (08) y Valencia (46). Filtrar constituciones, sociedades SLP, cambios de domicilio y ampliaciones de capital |
| **Google Ads Transparency Center** | Sí, por el dataset público de BigQuery (solo EEE y Turquía) [V]. No hay API REST oficial [D] | Proyecto de Google Cloud en modo sandbox de BigQuery, gratis y sin tarjeta [V] | **BigQuery sandbox**: anunciantes con `advertiser_location='ES'` y anuncios servidos en ES. URL prellenada por dominio para la revisión manual |
| **Meta Ad Library API** | Sí, con token (`ads_archive`, Graph API v26.0) [V]. Cubre **todos los anuncios entregados en la UE/RU del último año** [V/D] | Verificar identidad en facebook.com/ID (DNI y ubicación, unos días), cuenta de desarrollador, app y token de usuario [D] | **Manual asistido** (URL pública prellenada) hasta que Nico verifique su identidad. Después, la API |
| **InfoJobs API** | Sí: la API sigue activa (devuelve 401 si no hay credenciales) [V] | Cuenta de InfoJobs + registrar la app en developer.infojobs.net para obtener client_id y secret (Basic auth) [V] | **API de búsqueda de ofertas** (`/api/9/offer`) cuando Nico registre la app. Mientras tanto, URL prellenada a mano |
| **LinkedIn Empleos** | **No**. No hay API pública de búsqueda. La Job Posting API es solo para partners que publican ofertas [D] | No desbloqueable en la práctica | **Solo manual**: URL de búsqueda que abre una persona. Nada de scraping |
| **Indeed** | **No**. La Publisher API está cerrada a nuevos publishers desde 2022-2023 [D] | No hay vía de autoservicio | Manual (URL prellenada) o nada |
| **Jooble** | Hay API con clave que se pide por formulario [D]. La web devuelve 403 a clientes que no son navegador [V] | Pedir la clave a Jooble y aceptar sus condiciones de partner [D] | Aparcado. Duplica InfoJobs/Indeed |
| **Bolsas de empleo ICAM / ICAB / ICAV** | ICAM: no (login, robots `Disallow: /`) [V]. ICAB: listado público sin el nombre del despacho [V]. ICAV: no (zona privada de colegiados) [V] | Ser colegiado o candidato registrado | ICAB: revisión manual del listado (solo da cargo, ciudad y fecha). ICAM e ICAV: no |
| **Censo de colegiados (ICAM/ICAB/CGAE)** | **No para uso comercial**. El ICAM exige consentimiento expreso del colegiado para prospección [V]. Hay reCAPTCHA y robots lo bloquean [V] | Consentimiento de cada colegiado (inviable) | **No usar** para prospectar. Solo para verificar a mano que alguien está colegiado |
| **Registro de Sociedades Profesionales del ICAM** | Consulta pública con reCAPTCHA, robots `Disallow: /` [V] | — | Verificación manual puntual de SLP sacadas del BORME |
| **Google Maps / Places API (New)** | Sí, con API key y facturación activada [V] | Cuenta de facturación de Google Cloud. Hay cuota gratis mensual por SKU [V] | Opcional para completar web y teléfono de las SLP del BORME (Text Search Pro: 5.000 llamadas/mes gratis) [V] |

---

## 1. Meta Ad Library (`ads_archive`)

- **Versión actual de Graph API: v26.0** [V]. El endpoint responde en v24.0, v25.0 y v26.0; v27.0 todavía no existe (prueba de hoy). La página de referencia dice "API Graph v26.0".
- **Endpoint** [V]:
  ```
  GET https://graph.facebook.com/v26.0/ads_archive
      ?search_terms=abogados
      &ad_reached_countries=['ES']
      &ad_type=ALL
      &ad_active_status=ACTIVE
      &search_type=KEYWORD_UNORDERED
      &fields=id,page_id,page_name,ad_delivery_start_time,ad_delivery_stop_time,ad_snapshot_url,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,publisher_platforms,languages,eu_total_reach,beneficiary_payers,target_locations,target_ages
      &access_token=<TOKEN>
  ```
  Sin token responde `(#100) The parameter ad_reached_countries is required` [V].
- **Cobertura (DSA)**:
  - `ad_type` admite `ALL | EMPLOYMENT_ADS | FINANCIAL_PRODUCTS_AND_SERVICES_ADS | HOUSING_ADS | POLITICAL_AND_ISSUE_ADS`. El valor por defecto es `ALL` ("returns ads on all topics") [V].
  - Nota oficial [V]: *"Ads that did not reach any location in the EU will only return if they are about social issues, elections or politics."* Es decir, en ES se obtienen anuncios **comerciales**.
  - La landing de Meta (citada por búsqueda, no la pude abrir) dice: cualquier tipo de anuncio entregado en la UE o el RU **durante el último año**; los anuncios políticos, 7 años [D].
- **Campos para anuncios comerciales de la UE** (página de referencia ArchivedAd) [V]: `id`, `page_id`, `page_name`, `ad_creation_time`, `ad_delivery_start_time`, `ad_delivery_stop_time`, `ad_snapshot_url`, `ad_creative_bodies`, `ad_creative_link_titles/captions/descriptions`, `languages`, `publisher_platforms`. Solo para UE/RU: `eu_total_reach`, `beneficiary_payers`, `target_locations`, `target_ages`, `target_gender`, `age_country_gender_reach_breakdown`, `total_reach_by_location`.
  - **Sin gasto ni impresiones** en los anuncios comerciales: `spend`, `impressions`, `currency`, `bylines`, `demographic_distribution` y `delivery_by_region` son solo para anuncios políticos [V].
  - La web del anunciante sale de `ad_creative_link_captions`, que suele traer el dominio [D].
- **Límites**: el error 613 indica rate limit, pero la documentación no da cifras [V].
- **Requisitos de acceso** [D] (fuentes secundarias coinciden; la landing oficial no me cargó):
  1. Confirmar identidad y ubicación en facebook.com/ID con documento oficial (de 1 a 3 días hábiles).
  2. Cuenta de Meta for Developers y una app.
  3. Token de usuario: el corto dura 1 h y se puede cambiar por uno de 60 días.
  4. No hace falta App Review.
  - Coste: 0 €.
- **Términos y robots**: `facebook.com/robots.txt` prohíbe la recogida automatizada sin permiso escrito y tiene `User-agent: * / Disallow: /` [V]. La web de la biblioteca devuelve 403 ("Client challenge") a clientes que no son navegador [V]. Conclusión: **la API sí; scrapear la biblioteca, no**.
- **Alternativa manual** (formato habitual, **[D]**: no lo pude abrir sin navegador):
  ```
  https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ES&q=abogados&search_type=keyword_unordered&media_type=all
  ```
  Variante por frase exacta: `search_type=keyword_exact_phrase&q="abogado laboralista madrid"`.
- Docs: https://developers.facebook.com/docs/graph-api/reference/ads_archive/ · https://developers.facebook.com/docs/graph-api/reference/archived-ad/ · https://www.facebook.com/ads/library/api

## 2. Google Ads Transparency Center

- **API REST oficial: no existe** [D]. Las herramientas de terceros (SerpApi, actores de Apify) usan el RPC interno.
- **Dataset público en BigQuery** [V]: `bigquery-public-data.google_ads_transparency_center`, con dos tablas, `creative_stats` y `removed_creative_stats`. También se puede descargar en JSON gratis.
  - **Cobertura: solo anuncios servidos en el EEE y Turquía**, con datos de impresiones desde el 1-mar-2023. **España está incluida.** No se limita a anuncios políticos [V].
  - Columnas de `creative_stats` [V]: `advertiser_id`, `creative_id`, `creative_page_url`, `ad_format_type`, `advertiser_disclosed_name`, `advertiser_legal_name`, `advertiser_location` (ISO, p. ej. `ES`), `advertiser_verification_status`, `topic`, `is_funded_by_google_ad_grants`, `ad_funded_by`.
    - `region_stats[]`: `region_code`, `first_shown`, `last_shown`, `times_shown_lower_bound/upper_bound`, `times_shown_start_date/end_date`, `times_shown_availability_date`, `surface_serving_stats`.
    - `audience_selection_approach_info`: `demographic_info`, `geo_location`, `contextual_signals`, `customer_lists`, `topics_of_interest`.
  - **Qué no da**: ni el texto del anuncio, ni el dominio de destino, ni el gasto. El cruce con un despacho se hace por `advertiser_legal_name` (razón social, útil para cruzar con el BORME) [V por ausencia en el README].
  - **Coste**: el sandbox de BigQuery es gratis, sin tarjeta ni cuenta de facturación. Incluye 1 TiB de consultas al mes y 10 GiB de almacenamiento; las tablas caducan a los 60 días. Permite consultar datasets públicos [V]. **Ojo**: cada consulta factura las columnas escaneadas de la tabla completa, así que hay que seleccionar solo las columnas necesarias, sin `SELECT *` [D].
  - Consulta tipo [D]:
    ```sql
    SELECT advertiser_id, advertiser_legal_name, advertiser_disclosed_name, creative_page_url, r.first_shown, r.last_shown
    FROM `bigquery-public-data.google_ads_transparency_center.creative_stats`, UNNEST(region_stats) r
    WHERE r.region_code = 'ES' AND advertiser_location = 'ES'
      AND REGEXP_CONTAINS(LOWER(advertiser_legal_name), r'abogad|legal|jur[ií]dic|slp|bufete|lex')
      AND r.last_shown >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    ```
- **Términos**: los de Google y las "Ads Transparency Center Additional Terms" (según el README) [V]. `adstransparency.google.com/robots.txt` devuelve 404, así que no hay reglas publicadas [V]. Aun así, scrapear el RPC interno no está autorizado [D].
- **URL manual por dominio y región** (fuente: blog de Moda; la URL devuelve 200 con la SPA, pero no comprobé que filtre bien) [D]:
  ```
  https://adstransparency.google.com/?region=ES&domain=<dominio.es>
  https://adstransparency.google.com/?region=ES&domain=<dominio.es>&preset-date=Last+30+days
  https://adstransparency.google.com/advertiser/<AR…advertiser_id>?region=ES
  ```
- Docs: https://storage.googleapis.com/ads-transparency-center/api-data/README.txt · https://console.cloud.google.com/marketplace/product/bigquery-public-data/google-ads-transparency-center · https://docs.cloud.google.com/bigquery/docs/sandbox

## 3. InfoJobs API

- **Sigue activa** [V]. `GET https://api.infojobs.net/api/9/offer?q=abogado&province=madrid` sin credenciales responde `401 {"error":"102","error_description":"Client credentials not valid"}`. La v7 también responde.
- **Autenticación** [V]: HTTP Basic con `Authorization: Basic base64(client_id:client_secret)`. La búsqueda de ofertas tiene rol "public" y no necesita scope ni OAuth de usuario.
- **Alta** [V]: en developer.infojobs.net se entra con una cuenta de InfoJobs y se registra la app (`/app/manage-app/create.xhtml`) para obtener las credenciales. Es gratis.
- **Endpoint y parámetros** [V]: `GET https://api.infojobs.net/api/9/offer`
  - Filtros: `q`, `province` (repetible; valores de `/dictionary/province`), `provinceIds`, `city`, `cityIds`, `category`, `subcategory`, `employerId`.
  - Fecha y orden: `sinceDate` (`_24_HOURS | _7_DAYS | _15_DAYS | ANY`), `order` (`updated-desc`, `relevancia-desc`, `author`…).
  - Paginación: `page`, `maxResults` (por defecto 20, recomiendan ≤50), `facets=true`.
  - Otros: `salaryMin/Max`, `contractType`, `workday`, `teleworking`, `study`, `experienceMin`.
  - Ejemplo: `https://api.infojobs.net/api/9/offer?q=abogado&province=madrid&province=barcelona&province=valencia-valencia&sinceDate=_7_DAYS&maxResults=50&order=updated-desc`. El slug exacto de cada provincia sale del diccionario [D].
- **¿Muestra la empresa?** Sí [V]: `author.name` (nombre comercial), `author.uri` (web corporativa), `author.id` y `author.logoUrl`. Cada oferta también trae `link`, `city`, `province`, `published`, `updated`, `applications`, `requirementMin` y salario. Las ofertas de empresas "confidenciales" o de ETT no darán el despacho real [D].
- **Límites**: no están documentados [V]. Las condiciones de uso de la API no cargan (el enlace es `#`) [V], así que se desconoce si permiten uso comercial; hay que confirmarlo al registrar la app [D].
- **robots.txt** de www.infojobs.net [V]: bloquea los listados y fichas antiguos (`/ofertas_lista.cfm`, `/ver-oferta.xhtml`, `/visualizar_oferta.*`) y también `/jobsearch/search-results/list.xhtml`. Por tanto, **nada de scraping de la web: usar la API**.
- **URL manual** [V, responde 200]:
  ```
  https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=abogado&provinceIds=33&sinceDate=_7_DAYS
  https://www.infojobs.net/ofertas-trabajo/madrid/abogado
  ```
  El `provinceIds=33` = Madrid lo tomo de la doc y no lo he confirmado con el diccionario [D].
- Docs: https://developer.infojobs.net/documentation/operation/offer-list-9.xhtml · https://developer.infojobs.net/documentation/app-auth/index.xhtml

## 4. LinkedIn Empleos

- **No hay API pública para buscar ofertas** [D, según Microsoft Learn y fuentes secundarias]. La Job Posting API sirve para publicar ofertas y exige ser partner de Talent Solutions, con un formulario y un acuerdo de API.
- **Términos** [V] (User Agreement, en vigor desde el 3-nov-2025). La sección 8.2 prohíbe:
  - "software, devices, scripts, robots… to scrape or copy the Services";
  - "Use bots or other unauthorized automated methods to access the Services";
  - copiar o distribuir la información obtenida.
- **robots.txt** [V]: empieza con *"The use of robots or other automated means to access LinkedIn without the express permission of LinkedIn is strictly prohibited"*. Tiene `User-agent: * / Disallow: /`, y aun para los bots autorizados bloquea `/jobs-guest/`, `/api/jobPostings/jobs*` y `/jobs?runSearch*`.
- **URL manual** (responde 200) [V]: `https://www.linkedin.com/jobs/search/?keywords=abogado&location=Madrid&f_TPR=r604800` (`f_TPR=r604800` = últimos 7 días [D]).

## 5. Indeed y Jooble

- **Indeed** [D]: la Publisher API (búsqueda de ofertas) está cerrada a nuevos publishers desde 2022-2023. Las APIs actuales (Indeed Apply, Sponsored Jobs, Job Sync) son del lado del empleador y requieren aprobación como partner. `es.indeed.com/jobs` devuelve 403 a un cliente que no es navegador [V]. El robots.txt para `*` permite `/` pero bloquea `/advanced_search`, `/api/getrecjobs`, `/company/*`, `/cmp/*/people`… [V]. URL manual [D]: `https://es.indeed.com/jobs?q=abogado&l=Madrid&fromage=7`.
- **Jooble** [D]: API REST con clave que se pide en jooble.org/api/about. Formato habitual: `POST https://jooble.org/api/<key>` con el cuerpo `{"keywords":"abogado","location":"Madrid"}`. Pensada para partners que muestran ofertas. Tanto jooble.org/api/about como la búsqueda devuelven 403 a cliente no navegador [V]. El robots.txt bloquea `/SearchResult*`, `/desc/`, `/away/` y `/Export/` [V].

## 6. Bolsas de empleo de los colegios

- **ICAM (Madrid)** [V]:
  - Portal de Empleo en `www.icam.es/bolsaTrab/…`. Para consultar las ofertas hay que ser colegiado o estar registrado como candidato (colegiado de otro colegio, estudiante o graduado). Las normas de uso están en un PDF.
  - Los despachos publican "de forma… confidencial".
  - `www.icam.es/robots.txt` = `Disallow: /`.
  - **No es público y no muestra el despacho.**
- **ICAB (Barcelona)** [V]:
  - El listado de ofertas es **público sin login** (lo sirve cvtools y necesita JavaScript): `https://icab.cvtools.com/persona/WebLinkEntryPoint.php?idowner=16783&code=Ofertas-Licenciados-cat`. También existen los códigos `Ofertas-Estudiantes-cat` y `Ofertas-Secretarias-Juridica-cat`.
  - Cada fila trae fecha, referencia (p. ej. `R131438-575801`), cargo y ciudad. **No trae el nombre del despacho.** Se puede filtrar por sector ("Despatx d'advocats").
  - Hay ofertas exclusivas para colegiados en el área personal.
  - robots.txt bloquea `/colegi/membres/` y el cercador de professionals.
- **ICAV (Valencia)** [V]: las ofertas se cuelgan "en la parte privada de la web para que cualquier persona colegiada en el ICAV pueda acceder". **No son públicas.** `icav.es/robots.txt` devuelve una página 404 en HTML, es decir, no hay robots.txt.

## 7. BORME (BOE datos abiertos): probado hoy

- **Endpoint** [V]: `GET https://www.boe.es/datosabiertos/api/borme/sumario/AAAAMMDD`
  - El formato se elige con la cabecera `Accept: application/json` o `Accept: application/xml`; las dos funcionan [V].
  - No pide clave ni registro. La documentación no indica rate limit.
  - Los días sin BORME (p. ej. el domingo 20261018) responden `404 "La información solicitada no existe"` [V].
- **Estructura JSON real** (20261016, BORME núm. 200, 55 KB) [V]:
  ```json
  {
    "status": {"code": "200", "text": "ok"},
    "data": {"sumario": {
      "metadatos": {"publicacion": "BORME", "fecha_publicacion": "20261016"},
      "diario": [{
        "numero": "200",
        "sumario_diario": {"identificador": "BORME-S-2026-200",
          "url_pdf": {"szBytes": "223457", "szKBytes": "218", "texto": "https://www.boe.es/borme/dias/2026/10/16/pdfs/BORME-S-2026-200.pdf"}},
        "seccion": [
          {"codigo": "A", "nombre": "SECCIÓN PRIMERA. Empresarios. Actos inscritos",
           "item": [{
             "identificador": "BORME-A-2026-200-28",
             "titulo": "MADRID",
             "url_pdf": {"szBytes": "1001415", "szKBytes": "978", "pagina_inicial": "48484", "pagina_final": "48530",
                         "texto": "https://www.boe.es/borme/dias/2026/10/16/pdfs/BORME-A-2026-200-28.pdf"},
             "url_html": "https://www.boe.es/diario_borme/txt.php?id=BORME-A-2026-200-28",
             "url_xml":  "https://www.boe.es/diario_borme/xml.php?id=BORME-A-2026-200-28"
           }, "…"]},
          {"codigo": "C", "nombre": "SECCIÓN SEGUNDA. Anuncios y avisos legales",
           "apartado": [{"codigo": "002", "nombre": "CONVOCATORIAS DE JUNTAS",
             "item": [{"identificador": "BORME-C-2026-5474", "titulo": "AULA, ESCUELA EUROPEA, S.A.", "url_pdf": {"…"}, "url_html": "…", "url_xml": "…"}]}]}
        ]
      }]
    }}
  }
  ```
  - La Sección A tiene `item[]`, uno por provincia, más un último item llamado "ÍNDICE ALFABÉTICO DE SOCIEDADES"; ese día eran 33 items. La Sección C tiene `apartado[] → item[]`, un item por anuncio.
  - El sufijo del identificador coincide con el código INE de provincia: `-01` Álava, `-03` Alicante, `-28` Madrid. Barcelona y Valencia aparecen como "BARCELONA" y "VALENCIA/VALÈNCIA"; sus códigos serían `-08` y `-46` [D por patrón].
- **¿Hay texto o XML por acto?** **Sí, aunque en un documento por provincia, no un fichero por acto** [V]:
  - `url_xml` devuelve `<documento><metadatos>…</metadatos><texto>` con pares `<p class="articulo">NNNNNN - RAZÓN SOCIAL SL.</p>` + `<p class="parrafo">actos…</p>`.
  - Madrid el 16-oct: **610 actos, 119 constituciones**.
  - En el párrafo vienen tipos de acto que se pueden parsear: `Constitución` (con "Comienzo de operaciones", "Objeto social", "Domicilio" y capital), `Nombramientos`, `Ceses/Dimisiones`, `Cambio de domicilio social`, `Ampliación de capital`, `Reducción de capital`, `Cambio de objeto social`, `Cambio de denominación social`, `Disolución`, `Extinción`, `Fusión por absorción`, `Transformación de sociedad`, `Declaración de unipersonalidad`, `Revocaciones`. Además, "Datos registrales" (hoja `H M 864815`, fecha de inscripción).
  - Ejemplo real de ese día: `461060 - LOMEN ELEN SERVICIOS JURIDICOS SL.` → cambio de administración + "Cambio de domicilio social. C/ TOLEDO 27 5º C… (MADRID)".
  - Las SLP llevan el sufijo `SLP.` en la razón social; ese día salió una (de arquitectura).
- **Filtro para el radar** [D]: razón social con `SLP|ABOGAD|LEGAL|JURID|BUFETE|LEX|LAW` **o** objeto social con `abogac|asesoramiento jur[ií]dico|servicios jur[ií]dicos`, y acto de tipo Constitución, Ampliación de capital, Cambio de domicilio, Nombramientos o Fusión. Lo probé en Madrid el 16-oct: salen 5 por razón social (LOMEN ELEN SERVICIOS JURIDICOS, ANTHELEX INTERNATIONAL, PFSLEGAL HOLDING…). Hay falsos positivos (p. ej. "SUNPLEX") que hay que limpiar con una lista de exclusión.
- **robots.txt del BOE** [V]: bloquea `/diario_borme/xml.php?` y `/buscar/anborme.php?` para los rastreadores. `/datosabiertos/` no está bloqueado. Acceder a la XML enlazada desde la API de datos abiertos es reutilización bajo las condiciones del BOE, no rastreo para indexar [D]. Si se prefiere no tocar esa ruta, `url_html` (`txt.php`) trae el mismo contenido y no está bloqueado de forma general.
- **Condiciones de reutilización** [V]:
  - Permiten el uso "para fines comerciales y no comerciales", con licencia gratuita.
  - Obligaciones: citar "Fuente de los datos: Agencia Estatal Boletín Oficial del Estado" (o "Basado en datos de…"), no desnaturalizar la información, no sugerir carácter oficial y conservar la fecha de actualización.
  - Cuarta.9: si hay datos personales (nombres de administradores), se aplican el RGPD y la LOPDGDD.
  - El BOE puede suspender el acceso a quien incumpla.
- Docs: https://www.boe.es/datosabiertos/api/api.php · https://www.boe.es/datosabiertos/documentos/APIsumarioBORME.pdf · https://www.boe.es/datosabiertos/faq/borme.php · https://www.boe.es/informacion/aviso_legal/index.php#reutilizacion

## 8. Censo de colegiados (ICAM / ICAB / CGAE)

- **ICAM** [V]:
  - La búsqueda es pública, una a una y con reCAPTCHA: `https://www.icam.es/censoColegiados/BuscaCenso.jsp`.
  - El aviso de esa página dice literalmente: los datos se publican en la ventanilla única (Ley 2/1974) "con la finalidad de protección de los intereses de los ciudadanos y clientes… **la utilización con fines comerciales, de publicidad o de prospección comercial requiere el consentimiento expreso del colegiado**".
  - Además, robots `Disallow: /`.
  - Registro de Sociedades Profesionales (búsqueda por CIF o denominación, con reCAPTCHA): `https://www.icam.es/censoSociedades/BuscaSociedad.jsp`.
- **ICAB** [V]: robots.txt bloquea `*/cercador-de-professionals/`, `*/colegi/membres/` y `*/colegio/miembros/`.
- **CGAE (censo de letrados de abogacia.es)**: la página devuelve un cuerpo vacío de 212 bytes a cliente no navegador [V]. Es de esperar el mismo régimen (ventanilla única, finalidad de protección del consumidor) [D].
- **Conclusión**: el censo **no sirve como fuente de prospección**. La finalidad de publicación es incompatible y el ICAM lo dice expresamente. Solo vale para verificar a mano.

## 9. Google Maps / Places API (New)

- **Precio** (lista oficial, tramo 0-100k, por cada 1.000 llamadas) [V]:

  | SKU | Gratis/mes | Precio por 1.000 |
  |---|---|---|
  | Text Search Essentials (IDs Only) | ilimitado | — |
  | Text Search Pro | 5.000 | 32 $ |
  | Text Search Enterprise | 1.000 | 35 $ |
  | Text Search Enterprise + Atmosphere | 1.000 | 40 $ |
  | Place Details Essentials | 10.000 | 5 $ |
  | Place Details Pro | 5.000 | 17 $ |
  | Place Details Enterprise | 1.000 | 20 $ |
  | Place Details Enterprise + Atmosphere | 1.000 | 25 $ |
  | Nearby Search Pro | 5.000 | 32 $ |

  El modelo es una cuota gratis mensual por SKU; la página ya no menciona el crédito de 200 $. Hace falta una cuenta de facturación.
- **Campos por SKU** [D]: el teléfono y la web (`nationalPhoneNumber`, `websiteUri`) son campos Enterprise. Con la cuota gratis caben unas 1.000 fichas completas al mes.
- **Términos** [V]: prohíben "pre-fetch, cache, or store Places API content beyond the allowed exceptions". El `place_id` se puede guardar indefinidamente. Hay que atribuir a Google y citar al autor de fotos y reseñas. La regla de cachear lat/lng hasta 30 días viene de los Service Specific Terms [D]. Es decir: **no se puede montar una base de datos persistente de fichas de Maps**; se guarda el `place_id` y se vuelve a consultar cuando haga falta.
- Mientras Apify esté agotado (hasta el 29-oct), Places sirve para completar unas 1.000 SLP al mes gratis, siempre que no se guarde el contenido de Maps.
- Docs: https://developers.google.com/maps/billing-and-pricing/pricing · https://developers.google.com/maps/documentation/places/web-service/policies

## 10. Marco legal y consecuencias para el canal

- **RGPD + LOPDGDD** [V, texto del BOE]:
  - Art. 19.1 LOPDGDD: se presume interés legítimo (6.1.f RGPD) para tratar los datos de contacto y el puesto de las personas físicas que trabajan en una persona jurídica, si solo son los necesarios para la localización profesional y la finalidad es mantener relaciones con la persona jurídica.
  - Art. 19.2: la misma presunción vale para **empresarios individuales y profesionales liberales** (el abogado autónomo), "cuando se refieran a ellos únicamente en dicha condición".
  - Art. 23: sistemas de exclusión publicitaria (Lista Robinson).
  - En la práctica: tratar razón social, web, email y teléfono profesionales publicados por el propio despacho o en el BORME está amparado si se informa al interesado (art. 14 RGPD: origen de los datos y derecho de oposición en el primer contacto) y se respeta la oposición [D].
  - Los nombres de administradores del BORME son datos personales: usarlos solo para dirigirse al despacho, no para crear perfiles de personas [D].
- **LSSI art. 21** [V]: "Queda prohibido el envío de comunicaciones publicitarias o promocionales por correo electrónico u otro medio de comunicación electrónica equivalente que previamente no hubieran sido solicitadas o expresamente autorizadas por los destinatarios". La única excepción (21.2) es una relación contractual previa con servicios similares.
  - **Clave: el Anexo de la LSSI define "destinatario" como "persona física o jurídica"** [V]. Por tanto, en España **la prohibición protege también a la persona jurídica**. No hay excepción B2B: el email comercial en frío a un despacho SL/SLP **y** a un abogado autónomo necesita consentimiento previo.
  - Que el interés legítimo del RGPD cubra el *tratamiento* del dato **no** legitima el *envío* comercial por email, que se rige por la LSSI [D, criterio AEPD habitual].
  - Las sanciones por envío no solicitado son leves o graves, según el informe AEPD 0219/2009 [V].
  - Un primer email "¿le puedo enviar información?" también suele considerarse comunicación comercial [D].
- **Llamadas** (Ley 11/2022 General de Telecomunicaciones, art. 66.1.b) [V]: derecho a no recibir llamadas comerciales no deseadas "salvo que exista consentimiento previo… o salvo que la comunicación pueda ampararse en otra base de legitimación de las previstas en el artículo 6.1" del RGPD. Por tanto, se puede llamar con interés legítimo, consultando la Lista Robinson y atendiendo la oposición. Las llamadas automáticas sin intervención humana requieren consentimiento siempre [V].
- **Qué implica para el canal del radar** [D, recomendación]:
  1. **Email en frío: no**, ni a despachos (persona jurídica) ni a autónomos, salvo consentimiento o relación previa. Tampoco formularios web masivos con pitch comercial: es zona gris, porque un "medio de comunicación electrónica equivalente" puede incluirlos.
  2. **Canales defendibles**:
     - llamada humana al teléfono profesional (interés legítimo + Robinson + informar del origen del dato);
     - correo postal;
     - LinkedIn manual (nota de conexión sin pitch, persona a persona; es la vía actual de `b2b` en CLAUDE.md, aunque los mensajes de LinkedIn también son electrónicos, así que conviene mantenerlos no promocionales en el primer toque);
     - contenido y anuncios para que el despacho pida información (inbound, que da consentimiento).
  3. El radar sirve para **elegir a quién y cuándo** (señal de BORME, anuncios o vacantes). El contacto lo hace una persona por un canal legal.

---

## Fuentes consultadas hoy

**Meta**
- https://developers.facebook.com/docs/graph-api/reference/ads_archive/
- https://developers.facebook.com/docs/graph-api/reference/archived-ad/
- https://www.facebook.com/ads/library/api
- https://www.facebook.com/robots.txt

**Google**
- https://storage.googleapis.com/ads-transparency-center/api-data/README.txt
- https://console.cloud.google.com/marketplace/details/bigquery-public-data/google-ads-transparency-center
- https://discuss.google.dev/t/querying-public-google-ads-transparency-center-table-doesnt-show-all-the-needed-data/177804
- https://docs.cloud.google.com/bigquery/docs/sandbox
- https://moda.app/blog/google-ads-transparency-center
- https://blog.google/technology/ads/announcing-the-launch-of-the-new-ads-transparency-center/
- https://developers.google.com/maps/billing-and-pricing/pricing
- https://developers.google.com/maps/documentation/places/web-service/policies

**Portales de empleo**
- https://developer.infojobs.net/documentation/operation/offer-list-9.xhtml
- https://developer.infojobs.net/documentation/app-auth/index.xhtml
- https://www.infojobs.net/robots.txt
- https://www.linkedin.com/legal/user-agreement
- https://www.linkedin.com/robots.txt
- https://learn.microsoft.com/fr-ch/linkedin/talent/premium-job-posting
- https://jobspipe.dev/blog/indeed-publisher-api
- https://jobspipe.dev/blog/jooble-api
- https://es.indeed.com/robots.txt
- https://es.jooble.org/robots.txt

**Colegios de abogados**
- https://web.icam.es/servicios/area-de-desarrollo-profesional-empleo/
- https://web.icam.es/portal-de-empleo-candidatos/
- https://www.icam.es/censoColegiados/BuscaCenso.jsp
- https://www.icam.es/censoSociedades/BuscaSociedad.jsp
- https://www.icab.cat/ca/colegi/talent-icab/borsa-de-treball-icab/candidats/index.html
- https://www.icav.es/ver/325/enviar-una-nueva-oferta-de-empleo.html

**BOE y normativa**
- https://www.boe.es/datosabiertos/api/api.php
- https://www.boe.es/informacion/aviso_legal/index.php
- https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758 (LSSI)
- https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673 (LOPDGDD)
- https://www.boe.es/buscar/act.php?id=BOE-A-2022-10757 (LGTel)
- https://www.aepd.es/documento/2009-0219.pdf
