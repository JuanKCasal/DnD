-- =============================================================
-- DnD Community Manager — Fase C2: Aventuras/Arcos + Misiones
-- 008_adventures.sql
-- Aplicar: python db/migrate.py 008_adventures
-- Base: guides/dnd5e_campaigns_guide.md §1 (jerarquía), §7.4 (quests)
-- =============================================================

-- ── Aventuras / Arcos (guía §1, §16) ──────────────────────────
-- Nivel narrativo entre campaña y sesión. status/source como VARCHAR
-- validado en Pydantic (coherente con C1: leveling_method, ruleset).
CREATE TABLE IF NOT EXISTS adventures (
  id                 UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id        UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title              VARCHAR(200) NOT NULL,
  description        TEXT,
  sort_order         SMALLINT     NOT NULL DEFAULT 0,   -- posición en la campaña
  source             VARCHAR(12)  NOT NULL DEFAULT 'homebrew',    -- official|homebrew
  module_name        VARCHAR(200),                                -- si es un módulo publicado
  status             VARCHAR(16)  NOT NULL DEFAULT 'not_started', -- not_started|active|completed|abandoned
  rec_level_min      SMALLINT,
  rec_level_max      SMALLINT,
  visible_to_players BOOLEAN      NOT NULL DEFAULT TRUE,
  dm_notes           TEXT,                                        -- solo DM (guía §5.1)
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_adventure_levels CHECK (
    (rec_level_min IS NULL OR rec_level_min BETWEEN 1 AND 20)
    AND (rec_level_max IS NULL OR rec_level_max BETWEEN 1 AND 20)
    AND (rec_level_min IS NULL OR rec_level_max IS NULL OR rec_level_max >= rec_level_min)
  )
);
CREATE INDEX IF NOT EXISTS idx_adventures_campaign ON adventures(campaign_id);

-- ── Enlaces a la jerarquía ────────────────────────────────────
-- Sesión pertenece (opcionalmente) a una aventura (guía §1).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS adventure_id UUID REFERENCES adventures(id) ON DELETE SET NULL;

-- ── Misiones (quests) — exponer y enriquecer la tabla existente ─
-- La tabla `quests` ya existe (001) con objectives JSONB [{text,completed}].
-- Se añaden: agrupación por aventura, tipo y visibilidad para jugadores.
ALTER TABLE quests ADD COLUMN IF NOT EXISTS adventure_id       UUID        REFERENCES adventures(id) ON DELETE SET NULL;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS quest_type         VARCHAR(16) NOT NULL DEFAULT 'side';  -- main|side|personal|faction|fetch|escort|bounty
ALTER TABLE quests ADD COLUMN IF NOT EXISTS visible_to_players BOOLEAN     NOT NULL DEFAULT TRUE;     -- guía §17 regla 4
