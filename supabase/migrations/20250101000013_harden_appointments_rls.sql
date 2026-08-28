-- ============================================================
-- SECURITY HARDENING: appointments RLS
-- ------------------------------------------------------------
-- Cierra las brechas donde la RLS permitia escrituras directas
-- a la tabla appointments saltando la validacion del servidor
-- (rate limit, pago, blacklist, limites de plan, solapamiento).
--
-- 1. INSERT autenticado: el usuario SOLO puede crear turnos en su
--    propio tenant y con su propio user_id (antes: cualquier tenant).
-- 2. INSERT anonimo: SE ELIMINA. El flujo publico legitimo pasa por
--    /api/public-appointments que inserta con service role tras
--    validar server-side. La key anon ya no puede escribir turnos
--    confirmados directamente a la BD.
-- 3. UPDATE: se agrega WITH CHECK (mismas condiciones que USING).
-- ============================================================

-- 1. Autenticado: scope por tenant + propio user
DROP POLICY IF EXISTS "Authenticated users can create appointments" ON appointments;
DROP POLICY IF EXISTS "Users can create appointments" ON appointments;
CREATE POLICY "Owners can only create appointments in their tenant"
  ON appointments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.tenant_id = appointments.tenant_id
    )
  );

-- 2. Anonimo: se cierra por completo.
DROP POLICY IF EXISTS "Public can create confirmed appointments" ON appointments;

-- 3. UPDATE: agregar WITH CHECK (mismas condiciones que USING)
DROP POLICY IF EXISTS "Users can update own appointments" ON appointments;
CREATE POLICY "Tenant members can update own-tenant appointments"
  ON appointments FOR UPDATE
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = appointments.tenant_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = appointments.tenant_id)
  );
