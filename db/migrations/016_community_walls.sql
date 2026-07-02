-- =============================================================
-- DnD Community Manager — Fase CM4: muros de comunidad (unificado)
-- 016_community_walls.sql
-- Aplicar: python db/migrate.py 016_community_walls
-- Base: PLAN_MEJORAS_COMUNIDAD.md §CM4 (D4: muros unificados events|hall|clan)
-- =============================================================

-- Publicación de muro (reutilizada por Calendario/Eventos [CM4], Clanes [CM5] y
-- Salón de la Fama [CM6]) según `board`.
CREATE TABLE IF NOT EXISTS community_posts (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  board               VARCHAR(10)  NOT NULL,                 -- events | hall | clan
  clan_id             UUID         REFERENCES clans(id) ON DELETE CASCADE,
  author_member_id    UUID         REFERENCES members(id) ON DELETE SET NULL,
  author_character_id UUID         REFERENCES characters(id) ON DELETE SET NULL,
  title               VARCHAR(200),
  body                TEXT,
  image_url           TEXT,
  item_id             UUID         REFERENCES items(id) ON DELETE SET NULL,   -- compartir ítem (CM5)
  event_date          TIMESTAMPTZ,                            -- para el calendario (CM4)
  pinned              BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_community_posts_board ON community_posts(board);
CREATE INDEX IF NOT EXISTS idx_community_posts_clan  ON community_posts(clan_id);

CREATE TABLE IF NOT EXISTS community_comments (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id             UUID        NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_member_id    UUID        REFERENCES members(id) ON DELETE SET NULL,
  author_character_id UUID        REFERENCES characters(id) ON DELETE SET NULL,
  body                TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id);

CREATE TABLE IF NOT EXISTS community_reactions (
  post_id      UUID        NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  character_id UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  emoji        VARCHAR(10) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, character_id, emoji)
);
