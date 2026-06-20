-- 0004 — Preview por screenshot para /book
-- En vez de embeber la web viva en un <iframe> (frágil a volumen: proyectos dormidos,
-- límites de Lovable, URLs de editor coladas), guardamos una captura re-hospedada de cada
-- web. Lovable devuelve latest_screenshot_url al terminar el build; el orquestador la
-- descarga y la sube a Storage. /book muestra esa imagen estática: nunca se bloquea,
-- carga instantánea y escala a clicks ilimitados (una imagen por web, reutilizada).

alter table sites add column if not exists preview_image_url text;

-- Bucket PÚBLICO para las capturas. El orquestador sube con la service key (bypassa RLS);
-- la lectura es pública vía /storage/v1/object/public/site-previews/<lead_id>.<ext>
insert into storage.buckets (id, name, public)
values ('site-previews', 'site-previews', true)
on conflict (id) do nothing;
