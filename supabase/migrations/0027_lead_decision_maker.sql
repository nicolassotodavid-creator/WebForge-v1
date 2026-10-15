-- 0027_lead_decision_maker.sql — [LUVIA] ¿Quién decide la compra y por dónde se le llega?
-- Separa las clínicas que son "buenas" de las que además tienen un COMPRADOR identificado y ACCESIBLE.
-- Todas NULLABLE: NULL = no revisado (así los leads de webs no se ven afectados).
-- Sin cambios de RLS: las columnas heredan la visibilidad del lead (dueño + admin).
-- Reglas de cada valor: orquestador/luvia-decisor.mjs (cabecera).

-- Quién es y qué cargo tiene (rol de decisión de compra).
alter table leads add column if not exists business_decision_maker text
  check (business_decision_maker in ('propietario','administrador','gerente','director_medico','desconocido'));
alter table leads add column if not exists decision_maker_name text;

-- Prueba concreta del cargo: URL + cita real de la página (o del registro). Texto libre.
alter table leads add column if not exists decision_evidence text;

-- confirmado = la prueba se reabrió y se vio nombre + cargo en aviso legal/registro mercantil.
-- probable = hay indicios pero no se pudo comprobar así. sin_verificar = no hay prueba utilizable.
alter table leads add column if not exists decision_confidence text
  check (decision_confidence in ('confirmado','probable','sin_verificar'));

-- movil_directo = móvil publicado como suyo (o la única profesional); centralita = línea de clínica.
alter table leads add column if not exists phone_type text
  check (phone_type in ('movil_directo','centralita','desconocido'));

-- contacto_publicado = la clínica publicó ese canal para contacto profesional. NO es consentimiento
-- para publicidad. consentimiento_documentado solo si hay un opt-in real (respuesta, solicitud de demo).
alter table leads add column if not exists contact_permission text
  check (contact_permission in ('sin_consentimiento','contacto_publicado','consentimiento_documentado','baja'));
alter table leads add column if not exists contact_channel text
  check (contact_channel in ('email','telefono','whatsapp','formulario'));

alter table leads add column if not exists sales_readiness text
  check (sales_readiness in ('listo_para_contacto','pendiente_de_verificar','descartado'));

create index if not exists idx_leads_sales_readiness on leads (sales_readiness) where sales_readiness is not null;

comment on column leads.sales_readiness is 'listo_para_contacto = decide + confirmado + hay vía que le llega. Ver 0027.';
