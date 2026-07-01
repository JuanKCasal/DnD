"""
DnD Community Manager — Seeder del catálogo de ítems (SRD)
Fase I2. Poblado desde dnd5e_equipment_guide.md.

Uso:
    python db/seed_items.py            # aplica el upsert contra la BD
    python db/seed_items.py --dry-run  # no conecta; imprime conteos y una muestra

Idempotente: usa un índice único en items.dnd5eapi_index y ON CONFLICT DO UPDATE,
por lo que puede re-ejecutarse para refrescar los datos sin duplicar.
"""
import argparse
import asyncio
import json
import os
import re
import ssl
from pathlib import Path

# ── Carga de .env (sin dependencias extra, igual que migrate.py) ──────
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

CA_CERT = Path(__file__).parent.parent / os.environ.get("AIVEN_CA_CERT", "certs/ca.pem")

# Columnas de la tabla items que gestiona el seeder
COLUMNS = [
    "name", "description", "type", "rarity", "weight", "value_gp",
    "is_magical", "is_consumable", "requires_attunement", "attunement_restriction",
    "charges_max", "charges_recharge",
    "weapon_category", "weapon_range_type", "damage_dice", "damage_type",
    "damage_dice_versatile", "range_normal", "range_long",
    "throw_range_normal", "throw_range_long", "weapon_properties",
    "armor_category", "ac_base", "ac_dex_bonus", "ac_max_dex_bonus",
    "str_minimum", "stealth_disadvantage", "bonus_ac",
    "magical_properties", "source_book", "dnd5eapi_index",
]

DEFAULTS = {
    "description": None, "type": "other", "rarity": "common",
    "weight": None, "value_gp": None,
    "is_magical": False, "is_consumable": False, "requires_attunement": False,
    "attunement_restriction": None, "charges_max": None, "charges_recharge": None,
    "weapon_category": None, "weapon_range_type": None, "damage_dice": None,
    "damage_type": None, "damage_dice_versatile": None, "range_normal": None,
    "range_long": None, "throw_range_normal": None, "throw_range_long": None,
    "weapon_properties": None, "armor_category": None, "ac_base": None,
    "ac_dex_bonus": None, "ac_max_dex_bonus": None, "str_minimum": None,
    "stealth_disadvantage": None, "bonus_ac": None, "magical_properties": None,
    "source_book": "PHB",
}

ITEMS: list[dict] = []


def add(**kw):
    row = dict(DEFAULTS)
    row.update(kw)
    ITEMS.append(row)


# ═══════════════════════════════════════════════════════════════
#  4. ARMADURAS
#  (es, slug, categoria, ac_base, dex, max_dex, str_min, stealth, weight, gp)
# ═══════════════════════════════════════════════════════════════
_ARMOR = [
    ("Armadura acolchada", "padded", "Light", 11, True, None, 0, True, 8, 5),
    ("Armadura de cuero", "leather", "Light", 11, True, None, 0, False, 10, 10),
    ("Cuero tachonado", "studded-leather", "Light", 12, True, None, 0, False, 13, 45),
    ("Piel", "hide", "Medium", 12, True, 2, 0, False, 12, 10),
    ("Camisa de mallas", "chain-shirt", "Medium", 13, True, 2, 0, False, 20, 50),
    ("Cota de escamas", "scale-mail", "Medium", 14, True, 2, 0, True, 45, 50),
    ("Coraza", "breastplate", "Medium", 14, True, 2, 0, False, 20, 400),
    ("Media armadura", "half-plate", "Medium", 15, True, 2, 0, True, 40, 750),
    ("Cota de anillos", "ring-mail", "Heavy", 14, False, None, 0, False, 40, 30),
    ("Cota tachonada", "splint", "Heavy", 14, False, None, 0, True, 45, 75),
    ("Cota de malla", "chain-mail", "Heavy", 15, False, None, 13, True, 55, 75),
    ("Cota de placas", "plate", "Heavy", 17, False, None, 15, True, 60, 1500),
    ("Armadura completa", "full-plate", "Heavy", 18, False, None, 15, True, 65, 1500),
]
for es, slug, cat, ac, dex, maxd, smin, stl, w, gp in _ARMOR:
    dtxt = "+DES sin límite" if (dex and maxd is None) else (f"+DES (máx {maxd})" if dex else "sin DES")
    add(name=es, dnd5eapi_index=slug, type="armor", rarity="common",
        description=f"Armadura {cat.lower()}. CA base {ac} ({dtxt})."
                    + (f" Requiere FUE {smin}." if smin else "")
                    + (" Desventaja en Sigilo." if stl else ""),
        weight=w, value_gp=gp, armor_category=cat, ac_base=ac,
        ac_dex_bonus=dex, ac_max_dex_bonus=maxd, str_minimum=smin,
        stealth_disadvantage=stl)

add(name="Escudo", dnd5eapi_index="shield", type="armor", rarity="common",
    description="Se sujeta con una mano. Otorga +2 a la CA. Incompatible con armas a dos manos.",
    weight=6, value_gp=10, armor_category="Shield", bonus_ac=2)


# ═══════════════════════════════════════════════════════════════
#  5. ARMAS
#  (es, slug, dmg, dtype, versatile, props, weight, gp, rn, rl, tn, tl)
# ═══════════════════════════════════════════════════════════════
def _weapon(es, slug, cat, rtype, dmg, dtype, versatile, props, w, gp,
            rn=None, rl=None, tn=None, tl=None):
    parts = [f"Arma {cat.lower()} {'cuerpo a cuerpo' if rtype == 'Melee' else 'a distancia'}."]
    if dmg:
        parts.append(f"Daño {dmg} {dtype}.")
    if versatile:
        parts.append(f"Versátil ({versatile}).")
    if rn:
        parts.append(f"Alcance {rn}/{rl} ft.")
    if tn:
        parts.append(f"Arrojadiza {tn}/{tl} ft.")
    if props:
        parts.append("Propiedades: " + ", ".join(props) + ".")
    add(name=es, dnd5eapi_index=slug, type="weapon", rarity="common",
        description=" ".join(parts), weight=w, value_gp=gp,
        weapon_category=cat, weapon_range_type=rtype,
        damage_dice=dmg, damage_type=dtype, damage_dice_versatile=versatile,
        range_normal=rn, range_long=rl, throw_range_normal=tn, throw_range_long=tl,
        weapon_properties=props or [])


# Simples cuerpo a cuerpo
_weapon("Garrote", "club", "Simple", "Melee", "1d4", "bludgeoning", None, ["light"], 2, 0.1)
_weapon("Daga", "dagger", "Simple", "Melee", "1d4", "piercing", None, ["finesse", "light", "thrown"], 1, 2, tn=20, tl=60)
_weapon("Gran garrote", "greatclub", "Simple", "Melee", "1d8", "bludgeoning", None, ["two_handed"], 10, 0.2)
_weapon("Hacha de mano", "handaxe", "Simple", "Melee", "1d6", "slashing", None, ["light", "thrown"], 2, 5, tn=20, tl=60)
_weapon("Jabalina", "javelin", "Simple", "Melee", "1d6", "piercing", None, ["thrown"], 2, 0.5, tn=30, tl=120)
_weapon("Martillo ligero", "light-hammer", "Simple", "Melee", "1d4", "bludgeoning", None, ["light", "thrown"], 2, 2, tn=20, tl=60)
_weapon("Maza", "mace", "Simple", "Melee", "1d6", "bludgeoning", None, [], 4, 5)
_weapon("Bastón", "quarterstaff", "Simple", "Melee", "1d6", "bludgeoning", "1d8", ["versatile"], 4, 0.2)
_weapon("Hoz", "sickle", "Simple", "Melee", "1d4", "slashing", None, ["light"], 2, 1)
_weapon("Lanza", "spear", "Simple", "Melee", "1d6", "piercing", "1d8", ["thrown", "versatile"], 3, 1, tn=20, tl=60)
# Simples a distancia
_weapon("Ballesta ligera", "crossbow-light", "Simple", "Ranged", "1d8", "piercing", None, ["ammunition", "loading", "two_handed"], 5, 25, rn=80, rl=320)
_weapon("Dardo", "dart", "Simple", "Ranged", "1d4", "piercing", None, ["finesse", "thrown"], 0.25, 0.05, tn=20, tl=60)
_weapon("Arco corto", "shortbow", "Simple", "Ranged", "1d6", "piercing", None, ["ammunition", "two_handed"], 2, 25, rn=80, rl=320)
_weapon("Honda", "sling", "Simple", "Ranged", "1d4", "bludgeoning", None, ["ammunition"], 0, 0.1, rn=30, rl=120)
# Marciales cuerpo a cuerpo
_weapon("Hacha de batalla", "battleaxe", "Martial", "Melee", "1d8", "slashing", "1d10", ["versatile"], 4, 10)
_weapon("Mangual", "flail", "Martial", "Melee", "1d8", "bludgeoning", None, [], 2, 10)
_weapon("Guja", "glaive", "Martial", "Melee", "1d10", "slashing", None, ["heavy", "reach", "two_handed"], 6, 20)
_weapon("Gran hacha", "greataxe", "Martial", "Melee", "1d12", "slashing", None, ["heavy", "two_handed"], 7, 30)
_weapon("Espadón", "greatsword", "Martial", "Melee", "2d6", "slashing", None, ["heavy", "two_handed"], 6, 50)
_weapon("Alabarda", "halberd", "Martial", "Melee", "1d10", "slashing", None, ["heavy", "reach", "two_handed"], 6, 20)
_weapon("Lanza de caballería", "lance", "Martial", "Melee", "1d12", "piercing", None, ["reach", "special"], 6, 10)
_weapon("Espada larga", "longsword", "Martial", "Melee", "1d8", "slashing", "1d10", ["versatile"], 3, 15)
_weapon("Maza de guerra", "maul", "Martial", "Melee", "2d6", "bludgeoning", None, ["heavy", "two_handed"], 10, 10)
_weapon("Lucero del alba", "morningstar", "Martial", "Melee", "1d8", "piercing", None, [], 4, 15)
_weapon("Pica", "pike", "Martial", "Melee", "1d10", "piercing", None, ["heavy", "reach", "two_handed"], 18, 5)
_weapon("Estoque", "rapier", "Martial", "Melee", "1d8", "piercing", None, ["finesse"], 2, 25)
_weapon("Cimitarra", "scimitar", "Martial", "Melee", "1d6", "slashing", None, ["finesse", "light"], 3, 25)
_weapon("Espada corta", "shortsword", "Martial", "Melee", "1d6", "piercing", None, ["finesse", "light"], 2, 10)
_weapon("Tridente", "trident", "Martial", "Melee", "1d6", "piercing", "1d8", ["thrown", "versatile"], 4, 5, tn=20, tl=60)
_weapon("Pico de guerra", "war-pick", "Martial", "Melee", "1d8", "piercing", None, [], 2, 5)
_weapon("Martillo de guerra", "warhammer", "Martial", "Melee", "1d8", "bludgeoning", "1d10", ["versatile"], 2, 15)
_weapon("Látigo", "whip", "Martial", "Melee", "1d4", "slashing", None, ["finesse", "reach"], 3, 2)
# Marciales a distancia
_weapon("Cerbatana", "blowgun", "Martial", "Ranged", "1", "piercing", None, ["ammunition", "loading"], 1, 10, rn=25, rl=100)
_weapon("Ballesta de mano", "crossbow-hand", "Martial", "Ranged", "1d6", "piercing", None, ["ammunition", "light", "loading"], 3, 75, rn=30, rl=120)
_weapon("Ballesta pesada", "crossbow-heavy", "Martial", "Ranged", "1d10", "piercing", None, ["ammunition", "heavy", "loading", "two_handed"], 18, 50, rn=100, rl=400)
_weapon("Arco largo", "longbow", "Martial", "Ranged", "1d8", "piercing", None, ["ammunition", "heavy", "two_handed"], 2, 50, rn=150, rl=600)
_weapon("Red", "net", "Martial", "Ranged", None, None, None, ["special", "thrown"], 3, 1, tn=5, tl=15)

# 5.6 Munición
for es, slug, gp, w in [
    ("Flechas (20)", "arrows", 1, 1), ("Virotes (20)", "bolts", 1, 1.5),
    ("Balas de honda (20)", "sling-bullets", 0.04, 1.5), ("Agujas de cerbatana (50)", "blowgun-needles", 1, 1),
]:
    add(name=es, dnd5eapi_index=slug, type="ammunition", description="Munición.",
        weight=w, value_gp=gp)


# ═══════════════════════════════════════════════════════════════
#  6. HERRAMIENTAS Y KITS  (type tool)
#  (es, slug, desc, weight, gp)
# ═══════════════════════════════════════════════════════════════
_TOOLS = [
    ("Suministros de alquimista", "alchemists-supplies", "Crear pociones básicas e identificar sustancias (INT).", 8, 50),
    ("Suministros de cervecero", "brewers-supplies", "Fabricar alcohol e identificar bebidas (INT).", 9, 20),
    ("Suministros de calígrafo", "calligraphers-supplies", "Copiar pergaminos, falsificar documentos (DES).", 5, 10),
    ("Herramientas de carpintero", "carpenters-tools", "Construir o reparar estructuras de madera (FUE).", 6, 8),
    ("Herramientas de cartógrafo", "cartographers-tools", "Crear mapas y navegar terrenos (INT).", 6, 15),
    ("Herramientas de zapatero", "cobblers-tools", "Reparar calzado (DES).", 5, 5),
    ("Utensilios de cocinero", "cooks-utensils", "Preparar comidas con efectos de recuperación (SAB).", 8, 1),
    ("Herramientas de vidriero", "glassblowers-tools", "Crear objetos de vidrio y lentes (DES).", 5, 30),
    ("Herramientas de joyero", "jewelers-tools", "Tasar gemas y reparar joyería (INT).", 2, 25),
    ("Herramientas de peletero", "leatherworkers-tools", "Crear armadura de cuero y artículos (DES).", 5, 5),
    ("Herramientas de albañil", "masons-tools", "Trabajo en piedra (FUE).", 8, 10),
    ("Suministros de pintor", "painters-supplies", "Crear pinturas y retratos (SAB).", 5, 10),
    ("Herramientas de alfarero", "potters-tools", "Crear cerámica (DES).", 3, 10),
    ("Herramientas de herrero", "smiths-tools", "Forjar y reparar metal (FUE).", 8, 20),
    ("Herramientas de hojalatero", "tinkers-tools", "Reparar mecanismos y crear artilugios (DES).", 10, 50),
    ("Herramientas de tejedor", "weavers-tools", "Crear tela y ropa (DES).", 5, 1),
    ("Herramientas de tallador", "woodcarvers-tools", "Tallar madera y crear flechas (DES).", 5, 1),
    ("Gaita", "bagpipes", "Instrumento musical (Interpretación).", 6, 30),
    ("Tambor", "drum", "Instrumento musical (Interpretación).", 3, 6),
    ("Dulcémele", "dulcimer", "Instrumento musical (Interpretación).", 10, 25),
    ("Flauta", "flute", "Instrumento musical (Interpretación).", 1, 2),
    ("Cuerno", "horn", "Instrumento musical (Interpretación).", 2, 3),
    ("Laúd", "lute", "Instrumento musical (Interpretación).", 2, 35),
    ("Lira", "lyre", "Instrumento musical (Interpretación).", 2, 30),
    ("Flauta de pan", "pan-flute", "Instrumento musical (Interpretación).", 2, 12),
    ("Chirimía", "shawm", "Instrumento musical (Interpretación).", 1, 2),
    ("Viola", "viol", "Instrumento musical (Interpretación).", 1, 30),
    ("Dados", "dice-set", "Juego de azar (Engaño / Perspicacia).", 0, 0.1),
    ("Cartas", "playing-card-set", "Juego de azar (Engaño / Perspicacia).", 0, 0.5),
    ("Ajedrez dragón", "dragonchess-set", "Juego de estrategia (Historia).", 0.5, 1),
    ("Herramientas de ladrón", "thieves-tools", "Abrir cerraduras y desactivar trampas (DES).", 1, 25),
    ("Kit de herboristería", "herbalism-kit", "Identificar plantas y crear pociones de curación (SAB).", 3, 5),
    ("Kit de curandero", "healers-kit", "10 usos; estabilizar heridos sin tirada (Medicina).", 3, 5),
    ("Kit de envenenador", "poisoners-kit", "Crear y aplicar venenos (INT).", 2, 50),
    ("Herramientas de navegante", "navigators-tools", "Navegación marítima y orientación (SAB).", 2, 25),
    ("Kit de disfraz", "disguise-kit", "Crear disfraces (CAR/DES).", 3, 25),
    ("Kit de falsificación", "forgery-kit", "Falsificar documentos y sellos (DES).", 5, 15),
]
for es, slug, desc, w, gp in _TOOLS:
    add(name=es, dnd5eapi_index=slug, type="tool", description=desc, weight=w, value_gp=gp)
# El kit de curandero es consumible
for it in ITEMS:
    if it["dnd5eapi_index"] == "healers-kit":
        it["is_consumable"] = True
        it["charges_max"] = 10


# ═══════════════════════════════════════════════════════════════
#  7. ADVENTURING GEAR  (type gear)
#  (es, slug, desc, weight, gp)
# ═══════════════════════════════════════════════════════════════
_GEAR = [
    ("Antorcha", "torch", "Luz brillante 20 ft por 1 hora. Arma improvisada (1 fuego).", 1, 0.01),
    ("Vela", "candle", "Luz brillante 5 ft por 1 hora.", 0, 0.01),
    ("Linterna bullseye", "bullseye-lantern", "Cono de luz 60 ft; 6 h por frasco de aceite.", 2, 10),
    ("Linterna encapuchada", "hooded-lantern", "Luz 30 ft; 6 h por frasco de aceite; encapuchable.", 2, 5),
    ("Frasco de aceite", "oil-flask", "Combustible (6 h) o arma arrojadiza.", 1, 0.1),
    ("Mochila", "backpack", "Contenedor principal: 1 pie³ / 30 lb.", 5, 2),
    ("Barril", "barrel", "40 galones líquido / 4 pies³.", 70, 2),
    ("Cesto", "basket", "2 pies³ / 40 lb.", 2, 0.4),
    ("Cofre", "chest", "12 pies³ / 300 lb.", 25, 5),
    ("Bolsa de componentes", "component-pouch", "Sustituye componentes materiales sin precio.", 2, 25),
    ("Odre", "waterskin", "4 pintas de líquido; agua para 1 día.", 5, 0.2),
    ("Bolsita", "pouch", "Guarda monedas u objetos pequeños (6 lb).", 1, 0.5),
    ("Saco", "sack", "1 pie³ / 30 lb.", 0.5, 0.01),
    ("Vial", "vial", "4 onzas de líquido.", 0, 1),
    ("Cuerda de cáñamo (50 ft)", "rope-hempen", "Romper: CD 17 FUE.", 10, 1),
    ("Cuerda de seda (50 ft)", "rope-silk", "Romper: CD 20 FUE.", 5, 10),
    ("Cadena (10 ft)", "chain", "Romper: CD 20 FUE.", 10, 5),
    ("Esposas", "manacles", "Escapar: CD 20 DES; romper: CD 20 FUE.", 6, 2),
    ("Gancho de escalada", "grappling-hook", "Asegurar cuerdas en alturas.", 4, 2),
    ("Piqueta de hierro", "piton", "Soporta hasta 250 lb.", 0.25, 0.05),
    ("Kit de escalador", "climbers-kit", "Ventaja para anclarse al escalar.", 12, 25),
    ("Palanca", "crowbar", "Ventaja en FUE para apalancar.", 5, 2),
    ("Martillo", "hammer", "Clavar piquetas; arma improvisada 1d4.", 3, 1),
    ("Pala", "shovel", "Cavar; 1 pie³ cada 10 min.", 5, 2),
    ("Raciones (1 día)", "rations", "Comida para 1 persona por 1 día.", 2, 0.5),
    ("Caja de yesca", "tinderbox", "Encender fuego en 1 acción.", 1, 0.5),
    ("Kit de cama rodante", "bedroll", "Dormir cómodamente; descanso largo válido.", 7, 1),
    ("Manta", "blanket", "Confort en clima frío.", 3, 0.5),
    ("Menaje de campaña", "mess-kit", "Cocinar y comer sin penalización.", 1, 0.2),
    ("Tienda (2 personas)", "tent", "Protección contra la intemperie.", 20, 2),
    ("Tinta (1 onza)", "ink", "Escribir documentos.", 0, 10),
    ("Papel (1 hoja)", "paper", "Documentos.", 0, 0.2),
    ("Pergamino (1 hoja)", "parchment", "Documentos o hechizos copiados.", 0, 0.1),
    ("Espejo de acero", "steel-mirror", "Ver esquinas o hacer señales.", 0.5, 5),
    ("Catalejo", "spyglass", "×2 zoom; ventaja en Percepción a distancia.", 1, 1000),
    ("Lupa", "magnifying-glass", "Ventaja en Arcanos/Investigación de detalles.", 0, 100),
    ("Ropa común", "clothes-common", "Sin protección.", 3, 0.5),
    ("Ropa fina", "clothes-fine", "Persuasión en contextos nobles.", 6, 15),
    ("Ropa de viaje", "clothes-travelers", "Resistencia al clima.", 4, 2),
    ("Símbolo sagrado (amuleto)", "holy-symbol-amulet", "Foco divino para lanzadores.", 1, 5),
]
for es, slug, desc, w, gp in _GEAR:
    add(name=es, dnd5eapi_index=slug, type="gear", description=desc, weight=w, value_gp=gp)


# ═══════════════════════════════════════════════════════════════
#  9. CONSUMIBLES
# ═══════════════════════════════════════════════════════════════
# 9.1 Pociones de curación
_POTIONS_HEAL = [
    ("Poción de curación", "potion-healing", "common", "Restaura 2d4+2 PG (1 acción).", 50),
    ("Poción de curación mayor", "potion-greater-healing", "uncommon", "Restaura 4d4+4 PG.", 150),
    ("Poción de curación superior", "potion-superior-healing", "rare", "Restaura 8d4+8 PG.", 450),
    ("Poción de curación suprema", "potion-supreme-healing", "very_rare", "Restaura 10d4+20 PG.", 1350),
]
# 9.1 Fuerza de gigante
_POTIONS_STR = [
    ("Poción de fuerza de gigante de las colinas", "potion-hill-giant-strength", "uncommon", "FUE 21 durante 1 hora.", 200),
    ("Poción de fuerza de gigante de piedra", "potion-stone-giant-strength", "rare", "FUE 23 durante 1 hora.", 400),
    ("Poción de fuerza de gigante de fuego", "potion-fire-giant-strength", "rare", "FUE 25 durante 1 hora.", 400),
    ("Poción de fuerza de gigante de las nubes", "potion-cloud-giant-strength", "very_rare", "FUE 27 durante 1 hora.", 1000),
    ("Poción de fuerza de gigante de las tormentas", "potion-storm-giant-strength", "legendary", "FUE 29 durante 1 hora.", 10000),
]
# 9.1 Otras
_POTIONS_OTHER = [
    ("Poción de trepar", "potion-climbing", "common", "Velocidad de escalar; ventaja en Atletismo (escalar) 1 h.", 75),
    ("Poción de heroísmo", "potion-heroism", "uncommon", "+10 PG temporales y Bless durante 1 hora.", 180),
    ("Poción de invisibilidad", "potion-invisibility", "very_rare", "Invisibilidad durante 1 hora.", 180),
    ("Poción de vuelo", "potion-flying", "very_rare", "Velocidad de vuelo durante 1 hora.", 500),
    ("Poción de resistencia", "potion-resistance", "uncommon", "Resistencia a un tipo de daño 1 hora.", 300),
    ("Poción de velocidad", "potion-speed", "very_rare", "Efecto de Haste durante 1 minuto.", 400),
    ("Poción de respirar bajo el agua", "potion-water-breathing", "uncommon", "Respirar bajo el agua 1 hora.", 180),
    ("Poción de crecimiento", "potion-growth", "uncommon", "Tamaño Grande (Enlarge) 1d4 horas.", 150),
    ("Poción de veneno", "potion-poison", "uncommon", "Aparenta ser curación; 3d6 veneno, CD 13 CON.", 100),
]
for es, slug, rar, desc, gp in _POTIONS_HEAL + _POTIONS_STR + _POTIONS_OTHER:
    attune = rar in ("very_rare", "legendary") and "strength" in slug
    add(name=es, dnd5eapi_index=slug, type="potion", rarity=rar, description=desc,
        weight=0.5, value_gp=gp, is_magical=True, is_consumable=True,
        requires_attunement=False, source_book="DMG")

# 9.2 Pergaminos de hechizo
_SCROLLS = [
    ("Pergamino de hechizo (truco)", "spell-scroll-cantrip", "common", 25),
    ("Pergamino de hechizo (nivel 1)", "spell-scroll-1", "common", 75),
    ("Pergamino de hechizo (nivel 2)", "spell-scroll-2", "uncommon", 150),
    ("Pergamino de hechizo (nivel 3)", "spell-scroll-3", "uncommon", 300),
    ("Pergamino de hechizo (nivel 4)", "spell-scroll-4", "rare", 500),
    ("Pergamino de hechizo (nivel 5)", "spell-scroll-5", "rare", 1000),
    ("Pergamino de hechizo (nivel 6)", "spell-scroll-6", "very_rare", 2000),
    ("Pergamino de hechizo (nivel 7)", "spell-scroll-7", "very_rare", 4000),
    ("Pergamino de hechizo (nivel 8)", "spell-scroll-8", "very_rare", 8000),
    ("Pergamino de hechizo (nivel 9)", "spell-scroll-9", "legendary", 20000),
]
for es, slug, rar, gp in _SCROLLS:
    add(name=es, dnd5eapi_index=slug, type="spell_scroll", rarity=rar,
        description="Contiene un hechizo escrito; se destruye al usarse.",
        weight=0, value_gp=gp, is_magical=True, is_consumable=True, source_book="DMG")

# 9.3 Venenos (type other, consumible)
_POISONS = [
    ("Sangre de asesino", "assassins-blood", "Ingerido; 1d12 veneno, CD 10 CON.", 150),
    ("Veneno drow", "drow-poison", "Herida; inconsciente 1 h, CD 13 CON.", 200),
    ("Esencia de éter", "essence-of-ether", "Inhalado; inconsciente 8 h, CD 15 CON.", 300),
    ("Aceite de taggit", "oil-of-taggit", "Contacto; inconsciente 24 h, CD 13 CON.", 400),
    ("Tintura pálida", "pale-tincture", "Ingerido; 3d6 veneno/día por 10 días, CD 16 CON.", 250),
    ("Veneno de gusano púrpura", "purple-worm-poison", "Herida; 12d6 veneno, CD 19 CON.", 2000),
    ("Veneno de serpiente", "serpent-venom", "Herida; 3d6 veneno, CD 11 CON.", 200),
    ("Veneno de wyvern", "wyvern-poison", "Herida; 7d6 veneno, CD 15 CON.", 1200),
    ("Veneno básico", "basic-poison", "Herida; 1d4 veneno, CD 10 CON.", 100),
]
for es, slug, desc, gp in _POISONS:
    add(name=es, dnd5eapi_index=slug, type="other", description="Veneno. " + desc,
        weight=0, value_gp=gp, is_consumable=True, source_book="DMG")

# 9.5 Misc consumible (mundano)
_MISC_CONS = [
    ("Ácido (frasco)", "acid-vial", "2d6 daño ácido al arrojarlo (acción).", 25),
    ("Fuego de alquimista", "alchemists-fire", "1d4 fuego/turno hasta apagarlo (CD 10 DES).", 50),
    ("Agua bendita (frasco)", "holy-water", "2d6 radiante a no-muertos y demonios al arrojarla.", 25),
    ("Antitoxina", "antitoxin", "Ventaja en salvaciones vs. veneno 1 hora.", 50),
    ("Barra de humo", "smokestick", "Nube de humo 10 ft de radio, 1 minuto.", 10),
    ("Bolsa pegajosa", "tanglefoot-bag", "CD 15 FUE o velocidad 0.", 50),
    ("Piedra del trueno", "thunderstone", "CD 15 CON o ensordecer 1 hora.", 30),
]
for es, slug, desc, gp in _MISC_CONS:
    add(name=es, dnd5eapi_index=slug, type="gear", description=desc,
        weight=1, value_gp=gp, is_consumable=True)


# ═══════════════════════════════════════════════════════════════
#  10. MONTURAS Y VEHÍCULOS  (type vehicle)
# ═══════════════════════════════════════════════════════════════
_MOUNTS = [
    ("Camello", "camel", "Montura. Velocidad 50 ft; carga 480 lb.", 50),
    ("Burro / Mulo", "mule", "Montura de carga. Velocidad 40 ft; carga 420 lb.", 8),
    ("Elefante", "elephant", "Montura pesada. Velocidad 40 ft; carga 1320 lb.", 200),
    ("Caballo de tiro", "draft-horse", "Velocidad 40 ft; carga 540 lb.", 50),
    ("Caballo de monta", "riding-horse", "Velocidad 60 ft; carga 480 lb.", 75),
    ("Caballo de guerra", "warhorse", "Entrenado para combate. Velocidad 60 ft; carga 540 lb.", 400),
    ("Mastín", "mastiff", "Velocidad 40 ft; carga 195 lb.", 25),
    ("Poni", "pony", "Velocidad 40 ft; carga 225 lb.", 30),
]
_MOUNT_GEAR = [
    ("Bocado y brida", "bit-and-bridle", 2), ("Silla de monta", "riding-saddle", 10),
    ("Silla militar", "military-saddle", 20), ("Silla de carga", "pack-saddle", 5),
    ("Alforjas", "saddlebags", 4),
]
_VEHICLES = [
    ("Carruaje", "carriage", "Vehículo terrestre. Capacidad 2700 lb.", 100),
    ("Carreta", "cart", "Vehículo terrestre. Capacidad 200 lb.", 15),
    ("Vagón", "wagon", "Vehículo terrestre. Capacidad 4000 lb.", 35),
    ("Bote de remos", "rowboat", "Embarcación pequeña.", 50),
    ("Barco de vela", "sailing-ship", "Embarcación grande.", 10000),
    ("Galera", "galley", "Embarcación de guerra.", 30000),
]
for es, slug, desc, gp in _MOUNTS:
    add(name=es, dnd5eapi_index=slug, type="vehicle", description=desc, value_gp=gp)
for es, slug, gp in _MOUNT_GEAR:
    add(name=es, dnd5eapi_index=slug, type="gear", description="Equipo de montura.", value_gp=gp)
for es, slug, desc, gp in _VEHICLES:
    add(name=es, dnd5eapi_index=slug, type="vehicle", description=desc, value_gp=gp)


# ═══════════════════════════════════════════════════════════════
#  11. OBJETOS MÁGICOS (selección representativa)
# ═══════════════════════════════════════════════════════════════
# Armas y armaduras mágicas genéricas +1/+2/+3
for bonus, rar in [(1, "uncommon"), (2, "rare"), (3, "very_rare")]:
    add(name=f"Arma +{bonus}", dnd5eapi_index=f"weapon-plus-{bonus}", type="weapon", rarity=rar,
        description=f"Bonificador +{bonus} a las tiradas de ataque y daño con esta arma mágica.",
        weight=0, value_gp=None, is_magical=True, source_book="DMG",
        magical_properties={"bonus_attack": bonus, "bonus_damage": bonus})
    add(name=f"Armadura +{bonus}", dnd5eapi_index=f"armor-plus-{bonus}", type="armor", rarity=rar,
        description=f"Bonificador +{bonus} a la CA mientras se lleva esta armadura mágica.",
        weight=0, value_gp=None, is_magical=True, source_book="DMG",
        magical_properties={"bonus_ac": bonus})

# Objetos mágicos concretos: (es, slug, type, rarity, attune, desc, mprops)
_MAGIC = [
    ("Lengua de fuego", "flame-tongue", "weapon", "rare", True,
     "Espada que puede prender en llamas: +2d6 de daño de fuego al activarla.", {"bonus_damage_extra": "2d6 fuego"}),
    ("Espada solar", "sun-blade", "weapon", "rare", True,
     "+2 ataque y daño; +1d8 contra no-muertos; emite luz solar.", {"bonus_attack": 2, "bonus_damage": 2}),
    ("Daga del veneno", "dagger-of-venom", "weapon", "rare", False,
     "+1 ataque y daño; 1×/día envenena (2d10 veneno, CD 15 CON).", {"bonus_attack": 1, "bonus_damage": 1}),
    ("Armadura de mithral", "mithral-armor", "armor", "uncommon", False,
     "Sin desventaja en Sigilo ni requisito de FUE.", {"removes_stealth_disadvantage": True}),
    ("Armadura de adamantina", "adamantine-armor", "armor", "uncommon", False,
     "Los golpes críticos contra el portador se convierten en golpes normales.", {"no_crits": True}),
    ("Capa de protección", "cloak-of-protection", "wondrous", "uncommon", True,
     "+1 a la CA y +1 a todas las salvaciones.", {"bonus_ac": 1, "bonus_saves": 1}),
    ("Capa élfica", "cloak-of-elvenkind", "wondrous", "uncommon", True,
     "Ventaja en Sigilo; desventaja en Percepción para verte.", {}),
    ("Botas de zancada y salto", "boots-of-striding-and-springing", "wondrous", "uncommon", True,
     "Velocidad mínima 30 ft; saltas tres veces más lejos.", {}),
    ("Botas aladas", "winged-boots", "wondrous", "uncommon", True,
     "Velocidad de vuelo 30 ft hasta 4 horas (recarga en descanso largo).", {}),
    ("Guanteletes de fuerza de ogro", "gauntlets-of-ogre-power", "wondrous", "uncommon", True,
     "Tu FUE pasa a 19 mientras los llevas.", {"set_strength": 19}),
    ("Cinturón de fuerza de gigante de las colinas", "belt-of-hill-giant-strength", "wondrous", "rare", True,
     "Tu FUE pasa a 21 mientras lo llevas.", {"set_strength": 21}),
    ("Yelmo de telepatía", "helm-of-telepathy", "wondrous", "uncommon", True,
     "Detectar pensamientos a voluntad; telepatía con un objetivo.", {}),
    ("Sombrero de disfraz", "hat-of-disguise", "wondrous", "uncommon", True,
     "Lanzar Disfrazarse a voluntad.", {}),
    ("Anillo de protección", "ring-of-protection", "ring", "rare", True,
     "+1 a la CA y +1 a todas las salvaciones.", {"bonus_ac": 1, "bonus_saves": 1}),
    ("Bolsa de contención", "bag-of-holding", "wondrous", "uncommon", False,
     "Espacio interior mayor que el exterior; hasta 500 lb / 64 pies³.", {}),
]
for es, slug, typ, rar, attune, desc, mprops in _MAGIC:
    add(name=es, dnd5eapi_index=slug, type=typ, rarity=rar, description=desc,
        weight=1, value_gp=None, is_magical=True, requires_attunement=attune,
        attunement_restriction=None, magical_properties=mprops, source_book="DMG")


# ═══════════════════════════════════════════════════════════════
#  APLICACIÓN
# ═══════════════════════════════════════════════════════════════
INDEX_SQL = "CREATE UNIQUE INDEX IF NOT EXISTS uq_items_dnd5eapi_index ON items(dnd5eapi_index);"


async def apply():
    import asyncpg
    dsn = re.sub(r"\?sslmode=\w+", "", os.environ["DATABASE_URL"])
    ssl_ctx = ssl.create_default_context(cafile=str(CA_CERT)) if CA_CERT.exists() else None
    conn = await asyncpg.connect(dsn, ssl=ssl_ctx)

    # Casts: type::item_type, rarity::item_rarity, magical_properties::jsonb
    ph = []
    for i, c in enumerate(COLUMNS):
        n = f"${i+1}"
        if c == "type":
            ph.append(f"{n}::item_type")
        elif c == "rarity":
            ph.append(f"{n}::item_rarity")
        elif c == "magical_properties":
            ph.append(f"{n}::jsonb")
        else:
            ph.append(n)
    upsert = f"""
    INSERT INTO items ({", ".join(COLUMNS)})
    VALUES ({", ".join(ph)})
    ON CONFLICT (dnd5eapi_index) DO UPDATE SET
        {", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS if c != "dnd5eapi_index")}
    """

    await conn.execute(INDEX_SQL)
    print(f"Índice único asegurado. Sembrando {len(ITEMS)} ítems...")

    ok = 0
    for row in ITEMS:
        vals = []
        for c in COLUMNS:
            v = row.get(c)
            if c == "magical_properties":
                v = json.dumps(v) if v is not None else "{}"
            vals.append(v)
        try:
            await conn.execute(upsert, *vals)
            ok += 1
        except Exception as e:
            print(f"  ✗ {row['dnd5eapi_index']}: {str(e)[:100]}")
    await conn.close()
    print(f"✅ {ok}/{len(ITEMS)} ítems sembrados/actualizados.")


def dry_run():
    from collections import Counter
    by_type = Counter(i["type"] for i in ITEMS)
    slugs = [i["dnd5eapi_index"] for i in ITEMS]
    dupes = [s for s, n in Counter(slugs).items() if n > 1]
    print(f"Total ítems: {len(ITEMS)}")
    print("Por tipo:", dict(sorted(by_type.items())))
    print("Slugs duplicados:", dupes or "ninguno")
    # Validar enums básicos
    valid_types = {"weapon", "armor", "potion", "spell_scroll", "ring", "rod", "staff",
                   "wand", "wondrous", "tool", "ammunition", "gear", "treasure", "vehicle", "other"}
    valid_rar = {"common", "uncommon", "rare", "very_rare", "legendary", "artifact"}
    bad = [(i["name"], i["type"], i["rarity"]) for i in ITEMS
           if i["type"] not in valid_types or i["rarity"] not in valid_rar]
    print("Filas con enum inválido:", bad or "ninguna")
    sample = ITEMS[15]
    print("\nMuestra:", json.dumps({k: sample[k] for k in
          ["name", "type", "damage_dice", "weapon_properties", "ac_base"]}, ensure_ascii=False))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    if args.dry_run:
        dry_run()
    else:
        asyncio.run(apply())
