"""
Helpers de economía D&D 5e (Fase I5).

Regla base: toda conversión se hace en piezas de cobre (cp) como unidad
entera interna, para evitar decimales. Las columnas por denominación se
mantienen en la BD, pero los cálculos usan to_copper / from_copper.

Peso de monedas: 50 monedas (de cualquier tipo) = 1 libra.
Capacidad de carga: FUE x 15 (libras). Variante de encumbramiento:
  > FUE x 5  -> cargado        (-10 ft)
  > FUE x 10 -> muy cargado    (-20 ft)
  > FUE x 15 -> sobrecargado   (no puede moverse)
"""

COIN_TO_CP = {
    "platinum": 1000,
    "gold": 100,
    "electrum": 50,
    "silver": 10,
    "copper": 1,
}
COIN_ORDER = ["platinum", "gold", "electrum", "silver", "copper"]
COIN_ABBR = {"platinum": "pp", "gold": "po", "electrum": "pe", "silver": "pa", "copper": "pc"}


def to_copper(currency: dict) -> int:
    """Suma total en piezas de cobre a partir de un dict de denominaciones."""
    total = 0
    for coin, factor in COIN_TO_CP.items():
        total += int(currency.get(coin, 0) or 0) * factor
    return total


def from_copper(cp: int) -> dict:
    """Descompone cp en pp/po/pa/pc (sin electro, poco usado)."""
    cp = max(0, int(cp))
    platinum, cp = divmod(cp, 1000)
    gold, cp = divmod(cp, 100)
    silver, cp = divmod(cp, 10)
    return {"platinum": platinum, "gold": gold, "electrum": 0,
            "silver": silver, "copper": cp}


def format_currency(currency: dict) -> str:
    """Representacion legible: '3 po, 5 pa' (denominaciones no nulas)."""
    parts = []
    for coin in COIN_ORDER:
        val = int(currency.get(coin, 0) or 0)
        if val:
            parts.append(f"{val} {COIN_ABBR[coin]}")
    return ", ".join(parts) if parts else "0 pc"


def coin_weight(currency: dict) -> float:
    """Peso total de las monedas en libras (50 monedas = 1 lb)."""
    total_coins = sum(int(currency.get(c, 0) or 0) for c in COIN_TO_CP)
    return round(total_coins / 50.0, 2)


def carrying_capacity(str_score) -> int:
    """Capacidad maxima de carga en libras: FUE x 15."""
    return int(str_score or 10) * 15


def encumbrance(weight_lb: float, str_score) -> dict:
    """Estado de encumbramiento segun la variante del PHB."""
    s = int(str_score or 10)
    light = s * 5
    heavy = s * 10
    maximum = s * 15
    if weight_lb > maximum:
        status, penalty = "sobrecargado", None
    elif weight_lb > heavy:
        status, penalty = "muy cargado", -20
    elif weight_lb > light:
        status, penalty = "cargado", -10
    else:
        status, penalty = "normal", 0
    return {
        "carried": round(weight_lb, 2),
        "capacity": maximum,
        "encumbered_at": light,
        "heavy_at": heavy,
        "status": status,
        "speed_penalty": penalty,
    }
