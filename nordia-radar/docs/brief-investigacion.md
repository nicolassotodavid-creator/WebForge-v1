# Brief para los investigadores del radar NORDIA

NORDIA es una plataforma jurídica para despachos: automatiza la entrada de documentación y notificaciones
(LexNET, correo), organiza expedientes, busca en la información jurídica interna del despacho y asiste
al abogado con IA. Buscamos despachos que puedan querer invertir en mejorar sus operaciones.

## Cliente ideal
- Despacho español pequeño: 3 a 5 abogados (aceptable 2 o 6-8 si hay señales fuertes).
- Decisor accesible: socio fundador, titular o director, que ejerce.
- Especialidad con carga documental y trámite recurrente: extranjería, laboral, familia, penal, civil,
  segunda oportunidad / concursal, accidentes, sucesiones, bancario.
- FUERA: grandes firmas y boutiques corporativas (>10 abogados), franquicias y redes nacionales
  (Legálitas, Arriaga, Abogados para Todos, Repara tu Deuda, Legalitas, Ayuda T Pymes, Novanta, etc.),
  plataformas online, aseguradoras, gestorías sin abogados.

## Señales a buscar (por orden de peso)
1. **Contratación administrativa u operativa** (la más valiosa): ofertas para administrativo/a jurídico,
   secretaria/o, recepcionista, paralegal, auxiliar, gestor/a de expedientes, procurador interno.
   Fuentes: InfoJobs, Indeed, LinkedIn Empleos, Jooble, bolsas de empleo de los colegios (ICAM, ICAB,
   ICAV), página «Trabaja con nosotros» de la propia web. Las ofertas de ABOGADO cuentan como
   crecimiento, no como contratación administrativa. Anota la fecha de la oferta si se ve.
   Muchas ofertas ocultan el nombre («importante despacho»): solo valen si el despacho queda identificado
   sin adivinar.
2. **Publicidad activa**: NO intentes comprobar Meta Ads Library ni Google Ads Transparency (no tenemos
   acceso programático autorizado; lo verificará Nico a mano). Deja `publicidad` como `no_comprobada`.
   Si ves otra evidencia pública de publicidad pagada (p. ej. la web tiene landings de campaña tipo
   `/lp/`, o el despacho publica que hace campañas), anótala como señal `publicidad` con estado `hipotesis`.
3. **Tamaño y perfil**: cuenta abogados en la página de equipo. `confirmado` solo si los ves listados con
   nombre en su web (o en el colegio); si no, `estimado` y explica de dónde sale.
4. **Crecimiento**: nueva oficina/sede, incorporaciones recientes, ampliación de equipo, nuevas áreas,
   ofertas de abogado. Con fecha.
5. **Necesidad tecnológica o intención**: el despacho declara en público que busca software, digitaliza,
   automatiza, o una oferta de empleo describe tareas manuales de expedientes / LexNET / escaneo / archivo
   (eso es necesidad verificada). NO confundas «tienen web moderna» o «hacen publicidad» con intención.

## Reglas duras
- Solo despachos REALES y fuentes PÚBLICAS. Cada dato con su URL. Nada inventado: si no lo encuentras,
  deja `null` y explícalo en `faltan`.
- Prohibido: contactar, rellenar formularios, iniciar sesión, saltar CAPTCHAs o muros, abrir páginas de
  linkedin.com con WebFetch (de LinkedIn usa solo el resultado del buscador y su URL, marcado
  `fuente: "linkedin_via_buscador"`). Respeta robots y no hagas ráfagas contra un mismo dominio.
- Decisor: solo nombre y cargo PROFESIONAL publicados por el propio despacho o el colegio.
- Contacto: solo canales profesionales publicados (email genérico o del despacho, teléfono, formulario).
- Estado de cada señal: `verificado` = lo has visto tú en la URL indicada; `hipotesis` = inferencia.
- Fecha de comprobación: 2026-10-18 (hoy).

## Formato de salida (JSON, un array) — escríbelo con la herramienta Write
```json
[
  {
    "nombre": "Nombre comercial del despacho",
    "ciudad": "Madrid|Barcelona|Valencia",
    "web": "https://...",
    "especialidades": ["extranjería", "familia"],
    "abogados": { "n": 4, "tipo": "confirmado|estimado", "fuente": "https://.../equipo", "detalle": "4 abogados listados con nombre" },
    "decisor": { "nombre": "Ana Pérez", "cargo": "Socia fundadora", "fuente": "https://..." },
    "contacto": { "email": "info@...", "telefono": "+34 ...", "formulario": "https://.../contacto", "fuente": "https://..." },
    "senales": [
      {
        "tipo": "contratacion|publicidad|crecimiento|intencion",
        "subtipo": "admin|abogado|oficina|incorporacion|necesidad_tecnologica|busca_software|otro",
        "descripcion": "Oferta de administrativa jurídica en InfoJobs: gestión de expedientes y LexNET",
        "url": "https://...",
        "fecha_evidencia": "2026-09-30 o null si no se ve",
        "fecha_comprobacion": "2026-10-18",
        "estado": "verificado|hipotesis",
        "fuente": "infojobs|indeed|linkedin_via_buscador|colegio|web|prensa|otro"
      }
    ],
    "publicidad": { "meta": "no_comprobada", "google": "no_comprobada" },
    "necesidad_nordia": "1-2 frases: qué problema concreto de NORDIA les resolvería, apoyado en las señales",
    "faltan": "qué no has podido verificar",
    "descartado": false,
    "motivo_descarte": null
  }
]
```
Incluye también los que descartes tras mirarlos (con `descartado: true` y motivo), así no se repiten.
