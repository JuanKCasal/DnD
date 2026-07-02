# Guía Definitiva: Creación de Personaje en D&D 5e
## Documento de especificación para implementación en app

> **Propósito:** Este documento describe con precisión técnica todos los parámetros, fórmulas, dependencias y reglas de la creación de personaje en Dungeons & Dragons 5ª Edición (D&D 5e). Está escrito para que Claude Code pueda implementar un sistema de creación de personaje completo, correcto y sin ambigüedades.

---

## Índice

1. [Arquitectura general del personaje](#1-arquitectura-general-del-personaje)
2. [Las 6 características base](#2-las-6-características-base)
3. [Modificadores de característica](#3-modificadores-de-característica)
4. [Raza](#4-raza)
5. [Clase](#5-clase)
6. [Trasfondo](#6-trasfondo)
7. [Métodos de generación de puntuaciones](#7-métodos-de-generación-de-puntuaciones)
8. [Parámetros de combate calculados](#8-parámetros-de-combate-calculados)
9. [Las 18 habilidades](#9-las-18-habilidades)
10. [Tiradas de salvación](#10-tiradas-de-salvación)
11. [Competencias](#11-competencias)
12. [Equipo e inventario](#12-equipo-e-inventario)
13. [Magia y hechizos](#13-magia-y-hechizos)
14. [Rasgos narrativos y alineamiento](#14-rasgos-narrativos-y-alineamiento)
15. [Flujo de creación paso a paso](#15-flujo-de-creación-paso-a-paso)
16. [Modelo de datos sugerido](#16-modelo-de-datos-sugerido)
17. [Validaciones y reglas de integridad](#17-validaciones-y-reglas-de-integridad)

---

## 1. Arquitectura general del personaje

Un personaje de D&D 5e tiene tres capas de parámetros:

| Capa | Tipo | Descripción |
|------|------|-------------|
| **Base** | Elección del jugador | Raza, Clase, Trasfondo, puntuaciones de característica |
| **Derivada** | Calculada por fórmula | Modificadores, PG, CA, BPC, iniciativa, CD de hechizos |
| **Narrativa** | Libre/tablas opcionales | Alineamiento, personalidad, vínculos, defectos, nombre, apariencia |

### Orden de resolución obligatorio

```
1. Elegir Raza         → bonificadores a características + rasgos fijos
2. Elegir Clase        → dado de golpe, competencias, rasgos de clase
3. Elegir Trasfondo    → 2 competencias en habilidades + extras
4. Asignar puntuaciones de característica (antes de aplicar bonos de raza)
5. Aplicar bonificadores raciales a las puntuaciones
6. Calcular todos los modificadores (fórmula universal)
7. Calcular parámetros derivados (PG, CA, BPC, iniciativa, salvaciones, etc.)
8. Seleccionar equipo inicial
9. Definir rasgos narrativos
```

---

## 2. Las 6 características base

Toda la mecánica del juego gira en torno a estas 6 puntuaciones. Cada una tiene rango válido de **1 a 20** en creación de personaje (puede superar 20 con objetos mágicos o rasgos especiales, máximo absoluto 30).

| ID | Nombre | Abreviatura | Usos principales |
|----|--------|-------------|-----------------|
| `STR` | Fuerza | FUE | Ataques cuerpo a cuerpo (armas sin Finesse), Athletics, capacidad de carga, romper objetos |
| `DEX` | Destreza | DES | Ataques a distancia y armas Finesse, CA sin armadura, Iniciativa, Acrobatics, Stealth, Sleight of Hand |
| `CON` | Constitución | CON | PG totales y por nivel, tiradas de concentración de hechizos, resistencia física |
| `INT` | Inteligencia | INT | Magia del Mago, Arcana, History, Investigation, Nature, Religion |
| `WIS` | Sabiduría | SAB | Magia de Clérigo/Druida, Insight, Medicine, Perception, Survival, Animal Handling |
| `CHA` | Carisma | CAR | Magia de Bardo/Brujo/Hechicero/Paladín, Deception, Intimidation, Performance, Persuasion |

### Regla de puntuación mínima

Ninguna puntuación de característica puede quedar en 0 con ningún método de generación. El mínimo operativo es **3** (antes de bonos de raza). Si tras aplicar penalizaciones raciales una puntuación bajara de 1, se fija en **1**.

---

## 3. Modificadores de característica

Esta es la fórmula más usada en todo el juego. Cada puntuación de característica tiene un modificador asociado.

### Fórmula

```
modificador = floor((puntuación - 10) / 2)
```

### Tabla completa

| Puntuación | Modificador | Puntuación | Modificador |
|-----------|-------------|-----------|-------------|
| 1 | −5 | 14–15 | +2 |
| 2–3 | −4 | 16–17 | +3 |
| 4–5 | −3 | 18–19 | +4 |
| 6–7 | −2 | 20–21 | +5 |
| 8–9 | −1 | 22–23 | +6 |
| 10–11 | +0 | 24–25 | +7 |
| 12–13 | +1 | 26–27 | +8 |

> **Nota de implementación:** Los modificadores pueden ser negativos (de −5 a −1 con puntuaciones bajas). Almacenarlos siempre como enteros con signo.

---

## 4. Raza

La raza otorga bonificadores de característica, rasgos pasivos, velocidad base, visión especial e idiomas. Es el primer parámetro elegido.

### Razas del Manual del Jugador (Player's Handbook)

#### 4.1 Humano

| Variante | Bonus características | Velocidad | Rasgos | Idiomas |
|----------|----------------------|-----------|--------|---------|
| Estándar | +1 a **todas** las 6 características | 30 ft | Ninguno especial | Común + 1 a elección |
| Variante *(opcional)* | +1 a **2 características** a elección del jugador | 30 ft | **1 Dote** a nivel 1 | Común + 1 a elección |

> El Humano Variante es la opción más poderosa de creación — una dote al nivel 1 es un recurso que otras razas no obtienen hasta niveles superiores.

#### 4.2 Enano

| Subraza | Bonus características | Velocidad | Visión | Rasgos clave |
|---------|----------------------|-----------|--------|-------------|
| De las Colinas | +2 CON, +1 SAB | 25 ft | Darkvision 60 ft | Resistencia Enana (+ventaja en salvaciones vs. veneno, resistencia al daño por veneno), Tenacidad (+1 PG por nivel), Competencia con armadura media |
| De las Montañas | +2 CON, +2 FUE | 25 ft | Darkvision 60 ft | Resistencia Enana, Competencia con armadura media |

**Rasgos comunes a todos los enanos:**
- Velocidad no se reduce por llevar armadura pesada
- Competencia con hacha de batalla, hacha de mano, martillo ligero y de guerra
- Competencia con herramientas de albañil, herrero o cervecero (a elección)
- Idiomas: Común + Enano
- Conocimiento de piedra: ventaja en tiradas de Historia sobre origen de trabajos en piedra

#### 4.3 Elfo

| Subraza | Bonus características | Velocidad | Visión | Rasgos clave |
|---------|----------------------|-----------|--------|-------------|
| Alto | +2 DES, +1 INT | 30 ft | Darkvision 60 ft | Magia de elfo alto (1 truco de mago; INT como característica), Competencia con espada larga/corta/arco |
| Del bosque | +2 DES, +1 SAB | 35 ft | Darkvision 60 ft | Máscara de la naturaleza (Stealth en terreno natural), Competencia con espada larga/corta/arco |
| Oscuro (Drow) | +2 DES, +1 CAR | 30 ft | **Truesight 120 ft** | Magia Drow (Dancing Lights, Faerie Fire, Darkness), Sensibilidad a la luz solar (desventaja en ataques y Perception bajo luz solar directa) |

**Rasgos comunes a todos los elfos:**
- Sentidos agudos: Competencia en Perception
- Linaje feérico: ventaja en salvaciones vs. hechizos de encantamiento, inmune a la magia de sueño
- Transe: no duermen; descansan 4 horas meditando (equivale a 8 horas de sueño)
- Idiomas: Común + Élfico

#### 4.4 Halfling

| Subraza | Bonus características | Velocidad | Visión | Rasgos clave |
|---------|----------------------|-----------|--------|-------------|
| Pie ligero | +2 DES, +1 CAR | 25 ft | Normal | Sigiloso natural (esconderse detrás de criaturas más grandes) |
| Fornido | +2 DES, +1 CON | 25 ft | Normal | Resistencia al veneno (ventaja en salvaciones, resistencia al daño) |

**Rasgos comunes a todos los halflings:**
- Agilidad: puede moverse por el espacio de cualquier criatura de tamaño mayor
- Suerte: cuando se saca 1 natural en ataque, habilidad o salvación, se vuelve a tirar y se debe usar el nuevo resultado
- Valiente: ventaja en salvaciones vs. miedo
- Idiomas: Común + Halfling

#### 4.5 Gnomo

| Subraza | Bonus características | Velocidad | Visión | Rasgos clave |
|---------|----------------------|-----------|--------|-------------|
| De las rocas | +2 INT, +1 CON | 25 ft | Darkvision 60 ft | Artesano astuto (crear objetos mecánicos simples), Conocimiento de maquinaria |
| De los bosques | +2 INT, +1 DES | 25 ft | Darkvision 60 ft | Ilusión menor (Minor Illusion como truco; INT como característica), Hablar con bestias pequeñas |

**Rasgos comunes a todos los gnomos:**
- Astucia gnoma: ventaja en tiradas de salvación de INT, SAB y CAR contra magia
- Idiomas: Común + Gnomo

#### 4.6 Semielfo

- **Bonus características:** +2 CAR + **+1 a 2 características distintas** a elección del jugador (no pueden ser la misma)
- **Velocidad:** 30 ft
- **Visión:** Darkvision 60 ft
- **Rasgos:** Linaje feérico (igual que los elfos), Sentidos agudos (Competencia en Perception), **Versatilidad de habilidades: elige 2 habilidades adicionales de competencia de cualquier lista**
- **Idiomas:** Común, Élfico + 1 a elección

#### 4.7 Semiorco

- **Bonus características:** +2 FUE, +1 CON
- **Velocidad:** 30 ft
- **Visión:** Darkvision 60 ft
- **Rasgos:**
  - Amenazante: Competencia en Intimidation
  - Resistencia implacable: cuando se reduce a 0 PG pero no se muere, se puede quedar en **1 PG en su lugar** (1 vez por descanso largo)
  - Ataques salvajes: cuando se saca un crítico con arma cuerpo a cuerpo, se tira uno de los dados de daño extra una vez más y se añade al daño total
- **Idiomas:** Común + Orco

#### 4.8 Tiefling

- **Bonus características:** +2 CAR, +1 INT
- **Velocidad:** 30 ft
- **Visión:** Darkvision 60 ft
- **Rasgos:**
  - Resistencia infernal: resistencia al daño por fuego
  - Herencia infernal (magia innata, CAR como característica):
    - Nivel 1: `Thaumaturgy` (truco)
    - Nivel 3: `Hellish Rebuke` (hechizo de nivel 1, 1×/descanso largo)
    - Nivel 5: `Darkness` (hechizo de nivel 2, 1×/descanso largo)
- **Idiomas:** Común + Infernal

#### 4.9 Dragonborn

- **Bonus características:** +2 FUE, +1 CAR
- **Velocidad:** 30 ft
- **Visión:** Normal
- **Rasgos:**
  - Aliento de dragón: acción, área 15 ft cono o 30 ft línea, 2d6 daño (escala: nivel 6: 3d6, nivel 11: 4d6, nivel 16: 5d6), CD = 8 + BPC + mod. CON, 1×/descanso corto o largo
  - Resistencia dracónica: resistencia al tipo de daño de su linaje
- **Linajes dracónicos disponibles:**

| Linaje | Tipo de daño | Forma del aliento |
|--------|-------------|------------------|
| Negro | Ácido | Línea 5×30 ft |
| Azul | Rayo | Línea 5×30 ft |
| Latón | Fuego | Línea 5×30 ft |
| Bronce | Rayo | Línea 5×30 ft |
| Cobre | Ácido | Línea 5×30 ft |
| Dorado | Fuego | Cono 15 ft |
| Verde | Veneno | Cono 15 ft |
| Plateado | Frío | Cono 15 ft |
| Rojo | Fuego | Cono 15 ft |
| Blanco | Frío | Cono 15 ft |

- **Idiomas:** Común + Dracónico

---

## 5. Clase

La clase define el rol, el dado de golpe, las competencias de combate y las capacidades especiales. Se elige al nivel 1.

### Resumen de las 12 clases del PHB

| Clase | Dado de golpe | Característica mágica | Tiradas de salvación | Armadura | Armas |
|-------|-----------|----------------------|---------------------|----------|-------|
| Bárbaro | d12 | — | FUE, CON | Ligera, media, escudos | Sencillas, marciales |
| Bardo | d8 | CAR | DES, CAR | Ligera, escudos | Sencillas + selección marciales |
| Clérigo | d8 | SAB | SAB, CAR | Ligera, media, escudos | Sencillas |
| Druida | d8 | SAB | INT, SAB | Ligera, media, escudos (no metálicos) | Sencillas seleccionadas |
| Guerrero | d10 | — (CAR si Eldritch Knight: INT) | FUE, CON | Todas + escudos | Sencillas, marciales |
| Monje | d8 | — | FUE, DES | Ninguna | Sencillas, espadas cortas |
| Paladín | d10 | CAR | SAB, CAR | Todas + escudos | Sencillas, marciales |
| Explorador | d10 | SAB | FUE, DES | Ligera, media, escudos | Sencillas, marciales |
| Pícaro | d8 | — (INT si Arcane Trickster) | DES, INT | Ligera | Sencillas + selección marciales |
| Hechicero | d6 | CAR | CON, CAR | Ninguna | Sencillas seleccionadas |
| Brujo | d8 | CAR | SAB, CAR | Ligera | Sencillas |
| Mago | d6 | INT | INT, SAB | Ninguna | Sencillas seleccionadas |

### Detalle completo por clase

#### 5.1 Bárbaro

- **Dado de golpe:** d12
- **Tiradas de salvación:** FUE, CON
- **Habilidades:** Elige 2 de: Athletics, Intimidation, Nature, Perception, Survival, Animal Handling
- **Competencias:** Armadura ligera y media, escudos, armas sencillas y marciales
- **Oro inicial:** 2d4 × 10 po (alternativa: equipo de clase)
- **Equipo de clase:** Hacha grande O 2 hachas de mano, 4 jabalinas, mochila de explorador O mochila de mazmorrero
- **Rasgos nivel 1:**
  - **Cólera (Rage):** Acción bonus para activar. Duración: 1 minuto. Efectos: ventaja en tiradas de FUE, +2 daño en ataques con FUE (sube a +3 en nivel 9, +4 en nivel 16), resistencia a daño contundente/perforante/cortante. Usos: 2 por descanso largo (sube con nivel). Se cancela si se lleva armadura pesada, se lanza un hechizo o no se ataca ni recibe daño en un turno.
  - **Defensa sin armadura:** CA = 10 + mod. DES + mod. CON (solo si no viste armadura)
- **Rasgos importantes por nivel:** Ataque imprudente (nivel 2), Sentido del peligro (nivel 2), Ataque extra (nivel 5), Movimiento rápido (nivel 5), Golpe feroz (nivel 9), Mejora de puntuación de característica (niveles 4, 8, 12, 16, 19)
- **Subclases (Primal Path, nivel 3):** Berserker, Totem Warrior, Ancestral Guardian, Storm Herald, Zealot, Wild Magic

#### 5.2 Bardo

- **Dado de golpe:** d8
- **Tiradas de salvación:** DES, CAR
- **Habilidades:** Elige **3** habilidades cualesquiera (lista completa)
- **Competencias:** Armadura ligera, escudos, armas sencillas, espada larga, espada corta, espada ropera, ballesta de mano; 3 instrumentos musicales a elección
- **Oro inicial:** 5d4 × 10 po
- **Magia:** CAR; conjura hasta nivel 9; conoce cantidad limitada de hechizos (ver tabla de progresión); lista de hechizos del Bardo
- **Rasgos nivel 1:**
  - **Inspiración Bárdica:** Acción bonus. Otorga a otro personaje a 60 ft un dado de inspiración (d6 en nivel 1 → d8 nivel 5 → d10 nivel 10 → d12 nivel 15). El receptor puede añadirlo a 1 tirada de ataque, habilidad o salvación en los próximos 10 minutos. Usos: mod. CAR por descanso largo (mínimo 1).
- **Rasgos importantes:** Competencia multiuso / Pericia (nivel 3 y nivel 10), Canción de descanso (nivel 2), Canciones de clase (nivel 3), Inspiración bárdica mejorada (nivel 5), Contramagia (nivel 6), Magia incomparable (nivel 20)
- **Subclases (Bard College, nivel 3):** Lore, Valor, Glamour, Swords, Whispers, Eloquence, Creation, Spirits

#### 5.3 Clérigo

- **Dado de golpe:** d8
- **Tiradas de salvación:** SAB, CAR
- **Habilidades:** Elige 2 de: History, Insight, Medicine, Persuasion, Religion
- **Competencias:** Armadura ligera y media, escudos, todas las armas sencillas
- **Oro inicial:** 5d4 × 10 po
- **Magia:** SAB; preparado (puede cambiar hechizos preparados en cada descanso largo); preparar mod. SAB + nivel de clérigo hechizos por día (mínimo 1); lista de hechizos del Clérigo + hechizos de dominio siempre preparados
- **Rasgos nivel 1:**
  - **Dominio Divino:** Elige un dominio al nivel 1. Otorga hechizos adicionales siempre preparados, competencias extra y rasgos únicos. Dominios del PHB: Conocimiento, Vida, Luz, Naturaleza, Tempestad, Engaño, Guerra.
  - **Canal de Divinidad (nivel 2):** 1 uso por descanso corto. Cada dominio tiene 2 opciones; todos tienen `Turn Undead`.
- **Subclases (Divine Domain, nivel 1):** Knowledge, Life, Light, Nature, Tempest, Trickery, War, Death (solo para personajes malvados/villanos), Forge, Grave, Order, Peace, Twilight

#### 5.4 Druida

- **Dado de golpe:** d8
- **Tiradas de salvación:** INT, SAB
- **Habilidades:** Elige 2 de: Arcana, Animal Handling, Insight, Medicine, Nature, Perception, Religion, Survival
- **Competencias:** Armadura ligera y media **no metálica**, escudos **no metálicos**, garrote, daga, dardo, lanza, bastón, cimitarra, hoz, honda
- **Restricción:** Los druidas no pueden vestir armadura metálica ni usar escudos metálicos
- **Oro inicial:** 2d4 × 10 po
- **Magia:** SAB; preparado; igual cálculo que Clérigo (mod. SAB + nivel)
- **Rasgos nivel 1:**
  - **Druídico:** Conoce el idioma Druídico (lenguaje secreto, puede dejar mensajes ocultos en la naturaleza)
- **Rasgos nivel 2:**
  - **Forma salvaje (Wild Shape):** Acción. Se transforma en bestia que haya observado. Restricciones por nivel: nivel 2: CR ≤ 1/4 (sin vuelo ni nado); nivel 4: CR ≤ 1/2 (sin vuelo); nivel 8+: CR ≤ 1 (sin restricciones). 2 usos por descanso corto. PG de la forma son temporales; cuando llegan a 0 vuelve a forma normal.
- **Subclases (Druid Circle, nivel 2):** Land, Moon, Dreams, Shepherd, Spores, Stars, Wildfire

#### 5.5 Guerrero

- **Dado de golpe:** d10
- **Tiradas de salvación:** FUE, CON
- **Habilidades:** Elige 2 de: Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Survival
- **Competencias:** Todas las armaduras, escudos, armas sencillas y marciales
- **Oro inicial:** 5d4 × 10 po (armadura de malla O cuero tachonado + arco largo + 20 flechas)
- **Rasgos nivel 1:**
  - **Estilo de combate:** Elige 1: Arquería (+2 a tiradas de ataque con armas a distancia), Defensa (+1 CA si viste armadura), Duelo (+2 daño con arma a 1 mano si la otra está vacía), Combate con dos armas (añade modificador de característica al daño del arma secundaria), Gran arma (vuelve a tirar 1 y 2 en dados de daño con armas a 2 manos), Protección (reacción: imponer desventaja en ataque contra aliado adyacente con escudo).
  - **Segundo aliento:** Acción bonus. Recupera 1d10 + nivel del guerrero PG. 1×/descanso corto o largo.
- **Rasgos nivel 2:**
  - **Impulso de acción (Action Surge):** Toma 1 acción adicional completa en el turno. 1×/descanso corto (2×/descanso corto en nivel 17).
- **Rasgos importantes:** Ataque extra ×2 (nivel 5), ×3 (nivel 11), ×4 (nivel 20); Indomable (nivel 9)
- **Subclases (Martial Archetype, nivel 3):** Champion, Battle Master, Eldritch Knight, Arcane Archer, Cavalier, Echo Knight, Psi Warrior, Rune Knight, Samurai, Banneret

#### 5.6 Monje

- **Dado de golpe:** d8
- **Tiradas de salvación:** FUE, DES
- **Habilidades:** Elige 2 de: Acrobatics, Athletics, History, Insight, Religion, Stealth
- **Competencias:** Armas sencillas, espadas cortas; ninguna armadura
- **Oro inicial:** 5d4 po (no puede comenzar con armadura)
- **Rasgos nivel 1:**
  - **Defensa sin armadura:** CA = 10 + mod. DES + mod. SAB (sin armadura ni escudo)
  - **Artes marciales:** Las armas simples y espadas cortas son "armas de monje". Pueden usar DES en vez de FUE para atacar con ellas. Dado de daño sin armas escala: d4 (nivel 1-4), d6 (5-10), d8 (11-16), d10 (17+). Cuando se ataca con arma de monje o sin armas, se puede hacer un ataque sin armas como acción bonus.
- **Rasgos nivel 2:**
  - **Puntos de Ki:** mod. nivel por descanso corto. Gastar para: Flurry of Blows (2 puntos → 2 ataques adicionales sin armas como acción bonus), Patient Defense (1 punto → Dodge como acción bonus), Step of the Wind (1 punto → Disengage o Dash como acción bonus).
  - **Movimiento sin armadura:** +10 ft de velocidad (escala con nivel).
- **Rasgos importantes:** Deflect Missiles (nivel 3), Slow Fall (nivel 4), Ataque extra (nivel 5), Stunning Strike (nivel 5), Ki-Empowered Strikes (nivel 6), Evasion (nivel 7), Stillness of Mind (nivel 7), Purity of Body (nivel 10), Tongue of the Sun and Moon (nivel 13), Diamond Soul (nivel 14), Timeless Body (nivel 15), Empty Body (nivel 18), Perfect Self (nivel 20)
- **Subclases (Monastic Tradition, nivel 3):** Open Hand, Shadow, Four Elements, Astral Self, Drunken Master, Kensei, Long Death, Mercy, Sun Soul

#### 5.7 Paladín

- **Dado de golpe:** d10
- **Tiradas de salvación:** SAB, CAR
- **Habilidades:** Elige 2 de: Athletics, Insight, Intimidation, Medicine, Persuasion, Religion
- **Competencias:** Todas las armaduras, escudos, armas sencillas y marciales
- **Oro inicial:** 5d4 × 10 po
- **Magia:** CAR; hechizos preparados = mod. CAR + mitad nivel paladín (redondeado hacia abajo); empieza a conjurar en nivel 2
- **Rasgos nivel 1:**
  - **Detección del mal y el bien:** Acción. Sabe si hay aberración, celestial, elemental, hada, infernal o muerto viviente a 60 ft (siempre que no haya bloqueo total). 10 minutos de concentración; 1×/descanso corto.
  - **Imposición de manos:** Tiene pool de curación = nivel de paladín × 5. Como acción, puede curar tantos PG como quiera del pool (1 punto cura 1 PG). O puede gastar 5 puntos para curar una enfermedad o neutralizar un veneno. Se recupera en descanso largo.
- **Rasgos nivel 2:**
  - **Estilo de combate** (igual opciones que Guerrero)
  - **Conjurar hechizos:** Empieza a conjurar con ranuras de nivel 1
  - **Golpe Divino (Divine Smite):** Al impactar con arma cuerpo a cuerpo, puede gastar una ranura de hechizo para infligir daño extra: 2d8 por ranura de nivel 1 + 1d8 adicional por nivel de ranura superior. +1d8 extra si el objetivo es un muerto viviente o fiend. Máximo 5d8 total.
- **Rasgos importantes:** Aura de protección (nivel 6), Aura de valor (nivel 10), Mejoras de aura, Sagrado campeón (nivel 20)
- **Subclases (Sacred Oath, nivel 3):** Devotion, Ancients, Vengeance, Conquest, Crown, Glory, Redemption, Watchers, Oathbreaker (villanos)

#### 5.8 Explorador (Ranger)

- **Dado de golpe:** d10
- **Tiradas de salvación:** FUE, DES
- **Habilidades:** Elige 3 de: Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, Survival
- **Competencias:** Armadura ligera y media, escudos, armas sencillas y marciales
- **Oro inicial:** 5d4 × 10 po
- **Magia:** SAB; hechizos conocidos limitados (no preparados); empieza en nivel 2; lista de hechizos del Ranger
- **Rasgos nivel 1:**
  - **Enemigo favorito (Favored Enemy):** Elige un tipo de criatura (aberración, bestia, celestial, constructo, dragón, elemental, hada, fiend, gigante, monstruosidad, ooze, planta, muerto viviente) o 2 tipos de humanoides. Ventaja en tiradas de Survival para rastrearlos; ventaja en INT para recordarlos; aprende 1 idioma de esa criatura si habla.
  - **Explorador natural (Natural Explorer):** Elige 1 tipo de terreno (ártico, costa, desierto, bosque, pradera, montaña, ciénaga, Underdark). En ese terreno: la tirada doble en INT y SAB, movimiento sin penalización por difícil, no puede perderse (salvo por magia), rastreo de 6 o más criaturas da información adicional, puede viajar sigiloso a ritmo normal solo.
- **Rasgos importantes:** Estilo de combate (nivel 2), Ataque extra (nivel 5), Tier de subclase (nivel 3 y 7)
- **Subclases (Ranger Archetype, nivel 3):** Hunter, Beast Master, Fey Wanderer, Gloom Stalker, Horizon Walker, Monster Slayer, Swarmkeeper

#### 5.9 Pícaro (Rogue)

- **Dado de golpe:** d8
- **Tiradas de salvación:** DES, INT
- **Habilidades:** Elige **4** de: Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Performance, Persuasion, Sleight of Hand, Stealth
- **Competencias:** Armadura ligera, armas sencillas, espada larga, espada ropera, espada corta, ballesta de mano; herramientas de ladrón
- **Oro inicial:** 4d4 × 10 po
- **Rasgos nivel 1:**
  - **Ataque furtivo (Sneak Attack):** 1 vez por turno. Inflige daño adicional (1d6 en nivel 1, escala cada 2 niveles hasta 10d6 en nivel 19) si: tiene ventaja en la tirada de ataque, O hay un aliado a 5 ft del objetivo que no esté incapacitado (y el pícaro no tiene desventaja). Solo con arma de Finesse o a distancia.
  - **Jerga criminal (Thieves' Cant):** Idioma secreto de los pícaros. También puede comunicar mensajes ocultos en conversación normal.
  - **Pericia:** Elige 2 de sus competencias en habilidades o herramientas de ladrón; aplica BPC doble (pericia) a esas habilidades.
- **Rasgos nivel 2:**
  - **Acción astucia (Cunning Action):** Acción bonus: Dash, Disengage o Hide.
- **Rasgos importantes:** Pericia adicional (nivel 6), Evasión (nivel 7), Golpe confiable (nivel 11), Sentidos cegadores (nivel 14), Esquiva (nivel 15), Mente escurridiza (nivel 15), Esquiva espectral (nivel 18), Ladrón de habilidades (nivel 20)
- **Subclases (Roguish Archetype, nivel 3):** Thief, Assassin, Arcane Trickster, Inquisitive, Mastermind, Scout, Swashbuckler, Phantom, Soulknife

#### 5.10 Hechicero (Sorcerer)

- **Dado de golpe:** d6
- **Tiradas de salvación:** CON, CAR
- **Habilidades:** Elige 2 de: Arcana, Deception, Insight, Intimidation, Persuasion, Religion
- **Competencias:** Ninguna armadura, ningún escudo; daga, dardo, honda, bastón, ballesta ligera
- **Oro inicial:** 3d4 × 10 po
- **Magia:** CAR; hechizos **conocidos** (no preparados, lista fija que puede cambiar al subir nivel); cantidad limitada de hechizos conocidos y de trucos; nivel 9 máximo
- **Rasgos nivel 1:**
  - **Origen de hechicero (Sorcerous Origin):** Subclase elegida en nivel 1. Otorga rasgos únicos y hechizos adicionales.
- **Rasgos nivel 2:**
  - **Puntos de hechicería (Sorcery Points):** 2 puntos en nivel 2, +1 por nivel (máx 20 en nivel 20). Recuperados en descanso largo. Usos: Flexible Casting (convertir puntos en ranuras y ranuras en puntos), Metamagia.
  - **Metamagia:** Elige 2 opciones al nivel 3, +1 en niveles 10 y 17. Opciones: Careful (proteger aliados de hechizos de área), Distant (doblar alcance), Empowered (volver a tirar dados de daño), Extended (doblar duración), Heightened (+desventaja en salvación del objetivo), Quickened (lanzar como acción bonus), Seeking (re-tirar fallo), Subtle (sin componentes verbales/somáticos), Transmuted (cambiar tipo de daño), Twinned (afectar a 2 objetivos).
- **Subclases (Sorcerous Origin, nivel 1):** Draconic Bloodline, Wild Magic, Divine Soul, Shadow Magic, Storm Sorcery, Aberrant Mind, Clockwork Soul, Lunar Sorcery

#### 5.11 Brujo (Warlock)

- **Dado de golpe:** d8
- **Tiradas de salvación:** SAB, CAR
- **Habilidades:** Elige 2 de: Arcana, Deception, History, Intimidation, Investigation, Nature, Religion
- **Competencias:** Armadura ligera, armas sencillas
- **Oro inicial:** 4d4 × 10 po
- **Magia:** Sistema único — **Pact Magic:**
  - Ranuras de hechizo: pocas (1 en nivel 1, 2 en nivel 2+), todas del mismo nivel (el máximo disponible)
  - Ranuras se recuperan en **descanso corto** (no largo, como el resto)
  - Hechizos **conocidos** (no preparados)
  - CAR como característica mágica
- **Rasgos nivel 1:**
  - **Patrono sobrenatural (Otherworldly Patron):** Elige subclase. El patrono determina hechizos ampliados (siempre conocidos), rasgos de clase y la naturaleza de las Invocaciones.
  - **Magia de pacto (Pact Magic):** Ver arriba.
- **Rasgos nivel 2:**
  - **Invocaciones sobrenaturales (Eldritch Invocations):** Aprende 2 invocaciones en nivel 2. Estas modifican el Eldritch Blast, otorgan habilidades pasivas o permiten lanzar hechizos adicionales. Número escala con nivel.
- **Rasgos nivel 3:**
  - **Don del pacto:** Elige entre Pact of the Blade (invocar arma mágica), Pact of the Chain (familiar poderoso), Pact of the Tome (grimorio con 3 trucos adicionales), Pact of the Talisman.
- **Subclases (Otherworldly Patron, nivel 1):** Archfey, Fiend, Great Old One, Celestial, Hexblade, Fathomless, Genie, Undead, Undying

#### 5.12 Mago (Wizard)

- **Dado de golpe:** d6
- **Tiradas de salvación:** INT, SAB
- **Habilidades:** Elige 2 de: Arcana, History, Insight, Investigation, Medicine, Religion
- **Competencias:** Ninguna armadura; daga, dardo, honda, bastón, ballesta ligera
- **Oro inicial:** 4d4 × 10 po
- **Magia:** INT; hechizos **preparados** (mod. INT + nivel de mago, mínimo 1); lista de hechizos del Mago (la más amplia del juego); **Grimorio:** aprende 6 hechizos de nivel 1 al inicio, +2 por nivel; puede copiar hechizos de pergaminos y grimorios encontrados (coste: 50 po + 2 horas por nivel del hechizo)
- **Rasgos nivel 1:**
  - **Recuperación arcana (Arcane Recovery):** 1 vez por descanso largo. Después de un descanso corto, recuperar ranuras de hechizo con suma de niveles ≤ mitad nivel de mago (redondeado hacia arriba). Máximo nivel 5 por ranura.
- **Subclases (Arcane Tradition, nivel 2):** Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation, Bladesinging, Chronurgy, Graviturgy, Order of Scribes, War Magic

### Tabla de progresión de hechizos (Lanzadores completos: Bardo, Clérigo, Druida, Hechicero, Mago)

| Nivel | Trucos | Ranuras N1 | Ranuras N2 | Ranuras N3 | Ranuras N4 | Ranuras N5 | Ranuras N6 | Ranuras N7 | Ranuras N8 | Ranuras N9 |
|-------|--------|-----------|-----------|-----------|-----------|-----------|-----------|-----------|-----------|-----------|
| 1 | 3–4 | 2 | — | — | — | — | — | — | — | — |
| 2 | 3–4 | 3 | — | — | — | — | — | — | — | — |
| 3 | 3–4 | 4 | 2 | — | — | — | — | — | — | — |
| 4 | 4 | 4 | 3 | — | — | — | — | — | — | — |
| 5 | 4 | 4 | 3 | 2 | — | — | — | — | — | — |
| 6 | 4 | 4 | 3 | 3 | — | — | — | — | — | — |
| 7 | 4 | 4 | 3 | 3 | 1 | — | — | — | — | — |
| 8 | 4 | 4 | 3 | 3 | 2 | — | — | — | — | — |
| 9 | 4 | 4 | 3 | 3 | 3 | 1 | — | — | — | — |
| 10 | 5 | 4 | 3 | 3 | 3 | 2 | — | — | — | — |
| 11 | 5 | 4 | 3 | 3 | 3 | 2 | 1 | — | — | — |
| 12 | 5 | 4 | 3 | 3 | 3 | 2 | 1 | — | — | — |
| 13 | 5 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | — | — |
| 14 | 5 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | — | — |
| 15 | 5 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | — |
| 16 | 5 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | — |
| 17 | 5 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | 1 |
| 18 | 5 | 4 | 3 | 3 | 3 | 3 | 1 | 1 | 1 | 1 |
| 19 | 5 | 4 | 3 | 3 | 3 | 3 | 2 | 1 | 1 | 1 |
| 20 | 5 | 4 | 3 | 3 | 3 | 3 | 2 | 2 | 1 | 1 |

### Tabla de progresión del Brujo (Pact Magic)

| Nivel | Trucos | Hechizos conocidos | Ranuras | Nivel de ranura | Invocaciones | Dones |
|-------|--------|-------------------|---------|----------------|-------------|-------|
| 1 | 2 | 2 | 1 | 1 | — | — |
| 2 | 2 | 3 | 2 | 1 | 2 | — |
| 3 | 2 | 4 | 2 | 2 | 2 | 1 |
| 4 | 3 | 5 | 2 | 2 | 2 | 1 |
| 5 | 3 | 6 | 2 | 3 | 3 | 1 |
| 6 | 3 | 7 | 2 | 3 | 3 | 1 |
| 7 | 3 | 8 | 2 | 4 | 4 | 1 |
| 8 | 3 | 9 | 2 | 4 | 4 | 2 |
| 9 | 3 | 10 | 2 | 5 | 5 | 2 |
| 10 | 4 | 10 | 2 | 5 | 5 | 2 |
| 11 | 4 | 11 | 3 | 5 | 5 | 3 |
| 12–20 | (ver PHB) | … | … | 5 | … | … |

---

## 6. Trasfondo

El trasfondo representa la historia previa del personaje. Otorga competencias fijas y elementos narrativos.

### Estructura de un trasfondo

Cada trasfondo tiene exactamente:
- **2 competencias en habilidades** (fijas)
- **Competencias adicionales** (herramientas, vehículos o idiomas; cantidad variable)
- **Equipo inicial** fijo
- **Oro inicial** fijo
- **Rasgo** (beneficio mecánico-narrativo)
- **Tablas opcionales:** 2 rasgos de personalidad, 2 ideales, 2 vínculos, 2 defectos (el jugador elige 1 de cada tabla o inventa el suyo)

### Los 12 trasfondos del PHB

| Trasfondo | Competencias en habilidades | Competencias adicionales | Oro inicial |
|-----------|----------------------------|--------------------------|-------------|
| Acólito | Insight, Religion | 2 idiomas a elección | 15 po |
| Charlatán | Deception, Sleight of Hand | Kit de disfraz, kit de falsificación | 15 po |
| Criminal / Espía | Deception, Stealth | Juego de azar (1 tipo), herramientas de ladrón | 15 po |
| Entretenedor | Acrobatics, Performance | Kit de disfraz, instrumento musical (1 a elección) | 15 po |
| Forastero | Athletics, Survival | 1 tipo de instrumento musical, 1 idioma a elección | 10 po |
| Gremio artesano | Insight, Persuasion | 1 tipo herramientas artesanales, 1 idioma a elección | 15 po |
| Héroe del pueblo | Animal Handling, Survival | Vehículos terrestres, 1 tipo herramientas artesanales | 10 po |
| Marinero | Athletics, Perception | Herramientas de navegante, vehículos acuáticos | 10 po |
| Noble | History, Persuasion | 1 tipo de juego de azar, 1 idioma a elección | 25 po |
| Proscrito | Athletics, Intimidation | Vehículos terrestres, 1 juego de azar | 10 po |
| Sabio | Arcana, History | 2 idiomas a elección | 10 po |
| Soldado | Athletics, Intimidation | Vehículos terrestres, 1 juego de azar | 10 po |

---

## 7. Métodos de generación de puntuaciones

### Método 1: Tirada de dados (Roll 4d6 drop lowest)

```
Para cada una de las 6 puntuaciones:
  1. Tirar 4 dados de 6 caras (4d6)
  2. Descartar el dado con el valor más bajo
  3. Sumar los 3 dados restantes
  4. El resultado (rango 3–18) es la puntuación base

Asignar los 6 resultados a las 6 características en el orden que el jugador prefiera.
```

> Este método puede producir personajes muy poderosos (varios 15-18) o muy débiles (varios 6-8). Es el más "auténtico" pero el más desequilibrado.

### Método 2: Compra de puntos (Point Buy)

```
Presupuesto: 27 puntos
Rango permitido: 8 a 15 (antes de bonificadores raciales)

Tabla de costos:
  8  = 0 puntos
  9  = 1 punto
  10 = 2 puntos
  11 = 3 puntos
  12 = 4 puntos
  13 = 5 puntos
  14 = 7 puntos   ← salto de costo
  15 = 9 puntos   ← salto de costo

Todas las características comienzan en 8.
El jugador distribuye los 27 puntos hasta que:
  a) Se gastan todos los puntos, o
  b) Todas las características llegan a 15.
```

> **Nota de implementación:** En Point Buy es ilegal tener una puntuación menor de 8 o mayor de 15 antes de aplicar bonos raciales. Si los bonos raciales llevan una puntuación a 16, 17 o incluso 20, eso es válido.

### Método 3: Valores estándar (Standard Array)

```
Asignar libremente los siguientes 6 valores a las 6 características:
15, 14, 13, 12, 10, 8

No se puede repetir ningún valor ni usar valores distintos.
```

### Orden de aplicación (cualquier método)

```
1. Asignar puntuaciones base (por el método elegido)
2. Aplicar bonificadores de raza (suma directa)
3. Calcular modificadores (fórmula: floor((puntuación - 10) / 2))
```

---

## 8. Parámetros de combate calculados

### 8.1 Bonificador de competencia (BPC / Proficiency Bonus)

Depende solo del **nivel total del personaje**, no de la clase.

| Nivel | BPC |
|-------|-----|
| 1–4 | +2 |
| 5–8 | +3 |
| 9–12 | +4 |
| 13–16 | +5 |
| 17–20 | +6 |

```
BPC = floor((nivel - 1) / 4) + 2
```

### 8.2 Puntos de golpe (PG / Hit Points)

```
Nivel 1:
  PG_máx = dado_de_golpe_máximo + mod. CON
  (ej: Guerrero nivel 1 con CON 16 (+3): PG = 10 + 3 = 13)

Niveles 2+:
  PG adicionales por nivel = tirar dado_de_golpe (o usar promedio) + mod. CON
  Promedio del dado = floor(dado_de_golpe / 2) + 1
  (ej: d10 promedio = 6; d8 promedio = 5; d6 promedio = 4; d12 promedio = 7)

PG_total = (dado_de_golpe_máximo + mod. CON) + Σ(dado_de_golpe_nivel_i + mod. CON)
         para i desde nivel 2 hasta nivel actual
```

> **Nota:** El modificador de CON se aplica **retroactivamente** si la CON cambia. Si la puntuación de CON aumenta a nivel 8 (por mejora de característica), se recalculan todos los PG pasados.

### 8.3 Clase de armadura (CA / Armor Class)

La CA se calcula de formas mutuamente excluyentes según el equipo y la clase. Se aplica la **mayor** entre las opciones válidas.

```
Sin armadura (base):
  CA = 10 + mod. DES

Sin armadura (Monje):
  CA = 10 + mod. DES + mod. SAB
  (solo si no viste armadura ni escudo)

Sin armadura (Bárbaro):
  CA = 10 + mod. DES + mod. CON
  (solo si no viste armadura ni escudo)

Armadura ligera:
  CA = CA_de_la_armadura + mod. DES (sin límite)
  (Cuero: 11, Cuero tachonado: 12, Acolchada: 11)

Armadura media:
  CA = CA_de_la_armadura + min(mod. DES, 2)
  (Piel: 12, Armadura de cadenas: 13, Cota de escamas: 14, Coraza: 14, Media armadura: 15)

Armadura pesada:
  CA = CA_de_la_armadura  (sin modificador de DES)
  Requiere FUE mínima según armadura (ver tabla)
  Desventaja en Stealth
  (Anillos: 14, Cota tachonada: 14, Cota de malla: 15 [FUE 13], Cota de placas: 17 [FUE 15], Armadura completa: 18 [FUE 15])

Escudo: +2 CA (acumulable con cualquier tipo de armadura)
```

#### Tabla de armaduras completa

| Nombre | Tipo | CA base | Bonus DES | FUE mín | Desventaja Sigilo | Peso | Precio |
|--------|------|---------|-----------|---------|-------------------|------|--------|
| Acolchada | Ligera | 11 | + DES | — | Sí | 8 lb | 5 po |
| Cuero | Ligera | 11 | + DES | — | — | 10 lb | 10 po |
| Cuero tachonado | Ligera | 12 | + DES | — | — | 13 lb | 45 po |
| Piel | Media | 12 | + DES (máx 2) | — | — | 12 lb | 10 po |
| Armadura de cadenas | Media | 13 | + DES (máx 2) | — | — | 20 lb | 50 po |
| Cota de escamas | Media | 14 | + DES (máx 2) | — | Sí | 45 lb | 50 po |
| Coraza | Media | 14 | + DES (máx 2) | — | — | 20 lb | 400 po |
| Media armadura | Media | 15 | + DES (máx 2) | — | Sí | 40 lb | 750 po |
| Anillos | Pesada | 14 | — | — | — | 40 lb | 30 po |
| Cota tachonada | Pesada | 14 | — | — | Sí | 45 lb | 75 po |
| Cota de malla | Pesada | 15 | — | FUE 13 | Sí | 55 lb | 75 po |
| Cota de placas | Pesada | 17 | — | FUE 15 | Sí | 60 lb | 1500 po |
| Armadura completa | Pesada | 18 | — | FUE 15 | Sí | 65 lb | 1500 po |
| Escudo | — | +2 | — | — | — | 6 lb | 10 po |

### 8.4 Iniciativa

```
Iniciativa = mod. DES
(+ rasgos especiales si aplica: Alert feat, Jack of All Trades del Bardo, etc.)
```

La iniciativa se usa en el combate: se tira 1d20 + Iniciativa al inicio de cada encuentro para determinar el orden de acción.

### 8.5 Bonificador de ataque

```
Arma cuerpo a cuerpo (FUE):
  bonificador = mod. FUE + BPC

Arma a distancia (DES):
  bonificador = mod. DES + BPC

Arma con propiedad Finesse (FUE o DES, a elección del atacante):
  bonificador = max(mod. FUE, mod. DES) + BPC
  (la elección aplica tanto para ataque como para daño, debe ser consistente)

Hechizos:
  bonificador_ataque_hechizo = mod. característica_mágica + BPC
```

### 8.6 Tirada de daño

```
Arma cuerpo a cuerpo (FUE):
  daño = tirar_dado_de_daño + mod. FUE

Arma a distancia (DES):
  daño = tirar_dado_de_daño + mod. DES

Arma Finesse:
  daño = tirar_dado_de_daño + mod. elegido_para_ataque

Hechizos (si hacen tirada de daño):
  daño = dados_del_hechizo (sin modificador de característica, excepto Eldritch Blast con Agonizing Blast)

Critico (natural 20 en ataque):
  daño = tirar TODOS los dados de daño DOS veces + modificadores una vez
```

### 8.7 CD de salvación de hechizos (Spell Save DC)

```
CD = 8 + BPC + mod. característica_mágica_de_la_clase
```

Característica mágica por clase:
- INT: Mago, Eldritch Knight (Guerrero), Arcane Trickster (Pícaro)
- SAB: Clérigo, Druida, Explorador, Monje (algunas subclases)
- CAR: Bardo, Brujo, Hechicero, Paladín

### 8.8 Velocidad de movimiento

```
velocidad_base = determinada por raza (ver sección 4)
velocidad_efectiva = velocidad_base + modificadores_de_clase
```

Modificadores relevantes al nivel 1:
- Monje: +10 ft (Unarmored Movement, nivel 2 en adelante)
- Bárbaro subclase Storm Herald: posible bonus
- Hechizo o efecto: siempre situacional

### 8.9 Pasiva de Percepción

```
Percepción pasiva = 10 + mod. SAB + BPC (si competente en Perception) + bonus pericia (si aplica)
```

Es el valor que el DM usa cuando el personaje no tira activamente (ej: ¿nota algo sospechoso al pasar?).

---

## 9. Las 18 habilidades

Cada habilidad está vinculada a una característica base. Cuando se hace una tirada de habilidad:

```
tirada = 1d20 + mod. característica
+ BPC (si hay competencia en esa habilidad)
+ BPC (extra, si hay pericia — total BPC × 2)
```

| Habilidad | Característica | Usos principales |
|-----------|---------------|-----------------|
| Acrobatics | DES | Mantener equilibrio, piruetas, caídas controladas |
| Animal Handling | SAB | Calmar, entrenar o controlar bestias |
| Arcana | INT | Identificar magia, objetos mágicos, planos |
| Athletics | FUE | Escalar, saltar, nadar, forcejear |
| Deception | CAR | Mentir, disfrazar intenciones |
| History | INT | Recordar hechos históricos, personajes, legados |
| Insight | SAB | Detectar mentiras, leer intenciones |
| Intimidation | CAR | Amenazar, coaccionar mediante presión o violencia |
| Investigation | INT | Deducir pistas, buscar objetos ocultos, analizar |
| Medicine | SAB | Estabilizar moribundos, diagnosticar enfermedades |
| Nature | INT | Conocimiento de plantas, animales, clima, ciclos naturales |
| Perception | SAB | Notar detalles del entorno (el más usado del juego) |
| Performance | CAR | Actuar, cantar, tocar instrumentos |
| Persuasion | CAR | Convencer, negociar diplomáticamente |
| Religion | INT | Conocimiento sobre dioses, dogmas, rituales |
| Sleight of Hand | DES | Hurtar, hacer trucos, esconder objetos |
| Stealth | DES | Moverse sin ser detectado |
| Survival | SAB | Rastrear, orientarse, cazar, evitar peligros naturales |

---

## 10. Tiradas de salvación

Hay 6 tiradas de salvación, una por cada característica. Funcionan igual que las habilidades:

```
tirada_de_salvación = 1d20 + mod. característica + BPC (si hay competencia)
```

Cada clase otorga competencia en exactamente **2 tiradas de salvación** (las mismas siempre, no son a elección — excepto casos especiales de razas como el Gnomo).

| Clase | Salvaciones con competencia |
|-------|-----------------------------|
| Bárbaro | FUE, CON |
| Bardo | DES, CAR |
| Clérigo | SAB, CAR |
| Druida | INT, SAB |
| Guerrero | FUE, CON |
| Monje | FUE, DES |
| Paladín | SAB, CAR |
| Explorador | FUE, DES |
| Pícaro | DES, INT |
| Hechicero | CON, CAR |
| Brujo | SAB, CAR |
| Mago | INT, SAB |

---

## 11. Competencias

Las competencias determinan si se añade el BPC a una tirada. Tienen 3 niveles:

| Nivel | Bonus aplicado | Fuente |
|-------|---------------|--------|
| Sin competencia | Solo mod. característica | — |
| Competencia | + BPC | Clase, raza o trasfondo |
| Pericia (Expertise) | + BPC × 2 | Bardo, Pícaro (seleccionadas) |

### Tipos de competencias

1. **Armas:** sencillas / marciales / específicas (ej: espada larga)
2. **Armaduras:** ligera / media / pesada / escudos
3. **Habilidades:** las 18 listadas (sección 9)
4. **Tiradas de salvación:** las 6 (sección 10)
5. **Herramientas:** herramientas de ladrón, instrumentos musicales, herramientas artesanales, juegos de azar, vehículos terrestres/acuáticos
6. **Idiomas:** no otorgan BPC pero permiten comunicarse

### Regla de no duplicación

Si dos fuentes otorgan competencia en la misma habilidad (ej: clase y trasfondo ambos dan Perception), el personaje elige **otra habilidad de la lista de la clase** en su lugar. No se puede tener "doble competencia" (eso es pericia y solo se obtiene por rasgos específicos).

---

## 12. Equipo e inventario

### 12.1 Obtención de equipo inicial

Hay dos opciones mutuamente excluyentes:

**Opción A — Equipo de clase y trasfondo:**
Tomar el equipo de partida listado en la descripción de la clase y del trasfondo elegidos. Sin tiradas.

**Opción B — Oro de partida:**
Tirar el dado de oro de la clase y comprar equipo libremente.

| Clase | Dado de oro inicial |
|-------|-------------------|
| Bárbaro | 2d4 × 10 po |
| Bardo | 5d4 × 10 po |
| Clérigo | 5d4 × 10 po |
| Druida | 2d4 × 10 po |
| Guerrero | 5d4 × 10 po |
| Monje | 5d4 po |
| Paladín | 5d4 × 10 po |
| Explorador | 5d4 × 10 po |
| Pícaro | 4d4 × 10 po |
| Hechicero | 3d4 × 10 po |
| Brujo | 4d4 × 10 po |
| Mago | 4d4 × 10 po |

### 12.2 Sistema monetario

```
1 pp (plata de platino) = 10 po
1 po (pieza de oro)     = 10 pa = 100 pc
1 pa (plata de plata)   = 10 pc
1 pc (pieza de cobre)   = unidad base
```

### 12.3 Propiedades de armas

| Propiedad | Regla |
|-----------|-------|
| Finesse | Usa FUE o DES para ataque y daño (la misma para ambos en ese ataque) |
| Versatile | Puede usarse a 1 o 2 manos; el dado de daño 2 manos va entre paréntesis |
| Two-Handed | Requiere 2 manos obligatoriamente |
| Light | Usable en combate con dos armas (two-weapon fighting) |
| Thrown | Puede lanzarse a distancia usando la misma característica que para cuerpo a cuerpo |
| Reach | Amplía alcance en +5 ft (típicamente 10 ft) |
| Ammunition | Requiere munición para ataques a distancia |
| Loading | Solo 1 ataque por turno independientemente del número de ataques |
| Heavy | Criaturas pequeñas o más pequeñas tienen desventaja con estas armas |
| Special | Ver descripción específica del arma |

### 12.4 Capacidad de carga

```
Carga máxima = FUE × 15 libras
Sobrecargado (Push/Drag/Lift) = hasta FUE × 30 libras (velocidad 5 ft, desventaja en ataques/tiradas de DES/FUE)
```

### 12.5 Packs de aventurero (equipo de partida común)

| Pack | Contenido | Precio |
|------|-----------|--------|
| Burglar's Pack | Mochila, bolsa de canicas, 10 ft de cuerda de cáñamo, campanilla, 5 velas, palanca, martillo, 10 piquetas, linterna bullseye, 2 frascos aceite, 5 días raciones, caja de yesca, odre agua, 50 ft cuerda de seda | 16 po |
| Diplomat's Pack | Cofre, 2 casos para cartas, ropa elegante, tinta, pluma, lámpara, 2 frascos aceite, 5 hojas papel, frasco perfume, lacre, jabón | 39 po |
| Dungeoneer's Pack | Mochila, palanca, martillo, 10 piquetas, caja de yesca, linterna, 2 frascos aceite, 5 días raciones, odre agua, 50 ft cuerda cáñamo | 12 po |
| Entertainer's Pack | Mochila, kit de cama rodante, 5 velas, raciones 5 días, odre agua, kit de disfraz | 40 po |
| Explorer's Pack | Mochila, kit de cama rodante, cantimplora, 10 antorchas, caja de yesca, 10 días raciones, 50 ft cuerda cáñamo, ropa para viaje | 10 po |
| Scholar's Pack | Mochila, libro lore, frasco tinta, pluma, 10 hojas pergamino, bolsita arena, cuchillo pequeño | 40 po |

---

## 13. Magia y hechizos

### 13.1 Componentes de hechizos

Todo hechizo requiere uno o más:
- **V (Verbal):** Palabras de poder en voz alta. Imposible en silencio mágico o amordazado.
- **S (Somatic):** Gestos con las manos. Imposible sin manos libres.
- **M (Material):** Componente físico (puede sustituirse por un foco arcano o símbolo sagrado si el componente no tiene precio especificado).

### 13.2 Tipos de conjuración

| Tipo | Mecánica |
|------|----------|
| Acción | Se lanza en el turno del personaje como acción principal |
| Acción bonus | Se lanza como acción bonus. Si se lanza como AB, solo se puede lanzar un truco como acción normal ese turno |
| Reacción | Se lanza fuera del turno, en respuesta a un desencadenante específico |
| 1 minuto / 10 minutos / 1 hora | Ritual o conjuración fuera de combate |

### 13.3 Concentración

Algunos hechizos requieren **Concentración**:
- Solo puede haber 1 hechizo de concentración activo a la vez
- Si se toma daño: tirada de salvación de CON, CD = max(10, daño_recibido / 2). Fallo = pierde concentración
- Acciones físicas violentas, ser incapacitado o muerto también rompen la concentración

### 13.4 Niveles de hechizos y upcasting

- Los hechizos tienen niveles del 0 (trucos) al 9
- Los **trucos** no gastan ranuras y pueden lanzarse sin límite
- Los hechizos de nivel 1+ gastan una **ranura de hechizo** de nivel ≥ al nivel del hechizo
- Algunos hechizos tienen efectos mejorados al lanzarse con una ranura de nivel superior (upcasting)

### 13.5 Sistemas de hechizos por tipo de lanzador

| Sistema | Clases | Características |
|---------|--------|----------------|
| **Preparado** | Clérigo, Druida, Mago, Paladín | Preparan una lista cada descanso largo; pueden cambiarlos diariamente |
| **Conocido** | Bardo, Explorador, Hechicero, Brujo | Lista fija; solo cambian al subir de nivel |
| **Pact Magic** | Brujo | Pocas ranuras, nivel máximo, se recuperan en descanso corto |
| **Medio lanzador** | Paladín, Explorador | Tabla de ranuras reducida (empieza nivel 2, slots de nivel más bajo) |

---

## 14. Rasgos narrativos y alineamiento

### 14.1 Alineamiento

El alineamiento es una brújula moral de dos ejes:

**Eje moral:** Bueno — Neutral — Malvado
**Eje ético:** Legal — Neutral — Caótico

Combinaciones posibles (9 alineamientos):

| | Legal | Neutral | Caótico |
|---|-------|---------|---------|
| **Bueno** | Legal Bueno | Neutral Bueno | Caótico Bueno |
| **Neutral** | Legal Neutral | Neutral Verdadero | Caótico Neutral |
| **Malvado** | Legal Malvado | Neutral Malvado | Caótico Malvado |

> El alineamiento no tiene efectos mecánicos directos en 5e (salvo interacción con hechizos como *Detect Evil and Good* o restricciones de clase como el Paladín). Es principalmente un guía de rol.

### 14.2 Elementos narrativos del trasfondo

Cada personaje puede tener (opcional pero muy recomendado para el roleplay):

| Elemento | Descripción | Formato |
|----------|-------------|---------|
| **Rasgo de personalidad** | Algo memorable de la manera de ser del personaje | Frase corta |
| **Ideal** | El principio que guía al personaje; suele ligarse al alineamiento | Frase corta |
| **Vínculo** | La persona, lugar u objetivo más importante para el personaje | Frase corta |
| **Defecto** | Una debilidad, vicio o tendencia negativa | Frase corta |

### 14.3 Otros datos narrativos

| Campo | Descripción |
|-------|-------------|
| Nombre | Libre; muchas razas tienen nombres típicos (sugeridos en el PHB) |
| Edad | Varía por raza; los elfos pueden tener siglos, los halflings unas décadas |
| Altura y peso | Tablas en el PHB con tiradas de dados para variación aleatoria |
| Apariencia | Ojos, pelo, piel, marcas, etc. |
| Historia personal | El DM puede pedir un párrafo de historia previa |
| Dioses / Fe | Relevante para Clérigos, Paladines, Druidas |

---

## 15. Flujo de creación paso a paso

Este es el flujo que debe implementar la app, en orden estricto. Algunos pasos dependen de pasos anteriores.

```
PASO 1 — CONCEPTO (opcional pero útil primero)
  ├── Nombre del personaje
  ├── Raza tentativa
  └── Clase tentativa

PASO 2 — RAZA
  ├── Seleccionar raza principal
  ├── Seleccionar subraza (si aplica)
  └── → Bloquea: velocidad, visión, idiomas base, rasgos raciales, bonificadores de característica

PASO 3 — CLASE
  ├── Seleccionar clase
  └── → Bloquea: dado de golpe, competencias de armadura/arma/herramientas, tiradas de salvación

PASO 4 — TRASFONDO
  ├── Seleccionar trasfondo
  ├── Resolver conflictos de competencias con clase (ver sección 11)
  └── → Bloquea: 2 competencias de habilidad, extras, equipo de trasfondo

PASO 5 — PUNTUACIONES DE CARACTERÍSTICA
  ├── Elegir método (Tirada / Point Buy / Estándar)
  ├── Generar / asignar valores base
  ├── Aplicar bonificadores de raza
  └── Calcular todos los modificadores (floor((score - 10) / 2))

PASO 6 — ELECCIONES DE CLASE NIVEL 1
  ├── Competencias en habilidades (número según clase)
  ├── Estilo de combate (si aplica: Guerrero, Paladín, Explorador)
  ├── Origen/Dominio/Subclase (si se elige en nivel 1: Clérigo, Hechicero, Brujo)
  ├── Trucos (si la clase lanza magia: número según clase)
  └── Hechizos conocidos nivel 1 (si aplica)

PASO 7 — PARÁMETROS CALCULADOS (automáticos)
  ├── BPC = +2 (siempre en nivel 1)
  ├── PG = dado_de_golpe_máximo + mod. CON
  ├── CA = según armadura equipada y clase
  ├── Iniciativa = mod. DES
  ├── Tiradas de salvación = mod. característica [+ BPC si competente]
  ├── Habilidades = mod. característica [+ BPC si competente] [+ BPC extra si pericia]
  ├── Bonificador de ataque = mod. FUE/DES + BPC
  ├── CD de hechizos = 8 + BPC + mod. característica_mágica (si aplica)
  └── Percepción pasiva = 10 + mod. SAB [+ BPC si competente en Perception]

PASO 8 — EQUIPO
  ├── Elegir entre: equipo de clase + trasfondo, O tirar dado de oro y comprar
  └── → Afecta CA final (según armadura equipada)

PASO 9 — RASGOS NARRATIVOS
  ├── Alineamiento
  ├── Rasgo de personalidad, Ideal, Vínculo, Defecto
  └── Datos personales (nombre, apariencia, historia)

PASO 10 — REVISIÓN FINAL
  └── Verificar integridad: todos los campos obligatorios completos, sin conflictos
```

---

## 16. Modelo de datos sugerido

```typescript
// Puntuación de característica
interface AbilityScore {
  base: number;          // valor antes de bono racial (3–18)
  racialBonus: number;   // bono de raza
  total: number;         // base + racialBonus
  modifier: number;      // floor((total - 10) / 2)
}

// Competencia en habilidad/salvación
interface ProficiencyEntry {
  name: string;
  ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
  proficient: boolean;
  expertise: boolean;    // BPC × 2
  bonus: number;         // mod. característica + (BPC si proficient) + (BPC si expertise)
}

// Personaje nivel 1
interface Character {
  // Identidad
  name: string;
  race: string;
  subrace?: string;
  class: string;
  background: string;
  alignment: string;
  level: number;         // siempre 1 en creación

  // Características (las 6)
  abilities: {
    STR: AbilityScore;
    DEX: AbilityScore;
    CON: AbilityScore;
    INT: AbilityScore;
    WIS: AbilityScore;
    CHA: AbilityScore;
  };

  // Parámetros calculados
  proficiencyBonus: number;        // siempre 2 en nivel 1
  hitPoints: {
    maximum: number;               // DG_máx + mod. CON
    current: number;               // igual al máximo al inicio
    temporary: number;             // 0 al inicio
    hitDice: string;               // "d10", "d8", etc.
  };
  armorClass: number;              // calculado según equipo y clase
  initiative: number;              // mod. DES
  speed: number;                   // en pies, de la raza

  // Competencias
  savingThrows: ProficiencyEntry[];     // las 6 salvaciones
  skills: ProficiencyEntry[];           // las 18 habilidades
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  languages: string[];

  // Magia (null si no lanza hechizos)
  spellcasting?: {
    ability: 'INT' | 'WIS' | 'CHA';
    spellAttackBonus: number;          // BPC + mod. característica
    spellSaveDC: number;               // 8 + BPC + mod. característica
    cantripsKnown: string[];
    spellsKnown?: string[];            // para lanzadores de hechizos conocidos
    spellsPrepared?: string[];         // para lanzadores preparados
    spellSlots: { [level: number]: { total: number; used: number } };
  };

  // Equipo
  equipment: EquipmentItem[];
  currency: { pp: number; gp: number; sp: number; cp: number };

  // Rasgos
  features: Feature[];               // rasgos de clase y raza nivel 1
  personalityTraits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];

  // Metadatos
  createdAt: Date;
  method: 'standard_array' | 'point_buy' | 'roll';
}
```

---

## 17. Validaciones y reglas de integridad

La app debe impedir estados inválidos. Reglas críticas de validación:

### Reglas absolutas (nunca deben violar)

1. Ninguna puntuación de característica puede ser < 1 o > 30
2. En Point Buy: ninguna puntuación base puede ser < 8 ni > 15; la suma de costos no puede superar 27
3. En Standard Array: los valores deben ser exactamente {8, 10, 12, 13, 14, 15}, uno por característica
4. Los modificadores SIEMPRE se recalculan al cambiar cualquier puntuación
5. Los PG del nivel 1 SIEMPRE usan el máximo del dado de golpe (no se tira)
6. El BPC en nivel 1 es siempre +2, sin excepción
7. Un personaje no puede tener competencia doble en la misma habilidad (solo pericia cuenta como BPC×2)
8. Un Druida no puede vestir armadura o escudos metálicos
9. Un personaje no puede beneficiarse del rasgo de Defensa sin armadura del Bárbaro O del Monje si viste cualquier tipo de armadura
10. La CA sin armadura del Monje (SAB) requiere ausencia de armadura Y ausencia de escudo

### Reglas de competencias (resolución de conflictos)

```
Si raza, clase Y trasfondo otorgan la misma competencia de habilidad:
  → El personaje elige otra habilidad de la lista disponible de la clase
  
Si clase y trasfondo otorgan la misma competencia:
  → Igual: el personaje elige otra de la lista de clase
  
Si dos fuentes otorgan pericia en la misma habilidad:
  → Solo aplica una vez (no se puede tener BPC×3 ni BPC×4)
```

### Restricciones de equipo

```
Si el personaje NO tiene competencia en un tipo de armadura:
  → Puede vestirla, pero tiene desventaja en tiradas de Atletismo y Sigilo
  → No puede lanzar hechizos mientras la viste

Si el personaje NO tiene competencia en un arma:
  → Puede usarla, pero NO añade el BPC a la tirada de ataque

Requisito de FUE para armaduras pesadas:
  → Si FUE < FUE_mínima: velocidad reducida 10 ft
```

### Restricciones de magia

```
Si la clase no tiene magia (Bárbaro, Guerrero base, Monje base):
  → No hay campo de lanzamiento de hechizos
  → No hay trucos ni ranuras

Si se lanza un hechizo como acción bonus:
  → Solo se puede lanzar un truco (no hechizo de nivel) como acción en ese turno

Máximo 1 hechizo de concentración activo simultáneamente
```

---

*Documento generado para implementación técnica. Fuente: Player's Handbook D&D 5e (2014) + Tasha's Cauldron of Everything (2020) para subclases adicionales. Las reglas de terceros (UA, homebrew) no están incluidas.*
