-- =============================================================
-- DnD Community Manager — Fase C5: bestiario, encuentros y balanceo
-- 011_bestiary_encounters.sql
-- Aplicar: python db/migrate.py 011_bestiary_encounters
-- Base: guides/dnd5e_campaigns_guide.md §10 (stat blocks), §11 (encuentros), §12 (balanceo)
-- =============================================================

-- ── Bestiario (guía §10.1) ────────────────────────────────────
-- campaign_id NULL = monstruo global (SRD); no NULL = homebrew de la campaña.
CREATE TABLE IF NOT EXISTS stat_blocks (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id        UUID          REFERENCES campaigns(id) ON DELETE CASCADE,
  name               VARCHAR(120)  NOT NULL,
  size               VARCHAR(12),                        -- tiny|small|medium|large|huge|gargantuan
  creature_type      VARCHAR(20),                        -- humanoid|beast|dragon|...
  subtype            VARCHAR(60),
  alignment          VARCHAR(40),
  armor_class        SMALLINT,
  armor_class_note   VARCHAR(60),
  hit_points         SMALLINT,
  hit_dice           VARCHAR(30),
  speed              JSONB         NOT NULL DEFAULT '{}',   -- {walk,fly,swim,climb,burrow}
  abilities          JSONB         NOT NULL DEFAULT '{}',   -- {STR,DEX,CON,INT,WIS,CHA}
  saving_throws      JSONB         NOT NULL DEFAULT '{}',
  skills             JSONB         NOT NULL DEFAULT '{}',
  senses             JSONB         NOT NULL DEFAULT '{}',
  languages          VARCHAR(200),
  damage_tags        JSONB         NOT NULL DEFAULT '{}',   -- {vulnerabilities,resistances,immunities,condition_immunities}
  challenge_rating   NUMERIC(4,3)  NOT NULL DEFAULT 0,      -- soporta 0.125, 0.25, 0.5
  xp_value           INTEGER       NOT NULL DEFAULT 0,
  proficiency_bonus  SMALLINT,
  traits             JSONB         NOT NULL DEFAULT '[]',   -- [{name,description}]
  actions            JSONB         NOT NULL DEFAULT '[]',
  legendary_actions  JSONB         NOT NULL DEFAULT '[]',
  reactions          JSONB         NOT NULL DEFAULT '[]',
  description        TEXT,
  source             VARCHAR(60),
  is_homebrew        BOOLEAN       NOT NULL DEFAULT TRUE,
  dnd5eapi_index     VARCHAR(80) UNIQUE,                    -- idempotencia del seed
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stat_blocks_campaign ON stat_blocks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_stat_blocks_cr ON stat_blocks(challenge_rating);

-- ── Encuentros (guía §11.2) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS encounters (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id        UUID          NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  session_id         UUID          REFERENCES sessions(id) ON DELETE SET NULL,
  location_id        UUID          REFERENCES locations(id) ON DELETE SET NULL,
  name               VARCHAR(150)  NOT NULL,
  encounter_type     VARCHAR(16)   NOT NULL DEFAULT 'combat',  -- combat|social|exploration|puzzle|trap|hazard|chase|rest
  description        TEXT,
  difficulty         VARCHAR(10),                              -- derivada (trivial..deadly)
  party_size         SMALLINT      NOT NULL DEFAULT 4,
  party_level        SMALLINT      NOT NULL DEFAULT 1,
  terrain_features   TEXT,
  status             VARCHAR(12)   NOT NULL DEFAULT 'planned',  -- planned|active|completed|skipped
  dm_notes           TEXT,
  visible_to_players BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_encounters_campaign ON encounters(campaign_id);

-- ── Monstruos del encuentro (puente; guía §11.2) ──────────────
CREATE TABLE IF NOT EXISTS encounter_monsters (
  id             UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
  encounter_id   UUID     NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  stat_block_id  UUID     REFERENCES stat_blocks(id) ON DELETE SET NULL,
  name_override  VARCHAR(120),
  quantity       SMALLINT NOT NULL DEFAULT 1,
  xp_each        INTEGER  NOT NULL DEFAULT 0    -- snapshot para el cálculo de dificultad
);
CREATE INDEX IF NOT EXISTS idx_encounter_monsters_enc ON encounter_monsters(encounter_id);
