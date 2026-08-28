# AgenPro

Sistema de reserva de turnos online para negocios. Multi-tenant, con pagos integrados, WhatsApp notifications y panel de administración completo.

## Features

### 📅 Reserva Online
- **Flujo de reserva en 4 pasos** — calendario → formulario → pago → confirmación
- **Selección de servicio** — duración, precio, tiempo de limpieza
- **Slots de tiempo dinámicos** — generados desde configuración de disponibilidad
- **Turnos recurrentes** — reserva semanal con fecha de fin configurable
- **Tiempo de limpieza** — buffer configurable entre turnos (global o por servicio)
- **Fechas bloqueadas** — bloquear días específicos (feriados, capacitaciones, etc.)

### 🏢 Multi-Tenant
- **Arquitectura tenant-per-slug** — cada negocio tiene su URL única (`/[slug]`)
- **Branding personalizado** — logo (upload a Supabase Storage), color primario, nombre
- **Detección automática** — desde URL o sesión de usuario
- **Row Level Security (RLS)** — aislamiento completo de datos entre tenants

### 💳 Pagos
- **Stripe** — PaymentIntent, formulario con Stripe Elements, webhook verification
- **Mercado Pago** — checkout preference, redirect flow, verificación de pago
- **Doble método** — selección entre tarjeta y MP en el formulario de pago
- **Verificación dual** — confirma pago en ambas APIs antes de crear el turno

### 🔔 Notificaciones
- **WhatsApp vía Twilio** — confirmación de reserva, recordatorios
- **Email vía Resend** — recordatorios 24h antes del turno
- **WhatsApp recordatorios** — 24h antes + 1h antes
- **Links de confirmación/cancelación** — tokens con TTL de 48h en WhatsApp
- **Waitlist** — notifica cuando se libera un slot con 24h+ de anticipación

### 📋 Planes de Suscripción
- **3 planes:** Free (30 turnos, 1 staff), Pro ($12/mes, 200 turnos, 3 staff), Premium ($29/mes, ilimitado)
- **Feature gating por plan** — blacklist, tiempo de limpieza, depósito obligatorio, no-show tracking
- **Upgrade/downgrade** — downgrade inmediato, upgrade con flujo de pago
- **Límites mensuales** — enforcement al crear turnos
- **Límite de staff** — por plan

### 🖥 Panel de Administración
- **Dashboard** — tarjetas de stats (turnos totales, hoy, miembros, fechas bloqueadas)
- **Agenda semanal** — vista por día, turnos de hoy, ingresos mensuales
- **Gestión de servicios** — CRUD con nombre, duración, precio, tiempo de limpieza, toggle activo
- **Configuración de disponibilidad** — horario por día de semana, duración de slots, filtrado por servicio
- **Fechas bloqueadas** — date picker + razón, paginación
- **Blacklist de clientes** — bloquear por teléfono/email con razón
- **Gestión de staff** — agregar/remover miembros con roles owner/admin/staff
- **Configuración** — nombre, logo, slug, color, plan, features, campos custom, % depósito
- **Analytics** — turnos totales/mensuales, ingresos, clientes únicos, slots top, tasa cancelación, gráfico 7 días

### 👤 Portal del Cliente
- **Dashboard del cliente** — vista lista/calendario de sus turnos
- **Cancelación** — desde el dashboard
- **Turnos recurrentes** — visualización con fecha de fin
- **Registro de clientes** — con campos custom (soporta text, number, date, tel, required)

### 🔐 Seguridad
- **Rate limiting** — IP-based para público, user-based para autenticados
- **Blacklist checking** — al crear turnos (teléfono + email)
- **Verificación de pago** — antes de crear turno
- **Token de confirmación** — TTL de 48h para confirmar/cancelar
- **RLS policies** — en todas las tablas de la base de datos

### 🌐 i18n & UX
- **Español e Inglés** — sistema completo de traducciones
- **Dark/Light theme** — toggle persistido en localStorage
- **Responsive** — mobile-first, sidebar colapsa a hamburger
- **Toast notifications** — success, error, info
- **Skeleton loading** — estados de carga en dashboard y turnos
- **Diseño gold/amber** — efectos de gradiente

### 📱 Infraestructura
- **Supabase Edge Functions** — jobs de recordatorios (email + WhatsApp)
- **Cron jobs** — configuración automatizada
- **Sitemap** — generación automática
- **SEO metadata** — OpenGraph tags por página
- **Vercel deployment** — listo para producir

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Framework** | Next.js 16.2.6 (App Router) |
| **Lenguaje** | TypeScript 5 |
| **UI** | React 19, Tailwind CSS 4 |
| **Base de datos** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (email/password) |
| **Pagos** | Stripe + Mercado Pago |
| **Email** | Resend (vía Edge Functions) |
| **WhatsApp** | Twilio API |
| **Fechas** | date-fns 4.2 |
| **Testing** | Vitest, Testing Library |
| **Deploy** | Vercel, Supabase Edge Functions |

## Rutas

### Públicas
| Ruta | Descripción |
|------|-------------|
| `/` | Landing page |
| `/turno` | Reserva global (calendario → formulario → pago → confirmación) |
| `/reservar` | Reserva autenticada (con recurrente + notas) |
| `/login` | Login con reset de contraseña |
| `/register` | Registro de negocio (crea tenant + cuenta) |
| `/register-client` | Registro de cliente (con campos custom) |
| `/dashboard` | Dashboard del cliente — turnos |
| `/[slug]` | Página pública de reserva del tenant (branded) |

### Admin (requiere `is_admin`)
| Ruta | Descripción |
|------|-------------|
| `/admin` | Dashboard con stats |
| `/admin/agenda` | Agenda semanal + turnos de hoy + ingresos |
| `/admin/services` | CRUD de servicios |
| `/admin/availability` | Configuración de disponibilidad semanal |
| `/admin/blocked-dates` | Gestión de fechas bloqueadas |
| `/admin/blacklist` | Blacklist de clientes |
| `/admin/staff` | Gestión de equipo |
| `/admin/settings` | Configuración del negocio |
| `/admin/analytics` | Analytics detallados |

### API
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/appointments` | Crear turno (autenticado, rate limited) |
| POST | `/api/public-appointments` | Crear turno (público, con verificación de pago) |
| POST | `/api/create-payment-intent` | Crear Stripe PaymentIntent |
| POST | `/api/stripe-webhook` | Webhook Stripe |
| POST | `/api/mercadopago-preference` | Crear preferencia MercadoPago |
| GET | `/api/appointment-summary` | Resumen del turno vía token (página pública/cancelar) |
| POST | `/api/confirm-appointment` | Confirmar turno vía token |
| POST | `/api/cancel-appointment` | Cancelar turno vía token (token en body) |
| POST | `/api/change-plan` | Cambiar plan de suscripción |
| POST | `/api/waitlist` | Agregar a waitlist |

## Base de Datos (9 tablas + seed)

> **Fuente de verdad:** `supabase/schema.sql` (esquema canónico) + `supabase/seed.sql`.
> Para bases existentes se aplican las migraciones en `supabase/migrations/` en orden.

| Tabla | Propósito |
|-------|-----------|
| `tenants` | Entidades de negocio — nombre, slug, logo, color, suscripción, límites, features, campos custom, % depósito |
| `profiles` | Perfiles de usuario vinculados a tenants — rol (owner/admin/staff/client), is_admin, dni, custom_data |
| `services` | Servicios reservables — nombre, duración, precio, tiempo de limpieza, toggle activo |
| `availability` | Horario semanal por tenant+service — día, habilitado, hora inicio/fin, duración slot |
| `blocked_dates` | Fechas no disponibles — fecha, razón |
| `appointments` | Reservas — fecha, hora, estado, pago, info cliente, servicio, notas, recurrente, token confirmación |
| `plan_definitions` | Configuración de planes — key, nombre, precio cents, límite turnos, límite staff, features |
| `client_blacklist` | Clientes bloqueados por teléfono/email por tenant |
| `waitlist` | Lista de espera para slots no disponibles |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Variables de Entorno

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook secret
- `MERCADO_PAGO_ACCESS_TOKEN` — Mercado Pago access token
- `NEXT_PUBLIC_MERCADO_PAGO_KEY` — Mercado Pago public key
- `TWILIO_ACCOUNT_SID` — Twilio account SID
- `TWILIO_AUTH_TOKEN` — Twilio auth token
- `TWILIO_WHATSAPP_NUMBER` — Twilio WhatsApp number
- `RESEND_API_KEY` — Resend API key
- `EMAIL_FROM` — Sender email address

## Deploy

```bash
# Build
npm run build

# Deploy to Vercel
vercel --prod

# Deploy Supabase Edge Functions
supabase functions deploy

# Setup cron jobs (run in Supabase SQL Editor)
# See supabase/cron-setup.sql
```

## License

Private
