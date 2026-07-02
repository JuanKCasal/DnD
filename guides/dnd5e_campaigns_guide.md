# Guía Definitiva: Campañas y Aventuras en D&D 5e
## Documento de especificación para implementación en app

> **Propósito:** Este documento describe qué información define una campaña o aventura de D&D 5e y cómo estructurarla para gestión digital: metadatos, mundo, mesa de juego, estructura narrativa, encuentros, monstruos, mapas, recompensas y las matemáticas de balanceo. Complementa las Guías de Creación de Personaje, Equipamiento y Hechizos. Está escrito para que Claude Code implemente un sistema de gestión de campañas completo y sin ambigüedades.

---

## Índice

1. [Jerarquía: Campaña → Aventura → Sesión → Encuentro](#1-jerarquía-campaña--aventura--sesión--encuentro)
2. [Metadatos de la campaña](#2-metadatos-de-la-campaña)
3. [Sistema de juego y reglas de mesa](#3-sistema-de-juego-y-reglas-de-mesa)
4. [El mundo y la ambientación](#4-el-mundo-y-la-ambientación)
5. [La mesa: DM y jugadores](#5-la-mesa-dm-y-jugadores)
6. [Estructura narrativa](#6-estructura-narrativa)
7. [Plot hooks, arcos y giros argumentales](#7-plot-hooks-arcos-y-giros-argumentales)
8. [Localizaciones y mapas](#8-localizaciones-y-mapas)
9. [NPCs (personajes no jugadores)](#9-npcs-personajes-no-jugadores)
10. [Monstruos y bloques de estadísticas](#10-monstruos-y-bloques-de-estadísticas)
11. [Encuentros y su diseño](#11-encuentros-y-su-diseño)
12. [Matemáticas de balanceo de encuentros](#12-matemáticas-de-balanceo-de-encuentros)
13. [Recompensas: XP, tesoro y objetos](#13-recompensas-xp-tesoro-y-objetos)
14. [Progresión de nivel: XP vs. hitos](#14-progresión-de-nivel-xp-vs-hitos)
15. [Gestión de sesiones y bitácora](#15-gestión-de-sesiones-y-bitácora)
16. [Modelo de datos sugerido](#16-modelo-de-datos-sugerido)
17. [Validaciones y reglas de integridad](#17-validaciones-y-reglas-de-integridad)

---

## 1. Jerarquía: Campaña → Aventura → Sesión → Encuentro

D&D se organiza en niveles anidados. La app debe modelar esta jerarquía explícitamente.

```
CAMPAÑA (Campaign)
│  Una historia continua de larga duración (meses o años reales).
│  Mismo grupo, mismo mundo, misma progresión de personajes.
│
├── AVENTURA / ARCO (Adventure / Story Arc)
│   │  Una unidad narrativa completa con inicio, nudo y desenlace.
│   │  Una campaña contiene una o varias aventuras encadenadas.
│   │
│   ├── SESIÓN (Session)
│   │   │  Un encuentro real de juego (típicamente 3–5 horas).
│   │   │  Una aventura se juega a lo largo de varias sesiones.
│   │   │
│   │   ├── ESCENA / ENCUENTRO (Scene / Encounter)
│   │   │   Unidad mínima de juego: un combate, una escena social,
│   │   │   un desafío de exploración, un puzzle, etc.
```

### Definiciones operativas

| Nivel | Duración típica | Contiene | Ejemplo |
|-------|----------------|----------|---------|
| Campaña | Meses/años | Varias aventuras | "La Maldición de Strahd" |
| Aventura / Arco | 3–15 sesiones | Varias sesiones | "El asedio a la aldea de Barovia" |
| Sesión | 3–5 horas | Varios encuentros | "Sesión 7: el ataque nocturno" |
| Encuentro | 15 min – 1 hora | Una escena | "Emboscada de 6 lobos en el camino" |

> **Nota de implementación:** Un módulo publicado (como los libros oficiales) es una **Aventura** en esta taxonomía. Una campaña puede ser un solo módulo largo o una serie de módulos y contenido casero encadenados. La app debería permitir que una campaña contenga tanto aventuras "importadas" como aventuras caseras.

---

## 2. Metadatos de la campaña

La ficha de identidad de la campaña. Estos son los campos de nivel superior.

| Campo | Tipo | Descripción | Requerido |
|-------|------|-------------|-----------|
| `name` | string | Nombre de la campaña | Sí |
| `subtitle` | string | Subtítulo o eslogan | No |
| `description` | string (largo) | Sinopsis / premisa general | Sí |
| `dm_name` | string | Nombre del Dungeon Master | Sí |
| `dm_id` | string / uuid | Referencia al usuario DM | Sí |
| `system` | enum | Sistema de reglas (ver sección 3) | Sí |
| `world_setting` | string | Mundo o ambientación (ver sección 4) | Sí |
| `status` | enum | `planning` / `active` / `on_hiatus` / `completed` / `abandoned` | Sí |
| `start_level` | number | Nivel de personaje inicial (1–20) | Sí |
| `current_level` | number | Nivel actual del grupo | Sí |
| `target_end_level` | number | Nivel objetivo de finalización | No |
| `player_count` | number | Cantidad de jugadores | Sí |
| `min_players` / `max_players` | number | Rango deseado | No |
| `tone` | enum[] | Tono: `heroic`, `dark`, `comedic`, `horror`, `political`, `exploration`, `dungeon_crawl`, `sandbox` | No |
| `themes` | string[] | Temas: venganza, redención, supervivencia, etc. | No |
| `session_frequency` | enum | `weekly` / `biweekly` / `monthly` / `irregular` | No |
| `session_duration_hours` | number | Duración típica de sesión | No |
| `start_date` | date | Fecha de inicio real | No |
| `banner_image` | string (url/path) | Imagen de portada | No |
| `tags` | string[] | Etiquetas libres | No |
| `is_public` | boolean | Visibilidad (compartida o privada) | No |

### Estados de campaña (máquina de estados)

```
planning ──→ active ──→ completed
                │
                ├──→ on_hiatus ──→ active
                │
                └──→ abandoned
```

---

## 3. Sistema de juego y reglas de mesa

El sistema de reglas y las "house rules" (reglas caseras) que la mesa acuerda.

### 3.1 Sistema base

| Campo | Valores posibles | Descripción |
|-------|-----------------|-------------|
| `ruleset` | `dnd_5e_2014` / `dnd_5e_2024` / `dnd_5e_homebrew` | Edición de reglas |
| `sourcebooks_allowed` | string[] | Libros permitidos: PHB, XGE, TCoE, MotM, etc. |
| `homebrew_allowed` | boolean | Si se permite contenido casero |
| `variant_rules` | VariantRule[] | Reglas opcionales activadas (ver abajo) |

### 3.2 Reglas variantes comunes (Variant Rules)

Estas son reglas opcionales del DMG que la mesa puede activar. La app debería permitir togglearlas porque cambian los cálculos:

| Regla | Efecto en el sistema | Fuente |
|-------|---------------------|--------|
| Feats (Dotes) | Permite intercambiar mejoras de característica por dotes | PHB |
| Multiclassing | Permite combinar clases | PHB |
| Encumbrance (Encumbramiento) | Sistema detallado de carga (ver Guía de Equipamiento §13) | PHB |
| Flanking | Ventaja al atacar si dos aliados flanquean | DMG |
| Feats de curación lenta (Slow Natural Healing) | No recupera PG en descanso largo automáticamente | DMG |
| Gritty Realism | Descanso corto = 8 h, descanso largo = 7 días | DMG |
| Proficiency Dice | El BPC se tira como dado en vez de bonus fijo | DMG |
| Massive Damage | Daño masivo puede aturdir o matar | DMG |
| Honor / Sanity | Características adicionales opcionales | DMG |
| Hero Points | Puntos de héroe para re-tiradas | DMG |

### 3.3 Reglas caseras (House Rules)

Campo libre para acuerdos de la mesa. Ejemplos comunes:
- Críticos: "daño máximo + tirada" en vez de "doblar dados"
- Death saves: en secreto (solo el DM sabe) vs. abiertos
- Inspiración: cómo se gana y gasta
- Comida y descanso: nivel de detalle en la gestión de recursos
- Potions como acción bonus en vez de acción

```typescript
interface HouseRule {
  id: string;
  category: 'combat' | 'resting' | 'death' | 'inspiration' | 'crafting' | 'social' | 'other';
  title: string;
  description: string;
  active: boolean;
}
```

---

## 4. El mundo y la ambientación

Define el escenario donde ocurre la campaña.

### 4.1 Ambientaciones oficiales

| Ambientación | Tono | Descripción |
|--------------|------|-------------|
| Forgotten Realms | Fantasía heroica clásica | El mundo por defecto de D&D; incluye Faerûn, la Costa de la Espada, Waterdeep |
| Eberron | Fantasía noir / pulp | Magia industrializada, intriga, dirigibles, razas de constructos (warforged) |
| Ravenloft | Terror gótico | Dominios del Terror; el hogar de Strahd |
| Dragonlance | Épica de guerra | Krynn, la Guerra de la Lanza, los dragones |
| Greyhawk | Fantasía clásica | La ambientación original de Gary Gygax |
| Theros | Mito griego | Inspirada en la mitología helénica |
| Ravnica | Urbe-mundo | Ciudad infinita de gremios (crossover Magic) |
| Wildemount / Exandria | Variado | El mundo de Critical Role |
| Spelljammer | Fantasía espacial | Aventuras entre planetas |
| Planescape | Multiverso | Sigil, la ciudad de las puertas, viaje planar |

### 4.2 Campos del mundo (para ambientaciones caseras)

| Campo | Descripción |
|-------|-------------|
| `world_name` | Nombre del mundo/plano |
| `setting_type` | `official` / `homebrew` / `hybrid` |
| `genre` | high fantasy, dark fantasy, sword & sorcery, steampunk, etc. |
| `technology_level` | Medieval, renacentista, con pólvora, mágico-industrial, etc. |
| `magic_prevalence` | Qué tan común es la magia (rara / moderada / omnipresente) |
| `cosmology` | Estructura de planos, dioses, fuerzas |
| `major_factions` | Facciones y organizaciones de poder |
| `pantheon` | Dioses y su dominio |
| `calendar` | Sistema de fechas del mundo |
| `languages` | Idiomas disponibles en el mundo |
| `history_timeline` | Eventos históricos clave |
| `current_conflicts` | Tensiones y guerras activas |

### 4.3 Estructura geográfica jerárquica

```
Mundo / Plano
└── Continente / Región
    └── Reino / Nación
        └── Provincia / Territorio
            └── Ciudad / Pueblo / Aldea
                └── Distrito / Barrio
                    └── Localización específica (taberna, mazmorra, templo)
```

Cada nivel puede tener su propia ficha, mapa y NPCs asociados.

---

## 5. La mesa: DM y jugadores

### 5.1 El Dungeon Master

| Campo | Descripción |
|-------|-------------|
| `dm_name` | Nombre del DM |
| `dm_user_id` | Referencia al usuario |
| `dm_notes` | Notas privadas del DM (no visibles para jugadores) |
| `co_dms` | Otros DMs si los hay |

> **Nota de permisos:** La app debe distinguir contenido **visible para jugadores** de contenido **solo para el DM** (giros argumentales, stat blocks de jefes, tesoros ocultos, motivaciones secretas de NPCs). Este es un requisito de diseño central.

### 5.2 Los jugadores y el grupo (Party)

| Campo | Descripción |
|-------|-------------|
| `players` | Lista de jugadores (usuarios) |
| `party_name` | Nombre del grupo, si tiene |
| `characters` | Personajes activos (referencias a fichas de personaje) |
| `party_level` | Nivel promedio o efectivo del grupo |
| `party_size` | Número de personajes |

### 5.3 Ficha de jugador en la campaña

```typescript
interface CampaignPlayer {
  user_id: string;
  player_name: string;              // nombre real o apodo
  character_ids: string[];          // personajes que juega (normalmente 1)
  status: 'active' | 'inactive' | 'guest';
  joined_date: date;
  attendance?: number;              // % de asistencia (opcional)
  role_in_party?: string;           // "tank", "healer", "face", "scout"
}
```

### 5.4 Tamaño de grupo recomendado

| Tamaño | Nota |
|--------|------|
| 1 jugador | Requiere ajustes fuertes o un NPC acompañante |
| 2–3 jugadores | Grupo pequeño; encuentros más suaves |
| **4–5 jugadores** | **Tamaño estándar** — el balanceo del juego está calibrado para 4 |
| 6–7 jugadores | Grupo grande; encuentros más duros, combates más lentos |
| 8+ jugadores | Difícil de gestionar; considerar dividir |

> El sistema de balanceo de encuentros (sección 12) asume 3–5 jugadores. Para grupos fuera de ese rango, ajustar los umbrales de XP proporcionalmente.

---

## 6. Estructura narrativa

Cómo se organiza la historia de la campaña.

### 6.1 Los tres pilares del juego

Toda escena de D&D cae en uno (o varios) de estos pilares. El balance entre ellos define el tono de la campaña:

| Pilar | Descripción | Características que destacan |
|-------|-------------|----------------------------|
| **Combate** | Enfrentamientos tácticos | FUE, DES, CON |
| **Exploración** | Descubrir el mundo, viajar, resolver acertijos | INT, SAB |
| **Interacción social** | Negociar, engañar, persuadir NPCs | CAR |

### 6.2 Estructura de una aventura

Una aventura bien formada tiene:

| Componente | Descripción |
|------------|-------------|
| **Gancho (Hook)** | Qué motiva al grupo a involucrarse |
| **Premisa** | El conflicto o problema central |
| **Actos / Fases** | Desarrollo dividido en etapas |
| **Clímax** | El enfrentamiento o decisión culminante |
| **Resolución** | Consecuencias y cierre |
| **Ganchos futuros** | Semillas para próximas aventuras |

### 6.3 Modelos estructurales

| Modelo | Descripción | Cuándo usar |
|--------|-------------|-------------|
| **Lineal (Railroad)** | El grupo sigue una secuencia fija de escenas | Historia dirigida, módulos introductorios |
| **Sandbox (Mundo abierto)** | El grupo elige libremente qué hacer | Exploración, campañas emergentes |
| **Nodos (Node-based)** | Localizaciones/pistas conectadas, orden flexible | Misterios, investigaciones |
| **Reloj / Frentes (Clocks/Fronts)** | Amenazas que avanzan si el grupo no actúa | Tensión, urgencia, mundo reactivo |
| **Los cinco cuartos (Five Room Dungeon)** | Estructura clásica de 5 escenas para una mazmorra | Aventuras cortas de una sesión |

### 6.4 The Five Room Dungeon (plantilla útil)

Estructura clásica para una aventura de una sesión:

```
1. Entrada / Guardián      → obstáculo inicial (combate o puzzle)
2. Puzzle / Reto de rol    → desafío no-combate
3. Truco / Contratiempo    → giro, trampa, decepción
4. Clímax / Jefe           → gran enfrentamiento
5. Recompensa / Revelación → botín + gancho para lo siguiente
```

---

## 7. Plot hooks, arcos y giros argumentales

### 7.1 Ganchos (Plot Hooks)

Un gancho es la razón por la que los personajes se involucran. Campos:

```typescript
interface PlotHook {
  id: string;
  title: string;
  description: string;
  type: 'personal' | 'reward' | 'moral' | 'threat' | 'mystery' | 'obligation';
  target: 'party' | 'specific_character';
  character_id?: string;            // si es un gancho personal de un PJ
  delivered: boolean;               // si ya se presentó a los jugadores
  taken: boolean;                   // si el grupo lo aceptó
}
```

### 7.2 Arcos argumentales (Story Arcs)

```typescript
interface StoryArc {
  id: string;
  title: string;
  description: string;
  arc_type: 'main' | 'side' | 'character' | 'faction';
  status: 'not_started' | 'active' | 'resolved' | 'failed' | 'abandoned';
  related_character_id?: string;    // para arcos personales
  related_npc_ids: string[];
  related_faction_ids: string[];
  beats: StoryBeat[];               // los momentos clave del arco
  visible_to_players: boolean;
}

interface StoryBeat {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  session_id?: string;              // en qué sesión ocurrió
}
```

### 7.3 Giros argumentales (Plot Twists)

Los giros son contenido sensible: casi siempre son **solo para el DM** hasta que se revelan.

```typescript
interface PlotTwist {
  id: string;
  title: string;
  description: string;              // el giro en sí
  setup_clues: string[];           // pistas sembradas de antemano
  reveal_condition: string;        // qué desencadena la revelación
  revealed: boolean;
  reveal_session_id?: string;
  impact: string;                  // consecuencias narrativas
  dm_only: boolean;                // por defecto TRUE
}
```

### 7.4 Misiones (Quests)

```typescript
interface Quest {
  id: string;
  title: string;
  description: string;
  quest_type: 'main' | 'side' | 'personal' | 'faction' | 'fetch' | 'escort' | 'bounty';
  status: 'available' | 'active' | 'completed' | 'failed' | 'expired';
  giver_npc_id?: string;
  objectives: QuestObjective[];
  rewards: {
    xp?: number;
    gold_cp?: number;
    items?: string[];
    reputation?: { faction_id: string; amount: number }[];
    narrative?: string;
  };
  time_limit?: string;              // si es sensible al tiempo
  visible_to_players: boolean;
}

interface QuestObjective {
  id: string;
  description: string;
  completed: boolean;
  optional: boolean;
  hidden: boolean;                  // objetivo secreto que se revela al cumplirse
}
```

---

## 8. Localizaciones y mapas

### 8.1 Ficha de localización

```typescript
interface Location {
  id: string;
  name: string;
  location_type: 'world' | 'region' | 'settlement' | 'building' | 'dungeon' | 'wilderness' | 'landmark' | 'plane';
  parent_location_id?: string;      // jerarquía geográfica (ver §4.3)
  description: string;
  dm_notes?: string;                // secretos, contenido oculto
  map_id?: string;                  // mapa asociado
  npcs_present: string[];           // NPC ids
  points_of_interest: PointOfInterest[];
  encounters: string[];             // encuentros posibles aquí
  discovered: boolean;              // si el grupo ya la conoce
  visited: boolean;
  tags: string[];
}

interface PointOfInterest {
  id: string;
  name: string;
  description: string;
  x?: number;                       // coordenadas en el mapa
  y?: number;
  hidden: boolean;                  // requiere descubrir (Perception, etc.)
  dm_only: boolean;
}
```

### 8.2 Tipos de mapa

| Tipo | Escala | Uso |
|------|--------|-----|
| **World map** | Continentes | Visión general del mundo |
| **Regional map** | Reinos, provincias | Viaje de larga distancia |
| **Settlement map** | Ciudad/pueblo | Ubicar tiendas, NPCs, distritos |
| **Battle map** | Escala táctica (cuadrícula 5 ft) | Combate, posicionamiento |
| **Dungeon map** | Interiores | Exploración de mazmorras |

### 8.3 Ficha de mapa

```typescript
interface GameMap {
  id: string;
  name: string;
  map_type: 'world' | 'regional' | 'settlement' | 'battle' | 'dungeon';
  image_url: string;                // imagen del mapa
  location_id?: string;             // localización que representa

  // Para battle maps (cuadrícula táctica)
  grid_enabled: boolean;
  grid_size_pixels?: number;        // px por casilla
  grid_scale_feet?: number;         // pies por casilla (normalmente 5)
  width_squares?: number;
  height_squares?: number;

  // Capas y elementos
  fog_of_war?: boolean;             // niebla de guerra para exploración
  tokens?: MapToken[];              // fichas de criaturas/objetos
  annotations?: MapAnnotation[];    // notas, marcadores

  dm_only: boolean;
}

interface MapToken {
  id: string;
  name: string;
  token_type: 'pc' | 'npc' | 'monster' | 'object';
  reference_id?: string;            // id del personaje/monstruo/NPC
  x: number;                        // posición en casillas
  y: number;
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  image_url?: string;
  visible_to_players: boolean;
}
```

### 8.4 Escala táctica (Battle Map)

En combate, el estándar es una cuadrícula de **5 pies por casilla**:

| Tamaño de criatura | Espacio ocupado |
|--------------------|-----------------|
| Tiny (Diminuto) | 2.5 × 2.5 ft (4 caben en 1 casilla) |
| Small (Pequeño) | 5 × 5 ft (1 casilla) |
| Medium (Mediano) | 5 × 5 ft (1 casilla) |
| Large (Grande) | 10 × 10 ft (2×2 casillas) |
| Huge (Enorme) | 15 × 15 ft (3×3 casillas) |
| Gargantuan (Gigantesco) | 20 × 20 ft o más (4×4+) |

---

## 9. NPCs (personajes no jugadores)

### 9.1 Ficha de NPC

Los NPCs van desde figurantes (un tabernero) hasta el villano principal. El nivel de detalle varía.

```typescript
interface NPC {
  id: string;
  name: string;
  title?: string;                   // "Alcalde", "Archimago", "Capitán"
  race?: string;
  npc_role: 'ally' | 'neutral' | 'villain' | 'quest_giver' | 'merchant' | 'background' | 'rival' | 'contact';
  importance: 'major' | 'minor' | 'background';

  description: string;              // apariencia
  personality?: string;             // rasgos, manías
  mannerism?: string;               // tic distintivo (voz, gesto)
  ideal?: string;
  bond?: string;
  flaw?: string;
  voice_notes?: string;             // cómo interpretarlo (para el DM)

  motivation?: string;              // qué quiere (dm_only frecuentemente)
  secret?: string;                  // secreto (dm_only)

  location_id?: string;             // dónde suele estar
  faction_id?: string;              // a qué facción pertenece
  attitude: 'hostile' | 'unfriendly' | 'indifferent' | 'friendly' | 'helpful';

  stat_block_id?: string;           // si es combatiente, referencia a stat block
  quest_ids: string[];              // misiones que da
  relationships?: NPCRelationship[];

  status: 'alive' | 'dead' | 'missing' | 'unknown';
  dm_only_fields: string[];         // qué campos ocultar a jugadores
}

interface NPCRelationship {
  target_id: string;                // otro NPC o PC
  relationship_type: string;        // "aliado", "enemigo", "familiar", "deudor"
  description?: string;
}
```

### 9.2 Actitud de NPC (escala de reacción)

La actitud determina cómo responde un NPC y qué CD de habilidad social se necesita para influirlo:

| Actitud | Descripción | Efecto en tiradas sociales |
|---------|-------------|---------------------------|
| Hostile (Hostil) | Quiere hacer daño | CD muy alta para persuadir |
| Unfriendly (Poco amistoso) | Desconfía, no ayuda | CD alta |
| Indifferent (Indiferente) | Neutral | CD moderada |
| Friendly (Amistoso) | Bien dispuesto | CD baja |
| Helpful (Servicial) | Ayuda activamente | Coopera sin tirada |

### 9.3 Facciones

```typescript
interface Faction {
  id: string;
  name: string;
  faction_type: 'guild' | 'government' | 'religious' | 'criminal' | 'military' | 'arcane' | 'noble_house' | 'cult';
  description: string;
  goals: string;
  leader_npc_id?: string;
  member_npc_ids: string[];
  headquarters_location_id?: string;
  party_reputation: number;         // -100 a +100, reputación del grupo con la facción
  allied_factions: string[];
  enemy_factions: string[];
}
```

---

## 10. Monstruos y bloques de estadísticas

### 10.1 Anatomía de un stat block (bloque de estadísticas)

Todo monstruo o criatura tiene esta estructura. Es el objeto más complejo del bestiario.

```typescript
interface StatBlock {
  id: string;
  name: string;
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  creature_type: CreatureType;      // ver abajo
  subtype?: string;                 // "goblinoid", "shapechanger", etc.
  alignment: string;                // "chaotic evil", "neutral", etc.

  // Defensas
  armor_class: number;
  armor_class_source?: string;      // "natural armor", "chain mail", etc.
  hit_points: number;
  hit_dice: string;                 // "5d8 + 10"
  speed: {
    walk?: number;
    fly?: number;
    swim?: number;
    climb?: number;
    burrow?: number;
    hover?: boolean;
  };

  // Características (las 6)
  abilities: {
    STR: number; DEX: number; CON: number;
    INT: number; WIS: number; CHA: number;
  };

  // Competencias y sentidos
  saving_throws?: { ability: string; bonus: number }[];
  skills?: { skill: string; bonus: number }[];
  damage_vulnerabilities?: DamageType[];
  damage_resistances?: DamageType[];
  damage_immunities?: DamageType[];
  condition_immunities?: Condition[];
  senses: {
    darkvision?: number;
    blindsight?: number;
    tremorsense?: number;
    truesight?: number;
    passive_perception: number;
  };
  languages: string[];

  // Desafío
  challenge_rating: number;         // CR (0, 1/8, 1/4, 1/2, 1, 2, ... 30)
  xp_value: number;                 // XP que otorga (según CR)
  proficiency_bonus: number;

  // Rasgos y acciones
  traits?: Feature[];               // rasgos pasivos (ej: "Pack Tactics")
  actions: Action[];                // acciones de combate
  bonus_actions?: Action[];
  reactions?: Action[];
  legendary_actions?: LegendaryAction[];  // solo criaturas legendarias
  legendary_resistances?: number;         // usos por día
  lair_actions?: Action[];                // acciones de guarida

  // Meta
  description?: string;
  source: string;
  is_homebrew: boolean;
}

interface Action {
  name: string;
  description: string;
  attack_type?: 'melee_weapon' | 'ranged_weapon' | 'melee_spell' | 'ranged_spell';
  attack_bonus?: number;
  reach_feet?: number;
  range?: { normal: number; long?: number };
  damage?: { dice: string; type: DamageType }[];
  saving_throw?: { ability: string; dc: number };
  recharge?: string;                // "Recharge 5-6", "1/day"
}

type CreatureType =
  | 'aberration' | 'beast' | 'celestial' | 'construct' | 'dragon'
  | 'elemental' | 'fey' | 'fiend' | 'giant' | 'humanoid'
  | 'monstrosity' | 'ooze' | 'plant' | 'undead';

type Condition =
  | 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled'
  | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified'
  | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious'
  | 'exhaustion';
```

### 10.2 Challenge Rating (CR) y XP

El CR estima la dificultad de un monstruo. Cada CR corresponde a un valor fijo de XP:

| CR | XP | CR | XP | CR | XP |
|----|-----|----|-----|----|-----|
| 0 | 0 o 10 | 5 | 1.800 | 14 | 11.500 |
| 1/8 | 25 | 6 | 2.300 | 15 | 13.000 |
| 1/4 | 50 | 7 | 2.900 | 16 | 15.000 |
| 1/2 | 100 | 8 | 3.900 | 17 | 18.000 |
| 1 | 200 | 9 | 5.000 | 18 | 20.000 |
| 2 | 450 | 10 | 5.900 | 19 | 22.000 |
| 3 | 700 | 11 | 7.200 | 20 | 25.000 |
| 4 | 1.100 | 12 | 8.400 | 21 | 33.000 |
| | | 13 | 10.000 | 24 | 62.000 |
| | | | | 30 | 155.000 |

> **Regla general:** Un monstruo de CR igual al nivel del grupo es un desafío moderado para 4 personajes de ese nivel. Un solo monstruo raramente basta contra un grupo (ver "action economy" en la sección 12).

### 10.3 Los 14 tipos de criatura

Cada tipo tiene implicaciones mecánicas (ciertos hechizos y rasgos afectan solo a tipos específicos):

`aberration`, `beast`, `celestial`, `construct`, `dragon`, `elemental`, `fey`, `fiend`, `giant`, `humanoid`, `monstrosity`, `ooze`, `plant`, `undead`.

### 10.4 Las 15 condiciones

Las condiciones son estados que alteran las capacidades de una criatura. La app debe rastrearlas en combate:

| Condición | Efecto resumido |
|-----------|-----------------|
| Blinded (Cegado) | No ve; desventaja al atacar, ventaja para atacarle |
| Charmed (Encantado) | No puede atacar al encantador; este tiene ventaja social |
| Deafened (Ensordecido) | No oye |
| Frightened (Asustado) | Desventaja mientras ve la fuente; no se acerca a ella |
| Grappled (Agarrado) | Velocidad 0 |
| Incapacitated (Incapacitado) | Sin acciones ni reacciones |
| Invisible (Invisible) | No se ve; ventaja al atacar, desventaja para atacarle |
| Paralyzed (Paralizado) | Incapacitado, no se mueve/habla; críticos automáticos a 5 ft |
| Petrified (Petrificado) | Convertido en piedra; incapacitado, resistencia a todo |
| Poisoned (Envenenado) | Desventaja en ataques y tiradas de característica |
| Prone (Derribado) | Solo puede gatear; desventaja al atacar |
| Restrained (Apresado) | Velocidad 0; desventaja al atacar, ventaja para atacarle |
| Stunned (Aturdido) | Incapacitado, no se mueve; falla salvaciones FUE/DES |
| Unconscious (Inconsciente) | Incapacitado, cae derribado; críticos automáticos a 5 ft |
| Exhaustion (Agotamiento) | 6 niveles acumulativos; nivel 6 = muerte |

### 10.5 Niveles de agotamiento (Exhaustion)

| Nivel | Efecto acumulativo |
|-------|-------------------|
| 1 | Desventaja en tiradas de característica |
| 2 | Velocidad reducida a la mitad |
| 3 | Desventaja en ataques y salvaciones |
| 4 | PG máximos reducidos a la mitad |
| 5 | Velocidad reducida a 0 |
| 6 | Muerte |

---

## 11. Encuentros y su diseño

Un encuentro es la unidad mínima de juego. No todos son combate.

### 11.1 Tipos de encuentro

| Tipo | Descripción | Pilar |
|------|-------------|-------|
| Combat (Combate) | Enfrentamiento con enemigos | Combate |
| Social (Social) | Negociación, interrogatorio, corte | Interacción |
| Exploration (Exploración) | Terreno peligroso, navegación | Exploración |
| Puzzle (Acertijo) | Enigma, mecanismo, trampa lógica | Exploración |
| Trap (Trampa) | Peligro oculto | Exploración |
| Hazard (Peligro ambiental) | Lava, tormenta, veneno ambiental | Exploración |
| Chase (Persecución) | Huida o persecución | Mixto |
| Rest (Descanso) | Momento de recuperación | — |

### 11.2 Ficha de encuentro

```typescript
interface Encounter {
  id: string;
  name: string;
  encounter_type: 'combat' | 'social' | 'exploration' | 'puzzle' | 'trap' | 'hazard' | 'chase' | 'rest';
  description: string;
  location_id?: string;
  map_id?: string;

  // Para combate
  monsters?: EncounterMonster[];    // qué criaturas y cuántas
  difficulty?: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
  calculated_xp?: number;           // XP total ajustado (ver §12)
  terrain_features?: string[];      // cobertura, terreno difícil, etc.

  // Para todos
  triggers?: string;                // qué desencadena el encuentro
  objectives?: string;              // qué se necesita para "resolverlo"
  rewards?: EncounterReward;
  scaling_notes?: string;           // cómo ajustar por tamaño de grupo

  status: 'planned' | 'active' | 'completed' | 'skipped';
  dm_notes?: string;
}

interface EncounterMonster {
  stat_block_id: string;
  quantity: number;
  name_override?: string;           // "Grishnak, el goblin jefe"
  current_hp?: number[];            // HP individual de cada instancia (para tracking)
  initiative?: number;
  notes?: string;
}
```

### 11.3 Trampas y peligros

```typescript
interface Trap {
  id: string;
  name: string;
  description: string;
  detection_dc: number;             // CD de Perception/Investigation para detectar
  disarm_dc: number;                // CD para desactivar
  disarm_skill: string;             // "Thieves' Tools", "Investigation"
  trigger: string;                  // qué la activa
  effect: string;                   // qué hace
  save_ability?: string;            // salvación para evitar/reducir
  save_dc?: number;
  damage?: { dice: string; type: DamageType };
  severity: 'setback' | 'dangerous' | 'deadly';
}
```

---

## 12. Matemáticas de balanceo de encuentros

Esta es la sección crunchy que la app debe calcular automáticamente. Sistema del DMG (2014).

### 12.1 Umbrales de XP por personaje (por nivel)

Cada personaje aporta un "presupuesto" de XP según su nivel y la dificultad deseada:

| Nivel PJ | Fácil | Media | Difícil | Mortal |
|----------|-------|-------|---------|--------|
| 1 | 25 | 50 | 75 | 100 |
| 2 | 50 | 100 | 150 | 200 |
| 3 | 75 | 150 | 225 | 400 |
| 4 | 125 | 250 | 375 | 500 |
| 5 | 250 | 500 | 750 | 1.100 |
| 6 | 300 | 600 | 900 | 1.400 |
| 7 | 350 | 750 | 1.100 | 1.700 |
| 8 | 450 | 900 | 1.400 | 2.100 |
| 9 | 550 | 1.100 | 1.600 | 2.400 |
| 10 | 600 | 1.200 | 1.900 | 2.800 |
| 11 | 800 | 1.600 | 2.400 | 3.600 |
| 12 | 1.000 | 2.000 | 3.000 | 4.500 |
| 13 | 1.100 | 2.200 | 3.400 | 5.100 |
| 14 | 1.250 | 2.500 | 3.800 | 5.700 |
| 15 | 1.400 | 2.800 | 4.300 | 6.400 |
| 16 | 1.600 | 3.200 | 4.800 | 7.200 |
| 17 | 2.000 | 3.900 | 5.900 | 8.800 |
| 18 | 2.100 | 4.200 | 6.300 | 9.500 |
| 19 | 2.400 | 4.900 | 7.300 | 10.900 |
| 20 | 2.800 | 5.700 | 8.500 | 12.700 |

### 12.2 Cálculo del presupuesto del grupo

```
Para cada nivel de dificultad:
  umbral_del_grupo = Σ (umbral_del_personaje) para cada personaje

Ejemplo: grupo de 4 personajes de nivel 3, dificultad Media:
  umbral = 150 × 4 = 600 XP
```

### 12.3 Multiplicador por número de monstruos (Encounter Multiplier)

Más monstruos = más peligroso de lo que su XP sugiere (más ataques por turno, "action economy"). El XP total se **multiplica** antes de compararlo con el umbral:

| Nº de monstruos | Multiplicador |
|-----------------|---------------|
| 1 | × 1 |
| 2 | × 1.5 |
| 3–6 | × 2 |
| 7–10 | × 2.5 |
| 11–14 | × 3 |
| 15+ | × 4 |

### 12.4 Ajuste por tamaño de grupo

El multiplicador anterior asume un grupo de 3–5 personajes. Ajustar:

```
Grupo de 1–2 personajes → usar la SIGUIENTE fila más alta del multiplicador
Grupo de 3–5 personajes → usar el multiplicador normal
Grupo de 6+ personajes  → usar la fila ANTERIOR más baja del multiplicador
```

### 12.5 Fórmula completa de balanceo

```
1. XP_base = Σ (xp_de_cada_monstruo)
2. Determinar multiplicador según número total de monstruos (§12.3)
3. Ajustar el multiplicador según tamaño del grupo (§12.4)
4. XP_ajustado = XP_base × multiplicador
5. Calcular umbrales del grupo (§12.2) para las 4 dificultades
6. Comparar XP_ajustado con los umbrales:
   - < umbral Fácil          → Trivial
   - ≥ Fácil, < Media        → Fácil
   - ≥ Media, < Difícil      → Media
   - ≥ Difícil, < Mortal     → Difícil
   - ≥ Mortal                → Mortal (potencialmente letal)
```

### 12.6 Ejemplo completo

```
Grupo: 4 personajes de nivel 3
Encuentro: 6 goblins (CR 1/4 = 50 XP cada uno)

Paso 1: XP_base = 6 × 50 = 300 XP
Paso 2: 6 monstruos → multiplicador × 2
Paso 3: grupo de 4 (rango 3–5) → sin ajuste
Paso 4: XP_ajustado = 300 × 2 = 600 XP

Umbrales del grupo (4 PJ nivel 3):
  Fácil:   75 × 4  = 300
  Media:   150 × 4 = 600
  Difícil: 225 × 4 = 900
  Mortal:  400 × 4 = 1.600

600 XP ajustado → coincide con el umbral Media (dificultad MEDIA).
```

### 12.7 Presupuesto diario de aventura (Adventuring Day)

El DMG sugiere que un grupo puede afrontar cierto XP total por día antes de agotar recursos:

| Nivel PJ | XP ajustado / día |
|----------|-------------------|
| 1 | 300 |
| 2 | 600 |
| 3 | 1.200 |
| 4 | 1.700 |
| 5 | 3.500 |
| 10 | 11.900 |
| 15 | 25.000 |
| 20 | 40.000 |

> Regla práctica: 6–8 encuentros de dificultad media por día, con 2–3 descansos cortos. La app puede usar esto para avisar al DM si un día de aventura está sobrecargado o vacío.

---

## 13. Recompensas: XP, tesoro y objetos

### 13.1 Experiencia (XP)

```
XP por encuentro de combate = Σ (xp_base_de_cada_monstruo)
  (Se usa el XP BASE, sin multiplicador — el multiplicador es solo
   para medir dificultad, no para repartir recompensa)

XP repartido = XP_total / número_de_personajes
```

También se puede otorgar XP por objetivos no-combate (resolver un puzzle, negociar con éxito, descubrir una localización).

### 13.2 Tesoro individual vs. acumulado (Hoard)

| Tipo | Descripción |
|------|-------------|
| **Individual Treasure** | Lo que lleva un monstruo encima (monedas, alguna gema) |
| **Treasure Hoard** | Un tesoro acumulado (cofre del jefe, bóveda de dragón) — incluye objetos mágicos |

### 13.3 Tesoro por nivel (guía general del DMG)

| Rango de nivel | Tesoro acumulado típico | Objetos mágicos |
|----------------|------------------------|-----------------|
| 1–4 | Cientos de po | Common/Uncommon ocasionales |
| 5–10 | Miles de po | Uncommon/Rare |
| 11–16 | Decenas de miles de po | Rare/Very Rare |
| 17–20 | Cientos de miles de po | Very Rare/Legendary |

### 13.4 Ficha de recompensa

```typescript
interface EncounterReward {
  xp?: number;
  currency?: { pp?: number; gp?: number; ep?: number; sp?: number; cp?: number };
  items?: { item_id: string; quantity: number }[];
  magic_items?: string[];
  reputation_changes?: { faction_id: string; amount: number }[];
  story_rewards?: string;           // información, aliados, títulos
}
```

---

## 14. Progresión de nivel: XP vs. hitos

La app debe soportar los dos métodos de subida de nivel.

### 14.1 Tabla de XP por nivel (método clásico)

| Nivel | XP total acumulado | BPC |
|-------|-------------------|-----|
| 1 | 0 | +2 |
| 2 | 300 | +2 |
| 3 | 900 | +2 |
| 4 | 2.700 | +2 |
| 5 | 6.500 | +3 |
| 6 | 14.000 | +3 |
| 7 | 23.000 | +3 |
| 8 | 34.000 | +3 |
| 9 | 48.000 | +4 |
| 10 | 64.000 | +4 |
| 11 | 85.000 | +4 |
| 12 | 100.000 | +4 |
| 13 | 120.000 | +5 |
| 14 | 140.000 | +5 |
| 15 | 165.000 | +5 |
| 16 | 195.000 | +5 |
| 17 | 225.000 | +6 |
| 18 | 265.000 | +6 |
| 19 | 305.000 | +6 |
| 20 | 355.000 | +6 |

### 14.2 Progresión por hitos (Milestone)

Alternativa sin contar XP: el DM sube de nivel al grupo cuando alcanza puntos narrativos clave.

```typescript
interface LevelingConfig {
  method: 'xp' | 'milestone';
  // Para XP
  current_xp?: number;
  // Para hitos
  milestones?: {
    id: string;
    title: string;                  // "Derrotar al culto de la aldea"
    target_level: number;           // nivel al que sube el grupo
    achieved: boolean;
    session_id?: string;
  }[];
}
```

> **Nota de implementación:** El método de hitos es cada vez más popular porque desacopla la recompensa de matar monstruos y facilita la planificación narrativa. La app debería permitir cambiar de método a mitad de campaña.

---

## 15. Gestión de sesiones y bitácora

### 15.1 Ficha de sesión

```typescript
interface Session {
  id: string;
  campaign_id: string;
  session_number: number;
  title: string;
  date_played: date;
  duration_minutes?: number;

  // Preparación (antes de la sesión)
  planned_encounters: string[];     // encounter ids planificados
  prep_notes?: string;              // notas del DM

  // Durante / después
  summary?: string;                 // resumen narrativo (recap)
  encounters_played: string[];
  npcs_introduced: string[];
  locations_visited: string[];
  quests_advanced: string[];
  loot_gained?: EncounterReward;
  xp_awarded?: number;
  level_ups?: { character_id: string; new_level: number }[];

  // Meta
  players_present: string[];        // quiénes asistieron
  cliffhanger?: string;             // con qué quedó la cosa
  dm_notes?: string;
}
```

### 15.2 Recap automático

La app puede generar un "resumen de la sesión anterior" combinando: `summary` + `cliffhanger` + `quests_advanced` de la última sesión. Útil para arrancar la siguiente partida.

### 15.3 Rastreo de combate en vivo (Initiative Tracker)

Durante un encuentro de combate, la app debe rastrear:

```typescript
interface CombatTracker {
  encounter_id: string;
  round: number;                    // ronda actual
  current_turn_index: number;       // de quién es el turno
  combatants: Combatant[];
  active: boolean;
}

interface Combatant {
  id: string;
  name: string;
  combatant_type: 'pc' | 'npc' | 'monster';
  reference_id: string;             // character_id o stat_block_id
  initiative: number;               // resultado de la tirada de iniciativa
  current_hp: number;
  max_hp: number;
  temp_hp: number;
  armor_class: number;
  conditions: Condition[];          // condiciones activas
  concentration?: { spell: string; save_dc_source: number } | null;
  is_dead: boolean;
  notes?: string;
}
```

### 15.4 Orden de iniciativa

```
1. Cada combatiente tira iniciativa: 1d20 + modificador de DES (+ bonus)
2. Se ordena de mayor a menor
3. En caso de empate: mayor modificador de DES gana; si persiste, el DM decide
   (o los PJ deciden entre ellos; NPCs/monstruos los ordena el DM)
4. El combate procede en rondas; cada ronda = ~6 segundos de juego
5. Cada combatiente actúa en su turno en orden de iniciativa
6. Al final de la lista, empieza una nueva ronda
```

---

## 16. Modelo de datos sugerido

```typescript
// ── Raíz: Campaña ────────────────────────────────────────────────────────
interface Campaign {
  id: string;
  name: string;
  subtitle?: string;
  description: string;

  // Mesa
  dm_id: string;
  dm_name: string;
  co_dm_ids?: string[];
  players: CampaignPlayer[];
  character_ids: string[];

  // Sistema y mundo
  system: {
    ruleset: 'dnd_5e_2014' | 'dnd_5e_2024' | 'dnd_5e_homebrew';
    sourcebooks_allowed: string[];
    homebrew_allowed: boolean;
    variant_rules: string[];
    house_rules: HouseRule[];
  };
  world: {
    world_name: string;
    setting_type: 'official' | 'homebrew' | 'hybrid';
    official_setting?: string;      // "Forgotten Realms", etc.
    genre?: string;
    description?: string;
  };

  // Estado
  status: 'planning' | 'active' | 'on_hiatus' | 'completed' | 'abandoned';
  start_level: number;
  current_level: number;
  target_end_level?: number;
  leveling: LevelingConfig;

  // Configuración de mesa
  player_count: number;
  session_frequency?: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
  session_duration_hours?: number;
  tone?: string[];
  themes?: string[];

  // Contenido (referencias por id, almacenados en colecciones aparte)
  adventure_ids: string[];
  session_ids: string[];
  location_ids: string[];
  npc_ids: string[];
  faction_ids: string[];
  quest_ids: string[];
  story_arc_ids: string[];
  plot_twist_ids: string[];        // dm_only por defecto
  map_ids: string[];
  encounter_ids: string[];
  custom_stat_block_ids: string[]; // monstruos caseros

  // Meta
  banner_image?: string;
  tags?: string[];
  is_public: boolean;
  created_at: date;
  updated_at: date;
}

// ── Aventura / Arco ──────────────────────────────────────────────────────
interface Adventure {
  id: string;
  campaign_id: string;
  title: string;
  description: string;
  order: number;                    // posición en la campaña
  source: 'official' | 'homebrew';
  module_name?: string;             // si es un módulo publicado
  status: 'not_started' | 'active' | 'completed' | 'abandoned';
  recommended_level_range: { min: number; max: number };
  session_ids: string[];
  hook_ids: string[];
  story_arc_ids: string[];
}
```

> **Arquitectura recomendada:** La campaña es el agregado raíz. Las entidades pesadas (NPCs, monstruos, mapas, encuentros) se almacenan en colecciones separadas y se referencian por id, no se anidan directamente en el objeto Campaign. Esto mantiene el documento raíz ligero y permite consultas eficientes.

### Función de cálculo clave: dificultad de encuentro

```typescript
function calculateEncounterDifficulty(
  monsters: { xp: number; quantity: number }[],
  party: { level: number }[]
): {
  baseXP: number;
  adjustedXP: number;
  difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
} {
  // 1. XP base
  const baseXP = monsters.reduce((sum, m) => sum + m.xp * m.quantity, 0);
  const monsterCount = monsters.reduce((sum, m) => sum + m.quantity, 0);

  // 2. Multiplicador por número de monstruos
  let multiplierIndex = getMultiplierIndex(monsterCount);

  // 3. Ajuste por tamaño de grupo
  const partySize = party.length;
  if (partySize <= 2) multiplierIndex += 1;       // fila más alta
  else if (partySize >= 6) multiplierIndex -= 1;  // fila más baja
  const multiplier = MULTIPLIERS[clamp(multiplierIndex, 0, MULTIPLIERS.length - 1)];

  // 4. XP ajustado
  const adjustedXP = baseXP * multiplier;

  // 5. Umbrales del grupo
  const thresholds = { easy: 0, medium: 0, hard: 0, deadly: 0 };
  for (const pc of party) {
    thresholds.easy   += XP_THRESHOLDS[pc.level].easy;
    thresholds.medium += XP_THRESHOLDS[pc.level].medium;
    thresholds.hard   += XP_THRESHOLDS[pc.level].hard;
    thresholds.deadly += XP_THRESHOLDS[pc.level].deadly;
  }

  // 6. Clasificación
  let difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
  if (adjustedXP < thresholds.easy) difficulty = 'trivial';
  else if (adjustedXP < thresholds.medium) difficulty = 'easy';
  else if (adjustedXP < thresholds.hard) difficulty = 'medium';
  else if (adjustedXP < thresholds.deadly) difficulty = 'hard';
  else difficulty = 'deadly';

  return { baseXP, adjustedXP, difficulty };
}

const MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 4];  // índices 0–5

function getMultiplierIndex(count: number): number {
  if (count === 1) return 0;
  if (count === 2) return 1;
  if (count <= 6) return 2;
  if (count <= 10) return 3;
  if (count <= 14) return 4;
  return 5;
}
```

---

## 17. Validaciones y reglas de integridad

### Reglas absolutas

1. **Toda campaña tiene exactamente un DM principal** (`dm_id` obligatorio). Puede tener co-DMs adicionales.

2. **Jerarquía consistente:** una sesión pertenece a una aventura que pertenece a una campaña. Un encuentro pertenece a una sesión o localización dentro de la misma campaña. No permitir referencias cruzadas entre campañas.

3. **Niveles válidos:** `start_level`, `current_level` y `target_end_level` deben estar entre 1 y 20. `current_level ≥ start_level`.

4. **Contenido dm_only nunca se expone a jugadores:** plot twists, motivaciones/secretos de NPCs, stat blocks ocultos, puntos de interés ocultos, notas del DM. Este es un requisito de seguridad, no solo de UI — filtrar en el backend, no solo ocultar en el frontend.

5. **Los umbrales de XP y la tabla de CR son constantes del sistema:** no deben ser editables por el usuario (salvo modo homebrew explícito). Son la base de todos los cálculos de balanceo.

6. **HP de combatientes no negativo:** `current_hp ≥ 0`. Al llegar a 0, un PC entra en tiradas de muerte; un monstruo/NPC normalmente muere (a criterio del DM).

7. **Un combatiente tiene exactamente una entrada de iniciativa por encuentro.** Múltiples instancias del mismo monstruo son combatientes separados con iniciativa (compartida o individual, a elección del DM) y HP propios.

8. **Concentración única por combatiente:** coherente con la Guía de Hechizos — un combatiente concentrado en un hechizo pierde el anterior al concentrarse en otro.

9. **El multiplicador de encuentro NO se usa para repartir XP:** solo para medir dificultad. El XP de recompensa usa el XP base. (Error común de implementación.)

10. **Estados coherentes:** un `quest.status = 'completed'` requiere que todos sus objetivos no-opcionales estén completos. Una campaña `completed` no debería tener sesiones `planned` pendientes (advertir).

### Advertencias (no bloquean)

- Encuentro clasificado como `deadly` → advertir al DM que puede ser letal
- Día de aventura que supera el presupuesto diario de XP (§12.7) → advertir de sobrecarga
- Grupo fuera del rango 3–5 jugadores → recordar que el balanceo se ajusta
- Nivel del grupo muy por debajo/encima del rango recomendado de la aventura → advertir
- Monstruo de CR muy superior al nivel del grupo como enemigo único → advertir sobre "action economy" (un solo enemigo suele ser fácil de rodear)
- Sesión sin resumen tras marcarse como jugada → sugerir completar la bitácora

### Reglas de permisos (visibilidad)

```
ROL DM:
  → Ve y edita TODO el contenido de la campaña
  → Incluye: plot twists, secretos de NPCs, stat blocks, notas privadas,
    puntos de interés ocultos, tesoros no descubiertos

ROL JUGADOR:
  → Ve solo contenido marcado como visible_to_players / discovered
  → Ve su propia ficha de personaje completa
  → Ve NPCs, localizaciones y misiones que el grupo ya conoce
  → NO ve: plot_twists no revelados, dm_notes, secretos, stat blocks de
    monstruos no combatidos, mapas marcados dm_only

ROL INVITADO (guest):
  → Solo lectura de contenido público (si is_public = true)
```

---

*Documento generado para implementación técnica. Fuente principal: Dungeon Master's Guide D&D 5e (2014), Player's Handbook (2014), Xanathar's Guide to Everything (2017). Las matemáticas de balanceo de encuentros corresponden al sistema del DMG 2014 (capítulo "Creating Encounters"). El sistema alternativo simplificado de XP de Xanathar's puede añadirse como opción de configuración.*
