-- =============================================================
-- DnD Community Manager — Limpieza post-sistema de hechizos
-- 006_drop_deprecated_spell_columns.sql
-- Aplicar: python db/migrate.py 006_drop_deprecated_spell_columns
--
-- El repertorio de hechizos vive ahora en la tabla `character_spells`
-- (Fases H1–H5). Estas columnas JSONB/array quedaron como respaldo y ya
-- no se usan en ningún modelo ni consulta. Se eliminan.
-- La migración de datos (db/migrate_spells_known.py) debió ejecutarse ANTES.
-- =============================================================

ALTER TABLE characters DROP COLUMN IF EXISTS spells_known;
ALTER TABLE characters DROP COLUMN IF EXISTS cantrips_known;
