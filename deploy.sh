#!/bin/bash
# WebForge — Deploy completo a Supabase
# Uso: bash deploy.sh
# Sube todos los secrets del .env y redeploya las funciones.
set -e
cd "$(dirname "$0")"

# Cargar vars del .env (solo la parte antes del #)
_env() { grep "^$1=" .env | head -1 | cut -d= -f2- | sed 's/[[:space:]]*#.*//' | tr -d '\r'; }

SUPABASE_ACCESS_TOKEN=$(_env SUPABASE_ACCESS_TOKEN)
ANTHROPIC_API_KEY=$(_env ANTHROPIC_API_KEY)
RESEND_API_KEY=$(_env RESEND_API_KEY)
FROM_EMAIL=$(_env FROM_EMAIL)
BOOKING_BASE=$(_env BOOKING_BASE)
APIFY_TOKEN_2=$(_env APIFY_TOKEN_2)
STRIPE_SECRET_KEY=$(_env STRIPE_SECRET_KEY)
STRIPE_WEBHOOK_SECRET=$(_env STRIPE_WEBHOOK_SECRET)
APP_URL=$(_env APP_URL)
INGEST_WEBHOOK_SECRET=$(_env INGEST_WEBHOOK_SECRET)

echo ""
echo "🚀 WebForge Deploy"
echo "=================="

# 1. Link
echo ""
echo "1/4 Linkeando proyecto..."
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN npx supabase link --project-ref khscikqchvjxyvoaruas 2>&1 | grep -v "^$" || true

# 2. Secrets (solo los que tienen valor)
echo ""
echo "2/4 Subiendo secrets..."
SECRETS_ARGS=""
SECRETS_ARGS+=" ANTHROPIC_API_KEY=\"$ANTHROPIC_API_KEY\""
SECRETS_ARGS+=" RESEND_API_KEY=\"$RESEND_API_KEY\""
SECRETS_ARGS+=" FROM_EMAIL=\"$FROM_EMAIL\""
SECRETS_ARGS+=" BOOKING_BASE=\"$BOOKING_BASE\""
[ -n "$APIFY_TOKEN_2" ]          && SECRETS_ARGS+=" APIFY_TOKEN_2=\"$APIFY_TOKEN_2\""
[ -n "$STRIPE_SECRET_KEY" ]      && SECRETS_ARGS+=" STRIPE_SECRET_KEY=\"$STRIPE_SECRET_KEY\""
[ -n "$STRIPE_WEBHOOK_SECRET" ]  && SECRETS_ARGS+=" STRIPE_WEBHOOK_SECRET=\"$STRIPE_WEBHOOK_SECRET\""
[ -n "$APP_URL" ]                && SECRETS_ARGS+=" APP_URL=\"$APP_URL\""
[ -n "$INGEST_WEBHOOK_SECRET" ]  && SECRETS_ARGS+=" INGEST_WEBHOOK_SECRET=\"$INGEST_WEBHOOK_SECRET\""

eval "SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN npx supabase secrets set $SECRETS_ARGS"
echo "   ✅ Secrets OK"

# 3. Deploy functions
echo ""
echo "3/4 Deployando Edge Functions..."
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN npx supabase functions deploy \
  get-booking-info \
  create-checkout \
  stripe-webhook \
  analyze-lead \
  analyze-site \
  generate-outreach \
  send-email \
  track-event \
  ingest-leads \
  run-scrape

# 4. Verificar
echo ""
echo "4/4 Verificando..."
RESP=$(curl -s --max-time 10 https://khscikqchvjxyvoaruas.supabase.co/functions/v1/get-booking-info || echo "sin respuesta")
echo "$RESP" | head -c 100
echo ""

if echo "$RESP" | grep -q "lead_id"; then
  echo ""
  echo "✅ Todo OK — backend vivo."
else
  echo ""
  echo "⚠️  Respuesta inesperada — revisa el dashboard de Supabase."
fi

echo ""
echo "Secrets pendientes de rellenar en .env:"
[ -z "$STRIPE_SECRET_KEY" ]     && echo "  ❌ STRIPE_SECRET_KEY"
[ -z "$STRIPE_WEBHOOK_SECRET" ] && echo "  ❌ STRIPE_WEBHOOK_SECRET"
[ -z "$APP_URL" ]               && echo "  ❌ APP_URL"
echo ""
