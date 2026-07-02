-- =============================================================
-- DnD Community Manager — Fase C3: mundo vivo (NPCs/localizaciones/facciones)
-- 009_worldbuilding_fields.sql
-- Aplicar: python db/migrate.py 009_worldbuilding_fields
-- Base: guides/dnd5e_campaigns_guide.md §9 (NPCs), §17 regla 4 (visibilidad)
-- =============================================================

-- Las tablas locations, factions, faction_reputation y npcs YA existen (001).
-- C3 solo añade a npcs los campos de actitud y contenido DM-only (guía §9.1–§9.2).
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS attitude   VARCHAR(12);            -- hostile|unfriendly|indifferent|friendly|helpful
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS motivation TEXT;                   -- qué quiere (frecuentemente dm_only)
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS secret     TEXT;                   -- secreto (dm_only)
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS dm_only    BOOLEAN NOT NULL DEFAULT FALSE;  -- oculta el NPC completo a jugadores
