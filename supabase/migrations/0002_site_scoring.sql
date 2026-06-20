-- 0002_site_scoring.sql — Scoring automático de la web construida.
-- El orquestador, justo tras publicar la web en Lovable, llama a Claude (Haiku 4.5)
-- y guarda aquí el resultado. El mismo botón manual de analyze-site escribe estas columnas.
-- Es ORIENTATIVO: no toca el gate humano (nada se contacta hasta status='approved').

alter table sites add column if not exists score numeric;           -- 1-10, calidad general (null = sin analizar)
alter table sites add column if not exists analysis jsonb;          -- { score, summary, strengths[], improvements[] }
alter table sites add column if not exists analyzed_at timestamptz; -- cuándo se analizó por última vez

-- Para ordenar/filtrar el pipeline por score sin escanear toda la tabla.
create index if not exists idx_sites_score on sites (score);
