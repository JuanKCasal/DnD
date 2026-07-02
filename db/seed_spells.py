"""
DnD Community Manager — Seeder del catálogo de HECHIZOS (SRD 5.1)
Fase H2. Poblado desde la SRD 5.1 (OGL) vía 5e-bits / dnd5eapi.

Uso:
    python db/seed_spells.py               # descarga (o usa cache) + upsert contra la BD
    python db/seed_spells.py --dry-run     # no conecta a la BD; imprime conteos y muestra
    python db/seed_spells.py --refresh     # fuerza re-descarga de la fuente (ignora cache)

Fuente de datos: se descarga UNA vez a db/data/srd_spells.json y queda versionada,
de modo que las siguientes ejecuciones (y Railway) NO requieren red.

Idempotente: índice único en spells.dnd5eapi_index + ON CONFLICT DO UPDATE.

Nota de idioma: las descripciones son el texto oficial SRD (inglés, OGL). Los nombres
se muestran en español cuando existe traducción en SPANISH_NAMES; si no, se usa el
nombre en inglés (name_en siempre poblado). Todo es editable luego desde el catálogo
admin (Fase H3).
"""
import argparse
import asyncio
import json
import os
import re
import ssl
import urllib.request
from collections import Counter
from pathlib import Path

# ── Carga de .env (igual que migrate.py / seed_items.py) ──────────────
ROOT = Path(__file__).parent.parent
env_path = ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

CA_CERT = ROOT / os.environ.get("AIVEN_CA_CERT", "certs/ca.pem")
DATA_DIR = ROOT / "db" / "data"
CACHE_FILE = DATA_DIR / "srd_spells.json"

# Fuente bulk (mismo esquema que dnd5eapi, un solo archivo). Override con env SRD_SPELLS_URL.
SRD_BULK_URL = os.environ.get(
    "SRD_SPELLS_URL",
    "https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en/5e-SRD-Spells.json",
)

# Claves canónicas de clase lanzadora (deben coincidir con spell_model.SPELLCASTER_CLASSES)
CANONICAL_CLASSES = {
    "bard", "cleric", "druid", "paladin", "ranger",
    "sorcerer", "warlock", "wizard",
    "eldritch_knight", "arcane_trickster",
}

# Columnas gestionadas por el seeder (deben existir en la tabla spells)
COLUMNS = [
    "name", "name_en", "level", "school",
    "casting_time", "casting_time_type", "range_text", "range_type", "range_feet",
    "comp_verbal", "comp_somatic", "comp_material", "material_description",
    "material_cost_gp", "material_consumed",
    "duration", "concentration", "ritual",
    "description", "higher_levels",
    "requires_attack_roll", "saving_throw", "damage_dice", "damage_type",
    "classes", "source_book", "dnd5eapi_index",
]

# ── Traducción de nombres al español — SRD 5.1 completo (319) ─────────
# Cobertura total; el fallback a inglés solo aplicaría a hechizos fuera de la SRD.
# Los admins pueden editar cualquier nombre desde el catálogo (H3).
SPANISH_NAMES = {
    "acid-arrow": "Flecha ácida",
    "acid-splash": "Salpicadura ácida",
    "aid": "Auxilio",
    "alarm": "Alarma",
    "alter-self": "Alterar el yo",
    "animal-friendship": "Amistad animal",
    "animal-messenger": "Mensajero animal",
    "animal-shapes": "Formas animales",
    "animate-dead": "Animar muertos",
    "animate-objects": "Animar objetos",
    "antilife-shell": "Caparazón antivida",
    "antimagic-field": "Campo antimagia",
    "antipathy-sympathy": "Antipatía/simpatía",
    "arcane-eye": "Ojo arcano",
    "arcane-hand": "Mano arcana",
    "arcane-lock": "Cerradura arcana",
    "arcane-sword": "Espada arcana",
    "arcanists-magic-aura": "Aura mágica del arcanista",
    "astral-projection": "Proyección astral",
    "augury": "Augurio",
    "awaken": "Despertar",
    "bane": "Perdición",
    "banishment": "Destierro",
    "barkskin": "Piel de corteza",
    "beacon-of-hope": "Faro de esperanza",
    "bestow-curse": "Otorgar maldición",
    "black-tentacles": "Tentáculos negros de Evard",
    "blade-barrier": "Barrera de cuchillas",
    "bless": "Bendición",
    "blight": "Marchitar",
    "blindness-deafness": "Ceguera/sordera",
    "blink": "Parpadeo",
    "blur": "Difuminar",
    "branding-smite": "Golpe marcador",
    "burning-hands": "Manos ardientes",
    "call-lightning": "Convocar relámpagos",
    "calm-emotions": "Calmar emociones",
    "chain-lightning": "Cadena de relámpagos",
    "charm-person": "Embrujar persona",
    "chill-touch": "Toque helado",
    "circle-of-death": "Círculo de la muerte",
    "clairvoyance": "Clarividencia",
    "clone": "Clon",
    "cloudkill": "Nube mortal",
    "color-spray": "Chorro de colores",
    "command": "Orden",
    "commune": "Comunión",
    "commune-with-nature": "Comunión con la naturaleza",
    "comprehend-languages": "Comprender idiomas",
    "compulsion": "Compulsión",
    "cone-of-cold": "Cono de frío",
    "confusion": "Confusión",
    "conjure-animals": "Convocar animales",
    "conjure-celestial": "Convocar celestial",
    "conjure-elemental": "Convocar elemental",
    "conjure-fey": "Convocar feérico",
    "conjure-minor-elementals": "Convocar elementales menores",
    "conjure-woodland-beings": "Convocar seres del bosque",
    "contact-other-plane": "Contactar otro plano",
    "contagion": "Contagio",
    "contingency": "Contingencia",
    "continual-flame": "Llama continua",
    "control-water": "Controlar el agua",
    "control-weather": "Controlar el clima",
    "counterspell": "Contrahechizo",
    "create-food-and-water": "Crear comida y agua",
    "create-or-destroy-water": "Crear o destruir agua",
    "create-undead": "Crear no-muerto",
    "creation": "Creación",
    "cure-wounds": "Curar heridas",
    "dancing-lights": "Luces danzantes",
    "darkness": "Oscuridad",
    "darkvision": "Visión en la oscuridad",
    "daylight": "Luz del día",
    "death-ward": "Salvaguarda contra la muerte",
    "delayed-blast-fireball": "Bola de fuego de estallido retardado",
    "demiplane": "Semiplano",
    "detect-evil-and-good": "Detectar el bien y el mal",
    "detect-magic": "Detectar magia",
    "detect-poison-and-disease": "Detectar venenos y enfermedades",
    "detect-thoughts": "Detectar pensamientos",
    "dimension-door": "Puerta dimensional",
    "disguise-self": "Disfrazarse",
    "disintegrate": "Desintegrar",
    "dispel-evil-and-good": "Disipar el bien y el mal",
    "dispel-magic": "Disipar magia",
    "divination": "Adivinación",
    "divine-favor": "Favor divino",
    "divine-word": "Palabra divina",
    "dominate-beast": "Dominar bestia",
    "dominate-monster": "Dominar monstruo",
    "dominate-person": "Dominar persona",
    "dream": "Sueños",
    "druidcraft": "Artesanía druídica",
    "earthquake": "Terremoto",
    "eldritch-blast": "Estallido sobrenatural",
    "enhance-ability": "Mejorar característica",
    "enlarge-reduce": "Agrandar/reducir",
    "entangle": "Enmarañar",
    "enthrall": "Cautivar",
    "etherealness": "Etereidad",
    "expeditious-retreat": "Retirada expeditiva",
    "eyebite": "Mal de ojo",
    "fabricate": "Fabricar",
    "faerie-fire": "Fuego feérico",
    "faithful-hound": "Sabueso fiel de Mordenkainen",
    "false-life": "Vida falsa",
    "fear": "Miedo",
    "feather-fall": "Caída de pluma",
    "feeblemind": "Mente débil",
    "find-familiar": "Encontrar familiar",
    "find-steed": "Encontrar montura",
    "find-the-path": "Encontrar el camino",
    "find-traps": "Encontrar trampas",
    "finger-of-death": "Dedo de la muerte",
    "fire-bolt": "Descarga de fuego",
    "fire-shield": "Escudo de fuego",
    "fire-storm": "Tormenta de fuego",
    "fireball": "Bola de fuego",
    "flame-blade": "Hoja llameante",
    "flame-strike": "Descarga llameante",
    "flaming-sphere": "Esfera flamígera",
    "flesh-to-stone": "Carne a piedra",
    "floating-disk": "Disco flotante de Tenser",
    "fly": "Volar",
    "fog-cloud": "Nube de niebla",
    "forbiddance": "Interdicción",
    "forcecage": "Jaula de fuerza",
    "foresight": "Presciencia",
    "freedom-of-movement": "Libertad de movimiento",
    "freezing-sphere": "Esfera congelante",
    "gaseous-form": "Forma gaseosa",
    "gate": "Portal",
    "geas": "Mandato",
    "gentle-repose": "Reposo apacible",
    "giant-insect": "Insecto gigante",
    "glibness": "Labia",
    "globe-of-invulnerability": "Globo de invulnerabilidad",
    "glyph-of-warding": "Glifo custodio",
    "goodberry": "Baya nutritiva",
    "grease": "Grasa",
    "greater-invisibility": "Invisibilidad mayor",
    "greater-restoration": "Restauración mayor",
    "guardian-of-faith": "Guardián de la fe",
    "guards-and-wards": "Guardias y salvaguardas",
    "guidance": "Orientación",
    "guiding-bolt": "Proyectil guía",
    "gust-of-wind": "Ráfaga de viento",
    "hallow": "Consagrar",
    "hallucinatory-terrain": "Terreno alucinatorio",
    "harm": "Dañar",
    "haste": "Prisa",
    "heal": "Sanar",
    "healing-word": "Palabra de curación",
    "heat-metal": "Calentar metal",
    "hellish-rebuke": "Reprimenda infernal",
    "heroes-feast": "Festín de héroes",
    "heroism": "Heroísmo",
    "hideous-laughter": "Risa horrible de Tasha",
    "hold-monster": "Inmovilizar monstruo",
    "hold-person": "Inmovilizar persona",
    "holy-aura": "Aura sagrada",
    "hunters-mark": "Marca del cazador",
    "hypnotic-pattern": "Patrón hipnótico",
    "ice-storm": "Tormenta de hielo",
    "identify": "Identificar",
    "illusory-script": "Escritura ilusoria",
    "imprisonment": "Encarcelamiento",
    "incendiary-cloud": "Nube incendiaria",
    "inflict-wounds": "Infligir heridas",
    "insect-plague": "Plaga de insectos",
    "instant-summons": "Convocación instantánea",
    "invisibility": "Invisibilidad",
    "irresistible-dance": "Danza irresistible de Otto",
    "jump": "Salto",
    "knock": "Abrir",
    "legend-lore": "Saber legendario",
    "lesser-restoration": "Restauración menor",
    "levitate": "Levitar",
    "light": "Luz",
    "lightning-bolt": "Relámpago",
    "locate-animals-or-plants": "Localizar animales o plantas",
    "locate-creature": "Localizar criatura",
    "locate-object": "Localizar objeto",
    "longstrider": "Zancada larga",
    "mage-armor": "Armadura de mago",
    "mage-hand": "Mano de mago",
    "magic-circle": "Círculo mágico",
    "magic-jar": "Frasco mágico",
    "magic-missile": "Proyectil mágico",
    "magic-mouth": "Boca mágica",
    "magic-weapon": "Arma mágica",
    "magnificent-mansion": "Mansión magnífica de Mordenkainen",
    "major-image": "Imagen mayor",
    "mass-cure-wounds": "Curar heridas en masa",
    "mass-heal": "Sanar en masa",
    "mass-healing-word": "Palabra de curación en masa",
    "mass-suggestion": "Sugestión en masa",
    "maze": "Laberinto",
    "meld-into-stone": "Fundirse con la piedra",
    "mending": "Reparar",
    "message": "Mensaje",
    "meteor-swarm": "Lluvia de meteoros",
    "mind-blank": "Mente en blanco",
    "minor-illusion": "Ilusión menor",
    "mirage-arcane": "Espejismo arcano",
    "mirror-image": "Imagen múltiple",
    "mislead": "Despistar",
    "misty-step": "Paso brumoso",
    "modify-memory": "Modificar memoria",
    "moonbeam": "Rayo de luna",
    "move-earth": "Mover tierra",
    "nondetection": "Antidetección",
    "pass-without-trace": "Pasar sin rastro",
    "passwall": "Atravesar muros",
    "phantasmal-killer": "Asesino fantasmal",
    "phantom-steed": "Montura fantasmal",
    "planar-ally": "Aliado planar",
    "planar-binding": "Atadura planar",
    "plane-shift": "Cambio de plano",
    "plant-growth": "Crecimiento vegetal",
    "poison-spray": "Rociada venenosa",
    "polymorph": "Metamorfosis",
    "power-word-kill": "Palabra de poder: matar",
    "power-word-stun": "Palabra de poder: aturdir",
    "prayer-of-healing": "Plegaria de curación",
    "prestidigitation": "Prestidigitación",
    "prismatic-spray": "Chorro prismático",
    "prismatic-wall": "Muro prismático",
    "private-sanctum": "Santuario privado de Mordenkainen",
    "produce-flame": "Producir llamas",
    "programmed-illusion": "Ilusión programada",
    "project-image": "Proyectar imagen",
    "protection-from-energy": "Protección contra la energía",
    "protection-from-evil-and-good": "Protección contra el bien y el mal",
    "protection-from-poison": "Protección contra el veneno",
    "purify-food-and-drink": "Purificar comida y bebida",
    "raise-dead": "Alzar a los muertos",
    "ray-of-enfeeblement": "Rayo de debilitamiento",
    "ray-of-frost": "Rayo de escarcha",
    "regenerate": "Regenerar",
    "reincarnate": "Reencarnar",
    "remove-curse": "Eliminar maldición",
    "resilient-sphere": "Esfera resistente de Otiluke",
    "resistance": "Resistencia",
    "resurrection": "Resurrección",
    "reverse-gravity": "Invertir gravedad",
    "revivify": "Revivir",
    "rope-trick": "Truco de la cuerda",
    "sacred-flame": "Llama sagrada",
    "sanctuary": "Santuario",
    "scorching-ray": "Rayo abrasador",
    "scrying": "Videncia",
    "secret-chest": "Cofre secreto de Leomund",
    "see-invisibility": "Ver invisibilidad",
    "seeming": "Apariencia",
    "sending": "Envío",
    "sequester": "Aislar",
    "shapechange": "Cambio de forma",
    "shatter": "Añicos",
    "shield": "Escudo",
    "shield-of-faith": "Escudo de fe",
    "shillelagh": "Garrote mágico",
    "shocking-grasp": "Contacto electrizante",
    "silence": "Silencio",
    "silent-image": "Imagen silenciosa",
    "simulacrum": "Simulacro",
    "sleep": "Sueño",
    "sleet-storm": "Tormenta de aguanieve",
    "slow": "Lentitud",
    "spare-the-dying": "Perdonar al moribundo",
    "speak-with-animals": "Hablar con los animales",
    "speak-with-dead": "Hablar con los muertos",
    "speak-with-plants": "Hablar con las plantas",
    "spider-climb": "Trepar como arácnido",
    "spike-growth": "Crecimiento de púas",
    "spirit-guardians": "Guardianes espirituales",
    "spiritual-weapon": "Arma espiritual",
    "stinking-cloud": "Nube hedionda",
    "stone-shape": "Moldear piedra",
    "stoneskin": "Piel pétrea",
    "storm-of-vengeance": "Tormenta de venganza",
    "suggestion": "Sugestión",
    "sunbeam": "Rayo de sol",
    "sunburst": "Estallido solar",
    "symbol": "Símbolo",
    "telekinesis": "Telequinesis",
    "telepathic-bond": "Vínculo telepático de Rary",
    "teleport": "Teletransporte",
    "teleportation-circle": "Círculo de teletransporte",
    "thaumaturgy": "Taumaturgia",
    "thunderwave": "Onda atronadora",
    "time-stop": "Detener el tiempo",
    "tiny-hut": "Choza diminuta de Leomund",
    "tongues": "Lenguas",
    "transport-via-plants": "Transporte vegetal",
    "tree-stride": "Zancada arbórea",
    "true-polymorph": "Metamorfosis verdadera",
    "true-resurrection": "Resurrección verdadera",
    "true-seeing": "Visión verdadera",
    "true-strike": "Golpe certero",
    "unseen-servant": "Sirviente invisible",
    "vampiric-touch": "Toque vampírico",
    "vicious-mockery": "Burla cruel",
    "wall-of-fire": "Muro de fuego",
    "wall-of-force": "Muro de fuerza",
    "wall-of-ice": "Muro de hielo",
    "wall-of-stone": "Muro de piedra",
    "wall-of-thorns": "Muro de espinas",
    "warding-bond": "Vínculo protector",
    "water-breathing": "Respirar bajo el agua",
    "water-walk": "Caminar sobre el agua",
    "web": "Telaraña",
    "weird": "Fatalidad",
    "wind-walk": "Caminar en el viento",
    "wind-wall": "Muro de viento",
    "wish": "Deseo",
    "word-of-recall": "Palabra de regreso",
    "zone-of-truth": "Zona de verdad",
}


# ═══════════════════════════════════════════════════════════════
#  DESCARGA / CACHE DE LA FUENTE
# ═══════════════════════════════════════════════════════════════
def load_source(refresh: bool = False) -> list[dict]:
    if CACHE_FILE.exists() and not refresh:
        print(f"Usando cache: {CACHE_FILE.relative_to(ROOT)}")
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))

    print(f"Descargando SRD desde {SRD_BULK_URL} ...")
    req = urllib.request.Request(SRD_BULK_URL, headers={"User-Agent": "DnD-Seeder/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Guardado en cache: {CACHE_FILE.relative_to(ROOT)} ({len(raw)} hechizos)")
    return raw


# ═══════════════════════════════════════════════════════════════
#  TRANSFORMACIÓN (esquema dnd5eapi → columnas spells) — función pura
# ═══════════════════════════════════════════════════════════════
def _casting_time_type(txt: str) -> str | None:
    t = (txt or "").lower()
    if "bonus" in t:
        return "bonus_action"
    if "reaction" in t:
        return "reaction"
    if "action" in t:
        return "action"
    if "minute" in t:
        return "minutes"
    if "hour" in t:
        return "hours"
    return None


def _range_parts(txt: str):
    """Devuelve (range_type, range_feet)."""
    t = (txt or "").strip()
    low = t.lower()
    if low.startswith("self"):
        return "self", None
    if low == "touch":
        return "touch", None
    if low == "sight":
        return "sight", None
    if low in ("special", "unlimited") or "unlimited" in low:
        return "unlimited", None
    m = re.search(r"(\d+)\s*(feet|foot|mile)", low)
    if m:
        feet = int(m.group(1))
        if "mile" in m.group(2):
            feet *= 5280
        return "ranged", feet
    return "ranged", None


def _base_damage(raw: dict):
    """Devuelve (damage_dice, damage_type)."""
    dmg = raw.get("damage") or {}
    dtype = None
    if isinstance(dmg.get("damage_type"), dict):
        dtype = dmg["damage_type"].get("index")
    dice = None
    slot = dmg.get("damage_at_slot_level")
    char = dmg.get("damage_at_character_level")
    if isinstance(slot, dict) and slot:
        lvl_key = str(raw.get("level", 1))
        dice = slot.get(lvl_key) or slot[min(slot, key=lambda k: int(k))]
    elif isinstance(char, dict) and char:
        dice = char.get("1") or char[min(char, key=lambda k: int(k))]
    return dice, dtype


def _material_cost(text: str):
    """Extrae (coste_po, consumido) de la descripción del material SRD."""
    if not text:
        return None, False
    low = text.lower()
    m = re.search(r"worth\s+at\s+least\s+([\d,]+)\s*gp", low) or re.search(r"([\d,]+)\s*gp", low)
    cost = float(m.group(1).replace(",", "")) if m else None
    consumed = "consume" in low  # "which the spell consumes"
    return cost, consumed


def transform_spell(raw: dict) -> dict:
    index = raw["index"]
    comps = set(raw.get("components") or [])
    ct = raw.get("casting_time", "1 action")
    rng_type, rng_feet = _range_parts(raw.get("range", ""))
    dice, dtype = _base_damage(raw)

    dc = raw.get("dc") or {}
    saving_throw = None
    if isinstance(dc.get("dc_type"), dict):
        saving_throw = (dc["dc_type"].get("index") or "").upper() or None

    classes = []
    for c in (raw.get("classes") or []):
        idx = c.get("index") if isinstance(c, dict) else None
        if idx in CANONICAL_CLASSES:
            classes.append(idx)

    desc = "\n\n".join(raw.get("desc") or [])
    higher = "\n\n".join(raw.get("higher_level") or []) or None

    return {
        "name": SPANISH_NAMES.get(index, raw["name"]),
        "name_en": raw["name"],
        "level": int(raw.get("level", 0)),
        "school": (raw.get("school") or {}).get("index", "evocation"),
        "casting_time": ct,
        "casting_time_type": _casting_time_type(ct),
        "range_text": raw.get("range", "Toque"),
        "range_type": rng_type,
        "range_feet": rng_feet,
        "comp_verbal": "V" in comps,
        "comp_somatic": "S" in comps,
        "comp_material": "M" in comps,
        "material_description": raw.get("material"),
        "material_cost_gp": _material_cost(raw.get("material"))[0],
        "material_consumed": _material_cost(raw.get("material"))[1],
        "duration": raw.get("duration", "Instantáneo"),
        "concentration": bool(raw.get("concentration", False)),
        "ritual": bool(raw.get("ritual", False)),
        "description": desc,
        "higher_levels": higher,
        "requires_attack_roll": bool(raw.get("attack_type")),
        "saving_throw": saving_throw,
        "damage_dice": dice,
        "damage_type": dtype,
        "classes": classes,
        "source_book": "PHB",
        "dnd5eapi_index": index,
    }


def build_rows(refresh: bool = False) -> list[dict]:
    return [transform_spell(s) for s in load_source(refresh)]


# ═══════════════════════════════════════════════════════════════
#  APLICACIÓN CONTRA LA BD
# ═══════════════════════════════════════════════════════════════
async def apply(rows: list[dict]):
    import asyncpg
    dsn = re.sub(r"\?sslmode=\w+", "", os.environ["DATABASE_URL"])
    ssl_ctx = ssl.create_default_context(cafile=str(CA_CERT)) if CA_CERT.exists() else None
    conn = await asyncpg.connect(dsn, ssl=ssl_ctx)

    ph = []
    for i, c in enumerate(COLUMNS):
        n = f"${i+1}"
        ph.append(f"{n}::spell_school" if c == "school" else n)
    # El índice único de spells es PARCIAL (WHERE dnd5eapi_index IS NOT NULL),
    # así que el ON CONFLICT debe repetir el mismo predicado para inferirlo.
    upsert = f"""
    INSERT INTO spells ({", ".join(COLUMNS)})
    VALUES ({", ".join(ph)})
    ON CONFLICT (dnd5eapi_index) WHERE dnd5eapi_index IS NOT NULL DO UPDATE SET
        {", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS if c != "dnd5eapi_index")}
    """

    print(f"Sembrando {len(rows)} hechizos...")
    ok = 0
    for row in rows:
        vals = [row.get(c) for c in COLUMNS]
        try:
            await conn.execute(upsert, *vals)
            ok += 1
        except Exception as e:
            print(f"  ✗ {row['dnd5eapi_index']}: {str(e)[:120]}")
    await conn.close()
    print(f"✅ {ok}/{len(rows)} hechizos sembrados/actualizados.")


# ═══════════════════════════════════════════════════════════════
#  DRY RUN / QA
# ═══════════════════════════════════════════════════════════════
def report(rows: list[dict]):
    by_level = Counter(r["level"] for r in rows)
    by_school = Counter(r["school"] for r in rows)
    class_counts = Counter()
    for r in rows:
        for c in r["classes"]:
            class_counts[c] += 1

    slugs = [r["dnd5eapi_index"] for r in rows]
    dupes = [s for s, n in Counter(slugs).items() if n > 1]
    translated = sum(1 for r in rows if r["name"] != r["name_en"])

    valid_schools = {"abjuration", "conjuration", "divination", "enchantment",
                     "evocation", "illusion", "necromancy", "transmutation"}
    bad_school = [r["dnd5eapi_index"] for r in rows if r["school"] not in valid_schools]
    bad_level = [r["dnd5eapi_index"] for r in rows if not (0 <= r["level"] <= 9)]
    bad_class = [(r["dnd5eapi_index"], c) for r in rows for c in r["classes"]
                 if c not in CANONICAL_CLASSES]

    print(f"\nTotal hechizos: {len(rows)}")
    print("Por nivel:", dict(sorted(by_level.items())))
    print("Por escuela:", dict(sorted(by_school.items())))
    print("Por clase:", dict(sorted(class_counts.items())))
    print(f"Nombres traducidos a ES: {translated}/{len(rows)} (resto en inglés, editable)")
    print("Slugs duplicados:", dupes or "ninguno")
    print("Escuela inválida:", bad_school or "ninguna")
    print("Nivel inválido:", bad_level or "ninguno")
    print("Clase inválida:", bad_class or "ninguna")

    sample = next((r for r in rows if r["dnd5eapi_index"] == "fireball"), rows[0])
    print("\nMuestra (fireball):", json.dumps(
        {k: sample[k] for k in ["name", "name_en", "level", "school", "range_type",
                                "range_feet", "comp_verbal", "comp_somatic", "comp_material",
                                "concentration", "ritual", "saving_throw",
                                "damage_dice", "damage_type", "classes"]},
        ensure_ascii=False))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true", help="No conecta a la BD; imprime QA")
    p.add_argument("--refresh", action="store_true", help="Fuerza re-descarga de la fuente")
    args = p.parse_args()

    rows = build_rows(refresh=args.refresh)
    if args.dry_run:
        report(rows)
    else:
        report(rows)
        asyncio.run(apply(rows))
