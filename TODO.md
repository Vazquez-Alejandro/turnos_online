# AgenPro — TODO de Producción

## Bugs corregidos (Audit 2026-08-01)
- [x] `change-plan/route.ts`: Fix column names (`turnos_limit` → `appointments_limit`)
- [x] `change-plan/route.ts`: Fix query by `key` instead of `name`
- [x] `appointments/route.ts`: Fix column name
- [x] `public-appointments/route.ts`: Fix column name
- [x] `types/index.ts`: Fix `turnos_limit` → `appointments_limit`
- [x] `RegisterContent.tsx`: Fix column name
- [x] `SettingsContent.tsx`: Fix column name

## Fixes aplicados (2026-08-02)
- [x] **vercel.json** — Creado para deploy en Vercel
- [x] **MercadoPago webhook** — Creado `/api/mercadopago-webhook`
- [x] **.env.example** — Agregadas variables faltantes (MP_WEBHOOK_SECRET, NEXT_PUBLIC_MERCADO_PAGO_KEY)

## Pendiente (tu parte)

### Crítico (antes de lanzar)
- [ ] **Configurar Stripe** — Reemplazar `your_stripe_secret_key` y `your_stripe_publishable_key` en Vercel
- [ ] **Configurar Twilio** — Reemplazar `your_twilio_account_sid` y `your_twilio_auth_token` en Vercel
- [ ] **Configurar NEXT_PUBLIC_ORIGIN** — Cambiar `localhost:3000` por `https://agenpro.vercel.app` en Vercel
- [ ] **Configurar MP_WEBHOOK_SECRET** — Agregar en Vercel dashboard
- [ ] **Configurar Stripe webhook** — Crear webhook en Stripe dashboard apuntando a `/api/stripe-webhook`

### Importante
- [ ] **Dominio Resend** — Verificar `agenpro.app` en Resend para emails
- [ ] **Rate limiting** — Usa Map en memoria (resetea en cold start). Considerar Upstash Redis

## Aplicado (2026-08-09)
- [x] **Validación server-side** — Creado `src/lib/booking-validation.ts` con `validateBookingSlot()` (formato, fecha pasada, tenant, servicio, fechas bloqueadas, disponibilidad, solapamiento). Integrado en `/api/public-appointments` y `/api/appointments`.
- [x] **cancel GET→POST** — `/api/cancel-appointment` ahora POST con admin client; creado `/api/appointment-summary` (GET por token, TTL 48h) y página pública `/cancelar`; link WhatsApp actualizado. Admin client en `/api/confirm-appointment`. Traducciones `cancelPage` es/en.
- [x] **`src/lib/supabase/admin.ts`** — `createAdminClient()` con service role.
- [x] **Schema consolidado** — `supabase/schema.sql` es la fuente única de verdad (9 tablas + seed), alineado con el código (plan_definitions con `key`/`price_monthly_cents`/`appointments_limit`/`staff_limit`, tenants con `filter_by_service`/`deposit_percent`/`default_cleaning_time`/`custom_fields`/`features`, índice único parcial anti doble-reserva). Eliminados los archivos divergentes `supabase-schema.sql` y `supabase/schema_production.sql`. `supabase/seed.sql` alineado. Migración `20250101000012_align_plans_and_slot_unique.sql` reconcilia plan_definitions de DBs existentes y agrega el índice único. `PlanDefinition` en types actualizado.
- [ ] **Lint limpio** — Pendiente de corregir (~30 errors/warnings: react-hooks immutability/set-state-in-effect, no-explicit-any, prefer-const, purity, unused).

### Marketing
- [ ] Crear post de lanzamiento para redes sociales
- [ ] Configurar Google Analytics / Umami
- [ ] Crear demo video walkthrough

### Técnico
- [ ] Add error tracking (Sentry)
- [ ] Add health check endpoint
- [ ] Add input validation/sanitization
