-- 0007_lead_site_score.sql — Scoring de la web que el negocio YA tiene (señal de prospección).
-- OJO: esto NO es el scoring de la web que construimos nosotros (eso vive en `sites`, ver 0004).
-- Aquí puntuamos la web ACTUAL del negocio (la de raw_json, el globo del panel): el Orquestador
-- la analiza en un barrido diario con Claude (Haiku 4.5) y el mismo botón manual de analyze-site
-- escribe estas columnas. Es ORIENTATIVO: una nota baja = web floja = buen candidato a contactar.
alter table leads add column if not exists site_score numeric;           -- 1-10 calidad de su web actual (null = sin analizar)
alter table leads add column if not exists site_analysis jsonb;          -- { score, summary, strengths[], improvements[] }
alter table leads add column if not exists site_analyzed_at timestamptz; -- cuándo se analizó por última vez

-- Para ordenar/filtrar el pipeline por la calidad de su web sin escanear toda la tabla.
create index if not exists idx_leads_site_score on leads (site_score);
