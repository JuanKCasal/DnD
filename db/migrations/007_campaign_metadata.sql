-- =============================================================
-- DnD Community Manager — Fase C1: metadatos de campaña
-- 007_campaign_metadata.sql
-- Aplicar: python db/migrate.py 007_campaign_metadata
-- Base: guides/dnd5e_campaigns_guide.md §2 (metadatos) y §3 (reglas de mesa)
-- =============================================================

-- ── Estados de campaña (guía §2, máquina de estados) ──────────
-- Se añaden 'planning' (pre-lanzamiento) y 'on_hiatus' (pausa larga).
-- Nota: 'paused' se conserva por retrocompatibilidad; 'archived' cubre el
-- 'abandoned' de la guía. ADD VALUE es idempotente con IF NOT EXISTS.
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'planning';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'on_hiatus';

-- ── Metadatos de identidad y mesa (guía §2–§3) ────────────────
-- Todas aditivas con DEFAULT: no rompen filas existentes.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS subtitle          VARCHAR(200);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS tone              TEXT[]      NOT NULL DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS themes            TEXT[]      NOT NULL DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS start_level       SMALLINT    NOT NULL DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_level     SMALLINT    NOT NULL DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_end_level  SMALLINT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS session_frequency VARCHAR(20);           -- weekly|biweekly|monthly|irregular
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS leveling_method   VARCHAR(12) NOT NULL DEFAULT 'xp';        -- xp|milestone
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ruleset           VARCHAR(20) NOT NULL DEFAULT 'dnd_5e_2014'; -- dnd_5e_2014|dnd_5e_2024|dnd_5e_homebrew
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS house_rules       JSONB       NOT NULL DEFAULT '[]';  -- [{category,title,description,active}]
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS variant_rules     TEXT[]      NOT NULL DEFAULT '{}';  -- lista de reglas variantes activas
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS banner_image_url  TEXT;

-- ── Rangos de nivel válidos (guía §17 regla 3) ────────────────
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS chk_campaign_levels;
ALTER TABLE campaigns ADD CONSTRAINT chk_campaign_levels CHECK (
  start_level BETWEEN 1 AND 20
  AND current_level BETWEEN 1 AND 20
  AND current_level >= start_level
  AND (target_end_level IS NULL OR (target_end_level BETWEEN 1 AND 20 AND target_end_level >= current_level))
);
