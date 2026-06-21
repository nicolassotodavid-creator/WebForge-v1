-- 0014_app_config_rls.sql
-- app_config quedó SIN RLS en 0001 (a diferencia del resto de tablas). Guarda from_email,
-- plan_prices y booking_base_url: en cuanto el panel la lea/escriba con la anon key, quedaría
-- abierta a cualquiera según los GRANTs por defecto. Activamos RLS + política authenticated,
-- igual que leads/sites/bookings/etc. Las Edge Functions y el Orquestador usan service_role (bypassa RLS).

alter table app_config enable row level security;

drop policy if exists op_cfg on app_config;
create policy op_cfg on app_config for all using (auth.role()='authenticated');
