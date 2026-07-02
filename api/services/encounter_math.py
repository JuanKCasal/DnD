"""Matemáticas de balanceo de encuentros (Fase C5).

Sistema del DMG 2014 (guía §12). Constantes de sistema — NO editables por el
usuario (guía §17 regla 5). El multiplicador se usa SOLO para medir dificultad,
NUNCA para repartir XP de recompensa (guía §13.1, §17 regla 9).
"""

# ── Umbrales de XP por personaje y nivel (guía §12.1) ──
# level -> (easy, medium, hard, deadly)
XP_THRESHOLDS = {
    1: (25, 50, 75, 100), 2: (50, 100, 150, 200), 3: (75, 150, 225, 400),
    4: (125, 250, 375, 500), 5: (250, 500, 750, 1100), 6: (300, 600, 900, 1400),
    7: (350, 750, 1100, 1700), 8: (450, 900, 1400, 2100), 9: (550, 1100, 1600, 2400),
    10: (600, 1200, 1900, 2800), 11: (800, 1600, 2400, 3600), 12: (1000, 2000, 3000, 4500),
    13: (1100, 2200, 3400, 5100), 14: (1250, 2500, 3800, 5700), 15: (1400, 2800, 4300, 6400),
    16: (1600, 3200, 4800, 7200), 17: (2000, 3900, 5900, 8800), 18: (2100, 4200, 6300, 9500),
    19: (2400, 4900, 7300, 10900), 20: (2800, 5700, 8500, 12700),
}

# ── XP por Challenge Rating (guía §10.2) ──
CR_XP = {
    0.0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
    1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900,
    9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
    16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000,
    23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
}

# ── Multiplicador por nº de monstruos (guía §12.3) ──
MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 4]  # índices 0..5

# ── Presupuesto diario de aventura por nivel (guía §12.7, DMG) ──
ADVENTURING_DAY_XP = {
    1: 300, 2: 600, 3: 1200, 4: 1700, 5: 3500, 6: 4000, 7: 5000, 8: 6000,
    9: 7500, 10: 9000, 11: 10500, 12: 11500, 13: 13500, 14: 15000, 15: 18000,
    16: 20000, 17: 25000, 18: 27000, 19: 30000, 20: 40000,
}


def xp_for_cr(cr: float) -> int:
    """XP que otorga un monstruo de un CR dado. Acepta 0.125/0.25/0.5 o enteros."""
    try:
        cr = float(cr)
    except (TypeError, ValueError):
        return 0
    if cr in CR_XP:
        return CR_XP[cr]
    key = int(cr) if cr == int(cr) else cr
    return CR_XP.get(key, 0)


def _multiplier_index(count: int) -> int:
    if count <= 1:
        return 0
    if count == 2:
        return 1
    if count <= 6:
        return 2
    if count <= 10:
        return 3
    if count <= 14:
        return 4
    return 5


def _clamp(n: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, n))


def party_thresholds(levels: list[int]) -> dict:
    """Suma de umbrales del grupo para las 4 dificultades (guía §12.2)."""
    t = {"easy": 0, "medium": 0, "hard": 0, "deadly": 0}
    for lv in levels:
        e, m, h, d = XP_THRESHOLDS[_clamp(int(lv), 1, 20)]
        t["easy"] += e; t["medium"] += m; t["hard"] += h; t["deadly"] += d
    return t


def calculate_difficulty(monsters: list[dict], levels: list[int]) -> dict:
    """monsters: [{xp, quantity}]; levels: niveles de los personajes.

    Devuelve base_xp, adjusted_xp, multiplier, difficulty y umbrales (guía §12.5).
    """
    levels = [int(l) for l in levels if l] or [1]
    base_xp = sum(int(m.get("xp", 0)) * int(m.get("quantity", 1)) for m in monsters)
    count = sum(int(m.get("quantity", 1)) for m in monsters)

    idx = _multiplier_index(count)
    party_size = len(levels)
    if party_size <= 2:
        idx += 1          # grupo pequeño → fila más alta (guía §12.4)
    elif party_size >= 6:
        idx -= 1          # grupo grande → fila más baja
    multiplier = MULTIPLIERS[_clamp(idx, 0, len(MULTIPLIERS) - 1)]

    adjusted = int(round(base_xp * multiplier))
    th = party_thresholds(levels)

    if adjusted < th["easy"]:
        difficulty = "trivial"
    elif adjusted < th["medium"]:
        difficulty = "easy"
    elif adjusted < th["hard"]:
        difficulty = "medium"
    elif adjusted < th["deadly"]:
        difficulty = "hard"
    else:
        difficulty = "deadly"

    return {
        "base_xp": base_xp,          # XP para REPARTIR (recompensa) — guía §13.1
        "adjusted_xp": adjusted,     # solo para medir dificultad
        "multiplier": multiplier,
        "monster_count": count,
        "difficulty": difficulty,
        "thresholds": th,
        "daily_budget": sum(ADVENTURING_DAY_XP[_clamp(int(l), 1, 20)] for l in levels),
    }
