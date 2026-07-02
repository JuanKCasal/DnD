-- =============================================================
-- DnD Community Manager — Fase C6: rastreador de combate en vivo
-- 012_combat_tracker.sql
-- Aplicar: python db/migrate.py 012_combat_tracker
-- Base: guides/dnd5e_campaigns_guide.md §15.3–§15.4 (initiative/combat tracker)
-- =============================================================

-- Un rastreador por encuentro (guía §15.3)
CREATE TABLE IF NOT EXISTS combat_trackers (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  encounter_id       UUID        NOT NULL UNIQUE REFERENCES encounters(id) ON DELETE CASCADE,
  campaign_id        UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  round              SMALLINT    NOT NULL DEFAULT 1,
  current_turn_index SMALLINT    NOT NULL DEFAULT 0,
  active             BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Combatientes: una entrada de iniciativa por combatiente (guía §17 regla 7).
-- HP no negativo se aplica en el backend (guía §17 regla 6). Concentración única (regla 8).
CREATE TABLE IF NOT EXISTS combatants (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracker_id           UUID        NOT NULL REFERENCES combat_trackers(id) ON DELETE CASCADE,
  name                 VARCHAR(120) NOT NULL,
  combatant_type       VARCHAR(10)  NOT NULL DEFAULT 'monster',  -- pc|npc|monster
  reference_id         UUID,                                     -- character_id o stat_block_id
  initiative           SMALLINT     NOT NULL DEFAULT 0,
  initiative_tiebreak  SMALLINT     NOT NULL DEFAULT 0,          -- mod DES para desempate (guía §15.4)
  max_hp               SMALLINT,
  current_hp           SMALLINT,
  temp_hp              SMALLINT     NOT NULL DEFAULT 0,
  armor_class          SMALLINT,
  conditions           TEXT[]       NOT NULL DEFAULT '{}',       -- 14 condiciones (guía §10.4)
  exhaustion           SMALLINT     NOT NULL DEFAULT 0,          -- 0–6 (guía §10.5)
  concentration        VARCHAR(120),                            -- hechizo de concentración activo
  is_dead              BOOLEAN      NOT NULL DEFAULT FALSE,
  notes                TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_combatants_tracker ON combatants(tracker_id);
