-- =============================================================
-- DnD Community Manager — Fase CM1: identidad de personaje + clanes por personaje
-- 014_community_identity.sql
-- Aplicar: python db/migrate.py 014_community_identity
-- Base: PLAN_MEJORAS_COMUNIDAD.md §CM1 (D1 identidad = personaje activo, D2 clan por personaje)
-- =============================================================

-- Nuevos tipos de sala de chat (Saludos, Salón de la Fama, Administradores).
-- ADD VALUE no es transaccional: se ejecuta como sentencias sueltas (runner OK).
ALTER TYPE chat_room_type ADD VALUE IF NOT EXISTS 'welcome';
ALTER TYPE chat_room_type ADD VALUE IF NOT EXISTS 'hall_of_fame';
ALTER TYPE chat_room_type ADD VALUE IF NOT EXISTS 'admin';

-- Membresía de clan a nivel de PERSONAJE (D2). clan_members (por miembro) se
-- conserva para propiedad/liderazgo del jugador y compatibilidad de clans.py.
CREATE TABLE IF NOT EXISTS clan_characters (
  clan_id      UUID        NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  character_id UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  clan_role    clan_role   NOT NULL DEFAULT 'member',
  title        VARCHAR(80),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (clan_id, character_id)
);
CREATE INDEX IF NOT EXISTS idx_clan_characters_char ON clan_characters(character_id);

-- Migración de datos: por cada membresía de miembro, asignar su personaje
-- activo (o el más antiguo si no hay activo). Idempotente.
INSERT INTO clan_characters (clan_id, character_id, clan_role, title, joined_at)
SELECT cm.clan_id, ch.id, cm.clan_role, cm.title, cm.joined_at
FROM clan_members cm
JOIN LATERAL (
  SELECT c.id
  FROM characters c
  WHERE c.member_id = cm.member_id AND c.active = TRUE
  ORDER BY (c.id = (SELECT m.active_character_id FROM members m WHERE m.id = cm.member_id)) DESC,
           c.created_at ASC
  LIMIT 1
) ch ON TRUE
ON CONFLICT DO NOTHING;
