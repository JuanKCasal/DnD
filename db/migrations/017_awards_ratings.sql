-- =============================================================
-- DnD Community Manager — Fase CM6: Salón de la Fama
-- 017_awards_ratings.sql
-- Aplicar: python db/migrate.py 017_awards_ratings
-- Base: PLAN_MEJORAS_COMUNIDAD.md §CM6 (premios a personajes + valoración de DMs)
-- =============================================================

-- Premios / medallas otorgados por Admin/DM a personajes por sus proezas.
CREATE TABLE IF NOT EXISTS awards (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  campaign_id  UUID         REFERENCES campaigns(id) ON DELETE SET NULL,
  title        VARCHAR(120) NOT NULL,
  description  TEXT,
  icon         VARCHAR(10)  NOT NULL DEFAULT '🏅',
  rarity       VARCHAR(12)  NOT NULL DEFAULT 'rare',   -- common|uncommon|rare|very_rare|legendary
  awarded_by   UUID         REFERENCES members(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_awards_character ON awards(character_id);

-- Valoración del DM por los jugadores (una por jugador y campaña).
CREATE TABLE IF NOT EXISTS dm_ratings (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  dm_member_id       UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  campaign_id        UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  rater_member_id    UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  rater_character_id UUID        REFERENCES characters(id) ON DELETE SET NULL,
  stars              SMALLINT    NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, rater_member_id)
);
CREATE INDEX IF NOT EXISTS idx_dm_ratings_dm ON dm_ratings(dm_member_id);
