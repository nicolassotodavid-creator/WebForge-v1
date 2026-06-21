-- 0013_payments_reconciliation.sql
-- Conciliación de pagos: vincula cada cobro con su payout de Stripe y permite
-- confirmar a mano la llegada al banco. Aditiva e idempotente.
-- RLS: 'bookings' ya tiene la política op_book (authenticated, for all) de 0001 — no se toca.

alter table bookings add column if not exists stripe_payment_intent text;
alter table bookings add column if not exists stripe_payout_id text;
alter table bookings add column if not exists payout_arrival_date date;
alter table bookings add column if not exists bank_confirmed_at timestamptz;
alter table bookings add column if not exists holded_invoice_id text;
alter table bookings add column if not exists paid_at timestamptz;

create index if not exists idx_bookings_payment_intent on bookings (stripe_payment_intent);
create index if not exists idx_bookings_payout on bookings (stripe_payout_id);
