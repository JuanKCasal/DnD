"""
Cálculo de estadísticas de combate derivadas del equipo (Fase I4).

Funciones puras y sin acceso a BD: reciben los datos del personaje y su
equipo equipado, y devuelven CA efectiva, penalizaciones de movimiento,
desventaja de sigilo y los ataques de arma. No se persiste nada: todo se
calcula bajo demanda a partir del inventario equipado.
"""
import json


def ability_mod(score) -> int:
    """Modificador de característica D&D 5e: floor((score - 10) / 2)."""
    if score is None:
        score = 10
    return (int(score) - 10) // 2


def _as_dict(value):
    """magical_properties puede llegar como dict o como texto JSON (JSONB)."""
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return {}
    return {}


def _fmt(n: int) -> str:
    return f"+{n}" if n >= 0 else str(n)


def compute_combat(char: dict, equipped: list[dict]) -> dict:
    """
    char: {str_score, dex_score, con_score, wis_score, speed, prof_bonus, level}
    equipped: lista de ítems equipados con campos de items + slot.
    """
    str_mod = ability_mod(char.get("str_score"))
    dex_mod = ability_mod(char.get("dex_score"))
    prof = char.get("prof_bonus") or 2
    base_speed = char.get("speed") or 30

    ac_breakdown = []
    notes = []

    # ── Localizar armadura de cuerpo y escudo ──
    body_armor = None
    shield = None
    for it in equipped:
        cat = it.get("armor_category")
        if it.get("type") == "armor":
            if cat in ("Light", "Medium", "Heavy"):
                body_armor = it
            elif cat == "Shield":
                shield = it

    # ── CA base ──
    if body_armor:
        base = body_armor.get("ac_base") or 10
        if body_armor.get("ac_dex_bonus"):
            max_dex = body_armor.get("ac_max_dex_bonus")
            applied = dex_mod if max_dex is None else min(dex_mod, max_dex)
        else:
            applied = 0
        ac_total = base + applied
        ac_breakdown.append({"source": body_armor.get("name", "Armadura"), "value": base})
        if applied:
            ac_breakdown.append({"source": f"DES ({_fmt(applied)})", "value": applied})
    else:
        ac_total = 10 + dex_mod
        ac_breakdown.append({"source": "Base (sin armadura)", "value": 10})
        ac_breakdown.append({"source": f"DES ({_fmt(dex_mod)})", "value": dex_mod})

    # ── Escudo ──
    if shield:
        sb = shield.get("bonus_ac") or 2
        ac_total += sb
        ac_breakdown.append({"source": shield.get("name", "Escudo"), "value": sb})

    # ── Bonos mágicos (bonus_ac de magical_properties en cualquier equipado) ──
    for it in equipped:
        mp = _as_dict(it.get("magical_properties"))
        bonus = mp.get("bonus_ac")
        if bonus:
            ac_total += bonus
            ac_breakdown.append({"source": it.get("name", "Objeto mágico"), "value": bonus})

    # ── Velocidad: -10 ft si armadura pesada y FUE insuficiente ──
    speed_total = base_speed
    speed_penalty = 0
    speed_reason = None
    if body_armor and body_armor.get("armor_category") == "Heavy":
        req = body_armor.get("str_minimum") or 0
        if req and (char.get("str_score") or 10) < req:
            speed_penalty = -10
            speed_total = max(0, base_speed - 10)
            speed_reason = f"FUE menor que {req} con {body_armor.get('name')}"

    # ── Sigilo ──
    stealth_disadvantage = bool(body_armor and body_armor.get("stealth_disadvantage"))

    # ── Ataques con armas equipadas ──
    attacks = []
    for it in equipped:
        if it.get("type") != "weapon":
            continue
        props = list(it.get("weapon_properties") or [])
        is_ranged = it.get("weapon_range_type") == "Ranged"
        is_finesse = "finesse" in props
        # Característica de ataque: DES si a distancia; mejor de FUE/DES si finesse; FUE si no
        if is_ranged:
            abil_mod, abil = dex_mod, "DES"
        elif is_finesse:
            abil_mod, abil = (dex_mod, "DES") if dex_mod >= str_mod else (str_mod, "FUE")
        else:
            abil_mod, abil = str_mod, "FUE"

        mp = _as_dict(it.get("magical_properties"))
        # Bonificador mágico +X (columna bonus_attack o magical_properties.bonus_attack)
        plus = it.get("bonus_attack")
        if not plus and isinstance(mp.get("bonus_attack"), int):
            plus = mp["bonus_attack"]
        plus = plus or 0
        atk_bonus = abil_mod + prof + plus
        dmg_bonus = abil_mod + plus
        if isinstance(mp.get("bonus_damage"), int):
            dmg_bonus += mp["bonus_damage"]

        dmg = it.get("damage_dice") or "—"
        damage_str = f"{dmg} {_fmt(dmg_bonus)}".strip() if dmg != "—" else "—"

        attacks.append({
            "name": it.get("custom_name") or it.get("name"),
            "slot": it.get("slot"),
            "ability": abil,
            "attack_bonus": _fmt(atk_bonus),
            "damage": damage_str,
            "damage_type": it.get("damage_type"),
            "versatile": it.get("damage_dice_versatile"),
            "properties": props,
        })

    notes.append("El bono de ataque asume competencia con el arma.")
    if not equipped:
        notes.append("No hay objetos equipados; la CA usa 10 + DES.")

    return {
        "ac": {"total": ac_total, "breakdown": ac_breakdown},
        "speed": {"base": base_speed, "total": speed_total,
                  "penalty": speed_penalty, "reason": speed_reason},
        "stealth_disadvantage": stealth_disadvantage,
        "ability_mods": {"STR": str_mod, "DEX": dex_mod},
        "proficiency_bonus": prof,
        "attacks": attacks,
        "notes": notes,
    }
