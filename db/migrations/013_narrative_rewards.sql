-- =============================================================
-- DnD Community Manager — Fase C7: arcos, giros y recompensas
-- 013_narrative_rewards.sql
-- Aplicar: python db/migrate.py 013_narrative_rewards
-- Base: guides/dnd5e_campaigns_guide.md §7 (arcos/giros), §13 (recompensas)
-- =============================================================

-- Arcos argumentales (guía §7.2)
CREATE TABLE IF NOT EXISTS story_arcs (
  id                 UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id        UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title              VARCHAR(200) NOT NULL,
  description        TEXT,
  arc_type           VARCHAR(12)  NOT NULL DEFAULT 'main',   -- main|side|character|faction
  status             VARCHAR(14)  NOT NULL DEFAULT 'active',  -- not_started|active|resolved|failed|abandoned
  beats              JSONB        NOT NULL DEFAULT '[]',       -- [{title, description, completed}]
  visible_to_players BOOLEAN      NOT NULL DEFAULT TRUE,
  notes              TEXT,                                     -- DM-only
  sort_order         SMALLINT     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_story_arcs_campaign ON story_arcs(campaign_id);

-- Giros argumentales (guía §7.3) — dm_only por defecto hasta revelarse
CREATE TABLE IF NOT EXISTS plot_twists (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id      UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  arc_id           UUID         REFERENCES story_arcs(id) ON DELETE SET NULL,
  title            VARCHAR(200) NOT NULL,
  description      TEXT,                                    -- el giro en sí (dm_only)
  setup_clues      TEXT[]       NOT NULL DEFAULT '{}',       -- pistas sembradas
  reveal_condition TEXT,
  revealed         BOOLEAN      NOT NULL DEFAULT FALSE,
  impact           TEXT,                                    -- consecuencias narrativas
  dm_only          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plot_twists_campaign ON plot_twists(campaign_id);
