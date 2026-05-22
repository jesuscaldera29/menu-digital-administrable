-- ============================================================
-- ACTUALIZACIÓN DE PEDIDOS (EJECUTAR EN SUPABASE SQL EDITOR)
-- ============================================================

-- 1. Agregar columna status a la tabla orders si no existe
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pendiente';

-- 2. Asegurar que las órdenes existentes no tengan estado nulo
UPDATE orders SET status = 'Pendiente' WHERE status IS NULL;

-- 3. Crear política para permitir actualización de pedidos (necesario para cambiar el estado)
DROP POLICY IF EXISTS "update_orders" ON orders;
CREATE POLICY "update_orders" ON orders FOR UPDATE USING (true);
