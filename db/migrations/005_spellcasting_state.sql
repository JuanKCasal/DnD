-- =============================================================
-- DnD Community Manager — Fase H6: estado de conjuración
-- 005_spellcasting_state.sql
-- Aplicar: python db/migrate.py 005_spellcasting_state
-- =============================================================

-- Concentración: hechizo de concentración activo (máx. 1) — documento §7
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS concentrating_on UUID REFERENCES spells(id) ON DELETE SET NULL;

-- Coste de componentes: ítem consumible enlazado al hechizo — documento §6
ALTER TABLE spells
  ADD COLUMN IF NOT EXISTS material_item_id UUID REFERENCES items(id) ON DELETE SET NULL;
