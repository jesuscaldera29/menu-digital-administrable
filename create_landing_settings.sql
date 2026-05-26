-- ============================================================
-- TABLA DE CONFIGURACIÓN DE IMÁGENES DE LA LANDING PAGE
-- Ejecuta esto en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS landing_settings (
  id INT PRIMARY KEY DEFAULT 1,
  hero_image_url TEXT DEFAULT 'img/hero_showcase.png',
  admin_image_url TEXT DEFAULT 'img/dashboard_preview.png',
  mobile_image_url TEXT DEFAULT 'img/mobile_order.png',
  qr_image_url TEXT DEFAULT 'img/qr_table.png',
  fb_pixel_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_row CHECK (id = 1)
);

-- Insertar fila única por defecto
INSERT INTO landing_settings (id, hero_image_url, admin_image_url, mobile_image_url, qr_image_url, fb_pixel_id)
VALUES (1, 'img/hero_showcase.png', 'img/dashboard_preview.png', 'img/mobile_order.png', 'img/qr_table.png', '')
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS
ALTER TABLE landing_settings ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública a cualquiera
DROP POLICY IF EXISTS "anyone_read_landing_settings" ON landing_settings;
CREATE POLICY "anyone_read_landing_settings" ON landing_settings 
  FOR SELECT USING (true);

-- Permitir al SUPER ADMIN modificar todo
DROP POLICY IF EXISTS "super_admin_manage_landing_settings" ON landing_settings;
CREATE POLICY "super_admin_manage_landing_settings" ON landing_settings 
  FOR ALL 
  USING (auth.jwt() ->> 'email' = 'jesuscaldera2000@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'jesuscaldera2000@gmail.com');
