-- =============================================================
-- DnD Community Manager — Fase C4: bitácora de sesión enriquecida
-- 010_session_log.sql
-- Aplicar: python db/migrate.py 010_session_log
-- Base: guides/dnd5e_campaigns_guide.md §15 (gestión de sesiones/bitácora)
-- =============================================================

-- Preparación y cierre (guía §15.1)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS prep_notes  TEXT;   -- notas privadas del DM (pre-sesión)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cliffhanger TEXT;   -- con qué quedó la cosa

-- Referencias tocadas durante la sesión (arrays de ids; guía §15.1)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS npcs_introduced   UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS locations_visited UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quests_advanced   UUID[] NOT NULL DEFAULT '{}';
