"""Progresión de nivel (Fase C4).

Constantes del sistema (guía §14.1) — NO editables por el usuario (guía §17 regla 5).
Tabla de XP total acumulado por nivel y bono de competencia (BPC).
"""

# XP total acumulado necesario para ALCANZAR cada nivel (D&D 5e, guía §14.1)
XP_THRESHOLDS = {
    1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
    6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
    11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
    16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000,
}
MAX_LEVEL = 20


def proficiency_for_level(level: int) -> int:
    """BPC por nivel (guía §14.1): 1–4 +2, 5–8 +3, 9–12 +4, 13–16 +5, 17–20 +6."""
    level = max(1, min(MAX_LEVEL, int(level)))
    return 2 + (level - 1) // 4


def level_for_xp(xp: int) -> int:
    """Nivel más alto cuyo umbral de XP total es ≤ xp."""
    xp = max(0, int(xp))
    lvl = 1
    for level in range(1, MAX_LEVEL + 1):
        if xp >= XP_THRESHOLDS[level]:
            lvl = level
        else:
            break
    return lvl


def xp_for_level(level: int) -> int:
    return XP_THRESHOLDS[max(1, min(MAX_LEVEL, int(level)))]


def xp_progress(xp: int) -> dict:
    """Progreso hacia el siguiente nivel a partir del XP total del grupo."""
    xp = max(0, int(xp))
    level = level_for_xp(xp)
    if level >= MAX_LEVEL:
        return {
            "level": MAX_LEVEL,
            "next_level": None,
            "xp_into_level": 0,
            "xp_needed_for_next": 0,
            "pct_to_next": 100,
        }
    floor = XP_THRESHOLDS[level]
    ceil = XP_THRESHOLDS[level + 1]
    into = xp - floor
    span = ceil - floor
    return {
        "level": level,
        "next_level": level + 1,
        "xp_into_level": into,
        "xp_needed_for_next": ceil - xp,
        "pct_to_next": round(into * 100 / span) if span else 0,
    }
