-- Seed plan definitions (formato canónico: ver supabase/schema.sql)
INSERT INTO plan_definitions (key, name, price_monthly_cents, appointments_limit, staff_limit, features)
VALUES
  ('free',     'Gratuito', 0,     30,    1,    ARRAY['30 turnos/mes', '1 usuario', 'Agenda básica']),
  ('pro',      'Pro',      1200,  200,   3,    ARRAY['200 turnos/mes', '3 usuarios', 'Alertas y funciones avanzadas']),
  ('premium',  'Premium',  2900,  999999, 999,  ARRAY['Ilimitado', 'WhatsApp', 'Recordatorios', 'Depósito'])
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  appointments_limit = EXCLUDED.appointments_limit,
  staff_limit = EXCLUDED.staff_limit,
  features = EXCLUDED.features;