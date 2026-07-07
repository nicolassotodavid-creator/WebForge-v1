# WebForge — Plantillas de Outreach Email
Documento para inyectar en `generate-outreach`.  
Dos segmentos: **A) Sin web** / **B) Tienen web (mejorada)**.  
Variables disponibles desde `briefs`: `{{nombre}}`, `{{nombre_negocio}}`, `{{nota_google}}`, `{{num_reseñas}}`, `{{frase_reseña}}`, `{{live_url}}`.

---

## SEGMENTO A — No tienen web (`has_website: false`)

### Email 1 — Día 0 (Gancho)
**Asunto:** `Tu web está lista.`
```
Hola {{nombre}},
Sé que esto es raro pero os busqué en Google, 
vi el {{nota_google}} con {{num_reseñas}} reseñas y no teníais web.
Me puse.
{{live_url}}
Están vuestros servicios, algunas fotos y frases de 
clientes reales de Google. Carga bien en el móvil.
Si os gusta y queréis quedarosla, me decís.
Si hay algo que cambiaríais —colores, textos, una foto— os lo ajusto 
sin coste. Me escribís y ya.
Si no, sin problema — fue un rato mío.
Nico
```

> El **cuerpo del Email 1 lo redacta Claude** (`OUTREACH_PROMPT` en `_shared/prompts.ts`); esto es la
> referencia del tono, no un literal fijo. La frase de "cambios sin coste" va en el prompt para bajar la
> objeción. **Pie de WhatsApp:** si el secreto `WHATSAPP_NUMBER` está configurado, el sistema añade
> `WhatsApp: https://wa.me/…` bajo la firma en los **tres** emails (clicable en el HTML). Vacío → sin pie.

---

### Email 2 — Día 4 (Recordatorio, si no respondió)
**Asunto:** `Re: Tu web está lista.`
```
Hola {{nombre}},
Solo por si no lo viste.
{{live_url}}
Nico
```

---

### Email 3 — Día 7 (Cierre, solo si no abrió el email 2)
**Asunto:** `Re: Tu web está lista.`
```
Hola {{nombre}},
Esta semana la doy de baja — tengo otros negocios 
esperando y no puedo tenerla activa indefinidamente.
Por si acaso: {{live_url}}
Nico
```

---

---

## SEGMENTO B — Tienen web pero es mala (`has_website: true`)

> ⚠️ Nunca mencionar que su web es mala. Hablar de la oportunidad, no del problema.

### Email 1 — Día 0 (Gancho)
**Asunto:** `Tu web está lista. ¿Te gusta cómo ha quedado?`
```
Hola {{nombre}},
Vi que tenéis un {{nota_google}} en Google con {{num_reseñas}} reseñas.
Me pregunté si os llega gente desde el móvil.
Le di una vuelta a cómo podría verse: {{live_url}}
Si os resulta útil, me decís.
Si hay algo que cambiaríais del diseño, os lo ajusto sin coste — me escribís.
Nico
```

---

### Email 2 — Día 4 (Recordatorio, si no respondió)
**Asunto:** `Re: Tu web está lista. ¿Te gusta cómo ha quedado?`
```
Hola {{nombre}},
Te mando esto por si no llegaste a verlo.
{{live_url}}
Nico
```

---

### Email 3 — Día 7 (Cierre, solo si no abrió el email 2)
**Asunto:** `Re: Tu web está lista. ¿Te gusta cómo ha quedado?`
```
Hola {{nombre}},
Esta semana lo dejo caer — tenía otros negocios 
esperando y no puedo tenerlo activo indefinidamente.
Por si acaso: {{live_url}}
Nico
```

---

---

## Lógica de segmentación para `generate-outreach`

```typescript
const segment = lead.has_website ? 'has_web' : 'no_web'
const templates = {
  no_web: {
    subject_1: 'Tu web está lista.',
    subject_follow: 'Re: Tu web está lista.',
  },
  has_web: {
    subject_1: 'Tu web está lista. ¿Te gusta cómo ha quedado?',
    subject_follow: 'Re: Tu web está lista. ¿Te gusta cómo ha quedado?',
  }
}
```

## Lógica de envío (cuándo disparar cada email)

```
Email 1 → inmediato tras aprobación QA (status: approved)
Email 2 → día 4 si status sigue en 'contacted' (no respondió)
Email 3 → día 7 si email 2 no tuvo apertura (track_event: email_opened = false)
```

> El Email 3 **no se manda** si el lead abrió el Email 2 y no respondió.  
> Abrió = hay interés pasivo. Presionar con urgencia ahí quema el lead.

---

## Variables que genera Claude desde el brief

`generate-outreach` debe extraer del objeto `brief`:

| Variable | Fuente en brief |
|---|---|
| `{{nombre}}` | `brief.contact_name` o `lead.name` |
| `{{nombre_negocio}}` | `lead.name` |
| `{{nota_google}}` | `lead.rating` |
| `{{num_reseñas}}` | `lead.review_count` |
| `{{frase_reseña}}` | `brief.highlight_reviews[0]` (opcional, para versiones futuras) |
| `{{live_url}}` | `lead.live_url` |
