-- ============================================================
-- Alinea plan_definitions con el schema canónico (supabase/schema.sql)
-- y agrega el índice único parcial anti doble-reserva.
--
-- Motivo: migraciones anteriores crearon plan_definitions con
-- (id PK, name, max_turnos, max_staff, description), pero el código
-- (change-plan/route.ts, SettingsContent) consulta por `key` y usa
-- `appointments_limit` / `staff_limit`.
-- ============================================================

-- 1. Agregar columna `key` y poblar desde `name`
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS key TEXT;
UPDATE plan_definitions SET key = LOWER(name) WHERE key IS NULL OR key = '';

-- 2. Agregar columnas canónicas para los límites (si aún no existen)
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS appointments_limit INT NOT NULL DEFAULT 0;
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS staff_limit INT NOT NULL DEFAULT 1;
ALTER TABLE plan_definitions ADD COLUMN IF NOT EXISTS features TEXT[] NOT NULL DEFAULT '{}';

-- 3. Migrar datos desde las columnas viejas (solo si existen)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plan_definitions' AND column_name = 'max_turnos'
  ) THEN
    UPDATE plan_definitions SET appointments_limit = max_turnos WHERE appointments_limit = 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plan_definitions' AND column_name = 'max_staff'
  ) THEN
    UPDATE plan_definitions SET staff_limit = max_staff WHERE staff_limit = 1 AND max_staff IS DISTINCT FROM 1;
  END IF;
END $$;

-- 4. Hacer `key` único y PK (las filas antiguas con id PK se conservan via key)
DELETE FROM plan_definitions WHERE key IS NULL OR key = '';
CREATE UNIQUE INDEX IF NOT EXISTS plan_definitions_key_key ON plan_definitions(key);
ALTER TABLE plan_definitions DROP CONSTRAINT IF EXISTS plan_definitions_pkey;
ALTER TABLE plan_definitions ADD PRIMARY KEY (key);

-- 5. Limpiar columnas viejas (ya no usadas por el código)
ALTER TABLE plan_definitions DROP COLUMN IF EXISTS max_turnos;
ALTER TABLE plan_definitions DROP COLUMN IF EXISTS max_staff;

-- 6. Garantizar los tres planes canónicos
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

-- ============================================================
-- Índice único parcial anti doble-reserva
-- (backstop a nivel BD de la validación de solapamiento del server)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_slot_unique
  ON appointments(tenant_id, date, time)
  WHERE status <> 'cancelled';