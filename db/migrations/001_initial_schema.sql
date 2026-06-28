-- =============================================================
-- DnD Community Manager — Schema v2.0
-- 001_initial_schema.sql
-- Aplicar: psql "$DATABASE_URL" -f db/migrations/001_initial_schema.sql
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────

CREATE TYPE member_role      AS ENUM ('admin', 'dm', 'player');
CREATE TYPE clan_role        AS ENUM ('leader', 'officer', 'veteran', 'member', 'initiate');
CREATE TYPE campaign_status  AS ENUM ('active', 'paused', 'completed', 'archived');
CREATE TYPE quest_status     AS ENUM ('active', 'completed', 'failed', 'abandoned');
CREATE TYPE location_type    AS ENUM ('city', 'dungeon', 'wilderness', 'plane', 'region', 'poi');
CREATE TYPE npc_relationship AS ENUM ('ally', 'enemy', 'neutral', 'unknown');
CREATE TYPE alignment_type   AS ENUM ('LG','NG','CG','LN','TN','CN','LE','NE','CE');
CREATE TYPE invite_status    AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE item_type        AS ENUM (
  'weapon','armor','potion','spell_scroll','ring','rod','staff','wand',
  'wondrous','tool','ammunition','gear','treasure','vehicle','other'
);
CREATE TYPE item_rarity      AS ENUM ('common','uncommon','rare','very_rare','legendary','artifact');
CREATE TYPE chat_room_type   AS ENUM ('general','clan','rank','campaign','dm_channel','ooc','announcements');
CREATE TYPE message_type     AS ENUM ('ic','ooc','dice','emote','system','whisper');
CREATE TYPE dm_message_type  AS ENUM ('ic','ooc','whisper');

-- ─────────────────────────────────────────────────────────────
-- RANKS (debe existir antes de members)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE ranks (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(80) NOT NULL UNIQUE,
  slug          VARCHAR(80) NOT NULL UNIQUE,
  description   TEXT,
  color_hex     CHAR(7)     NOT NULL DEFAULT '#7D7468',
  icon_url      TEXT,
  level         SMALLINT    NOT NULL DEFAULT 0,
  permissions   JSONB       NOT NULL DEFAULT '{"can_post":true,"can_dm":true,"can_create_character":true}',
  xp_threshold  INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- MEMBERS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE members (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  username            VARCHAR(50)   NOT NULL UNIQUE,
  email               VARCHAR(255)  NOT NULL UNIQUE,
  password_hash       TEXT          NOT NULL,
  display_name        VARCHAR(80),
  avatar_url          TEXT,
  discord_handle      VARCHAR(100),
  discord_id          VARCHAR(50),
  role                member_role   NOT NULL DEFAULT 'player',
  rank_id             UUID          REFERENCES ranks(id) ON DELETE SET NULL,
  bio                 TEXT,
  timezone            VARCHAR(50)   DEFAULT 'UTC',
  active_character_id UUID,                             -- FK añadida tras characters
  active              BOOLEAN       NOT NULL DEFAULT TRUE,
  last_seen_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE member_xp (
  member_id         UUID    PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  total_xp          INTEGER NOT NULL DEFAULT 0,
  sessions_attended INTEGER NOT NULL DEFAULT 0,
  messages_sent     INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- CLANS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE clans (
  id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(100)   NOT NULL UNIQUE,
  slug              VARCHAR(100)   NOT NULL UNIQUE,
  description       TEXT,
  motto             VARCHAR(200),
  emblem_url        TEXT,
  color_hex         CHAR(7)        NOT NULL DEFAULT '#C9A84C',
  alignment         alignment_type,
  leader_member_id  UUID           REFERENCES members(id) ON DELETE SET NULL,
  is_public         BOOLEAN        NOT NULL DEFAULT TRUE,
  requires_approval BOOLEAN        NOT NULL DEFAULT FALSE,
  max_members       SMALLINT,
  lore              TEXT,
  active            BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE clan_members (
  clan_id           UUID       NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  member_id         UUID       NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  clan_role         clan_role  NOT NULL DEFAULT 'member',
  title             VARCHAR(80),
  contribution_pts  INTEGER    NOT NULL DEFAULT 0,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by       UUID       REFERENCES members(id) ON DELETE SET NULL,
  PRIMARY KEY (clan_id, member_id)
);

CREATE TABLE clan_invitations (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  clan_id           UUID          NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  invited_member_id UUID          NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  invited_by        UUID          NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status            invite_status NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────
-- CAMPAIGNS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE campaigns (
  id              UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100)     NOT NULL,
  slug            VARCHAR(100)     NOT NULL UNIQUE,
  dm_id           UUID             NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  system          VARCHAR(50)      NOT NULL DEFAULT 'D&D 5e',
  status          campaign_status  NOT NULL DEFAULT 'active',
  description     TEXT,
  lore            TEXT,
  cover_image_url TEXT,
  is_public       BOOLEAN          NOT NULL DEFAULT FALSE,
  world_name      VARCHAR(100),
  setting         VARCHAR(100),
  start_date      DATE,
  end_date        DATE,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE TABLE campaign_members (
  campaign_id UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  member_id   UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, member_id)
);

-- ─────────────────────────────────────────────────────────────
-- CHARACTERS (completo D&D 5e)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE characters (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id             UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  campaign_id           UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Identidad
  name                  VARCHAR(100) NOT NULL,
  portrait_url          TEXT,
  race                  VARCHAR(60),
  subrace               VARCHAR(60),
  class                 VARCHAR(60),
  multiclass            JSONB        DEFAULT '[]',      -- [{class, level}]
  subclass              VARCHAR(100),
  level                 SMALLINT     NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
  background            VARCHAR(100),
  alignment             alignment_type,
  deity                 VARCHAR(80),
  xp                    INTEGER      NOT NULL DEFAULT 0,
  xp_to_next            INTEGER      NOT NULL DEFAULT 300,
  inspiration           BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Habilidades base
  str                   SMALLINT     NOT NULL DEFAULT 10 CHECK (str BETWEEN 1 AND 30),
  dex                   SMALLINT     NOT NULL DEFAULT 10 CHECK (dex BETWEEN 1 AND 30),
  con                   SMALLINT     NOT NULL DEFAULT 10 CHECK (con BETWEEN 1 AND 30),
  int                   SMALLINT     NOT NULL DEFAULT 10 CHECK (int BETWEEN 1 AND 30),
  wis                   SMALLINT     NOT NULL DEFAULT 10 CHECK (wis BETWEEN 1 AND 30),
  cha                   SMALLINT     NOT NULL DEFAULT 10 CHECK (cha BETWEEN 1 AND 30),

  -- Stats derivados
  hp                    SMALLINT     NOT NULL DEFAULT 8,
  max_hp                SMALLINT     NOT NULL DEFAULT 8,
  temp_hp               SMALLINT     NOT NULL DEFAULT 0,
  ac                    SMALLINT     NOT NULL DEFAULT 10,
  initiative_bonus      SMALLINT     NOT NULL DEFAULT 0,
  speed                 SMALLINT     NOT NULL DEFAULT 30,
  prof_bonus            SMALLINT     NOT NULL DEFAULT 2,
  passive_perception    SMALLINT     NOT NULL DEFAULT 10,
  passive_insight       SMALLINT     NOT NULL DEFAULT 10,
  passive_investigation SMALLINT     NOT NULL DEFAULT 10,

  -- Recursos
  hit_dice_total        VARCHAR(20)  NOT NULL DEFAULT '1d8',
  hit_dice_remaining    SMALLINT     NOT NULL DEFAULT 1,
  death_saves_success   SMALLINT     NOT NULL DEFAULT 0 CHECK (death_saves_success BETWEEN 0 AND 3),
  death_saves_failure   SMALLINT     NOT NULL DEFAULT 0 CHECK (death_saves_failure BETWEEN 0 AND 3),
  exhaustion_level      SMALLINT     NOT NULL DEFAULT 0 CHECK (exhaustion_level BETWEEN 0 AND 6),
  conditions            TEXT[]       NOT NULL DEFAULT '{}',
  attunement_slots      SMALLINT     NOT NULL DEFAULT 3,

  -- Proficiencias
  saving_throws         JSONB        NOT NULL DEFAULT '{"str":{"prof":false,"expert":false},"dex":{"prof":false,"expert":false},"con":{"prof":false,"expert":false},"int":{"prof":false,"expert":false},"wis":{"prof":false,"expert":false},"cha":{"prof":false,"expert":false}}',
  skills                JSONB        NOT NULL DEFAULT '{}',
  tool_proficiencies    TEXT[]       NOT NULL DEFAULT '{}',
  weapon_proficiencies  TEXT[]       NOT NULL DEFAULT '{}',
  armor_proficiencies   TEXT[]       NOT NULL DEFAULT '{}',
  languages             TEXT[]       NOT NULL DEFAULT '{}',

  -- Magia
  spellcasting_ability  VARCHAR(3),
  spell_attack_bonus    SMALLINT     NOT NULL DEFAULT 0,
  spell_save_dc         SMALLINT     NOT NULL DEFAULT 8,
  spell_slots           JSONB        NOT NULL DEFAULT '{"1":{"total":0,"used":0},"2":{"total":0,"used":0},"3":{"total":0,"used":0},"4":{"total":0,"used":0},"5":{"total":0,"used":0},"6":{"total":0,"used":0},"7":{"total":0,"used":0},"8":{"total":0,"used":0},"9":{"total":0,"used":0}}',
  pact_magic            JSONB        DEFAULT NULL,       -- {slots, level, used}
  cantrips_known        TEXT[]       NOT NULL DEFAULT '{}',
  spells_known          JSONB        NOT NULL DEFAULT '[]', -- [{name, level, prepared, school}]

  -- Rasgos y features
  racial_traits         JSONB        NOT NULL DEFAULT '[]', -- [{name, desc}]
  class_features        JSONB        NOT NULL DEFAULT '[]',
  feats                 JSONB        NOT NULL DEFAULT '[]',
  background_feature    TEXT,
  allies_orgs           TEXT,

  -- Apariencia
  age                   VARCHAR(30),
  height                VARCHAR(20),
  weight                VARCHAR(20),
  eyes                  VARCHAR(50),
  skin                  VARCHAR(50),
  hair                  VARCHAR(50),

  -- Personalidad
  personality_traits    TEXT,
  ideals                TEXT,
  bonds                 TEXT,
  flaws                 TEXT,
  backstory             TEXT,
  notes                 TEXT,

  active                BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Monedas por personaje
CREATE TABLE character_currency (
  character_id UUID    PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  copper       INTEGER NOT NULL DEFAULT 0,
  silver       INTEGER NOT NULL DEFAULT 0,
  electrum     INTEGER NOT NULL DEFAULT 0,
  gold         INTEGER NOT NULL DEFAULT 0,
  platinum     INTEGER NOT NULL DEFAULT 0
);

-- FK circular members ↔ characters
ALTER TABLE members
  ADD CONSTRAINT fk_members_active_character
  FOREIGN KEY (active_character_id) REFERENCES characters(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- WORLD BUILDING
-- ─────────────────────────────────────────────────────────────

CREATE TABLE locations (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id        UUID          NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  parent_location_id UUID          REFERENCES locations(id) ON DELETE SET NULL,
  name               VARCHAR(150)  NOT NULL,
  type               location_type NOT NULL DEFAULT 'poi',
  description        TEXT,
  map_url            TEXT,
  is_discovered      BOOLEAN       NOT NULL DEFAULT TRUE,
  notes              TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE factions (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id      UUID           NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name             VARCHAR(100)   NOT NULL,
  slug             VARCHAR(100)   NOT NULL,
  description      TEXT,
  goals            TEXT,
  alignment        alignment_type,
  emblem_url       TEXT,
  leader_name      VARCHAR(100),
  reputation_scale JSONB          NOT NULL DEFAULT '{"hostile":-100,"unfriendly":-50,"neutral":0,"friendly":50,"ally":100}',
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, slug)
);

CREATE TABLE faction_reputation (
  faction_id       UUID    NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  character_id     UUID    NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  reputation_pts   INTEGER NOT NULL DEFAULT 0,
  rank_title       VARCHAR(80),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (faction_id, character_id)
);

CREATE TABLE npcs (
  id           UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id  UUID             NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name         VARCHAR(100)     NOT NULL,
  race         VARCHAR(60),
  class        VARCHAR(60),
  role         VARCHAR(100),
  relationship npc_relationship NOT NULL DEFAULT 'unknown',
  description  TEXT,
  portrait_url TEXT,
  stat_block   JSONB            DEFAULT '{}',
  location_id  UUID             REFERENCES locations(id) ON DELETE SET NULL,
  faction_id   UUID             REFERENCES factions(id) ON DELETE SET NULL,
  alive        BOOLEAN          NOT NULL DEFAULT TRUE,
  notes        TEXT,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE TABLE quests (
  id                 UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id        UUID         NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title              VARCHAR(200) NOT NULL,
  description        TEXT,
  status             quest_status NOT NULL DEFAULT 'active',
  quest_giver_npc_id UUID         REFERENCES npcs(id) ON DELETE SET NULL,
  reward_description TEXT,
  reward_xp          INTEGER      NOT NULL DEFAULT 0,
  reward_gp          NUMERIC(10,2) NOT NULL DEFAULT 0,
  objectives         JSONB        NOT NULL DEFAULT '[]', -- [{text, completed}]
  notes              TEXT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────
-- SESSIONS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE sessions (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id       UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  session_number    SMALLINT    NOT NULL,
  title             VARCHAR(200),
  date              DATE,
  duration_min      SMALLINT,
  summary           TEXT,
  highlights        TEXT[]      NOT NULL DEFAULT '{}',
  xp_awarded        INTEGER     NOT NULL DEFAULT 0,
  milestone_level   SMALLINT,
  next_session_date TIMESTAMPTZ,
  created_by        UUID        NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, session_number)
);

CREATE TABLE session_attendance (
  session_id    UUID     NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  member_id     UUID     NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  character_id  UUID     REFERENCES characters(id) ON DELETE SET NULL,
  present       BOOLEAN  NOT NULL DEFAULT TRUE,
  xp_received   INTEGER  NOT NULL DEFAULT 0,
  notes         TEXT,
  PRIMARY KEY (session_id, member_id)
);

-- ─────────────────────────────────────────────────────────────
-- ITEMS (SRD completo)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE items (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                   VARCHAR(200) NOT NULL,
  description            TEXT,
  type                   item_type   NOT NULL DEFAULT 'other',
  rarity                 item_rarity NOT NULL DEFAULT 'common',
  weight                 NUMERIC(8,3),
  value_gp               NUMERIC(12,2),

  -- Propiedades mágicas
  is_magical             BOOLEAN     NOT NULL DEFAULT FALSE,
  is_consumable          BOOLEAN     NOT NULL DEFAULT FALSE,
  requires_attunement    BOOLEAN     NOT NULL DEFAULT FALSE,
  attunement_restriction TEXT,
  charges_max            SMALLINT,
  charges_recharge       VARCHAR(20),   -- dawn / dusk / short_rest / long_rest
  sentient               BOOLEAN     NOT NULL DEFAULT FALSE,
  cursed                 BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Weapon
  weapon_category        VARCHAR(20),   -- Simple / Martial
  weapon_range_type      VARCHAR(10),   -- Melee / Ranged
  damage_dice            VARCHAR(20),   -- 1d8
  damage_type            VARCHAR(20),   -- slashing / piercing / bludgeoning
  damage_dice_versatile  VARCHAR(20),
  range_normal           INTEGER,
  range_long             INTEGER,
  throw_range_normal     INTEGER,
  throw_range_long       INTEGER,
  weapon_properties      TEXT[]      DEFAULT '{}',
  bonus_attack           SMALLINT,

  -- Armor
  armor_category         VARCHAR(10),   -- Light / Medium / Heavy / Shield
  ac_base                SMALLINT,
  ac_dex_bonus           BOOLEAN     DEFAULT FALSE,
  ac_max_dex_bonus       SMALLINT,
  str_minimum            SMALLINT    DEFAULT 0,
  stealth_disadvantage   BOOLEAN     DEFAULT FALSE,
  bonus_ac               SMALLINT,

  -- Bag de propiedades mágicas extendidas
  magical_properties     JSONB       NOT NULL DEFAULT '{}',

  -- Referencia SRD
  source_book            VARCHAR(10),
  source_page            INTEGER,
  dnd5eapi_index         TEXT,
  open5e_key             TEXT
);

CREATE TABLE character_inventory (
  character_id    UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id         UUID        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity        SMALLINT    NOT NULL DEFAULT 1,
  equipped        BOOLEAN     NOT NULL DEFAULT FALSE,
  attuned         BOOLEAN     NOT NULL DEFAULT FALSE,
  charges_current SMALLINT,
  custom_name     VARCHAR(100),
  notes           TEXT,
  PRIMARY KEY (character_id, item_id)
);

CREATE TABLE campaign_treasury (
  campaign_id UUID          NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  item_id     UUID          NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity    SMALLINT      NOT NULL DEFAULT 1,
  notes       TEXT,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, item_id)
);

CREATE TABLE campaign_currency (
  campaign_id UUID    PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  copper      INTEGER NOT NULL DEFAULT 0,
  silver      INTEGER NOT NULL DEFAULT 0,
  electrum    INTEGER NOT NULL DEFAULT 0,
  gold        INTEGER NOT NULL DEFAULT 0,
  platinum    INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE session_loot (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id      UUID        REFERENCES items(id) ON DELETE SET NULL,
  item_name    VARCHAR(200),   -- snapshot si el item se elimina
  quantity     SMALLINT    NOT NULL DEFAULT 1,
  awarded_to   UUID        REFERENCES characters(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- CHAT SYSTEM
-- ─────────────────────────────────────────────────────────────

CREATE TABLE chat_rooms (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(100)   NOT NULL,
  slug             VARCHAR(100)   NOT NULL UNIQUE,
  type             chat_room_type NOT NULL DEFAULT 'general',
  clan_id          UUID           REFERENCES clans(id) ON DELETE CASCADE,
  campaign_id      UUID           REFERENCES campaigns(id) ON DELETE CASCADE,
  rank_required_id UUID           REFERENCES ranks(id) ON DELETE SET NULL,
  description      TEXT,
  icon             VARCHAR(10)    DEFAULT '💬',
  is_readonly      BOOLEAN        NOT NULL DEFAULT FALSE,
  is_ic            BOOLEAN        NOT NULL DEFAULT FALSE,
  sort_order       SMALLINT       NOT NULL DEFAULT 0,
  created_by       UUID           REFERENCES members(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id      UUID         NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  member_id    UUID         NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  character_id UUID         REFERENCES characters(id) ON DELETE SET NULL,
  message_type message_type NOT NULL DEFAULT 'ooc',
  content      TEXT         NOT NULL,
  dice_result  JSONB,       -- {expression:"2d6+3", rolls:[4,2], modifier:3, total:9, type:"attack"}
  reply_to_id  UUID         REFERENCES chat_messages(id) ON DELETE SET NULL,
  attachments  JSONB        NOT NULL DEFAULT '[]',
  mentions     UUID[]       NOT NULL DEFAULT '{}',
  is_pinned    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  edited_at    TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ
);

CREATE TABLE chat_direct_messages (
  id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_character_id UUID           NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  to_character_id   UUID           NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  content           TEXT           NOT NULL,
  message_type      dm_message_type NOT NULL DEFAULT 'ic',
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE chat_room_presence (
  room_id              UUID    NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  member_id            UUID    NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  last_read_message_id UUID    REFERENCES chat_messages(id) ON DELETE SET NULL,
  last_read_at         TIMESTAMPTZ,
  notifications_muted  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (room_id, member_id)
);

CREATE TABLE chat_reactions (
  message_id   UUID        NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  character_id UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  emoji        VARCHAR(10) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, character_id, emoji)
);

-- ─────────────────────────────────────────────────────────────
-- EVENT LOG
-- ─────────────────────────────────────────────────────────────

CREATE TABLE event_log (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_member_id   UUID        REFERENCES members(id) ON DELETE SET NULL,
  actor_character_id UUID       REFERENCES characters(id) ON DELETE SET NULL,
  action            VARCHAR(60) NOT NULL,
  target_type       VARCHAR(40) NOT NULL,
  target_id         UUID,
  target_name       TEXT,
  before_state      JSONB,
  after_state       JSONB,
  metadata          JSONB       NOT NULL DEFAULT '{}',
  ip_address        INET,
  is_public         BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ─────────────────────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────────────────────

-- Members
CREATE INDEX idx_members_rank          ON members(rank_id);
CREATE INDEX idx_members_role          ON members(role);

-- Clans
CREATE INDEX idx_clan_members_member   ON clan_members(member_id);

-- Campaigns
CREATE INDEX idx_campaigns_dm          ON campaigns(dm_id);
CREATE INDEX idx_campaigns_status      ON campaigns(status);

-- Characters
CREATE INDEX idx_characters_member     ON characters(member_id);
CREATE INDEX idx_characters_campaign   ON characters(campaign_id);
CREATE INDEX idx_characters_active     ON characters(active);

-- World
CREATE INDEX idx_locations_campaign    ON locations(campaign_id);
CREATE INDEX idx_locations_parent      ON locations(parent_location_id);
CREATE INDEX idx_npcs_campaign         ON npcs(campaign_id);
CREATE INDEX idx_factions_campaign     ON factions(campaign_id);
CREATE INDEX idx_quests_campaign       ON quests(campaign_id);
CREATE INDEX idx_quests_status         ON quests(status);

-- Sessions
CREATE INDEX idx_sessions_campaign     ON sessions(campaign_id);
CREATE INDEX idx_sessions_date         ON sessions(date DESC);

-- Items
CREATE INDEX idx_items_type            ON items(type);
CREATE INDEX idx_items_rarity          ON items(rarity);

-- Chat
CREATE INDEX idx_chat_messages_room    ON chat_messages(room_id, created_at DESC);
CREATE INDEX idx_chat_messages_member  ON chat_messages(member_id);
CREATE INDEX idx_chat_messages_char    ON chat_messages(character_id);
CREATE INDEX idx_chat_dm_from          ON chat_direct_messages(from_character_id);
CREATE INDEX idx_chat_dm_to            ON chat_direct_messages(to_character_id);
CREATE INDEX idx_chat_rooms_clan       ON chat_rooms(clan_id);
CREATE INDEX idx_chat_rooms_campaign   ON chat_rooms(campaign_id);

-- Event log
CREATE INDEX idx_event_log_occurred    ON event_log(occurred_at DESC);
CREATE INDEX idx_event_log_actor       ON event_log(actor_member_id);
CREATE INDEX idx_event_log_action      ON event_log(action);
CREATE INDEX idx_event_log_target      ON event_log(target_type, target_id);
CREATE INDEX idx_event_log_public      ON event_log(is_public, occurred_at DESC);

-- ─────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER member_xp_updated_at
  BEFORE UPDATE ON member_xp FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- SEED: Datos iniciales
-- ─────────────────────────────────────────────────────────────

-- Rangos base
INSERT INTO ranks (name, slug, color_hex, level, xp_threshold, description) VALUES
  ('Iniciado',     'iniciado',     '#7D7468', 0,    0,     'Nuevo miembro de la comunidad'),
  ('Aventurero',   'aventurero',   '#6DBF8E', 1,    500,   'Ha completado su primera campaña'),
  ('Héroe',        'heroe',        '#8A9BC9', 2,    2000,  'Miembro veterano con múltiples campañas'),
  ('Leyenda',      'leyenda',      '#C9A84C', 3,    5000,  'Pilar de la comunidad'),
  ('Dungeon Master','dm',          '#9B2335', 10,   0,     'Director de juego'),
  ('Administrador','admin',        '#C9A84C', 99,   0,     'Administrador del sistema')
ON CONFLICT DO NOTHING;

-- Salas de chat base
INSERT INTO chat_rooms (name, slug, type, description, icon, sort_order, is_ic, is_readonly) VALUES
  ('General',        'general',        'general',       'Canal principal de la comunidad',         '📢', 0,  FALSE, FALSE),
  ('Taberna',        'taberna',        'general',       'Conversación casual In-Character',        '🍺', 1,  TRUE,  FALSE),
  ('Anuncios',       'anuncios',       'announcements', 'Anuncios oficiales de la comunidad',      '📜', 2,  FALSE, TRUE),
  ('Fuera de Mesa',  'fuera-de-mesa',  'ooc',           'Conversación OOC entre jugadores',        '🎲', 3,  FALSE, FALSE),
  ('Lore & Mundo',   'lore-mundo',     'general',       'Discusión de lore, historia y mundo',     '🗺️', 4,  FALSE, FALSE)
ON CONFLICT DO NOTHING;

-- Admin inicial (password: Admin1234! — cambiar en producción)
INSERT INTO members (username, email, role, password_hash, display_name)
VALUES (
  'admin',
  'admin@dnd.local',
  'admin',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TdCJ1O4dTEGFJl4aBXLTFqxLCHCa',
  'Administrador'
) ON CONFLICT DO NOTHING;

INSERT INTO member_xp (member_id)
SELECT id FROM members WHERE username = 'admin'
ON CONFLICT DO NOTHING;
