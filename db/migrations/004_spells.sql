-- =============================================================
-- DnD Community Manager — Fase H1: Sistema de Hechizos
-- 004_spells.sql
-- Aplicar: python db/migrate.py 004_spells
--     o:   psql "$DATABASE_URL" -f db/migrations/004_spells.sql
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- ENUM: escuelas de magia (documento §11)
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'spell_school') THEN
    CREATE TYPE spell_school AS ENUM (
      'abjuration','conjuration','divination','enchantment',
      'evocation','illusion','necromancy','transmutation'
    );
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────
-- TABLA: spells (catálogo global de la comunidad)
-- Anatomía completa del hechizo (documento §5, §10, §16)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spells (
  id                     UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                   VARCHAR(200) NOT NULL,            -- nombre display (español)
  name_en                VARCHAR(200),                     -- nombre inglés (matching SRD)
  level                  SMALLINT     NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 9),  -- 0 = truco
  school                 spell_school NOT NULL DEFAULT 'evocation',

  -- Ejecución
  casting_time           VARCHAR(60)  NOT NULL DEFAULT '1 acción',
  casting_time_type      VARCHAR(20),                      -- action|bonus_action|reaction|minutes|hours
  range_text             VARCHAR(60)  NOT NULL DEFAULT 'Toque',
  range_type             VARCHAR(20),                      -- self|touch|ranged|sight|unlimited
  range_feet             INTEGER,

  -- Componentes (documento §6)
  comp_verbal            BOOLEAN      NOT NULL DEFAULT FALSE,
  comp_somatic           BOOLEAN      NOT NULL DEFAULT FALSE,
  comp_material          BOOLEAN      NOT NULL DEFAULT FALSE,
  material_description    TEXT,
  material_cost_gp        NUMERIC(12,2),                   -- coste en oro si aplica (H6: consumo)
  material_consumed       BOOLEAN      NOT NULL DEFAULT FALSE,

  duration               VARCHAR(80)  NOT NULL DEFAULT 'Instantáneo',
  concentration          BOOLEAN      NOT NULL DEFAULT FALSE,
  ritual                 BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Contenido
  description            TEXT         NOT NULL DEFAULT '',
  higher_levels          TEXT,                             -- texto de upcasting (documento §9)

  -- Resolución (documento §10)
  requires_attack_roll   BOOLEAN      NOT NULL DEFAULT FALSE,
  saving_throw           VARCHAR(3),                       -- STR|DEX|CON|INT|WIS|CHA
  damage_dice            VARCHAR(20),                      -- "8d6"
  damage_type            VARCHAR(20),                      -- fire|cold|...
  damage_scaling         VARCHAR(120),                     -- "+1d6 por nivel sobre 3"

  -- Disponibilidad por clase (fuente de verdad de "quién puede aprenderlo")
  classes                TEXT[]       NOT NULL DEFAULT '{}',  -- ['wizard','sorcerer',...]

  -- Referencia SRD
  source_book            VARCHAR(10)  DEFAULT 'PHB',
  source_page            INTEGER,
  dnd5eapi_index         TEXT,                             -- índice único para seed idempotente
  open5e_key             TEXT,

  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_spells_dnd5eapi ON spells(dnd5eapi_index) WHERE dnd5eapi_index IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_spells_level   ON spells(level);
CREATE INDEX IF NOT EXISTS idx_spells_school  ON spells(school);
CREATE INDEX IF NOT EXISTS idx_spells_classes ON spells USING GIN (classes);

-- ─────────────────────────────────────────────────────────────
-- TABLA: character_spells (repertorio del personaje)
-- Reemplaza el JSONB libre characters.spells_known (documento §12)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS character_spells (
  character_id     UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  spell_id         UUID        NOT NULL REFERENCES spells(id) ON DELETE CASCADE,
  is_prepared      BOOLEAN     NOT NULL DEFAULT FALSE,   -- modelo "preparado"
  is_always_known  BOOLEAN     NOT NULL DEFAULT FALSE,   -- dominio/subclase: no cuenta al límite
  source           VARCHAR(20) NOT NULL DEFAULT 'class', -- class|subclass|race|feat|item
  notes            TEXT,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (character_id, spell_id)
);

CREATE INDEX IF NOT EXISTS idx_character_spells_char  ON character_spells(character_id);
CREATE INDEX IF NOT EXISTS idx_character_spells_spell ON character_spells(spell_id);
