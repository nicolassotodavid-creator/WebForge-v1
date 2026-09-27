-- 0026_incidencias_fincas.sql
-- [FINCAS] Incidencias que recoge el asistente de voz de recepción para administradores de fincas
-- (demo "Administraciones Turia", docs/fincas/agente-fincas/). Producto aparte de las webs: vive en este
-- proyecto solo por comodidad; no toca leads ni events.
--
-- Escriben solo las herramientas del agente vía la función fincas-voz (service_role). RLS activado y sin
-- políticas: nadie lee ni escribe desde el navegador.
--
-- La referencia (INC-1001, INC-1002…) sale de una secuencia: es la que el agente lee en voz alta al vecino
-- y la que aparece en el email del gestor, así que existe de verdad y se puede buscar.
create sequence if not exists incidencias_fincas_ref_seq start 1001;

create table if not exists incidencias_fincas (
  id                   uuid primary key default gen_random_uuid(),
  referencia           text not null unique default ('INC-' || nextval('incidencias_fincas_ref_seq')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  conversation_id      text,
  tipo_llamada         text not null default 'vecino' check (tipo_llamada in ('vecino', 'no_vecino')),
  direccion            text,
  comunidad_gestionada boolean,
  ubicacion            text,
  descripcion          text,
  urgente              boolean not null default false,
  categoria_urgencia   text,
  nombre               text,
  telefono             text,
  empresa              text,
  motivo               text,
  idioma               text,
  fuera_horario        boolean,
  aviso_guardia_at     timestamptz,
  aviso_guardia_canal  text,
  gestor_email         text,
  guardia_movil        text,
  resumen_enviado_at   timestamptz,
  demo                 boolean not null default true
);

create index if not exists incidencias_fincas_conversation_idx on incidencias_fincas (conversation_id);
create index if not exists incidencias_fincas_created_idx on incidencias_fincas (created_at desc);

alter table incidencias_fincas enable row level security;
