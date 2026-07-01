-- ─────────────────────────────────────────────────────────────
-- Migración 003 — Fase I3: Slots de equipo
-- Añade el slot donde está equipado cada ítem del inventario.
-- NULL = el ítem está en la mochila (no equipado en una zona del cuerpo).
-- Valores: head, neck, body, cloak, hands, ring_left, ring_right,
--          waist, feet, main_hand, off_hand, back
-- ─────────────────────────────────────────────────────────────

ALTER TABLE character_inventory
  ADD COLUMN IF NOT EXISTS slot VARCHAR(12);

CREATE INDEX IF NOT EXISTS idx_char_inv_slot
  ON character_inventory (character_id, slot);
