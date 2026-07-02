"""Guía de recompensas por nivel (Fase C7).

Referencia del DMG (guía §13.2–§13.3): tesoro acumulado (hoard) vs. individual,
y rareza de objetos mágicos por rango de nivel. Constantes de sistema.
"""

# tier -> guía (guía §13.3)
_TIERS = [
    (1, 4, {
        "tier": "1–4",
        "hoard": "Cientos de po (≈ 100–1.000 po por tesoro acumulado)",
        "individual": "Monedas sueltas: unidades a decenas de po por criatura",
        "magic_item_rarities": ["common", "uncommon"],
    }),
    (5, 10, {
        "tier": "5–10",
        "hoard": "Miles de po (≈ 1.000–10.000 po)",
        "individual": "Decenas a cientos de po por criatura",
        "magic_item_rarities": ["uncommon", "rare"],
    }),
    (11, 16, {
        "tier": "11–16",
        "hoard": "Decenas de miles de po",
        "individual": "Cientos a miles de po por criatura",
        "magic_item_rarities": ["rare", "very_rare"],
    }),
    (17, 20, {
        "tier": "17–20",
        "hoard": "Cientos de miles de po",
        "individual": "Miles de po por criatura",
        "magic_item_rarities": ["very_rare", "legendary"],
    }),
]

RARITY_LABEL = {
    "common": "común", "uncommon": "infrecuente", "rare": "raro",
    "very_rare": "muy raro", "legendary": "legendario",
}


def guidance(level: int) -> dict:
    level = max(1, min(20, int(level)))
    for lo, hi, data in _TIERS:
        if lo <= level <= hi:
            return {"party_level": level, **data}
    return {"party_level": level, **_TIERS[-1][2]}


def full_table() -> list[dict]:
    return [data for _, _, data in _TIERS]
