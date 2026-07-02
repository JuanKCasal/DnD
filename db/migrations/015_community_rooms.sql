-- =============================================================
-- DnD Community Manager — Fase CM2: salas globales de chat
-- 015_community_rooms.sql
-- Aplicar: python db/migrate.py 015_community_rooms   (DESPUÉS de 014)
-- Base: PLAN_MEJORAS_COMUNIDAD.md §CM2 (canales pedidos)
-- =============================================================

-- UPSERT de las salas globales requeridas. Usa los tipos añadidos en 014
-- (welcome/hall_of_fame/admin). Idempotente por slug.
INSERT INTO chat_rooms (name, slug, type, description, icon, is_readonly, is_ic, sort_order) VALUES
  ('Anuncios y Eventos', 'anuncios',        'announcements', 'Anuncios oficiales y eventos (solo administradores)', '📣', TRUE,  FALSE, 0),
  ('Saludos',            'saludos',         'welcome',       'El sistema saluda a nuevos miembros y personajes',      '👋', TRUE,  FALSE, 1),
  ('Público',            'general',         'general',       'Canal principal de la comunidad',                       '💬', FALSE, FALSE, 2),
  ('Administradores',    'administradores', 'admin',         'Canal privado del staff (admin/DM)',                    '🛡️', FALSE, FALSE, 3),
  ('Salón de la Fama',   'salon-fama',      'hall_of_fame',  'Proezas y logros de la comunidad',                      '🏆', TRUE,  FALSE, 4)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  type        = EXCLUDED.type,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  is_readonly = EXCLUDED.is_readonly,
  sort_order  = EXCLUDED.sort_order;
