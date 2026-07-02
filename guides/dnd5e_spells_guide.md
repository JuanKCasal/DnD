# Guía Definitiva: Hechizos y Magia en D&D 5e
## Documento de especificación para implementación en app

> **Propósito:** Este documento describe con precisión técnica el sistema completo de conjuración de D&D 5e: mecánicas de lanzamiento, ranuras, componentes, concentración, listas por clase, escuelas de magia y una base de datos de hechizos representativa. Complementa las Guías de Creación de Personaje y de Equipamiento. Está escrito para que Claude Code implemente un sistema de gestión de hechizos, grimorio, preparación y lanzamiento completo y sin ambigüedades.

---

## Índice

1. [Arquitectura del sistema de magia](#1-arquitectura-del-sistema-de-magia)
2. [Los cuatro sistemas de conjuración](#2-los-cuatro-sistemas-de-conjuración)
3. [Ranuras de hechizo (Spell Slots)](#3-ranuras-de-hechizo-spell-slots)
4. [Trucos (Cantrips)](#4-trucos-cantrips)
5. [Anatomía de un hechizo](#5-anatomía-de-un-hechizo)
6. [Componentes de conjuración](#6-componentes-de-conjuración)
7. [Concentración](#7-concentración)
8. [Rituales](#8-rituales)
9. [Lanzamiento a nivel superior (Upcasting)](#9-lanzamiento-a-nivel-superior-upcasting)
10. [Parámetros de conjuración calculados](#10-parámetros-de-conjuración-calculados)
11. [Las ocho escuelas de magia](#11-las-ocho-escuelas-de-magia)
12. [Preparación vs. hechizos conocidos](#12-preparación-vs-hechizos-conocidos)
13. [Focos de conjuración](#13-focos-de-conjuración)
14. [Progresión por clase](#14-progresión-por-clase)
15. [Base de datos de hechizos representativa](#15-base-de-datos-de-hechizos-representativa)
16. [Modelo de datos sugerido](#16-modelo-de-datos-sugerido)
17. [Validaciones y reglas de integridad](#17-validaciones-y-reglas-de-integridad)

---

## 1. Arquitectura del sistema de magia

### Conceptos fundamentales

La magia en D&D 5e se organiza en tres capas:

| Capa | Elemento | Descripción |
|------|----------|-------------|
| **Recursos** | Ranuras de hechizo, puntos de hechicería, cargas | Lo que se gasta al lanzar |
| **Repertorio** | Hechizos conocidos / preparados, trucos | Lo que el personaje puede lanzar |
| **Ejecución** | Componentes, concentración, tiempo de lanzamiento | Cómo se lanza en la práctica |

### Los cuatro pilares de la conjuración

```
1. ¿El personaje PUEDE lanzar hechizos?
   → determinado por CLASE (y ciertas razas/dotes/subclases)

2. ¿QUÉ hechizos conoce/prepara?
   → determinado por el sistema de la clase (conocido vs. preparado)

3. ¿CON QUÉ recursos los lanza?
   → ranuras de hechizo (o Pact Magic, o puntos de hechicería)

4. ¿CÓMO se resuelve el hechizo?
   → componentes + tiempo + concentración + salvación/ataque
```

### Característica mágica por clase (Spellcasting Ability)

Cada clase lanzadora usa **una** característica para su magia. Esto determina la CD de salvación, el bonus de ataque de hechizo y (en algunos casos) cuántos hechizos se pueden preparar.

| Clase | Característica mágica | Sistema |
|-------|---------------------|---------|
| Mago (Wizard) | INT | Preparado (grimorio) |
| Clérigo (Cleric) | SAB | Preparado |
| Druida (Druid) | SAB | Preparado |
| Paladín (Paladin) | CAR | Preparado (medio lanzador) |
| Explorador (Ranger) | SAB | Conocido (medio lanzador) |
| Bardo (Bard) | CAR | Conocido |
| Hechicero (Sorcerer) | CAR | Conocido |
| Brujo (Warlock) | CAR | Conocido (Pact Magic) |
| Guerrero — Eldritch Knight | INT | Conocido (1/3 lanzador) |
| Pícaro — Arcane Trickster | INT | Conocido (1/3 lanzador) |

---

## 2. Los cuatro sistemas de conjuración

D&D 5e tiene cuatro sistemas mecánicamente distintos. La app debe modelar cada uno por separado.

### 2.1 Lanzador completo (Full Caster)

- **Clases:** Bardo, Clérigo, Druida, Hechicero, Mago
- **Progresión:** Acceden a hechizos de nivel 9 en el nivel 17 del personaje
- **Ranuras:** Tabla estándar de lanzador completo (ver sección 3)
- **Recuperación:** Descanso largo

### 2.2 Medio lanzador (Half Caster)

- **Clases:** Paladín, Explorador
- **Progresión:** Empiezan a lanzar en el nivel 2 del personaje; acceden a hechizos hasta nivel 5 (en el nivel 17)
- **Ranuras:** Tabla reducida (aproximadamente la mitad)
- **Recuperación:** Descanso largo

### 2.3 Tercio de lanzador (Third Caster)

- **Clases:** Eldritch Knight (subclase de Guerrero), Arcane Trickster (subclase de Pícaro)
- **Progresión:** Empiezan a lanzar en el nivel 3 de la subclase; acceden a hechizos hasta nivel 4
- **Ranuras:** Tabla muy reducida
- **Recuperación:** Descanso largo

### 2.4 Pact Magic (Brujo)

Sistema único con reglas propias:

- **Clase:** Brujo (Warlock)
- **Pocas ranuras:** 1 en nivel 1, hasta 4 en niveles altos
- **Todas las ranuras del mismo nivel:** siempre del nivel máximo disponible (nivel 1 → slots N1, nivel 3 → slots N2, etc.)
- **Recuperación en descanso corto** (no largo): es la gran diferencia — un Brujo recupera sus ranuras mucho más frecuentemente
- **Nivel máximo de ranura:** 5 (para hechizos de nivel 6+ usa Mystic Arcanum, 1 uso por descanso largo)

> **Nota de implementación crítica:** El Brujo NO comparte la tabla de ranuras estándar. Necesita su propia lógica de progresión y de recuperación (descanso corto vs. largo). Un multiclase de Brujo + otro lanzador mantiene los dos pools de ranuras separados.

---

## 3. Ranuras de hechizo (Spell Slots)

Las ranuras de hechizo son el recurso principal para lanzar hechizos de nivel 1+.

### Reglas fundamentales

1. Un hechizo de nivel N requiere una ranura de nivel ≥ N
2. Al lanzar, la ranura se **gasta** (no importa el nivel del hechizo, solo que la ranura sea ≥)
3. Lanzar un hechizo de nivel bajo con una ranura de nivel alto puede **potenciarlo** (upcasting, sección 9)
4. Los trucos NO usan ranuras
5. Las ranuras se recuperan en descanso largo (excepto Pact Magic del Brujo: descanso corto)

### 3.1 Tabla de lanzador completo (Bardo, Clérigo, Druida, Hechicero, Mago)

| Nivel PJ | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|----------|---|---|---|---|---|---|---|---|---|
| 1 | 2 | — | — | — | — | — | — | — | — |
| 2 | 3 | — | — | — | — | — | — | — | — |
| 3 | 4 | 2 | — | — | — | — | — | — | — |
| 4 | 4 | 3 | — | — | — | — | — | — | — |
| 5 | 4 | 3 | 2 | — | — | — | — | — | — |
| 6 | 4 | 3 | 3 | — | — | — | — | — | — |
| 7 | 4 | 3 | 3 | 1 | — | — | — | — | — |
| 8 | 4 | 3 | 3 | 2 | — | — | — | — | — |
| 9 | 4 | 3 | 3 | 3 | 1 | — | — | — | — |
| 10 | 4 | 3 | 3 | 3 | 2 | — | — | — | — |
| 11 | 4 | 3 | 3 | 3 | 2 | 1 | — | — | — |
| 12 | 4 | 3 | 3 | 3 | 2 | 1 | — | — | — |
| 13 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | — | — |
| 14 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | — | — |
| 15 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | — |
| 16 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | — |
| 17 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | 1 |
| 18 | 4 | 3 | 3 | 3 | 3 | 1 | 1 | 1 | 1 |
| 19 | 4 | 3 | 3 | 3 | 3 | 2 | 1 | 1 | 1 |
| 20 | 4 | 3 | 3 | 3 | 3 | 2 | 2 | 1 | 1 |

### 3.2 Tabla de medio lanzador (Paladín, Explorador)

Empieza en nivel 2 del personaje. Máximo hechizos de nivel 5.

| Nivel PJ | 1 | 2 | 3 | 4 | 5 |
|----------|---|---|---|---|---|
| 1 | — | — | — | — | — |
| 2 | 2 | — | — | — | — |
| 3 | 3 | — | — | — | — |
| 4 | 3 | — | — | — | — |
| 5 | 4 | 2 | — | — | — |
| 6 | 4 | 2 | — | — | — |
| 7 | 4 | 3 | — | — | — |
| 8 | 4 | 3 | — | — | — |
| 9 | 4 | 3 | 2 | — | — |
| 10 | 4 | 3 | 2 | — | — |
| 11 | 4 | 3 | 3 | — | — |
| 12 | 4 | 3 | 3 | — | — |
| 13 | 4 | 3 | 3 | 1 | — |
| 14 | 4 | 3 | 3 | 1 | — |
| 15 | 4 | 3 | 3 | 2 | — |
| 16 | 4 | 3 | 3 | 2 | — |
| 17 | 4 | 3 | 3 | 3 | 1 |
| 18 | 4 | 3 | 3 | 3 | 1 |
| 19 | 4 | 3 | 3 | 3 | 2 |
| 20 | 4 | 3 | 3 | 3 | 2 |

### 3.3 Tabla de tercio de lanzador (Eldritch Knight, Arcane Trickster)

Empieza en nivel 3 del personaje. Máximo hechizos de nivel 4.

| Nivel PJ | 1 | 2 | 3 | 4 |
|----------|---|---|---|---|
| 3 | 2 | — | — | — |
| 4 | 3 | — | — | — |
| 5–6 | 3 | — | — | — |
| 7 | 4 | 2 | — | — |
| 8–9 | 4 | 2 | — | — |
| 10 | 4 | 3 | — | — |
| 11–12 | 4 | 3 | — | — |
| 13 | 4 | 3 | 2 | — |
| 14–15 | 4 | 3 | 2 | — |
| 16 | 4 | 3 | 3 | — |
| 17–18 | 4 | 3 | 3 | — |
| 19 | 4 | 3 | 3 | 1 |
| 20 | 4 | 3 | 3 | 1 |

### 3.4 Tabla de Pact Magic (Brujo)

Todas las ranuras son del mismo nivel (el máximo). Se recuperan en **descanso corto**.

| Nivel PJ | Nº ranuras | Nivel de ranura | Mystic Arcanum |
|----------|-----------|----------------|----------------|
| 1 | 1 | 1 | — |
| 2 | 2 | 1 | — |
| 3 | 2 | 2 | — |
| 4 | 2 | 2 | — |
| 5 | 2 | 3 | — |
| 6 | 2 | 3 | — |
| 7 | 2 | 4 | — |
| 8 | 2 | 4 | — |
| 9 | 2 | 5 | — |
| 10 | 2 | 5 | — |
| 11 | 3 | 5 | N6 (1/descanso largo) |
| 12 | 3 | 5 | N6 |
| 13 | 3 | 5 | N6, N7 |
| 14 | 3 | 5 | N6, N7 |
| 15 | 3 | 5 | N6, N7, N8 |
| 16 | 3 | 5 | N6, N7, N8 |
| 17 | 4 | 5 | N6, N7, N8, N9 |
| 18 | 4 | 5 | N6, N7, N8, N9 |
| 19 | 4 | 5 | N6, N7, N8, N9 |
| 20 | 4 | 5 | N6, N7, N8, N9 |

---

## 4. Trucos (Cantrips)

Los trucos son hechizos de **nivel 0**. Reglas especiales:

1. **No consumen ranuras** — se pueden lanzar ilimitadamente
2. **Siempre disponibles** — no requieren preparación
3. **Escalan con el nivel del personaje** (no con la ranura), en estos umbrales:
   - Nivel 1–4: efecto base
   - Nivel 5–10: mejora (ej: +1 dado de daño)
   - Nivel 11–16: mejora adicional
   - Nivel 17–20: mejora final

### Escalado de daño de trucos de ataque

La mayoría de trucos de daño (Fire Bolt, Eldritch Blast, Sacred Flame, etc.) escalan así:

| Nivel del personaje | Dados de daño |
|---------------------|---------------|
| 1–4 | 1 dado |
| 5–10 | 2 dados |
| 11–16 | 3 dados |
| 17–20 | 4 dados |

> **Nota:** El escalado depende del NIVEL DEL PERSONAJE, no del nivel en la clase lanzadora ni de la ranura usada. Un Mago nivel 5 lanza Fire Bolt haciendo 2d10.

### Número de trucos conocidos

Cada clase lanzadora conoce una cantidad de trucos que crece con el nivel. Ver la tabla específica de cada clase en la sección 14.

---

## 5. Anatomía de un hechizo

Cada hechizo tiene una ficha estructurada con estos campos:

| Campo | Ejemplo | Descripción |
|-------|---------|-------------|
| **Nombre** | Fireball | Identificador del hechizo |
| **Nivel** | 3 | 0 (truco) a 9 |
| **Escuela** | Evocación | Una de las 8 escuelas |
| **Tiempo de lanzamiento** | 1 acción | Acción / acción bonus / reacción / minutos / horas |
| **Alcance** | 150 ft | Toque, personal, distancia en pies, o "Vista" |
| **Componentes** | V, S, M (una bolita de guano de murciélago y azufre) | Verbal, Somático, Material |
| **Duración** | Instantáneo | Instantáneo / concentración hasta X / X minutos u horas |
| **Concentración** | No | Si requiere mantener concentración |
| **Ritual** | No | Si puede lanzarse como ritual |
| **Descripción** | "Un rayo brillante..." | Efecto mecánico |
| **A niveles superiores** | +1d6 por nivel sobre el 3 | Efecto de upcasting |
| **Clases** | Hechicero, Mago | Qué clases lo tienen en su lista |

### Tiempos de lanzamiento posibles

| Tiempo | Uso |
|--------|-----|
| 1 acción | El más común; se lanza en el turno |
| 1 acción bonus | Hechizos rápidos (ej: Healing Word, Misty Step) |
| 1 reacción | En respuesta a un desencadenante (ej: Shield, Counterspell, Feather Fall) |
| 1 minuto | Fuera de combate normalmente |
| 10 minutos / 1 hora / 8 horas / 12 horas / 24 horas | Rituales y hechizos largos |

### Tipos de alcance

| Alcance | Significado |
|---------|-------------|
| Personal (Self) | Solo afecta al lanzador |
| Toque (Touch) | Debe tocar el objetivo |
| Distancia (ej. 30 ft, 60 ft, 120 ft) | Objetivo a esa distancia máxima |
| Vista (Sight) | Cualquier objetivo que el lanzador pueda ver |
| Ilimitado / Especial | Casos únicos (ej: Sending, Scrying) |

### Tipos de duración

| Duración | Significado |
|----------|-------------|
| Instantáneo | El efecto ocurre y termina inmediatamente |
| Concentración, hasta X | Requiere concentración; máximo X tiempo |
| X minutos / horas (sin concentración) | Dura ese tiempo automáticamente |
| Hasta ser disipado | Permanente hasta Dispel Magic o condición específica |

---

## 6. Componentes de conjuración

Todo hechizo requiere uno o más de estos tres componentes:

### V — Verbal

- El lanzador debe pronunciar palabras de poder en voz alta
- **Bloqueado por:** estar amordazado, en un área de *Silence*, o incapaz de hablar

### S — Somático

- El lanzador debe hacer gestos precisos con las manos
- **Requiere:** al menos una mano libre
- **Nota:** si el hechizo también tiene componente material, la mano que sostiene el foco/componente puede realizar los gestos somáticos

### M — Material

- Requiere un componente físico específico
- **Sustitución:** si el componente NO tiene un coste en oro especificado, puede reemplazarse por:
  - Una **bolsa de componentes** (component pouch), o
  - Un **foco de conjuración** (arcane focus, símbolo sagrado, foco druídico)
- **Excepción:** si el componente tiene un coste en oro (ej: "un diamante de 300 po") o se consume, debe tenerse físicamente y no puede sustituirse

### Tabla de resolución de componentes

| Componentes del hechizo | ¿Necesita foco/bolsa? | ¿Necesita mano libre? |
|-------------------------|----------------------|----------------------|
| Solo V | No | No |
| Solo S | No | Sí (1 mano) |
| Solo M (sin coste) | Foco o bolsa | La que sostiene el foco |
| V, S | No | Sí (1 mano) |
| V, M (sin coste) | Foco o bolsa | No (foco cuenta) |
| S, M (sin coste) | Foco o bolsa | Sí (la del foco sirve para S) |
| V, S, M (sin coste) | Foco o bolsa | 1 mano (la del foco) |
| M con coste en oro | Componente físico exacto | La que sostiene el componente |

> **Nota de implementación:** Los componentes materiales con coste en oro (ej: Revivify requiere diamantes de 300 po, Resurrection requiere 1.000 po) deben modelarse como consumibles que se descuentan del inventario al lanzar el hechizo.

---

## 7. Concentración

Muchos hechizos requieren **Concentración** para mantener su efecto activo.

### Reglas de concentración

1. **Solo un hechizo de concentración a la vez.** Lanzar un segundo hechizo de concentración termina automáticamente el primero.
2. **Recibir daño:** hay que hacer una tirada de salvación de CONSTITUCIÓN. La CD es:
   ```
   CD = máximo(10, daño_recibido / 2 redondeado hacia abajo)
   ```
   Fallar la salvación termina la concentración.
3. **Múltiples fuentes de daño en un turno:** se hace una tirada de salvación por cada instancia de daño.
4. **Otras causas de pérdida de concentración:**
   - Quedar incapacitado o muerto
   - El DM puede pedir salvación en situaciones violentas (ser zarandeado, terremoto, etc.)
5. **La concentración NO se rompe por:** lanzar trucos que no requieran concentración, moverse, atacar (a menos que reciba daño), realizar acciones normales.

### Ejemplo de cálculo

```
Un mago concentrado en Haste recibe 18 de daño.
CD de la salvación = máximo(10, 18/2) = máximo(10, 9) = 10
El mago tira 1d20 + su bonus de salvación de CON. Si saca ≥ 10, mantiene Haste.

Un mago concentrado recibe 30 de daño.
CD = máximo(10, 15) = 15. Salvación más difícil.
```

> **Nota de implementación:** El sistema debe rastrear qué hechizo de concentración está activo (máximo 1), su duración restante, y disparar la tirada de salvación de CON automáticamente cuando el personaje reciba daño.

---

## 8. Rituales

Algunos hechizos tienen la etiqueta **(Ritual)**. Pueden lanzarse de dos formas:

| Método | Coste de ranura | Tiempo adicional |
|--------|----------------|-----------------|
| Normal | Gasta ranura | Tiempo de lanzamiento normal |
| Como ritual | **NO gasta ranura** | +10 minutos al tiempo de lanzamiento |

### Reglas de ritual por clase

- **Bardo, Clérigo, Druida, Mago:** pueden lanzar como ritual cualquier hechizo de ritual que tengan preparado o (para el Mago) en su grimorio
- **Mago:** caso especial — puede lanzar como ritual cualquier hechizo de ritual **en su grimorio**, aunque no esté preparado
- **Hechicero, Paladín, Explorador, Brujo:** NO pueden lanzar rituales de forma nativa (salvo dotes/rasgos específicos como el Ritual Caster feat o el Pact of the Tome)

### Ejemplos de hechizos de ritual comunes

`Detect Magic`, `Identify`, `Comprehend Languages`, `Find Familiar`, `Water Breathing`, `Water Walk`, `Alarm`, `Augury`, `Divination`, `Commune`, `Speak with Animals`, `Silence`, `Tiny Hut`.

---

## 9. Lanzamiento a nivel superior (Upcasting)

Lanzar un hechizo usando una ranura de nivel superior al mínimo requerido puede potenciarlo.

### Reglas

1. Solo funciona si el hechizo tiene la sección **"A niveles superiores"** (At Higher Levels)
2. El efecto extra depende de la diferencia entre el nivel de la ranura y el nivel base del hechizo
3. Los trucos NO se potencian con ranuras (escalan con nivel del personaje, sección 4)

### Patrones comunes de upcasting

| Patrón | Ejemplo |
|--------|---------|
| +1 dado de daño por nivel | Fireball: +1d6 por cada nivel sobre 3 |
| +1 objetivo por nivel | Magic Missile: +1 dardo por nivel sobre 1 |
| +duración | Ninguno común, pero existe |
| +PG curados | Cure Wounds: +1d8 por nivel sobre 1 |
| Efecto cualitativo | Ejemplo: algunos hechizos afectan criaturas de mayor CR |

### Ejemplo

```
Fireball es un hechizo de nivel 3 (8d6 de daño base).
Lanzado con una ranura de nivel 5:
  daño = 8d6 + 2d6 (por 2 niveles sobre el 3) = 10d6

Magic Missile es de nivel 1 (3 dardos base).
Lanzado con una ranura de nivel 3:
  dardos = 3 + 2 = 5 dardos
```

---

## 10. Parámetros de conjuración calculados

### 10.1 CD de salvación de hechizos (Spell Save DC)

Es la dificultad que los enemigos deben superar para resistir los hechizos del lanzador.

```
CD de hechizo = 8 + Bonificador de Competencia + modificador de característica mágica
```

Ejemplo: Mago nivel 1 (BPC +2) con INT 16 (+3): CD = 8 + 2 + 3 = 13

### 10.2 Bonificador de ataque de hechizo (Spell Attack Bonus)

Se usa cuando el hechizo requiere una tirada de ataque (ej: Fire Bolt, Ray of Frost, Eldritch Blast).

```
Bonus de ataque de hechizo = Bonificador de Competencia + modificador de característica mágica
```

Ejemplo: mismo mago: +2 + 3 = +5

### 10.3 Tabla de característica mágica por clase

| Clase | Característica | CD y ataque usan |
|-------|---------------|-----------------|
| Mago, Eldritch Knight, Arcane Trickster | INT | 8/+BPC/+mod. INT |
| Clérigo, Druida, Explorador | SAB | 8/+BPC/+mod. SAB |
| Bardo, Hechicero, Brujo, Paladín | CAR | 8/+BPC/+mod. CAR |

### 10.4 Resolución de un hechizo (flujo)

```
El hechizo requiere TIRADA DE SALVACIÓN:
  → El objetivo tira 1d20 + su bonus de salvación de la característica indicada
  → Compara con la CD de hechizo del lanzador
  → Éxito / fallo determina efecto (muchos hechizos: mitad de daño si tiene éxito)

El hechizo requiere TIRADA DE ATAQUE:
  → El lanzador tira 1d20 + bonus de ataque de hechizo
  → Compara con la CA del objetivo
  → Impacto: aplica daño/efecto; crítico (nat 20): dobla dados de daño

El hechizo NO requiere tirada (efecto automático):
  → El efecto se aplica directamente (ej: Magic Missile siempre impacta,
     Cure Wounds siempre cura, Bless siempre beneficia)
```

---

## 11. Las ocho escuelas de magia

Todo hechizo pertenece a una de las 8 escuelas. Las escuelas importan mecánicamente porque ciertas subclases (ej: escuelas de Mago) otorgan beneficios a hechizos de una escuela específica.

| Escuela | Nombre inglés | Temática | Ejemplos |
|---------|--------------|----------|----------|
| Abjuración | Abjuration | Protección, barreras, disipación | Shield, Counterspell, Dispel Magic, Protection from Evil |
| Conjuración | Conjuration | Invocar criaturas y objetos, teletransporte | Find Familiar, Misty Step, Conjure Animals, Teleport |
| Adivinación | Divination | Información, videncia, detección | Detect Magic, Identify, Scrying, Divination, True Seeing |
| Encantamiento | Enchantment | Controlar mentes, influir | Charm Person, Sleep, Hold Person, Suggestion, Dominate |
| Evocación | Evocation | Energía, daño elemental | Fireball, Magic Missile, Lightning Bolt, Cone of Cold |
| Ilusión | Illusion | Engaño sensorial | Minor Illusion, Invisibility, Mirror Image, Phantasmal Force |
| Nigromancia | Necromancy | Vida, muerte, no-muertos | Chill Touch, Animate Dead, Vampiric Touch, Revivify |
| Transmutación | Transmutation | Cambiar propiedades | Polymorph, Haste, Fly, Enlarge/Reduce, Stoneskin |

---

## 12. Preparación vs. hechizos conocidos

La distinción más importante para la UI de la app. Hay dos modelos fundamentales:

### 12.1 Modelo "Preparado" (Prepared Casters)

**Clases:** Clérigo, Druida, Paladín, Mago

- El personaje tiene acceso a **toda la lista de hechizos de su clase** (el Mago está limitado a los de su grimorio)
- Cada día (tras un descanso largo) elige qué hechizos "preparar"
- **Número de hechizos preparados:**
  ```
  Clérigo, Druida, Mago:  mod. característica + nivel de clase   (mínimo 1)
  Paladín:                mod. CAR + (nivel de paladín / 2)      (mínimo 1)
  ```
- Los trucos NO cuentan para este límite y no se preparan (siempre disponibles)
- Puede cambiar los hechizos preparados en cada descanso largo

**Caso especial del Mago (Grimorio / Spellbook):**
- Empieza con 6 hechizos de nivel 1 en su grimorio
- Al subir de nivel, añade 2 hechizos nuevos al grimorio
- Puede copiar hechizos de pergaminos y otros grimorios: coste 50 po + 2 horas por nivel del hechizo
- Solo puede **preparar** hechizos que estén en su grimorio
- Puede lanzar como ritual cualquier hechizo de ritual del grimorio, aunque no esté preparado

### 12.2 Modelo "Conocido" (Known Casters)

**Clases:** Bardo, Hechicero, Brujo, Explorador

- El personaje conoce una lista **fija** de hechizos
- No prepara: todos sus hechizos conocidos están siempre disponibles
- El número de hechizos conocidos crece con el nivel (según tabla de clase)
- Al subir de nivel puede **reemplazar** 1 hechizo conocido por otro
- No tiene acceso al resto de la lista de clase — solo a lo que conoce

### 12.3 Tabla comparativa

| Aspecto | Preparado | Conocido |
|---------|-----------|----------|
| Acceso a la lista de clase | Total (Mago: grimorio) | Solo hechizos conocidos |
| Flexibilidad diaria | Alta (cambia cada día) | Nula (lista fija) |
| Cambio de repertorio | Cada descanso largo | Solo al subir de nivel |
| Clases | Clérigo, Druida, Paladín, Mago | Bardo, Hechicero, Brujo, Explorador |

> **Nota de implementación:** La UI debe ser distinta según el modelo. Un lanzador preparado necesita una pantalla de "gestión de preparación diaria" que se resetea en descanso largo. Un lanzador conocido solo necesita mostrar su lista fija y permitir reemplazo al subir de nivel.

---

## 13. Focos de conjuración

Un foco reemplaza los componentes materiales sin coste. Cada tipo de lanzador usa un foco distinto.

| Foco | Clases que lo usan | Ejemplos |
|------|-------------------|----------|
| **Arcane Focus** (foco arcano) | Mago, Hechicero, Brujo | Orbe, cristal, vara, cetro, bastón, varita |
| **Holy Symbol** (símbolo sagrado) | Clérigo, Paladín | Amuleto, emblema, reliquia (puede ir en escudo) |
| **Druidic Focus** (foco druídico) | Druida, Explorador | Rama de muérdago, tótem, vara de tejo, bastón |
| **Component Pouch** (bolsa de componentes) | Cualquiera | Bolsa con componentes variados |
| **Instrumento musical** | Bardo | El bardo usa un instrumento como foco |

### Precios de focos

| Foco | Precio | Peso |
|------|--------|------|
| Crystal (Cristal) | 10 po | 1 lb |
| Orb (Orbe) | 20 po | 3 lb |
| Rod (Vara) | 10 po | 2 lb |
| Staff (Bastón) | 5 po | 4 lb | (también arma: bastón) |
| Wand (Varita) | 10 po | 1 lb |
| Sprig of mistletoe (Muérdago) | 1 po | — |
| Wooden staff (Bastón de madera) | 5 po | 4 lb |
| Yew wand (Vara de tejo) | 10 po | 1 lb |
| Totem | 1 po | — |
| Holy symbol - Amulet | 5 po | 1 lb |
| Holy symbol - Emblem | 5 po | — |
| Holy symbol - Reliquary | 5 po | 2 lb |
| Component pouch | 25 po | 2 lb |

---

## 14. Progresión por clase

### 14.1 Mago (Wizard) — INT, Preparado + Grimorio

| Nivel | BPC | Trucos | Hechizos en grimorio | Preparados | Máx nivel hechizo |
|-------|-----|--------|---------------------|-----------|-------------------|
| 1 | +2 | 3 | 6 | INT + 1 | 1 |
| 2 | +2 | 3 | 8 | INT + 2 | 1 |
| 3 | +2 | 3 | 10 | INT + 3 | 2 |
| 4 | +2 | 4 | 12 | INT + 4 | 2 |
| 5 | +3 | 4 | 14 | INT + 5 | 3 |
| ... | ... | ... | +2 por nivel | INT + nivel | ... |
| 20 | +6 | 5 | 44 | INT + 20 | 9 |

### 14.2 Clérigo / Druida — SAB, Preparado

| Nivel | Trucos (Clérigo) | Trucos (Druida) | Preparados | Máx nivel |
|-------|-----------------|-----------------|-----------|-----------|
| 1 | 3 | 2 | SAB + 1 | 1 |
| 4 | 4 | 3 | SAB + 4 | 2 |
| 10 | 5 | 4 | SAB + 10 | 5 |
| 20 | 5 | 4 | SAB + 20 | 9 |

### 14.3 Bardo — CAR, Conocido

| Nivel | Trucos | Hechizos conocidos | Máx nivel |
|-------|--------|-------------------|-----------|
| 1 | 2 | 4 | 1 |
| 4 | 3 | 7 | 2 |
| 10 | 4 | 14 | 5 |
| 20 | 4 | 22 | 9 |

### 14.4 Hechicero — CAR, Conocido

| Nivel | Trucos | Hechizos conocidos | Puntos de hechicería | Máx nivel |
|-------|--------|-------------------|---------------------|-----------|
| 1 | 4 | 2 | — | 1 |
| 2 | 4 | 3 | 2 | 1 |
| 4 | 5 | 5 | 4 | 2 |
| 10 | 6 | 11 | 10 | 5 |
| 20 | 6 | 15 | 20 | 9 |

### 14.5 Brujo — CAR, Conocido (Pact Magic)

| Nivel | Trucos | Hechizos conocidos | Ranuras | Nivel ranura | Invocaciones |
|-------|--------|-------------------|---------|--------------|--------------|
| 1 | 2 | 2 | 1 | 1 | — |
| 2 | 2 | 3 | 2 | 1 | 2 |
| 5 | 3 | 6 | 2 | 3 | 3 |
| 10 | 4 | 10 | 2 | 5 | 5 |
| 20 | 4 | 15 | 4 | 5 | 8 |

### 14.6 Paladín — CAR, Preparado (medio lanzador)

| Nivel | Preparados | Máx nivel | Notas |
|-------|-----------|-----------|-------|
| 1 | — | — | No lanza aún |
| 2 | CAR + 1 | 1 | Empieza a lanzar |
| 5 | CAR + 2 | 2 | |
| 9 | CAR + 4 | 3 | |
| 17 | CAR + 8 | 5 | |

Sin trucos (los paladines no tienen trucos).

### 14.7 Explorador — SAB, Conocido (medio lanzador)

| Nivel | Hechizos conocidos | Máx nivel | Notas |
|-------|-------------------|-----------|-------|
| 1 | — | — | No lanza aún |
| 2 | 2 | 1 | Empieza a lanzar |
| 5 | 4 | 2 | |
| 9 | 6 | 3 | |
| 17 | 10 | 5 | |

Sin trucos (los exploradores clásicos no tienen trucos).

---

## 15. Base de datos de hechizos representativa

Esta es una selección representativa de los hechizos más usados, organizada por nivel. Para una app completa se recomienda cargar la lista completa (~450 hechizos del PHB) desde una fuente estructurada como la [SRD 5.1](https://dnd.wizards.com/resources/systems-reference-document) (Open Game License).

### 15.1 Trucos (Nivel 0)

| Hechizo | Escuela | Tiempo | Alcance | Efecto | Clases |
|---------|---------|--------|---------|--------|--------|
| Fire Bolt | Evocación | 1 acción | 120 ft | Ataque de hechizo; 1d10 fuego (escala) | Hechicero, Mago |
| Ray of Frost | Evocación | 1 acción | 60 ft | Ataque; 1d8 frío + velocidad -10 ft | Hechicero, Mago |
| Eldritch Blast | Evocación | 1 acción | 120 ft | Ataque; 1d10 fuerza; +1 rayo cada 5 niveles | Brujo |
| Sacred Flame | Evocación | 1 acción | 60 ft | Salvación DES; 1d8 radiante (sin cobertura) | Clérigo |
| Toll the Dead | Nigromancia | 1 acción | 60 ft | Salvación SAB; 1d8/1d12 necrótico | Clérigo, Mago, Brujo |
| Mage Hand | Conjuración | 1 acción | 30 ft | Mano espectral manipula objetos (10 lb) | Bardo, Hechicero, Mago, Brujo |
| Minor Illusion | Ilusión | 1 acción | 30 ft | Sonido o imagen ilusoria | Bardo, Hechicero, Mago, Brujo |
| Prestidigitation | Transmutación | 1 acción | 10 ft | Efectos menores de utilidad | Bardo, Hechicero, Mago, Brujo |
| Guidance | Adivinación | 1 acción | Toque | +1d4 a una tirada de habilidad (conc.) | Clérigo, Druida |
| Vicious Mockery | Encantamiento | 1 acción | 60 ft | Salvación SAB; 1d4 psíquico + desventaja ataque | Bardo |
| Druidcraft | Transmutación | 1 acción | 30 ft | Efectos naturales menores | Druida |
| Produce Flame | Conjuración | 1 acción | Personal/30ft | Llama en mano; ataque 1d8 fuego | Druida |
| Shillelagh | Transmutación | 1 acción bonus | Toque | Convierte bastón/garrote en arma mágica 1d8, usa SAB/CAR | Druida |
| Light | Evocación | 1 acción | Toque | Objeto emite luz brillante 20 ft | Bardo, Clérigo, Hechicero, Mago |
| Spare the Dying | Nigromancia | 1 acción | Toque | Estabiliza criatura a 0 PG | Clérigo |
| Thaumaturgy | Transmutación | 1 acción | 30 ft | Manifestación menor de poder divino | Clérigo |
| Mending | Transmutación | 1 minuto | Toque | Repara una rotura o rasgadura pequeña | Bardo, Clérigo, Druida, Hechicero, Mago |

### 15.2 Hechizos de nivel 1

| Hechizo | Escuela | Tiempo | Alcance | Conc. | Efecto | Upcast |
|---------|---------|--------|---------|-------|--------|--------|
| Magic Missile | Evocación | 1 acción | 120 ft | No | 3 dardos, 1d4+1 fuerza c/u (auto-impacto) | +1 dardo/nivel |
| Cure Wounds | Evocación | 1 acción | Toque | No | Cura 1d8 + mod. mágico | +1d8/nivel |
| Healing Word | Evocación | 1 acción bonus | 60 ft | No | Cura 1d4 + mod. mágico a distancia | +1d4/nivel |
| Shield | Abjuración | 1 reacción | Personal | No | +5 CA hasta próximo turno; bloquea Magic Missile | — |
| Burning Hands | Evocación | 1 acción | Cono 15 ft | No | Salvación DES; 3d6 fuego (mitad si pasa) | +1d6/nivel |
| Sleep | Encantamiento | 1 acción | 90 ft | No | 5d8 PG de criaturas duermen (menor PG primero) | +2d8/nivel |
| Charm Person | Encantamiento | 1 acción | 30 ft | No | Salvación SAB; objetivo encantado 1 hora | +1 objetivo/nivel |
| Detect Magic | Adivinación | 1 acción (ritual) | Personal | Sí | Percibe magia a 30 ft | — |
| Thunderwave | Evocación | 1 acción | Cubo 15 ft | No | Salvación CON; 2d8 trueno + empuje 10 ft | +1d8/nivel |
| Faerie Fire | Evocación | 1 acción | 60 ft | Sí | Salvación DES; objetos brillan, ventaja a atacarlos | — |
| Bless | Encantamiento | 1 acción | 30 ft | Sí | 3 criaturas +1d4 a ataques y salvaciones | +1 objetivo/nivel |
| Guiding Bolt | Evocación | 1 acción | 120 ft | No | Ataque; 4d6 radiante + ventaja siguiente ataque | +1d6/nivel |
| Hex | Encantamiento | 1 acción bonus | 90 ft | Sí | +1d6 necrótico en ataques al objetivo | — |
| Hunter's Mark | Adivinación | 1 acción bonus | 90 ft | Sí | +1d6 daño en ataques al objetivo | — |
| Feather Fall | Transmutación | 1 reacción | 60 ft | No | 5 criaturas caen lentamente (sin daño) | — |
| Mage Armor | Abjuración | 1 acción | Toque | No | CA = 13 + mod. DES (8 horas, sin armadura) | — |
| Detect Evil and Good | Adivinación | 1 acción | Personal | Sí | Detecta ciertos tipos de criatura a 30 ft | — |
| Identify | Adivinación | 1 min (ritual) | Toque | No | Conoce propiedades de objeto mágico | — |
| Find Familiar | Conjuración | 1 h (ritual) | 10 ft | No | Invoca un familiar espiritual | — |

### 15.3 Hechizos de nivel 2

| Hechizo | Escuela | Tiempo | Alcance | Conc. | Efecto | Upcast |
|---------|---------|--------|---------|-------|--------|--------|
| Misty Step | Conjuración | 1 acción bonus | Personal | No | Teletransporte 30 ft a punto visible | — |
| Scorching Ray | Evocación | 1 acción | 120 ft | No | 3 rayos, ataque c/u, 2d6 fuego | +1 rayo/nivel |
| Hold Person | Encantamiento | 1 acción | 60 ft | Sí | Salvación SAB; humanoide paralizado | +1 objetivo/nivel |
| Invisibility | Ilusión | 1 acción | Toque | Sí | Objetivo invisible hasta atacar/lanzar | +1 objetivo/nivel |
| Mirror Image | Ilusión | 1 acción | Personal | No | 3 duplicados que absorben ataques | — |
| Spiritual Weapon | Evocación | 1 acción bonus | 60 ft | No | Arma espectral; 1d8 + mod. mágico | +1d8 por 2 niveles |
| Web | Conjuración | 1 acción | 60 ft | Sí | Salvación DES; zona apresa (restrained) | — |
| Lesser Restoration | Abjuración | 1 acción | Toque | No | Cura enfermedad o condición (ciego, paralizado...) | — |
| Aid | Abjuración | 1 acción | 30 ft | No | +5 PG máx y actuales a 3 criaturas | +5 PG/nivel |
| Darkness | Evocación | 1 acción | 60 ft | Sí | Esfera de oscuridad mágica 15 ft | — |
| Moonbeam | Evocación | 1 acción | 120 ft | Sí | Salvación CON; 2d10 radiante en columna | +1d10/nivel |
| Hold Person | Encantamiento | 1 acción | 60 ft | Sí | Paraliza humanoide | +1 objetivo/nivel |
| Suggestion | Encantamiento | 1 acción | 30 ft | Sí | Salvación SAB; sugerencia razonable | — |
| See Invisibility | Adivinación | 1 acción | Personal | No | Ve criaturas y objetos invisibles | — |

### 15.4 Hechizos de nivel 3

| Hechizo | Escuela | Tiempo | Alcance | Conc. | Efecto | Upcast |
|---------|---------|--------|---------|-------|--------|--------|
| Fireball | Evocación | 1 acción | 150 ft | No | Salvación DES; 8d6 fuego, esfera 20 ft | +1d6/nivel |
| Lightning Bolt | Evocación | 1 acción | Línea 100 ft | No | Salvación DES; 8d6 rayo en línea | +1d6/nivel |
| Counterspell | Abjuración | 1 reacción | 60 ft | No | Interrumpe un hechizo (auto si ≤ nivel 3) | Sube el nivel automático |
| Dispel Magic | Abjuración | 1 acción | 120 ft | No | Termina efectos mágicos (auto si ≤ nivel 3) | Sube el nivel automático |
| Fly | Transmutación | 1 acción | Toque | Sí | Velocidad de vuelo 60 ft | +1 objetivo/nivel |
| Haste | Transmutación | 1 acción | 30 ft | Sí | +2 CA, doble velocidad, acción extra | — |
| Revivify | Nigromancia | 1 acción | Toque | No | Revive muerto (< 1 min); requiere diamante 300 po | — |
| Counterspell | Abjuración | 1 reacción | 60 ft | No | Cancela conjuración enemiga | — |
| Hypnotic Pattern | Ilusión | 1 acción | 120 ft | Sí | Salvación SAB; encanta (charmed/incapacitated) | — |
| Spirit Guardians | Conjuración | 1 acción | Personal (15ft) | Sí | Salvación SAB; 3d8 radiante/necrótico alrededor | +1d8/nivel |
| Mass Healing Word | Evocación | 1 acción bonus | 60 ft | No | Cura 1d4 + mod. a 6 criaturas | +1d4/nivel |
| Sleet Storm | Conjuración | 1 acción | 150 ft | Sí | Zona resbaladiza, oscurece, rompe concentración | — |
| Vampiric Touch | Nigromancia | 1 acción | Personal | Sí | Ataque; 3d6 necrótico, cura la mitad | +1d6/nivel |
| Animate Dead | Nigromancia | 1 minuto | 10 ft | No | Crea esqueleto o zombi bajo control | +1 no-muerto por 2 niveles |

### 15.5 Hechizos de nivel 4

| Hechizo | Escuela | Tiempo | Alcance | Conc. | Efecto | Upcast |
|---------|---------|--------|---------|-------|--------|--------|
| Polymorph | Transmutación | 1 acción | 60 ft | Sí | Salvación SAB; transforma en bestia (CR ≤ nivel) | — |
| Greater Invisibility | Ilusión | 1 acción | Toque | Sí | Invisible incluso al atacar/lanzar | — |
| Wall of Fire | Evocación | 1 acción | 120 ft | Sí | Muro de fuego; 5d8 fuego | +1d8/nivel |
| Dimension Door | Conjuración | 1 acción | 500 ft | No | Teletransporte largo (+ 1 criatura) | — |
| Banishment | Abjuración | 1 acción | 60 ft | Sí | Salvación CAR; destierra criatura | +1 objetivo/nivel |
| Ice Storm | Evocación | 1 acción | 300 ft | No | Salvación DES; 2d8 contundente + 4d6 frío | +1d8/nivel |
| Stoneskin | Abjuración | 1 acción | Toque | Sí | Resistencia a daño físico no mágico | — |
| Blight | Nigromancia | 1 acción | 30 ft | No | Salvación CON; 8d8 necrótico | +1d8/nivel |

### 15.6 Hechizos de nivel 5

| Hechizo | Escuela | Tiempo | Alcance | Conc. | Efecto | Upcast |
|---------|---------|--------|---------|-------|--------|--------|
| Cone of Cold | Evocación | 1 acción | Cono 60 ft | No | Salvación CON; 8d8 frío | +1d8/nivel |
| Wall of Force | Evocación | 1 acción | 120 ft | Sí | Muro invisible impenetrable | — |
| Hold Monster | Encantamiento | 1 acción | 90 ft | Sí | Salvación SAB; paraliza cualquier criatura | +1 objetivo/nivel |
| Mass Cure Wounds | Evocación | 1 acción | 60 ft | No | Cura 3d8 + mod. a 6 criaturas | +1d8/nivel |
| Raise Dead | Nigromancia | 1 hora | Toque | No | Revive muerto (< 10 días); diamante 500 po | — |
| Scrying | Adivinación | 10 minutos | Personal | Sí | Observa a distancia a una criatura | — |
| Telekinesis | Transmutación | 1 acción | 60 ft | Sí | Mueve criaturas/objetos con la mente | — |
| Contact Other Plane | Adivinación | 1 min (ritual) | Personal | No | Pregunta a entidad extraplanar | — |
| Geas | Encantamiento | 1 minuto | 60 ft | No | Orden mágica; daño si desobedece | — |

### 15.7 Hechizos de nivel 6–9 (selección)

| Hechizo | Nivel | Escuela | Efecto | Clases |
|---------|-------|---------|--------|--------|
| Chain Lightning | 6 | Evocación | 10d8 rayo a 1 objetivo + 3 saltos | Hechicero, Mago |
| Disintegrate | 6 | Transmutación | 10d6+40 fuerza; desintegra si llega a 0 PG | Hechicero, Mago |
| Heal | 6 | Evocación | Cura 70 PG + elimina condiciones | Clérigo, Druida |
| True Seeing | 6 | Adivinación | Ve invisibilidad, ilusiones, cambios de forma | Bardo, Clérigo, Hechicero, Mago, Brujo |
| Mass Suggestion | 6 | Encantamiento | Suggestion a 12 criaturas | Bardo, Hechicero, Mago, Brujo |
| Finger of Death | 7 | Nigromancia | 7d8+30 necrótico; crea zombi si mata | Hechicero, Mago, Brujo |
| Teleport | 7 | Conjuración | Viaje instantáneo a lugar conocido | Bardo, Hechicero, Mago |
| Plane Shift | 7 | Conjuración | Viaje entre planos de existencia | Clérigo, Druida, Hechicero, Mago, Brujo |
| Regenerate | 7 | Transmutación | Cura + regenera miembros perdidos | Bardo, Clérigo, Druida |
| Dominate Monster | 8 | Encantamiento | Control total de una criatura | Bardo, Hechicero, Mago, Brujo |
| Sunburst | 8 | Evocación | 12d6 radiante en 60 ft; ciega | Druida, Hechicero, Mago |
| Power Word Stun | 8 | Encantamiento | Aturde si el objetivo tiene ≤ 150 PG | Bardo, Hechicero, Mago, Brujo |
| Wish | 9 | Conjuración | El hechizo más poderoso; replica cualquier hechizo ≤8 o altera la realidad | Hechicero, Mago |
| Meteor Swarm | 9 | Evocación | 40d6 (fuego+contundente) en 4 zonas de 40 ft | Hechicero, Mago |
| Power Word Kill | 9 | Encantamiento | Mata al instante si el objetivo tiene ≤ 100 PG | Bardo, Hechicero, Mago, Brujo |
| True Resurrection | 9 | Nigromancia | Revive muerto hasta 200 años, sin necesitar cuerpo | Clérigo, Druida |
| Time Stop | 9 | Transmutación | 1d4+1 turnos extra para el lanzador | Hechicero, Mago |
| Mass Heal | 9 | Evocación | Cura hasta 700 PG repartidos | Clérigo |

---

## 16. Modelo de datos sugerido

```typescript
// ── Definición de hechizo (catálogo global) ─────────────────────────────
interface Spell {
  id: string;
  name: string;
  name_en: string;
  level: number;                     // 0 = truco, 1–9
  school: SpellSchool;
  casting_time: string;              // "1 action", "1 bonus action", "1 reaction", "10 minutes"
  casting_time_type: 'action' | 'bonus_action' | 'reaction' | 'minutes' | 'hours';
  range: string;                     // "60 feet", "Touch", "Self", "Sight"
  range_type: 'self' | 'touch' | 'ranged' | 'sight' | 'unlimited';
  range_feet?: number;               // valor numérico si aplica

  // Componentes
  components: {
    verbal: boolean;                 // V
    somatic: boolean;                // S
    material: boolean;               // M
    material_description?: string;   // "un diamante de 300 po"
    material_cost_gp?: number;       // coste en oro si aplica (para consumibles)
    material_consumed?: boolean;     // si el componente se consume al lanzar
  };

  duration: string;                  // "Instantaneous", "Concentration, up to 1 minute"
  concentration: boolean;
  ritual: boolean;

  description: string;               // efecto mecánico
  higher_levels?: string;            // texto de upcasting

  // Resolución
  requires_attack_roll: boolean;
  saving_throw?: AbilityKey;         // qué salvación exige, si alguna
  damage?: {
    dice: string;                    // "8d6"
    type: DamageType;
    scaling?: string;                // "+1d6 per slot level above 3rd"
  };

  classes: SpellcasterClass[];       // qué clases lo tienen en su lista
  source: string;                    // "PHB", "XGE", etc.
}

// ── Estado de conjuración del personaje ─────────────────────────────────
interface SpellcastingState {
  // Configuración de clase
  spellcasting_ability: AbilityKey;        // INT, WIS o CHA
  caster_type: 'full' | 'half' | 'third' | 'pact' | 'none';
  preparation_model: 'prepared' | 'known';

  // Parámetros calculados
  spell_save_dc: number;                   // 8 + BPC + mod. ability
  spell_attack_bonus: number;              // BPC + mod. ability

  // Ranuras de hechizo
  spell_slots: {
    [level: number]: {
      total: number;
      used: number;
    };
  };
  // Pact Magic (solo Brujo)
  pact_slots?: {
    total: number;
    used: number;
    slot_level: number;                    // nivel de todas las ranuras de pacto
  };
  mystic_arcanum?: { [level: number]: { used: boolean } };  // Brujo N6–N9

  // Repertorio
  cantrips_known: string[];                // ids de trucos
  spells_known?: string[];                 // ids (modelo "conocido")
  spells_prepared?: string[];              // ids (modelo "preparado")
  spellbook?: string[];                    // ids (solo Mago: grimorio completo)

  // Límites calculados
  max_cantrips: number;
  max_spells_known?: number;               // modelo conocido
  max_spells_prepared?: number;            // modelo preparado
  max_spell_level: number;                 // nivel más alto que puede lanzar

  // Concentración
  concentrating_on?: {
    spell_id: string;
    remaining_duration: number;            // en rondas o minutos
  } | null;

  // Puntos de hechicería (solo Hechicero)
  sorcery_points?: { total: number; used: number };
}

type SpellSchool =
  | 'abjuration' | 'conjuration' | 'divination' | 'enchantment'
  | 'evocation' | 'illusion' | 'necromancy' | 'transmutation';

type SpellcasterClass =
  | 'bard' | 'cleric' | 'druid' | 'paladin' | 'ranger'
  | 'sorcerer' | 'warlock' | 'wizard'
  | 'eldritch_knight' | 'arcane_trickster';

type AbilityKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

type DamageType =
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force'
  | 'lightning' | 'necrotic' | 'piercing' | 'poison'
  | 'psychic' | 'radiant' | 'slashing' | 'thunder';
```

### Funciones de cálculo clave

```typescript
// Calcular CD de salvación de hechizos
function spellSaveDC(proficiencyBonus: number, abilityMod: number): number {
  return 8 + proficiencyBonus + abilityMod;
}

// Calcular bonus de ataque de hechizo
function spellAttackBonus(proficiencyBonus: number, abilityMod: number): number {
  return proficiencyBonus + abilityMod;
}

// Máximo de hechizos preparados (Clérigo, Druida, Mago)
function maxPreparedFull(abilityMod: number, classLevel: number): number {
  return Math.max(1, abilityMod + classLevel);
}

// Máximo de hechizos preparados (Paladín — medio lanzador)
function maxPreparedPaladin(chaMod: number, paladinLevel: number): number {
  return Math.max(1, chaMod + Math.floor(paladinLevel / 2));
}

// Escalado de daño de truco por nivel de personaje
function cantripDiceCount(characterLevel: number): number {
  if (characterLevel >= 17) return 4;
  if (characterLevel >= 11) return 3;
  if (characterLevel >= 5) return 2;
  return 1;
}

// CD de salvación de concentración al recibir daño
function concentrationSaveDC(damageTaken: number): number {
  return Math.max(10, Math.floor(damageTaken / 2));
}

// ¿Puede lanzar un hechizo de nivel N?
function canCastSpell(state: SpellcastingState, spellLevel: number): boolean {
  if (spellLevel === 0) return true;  // trucos siempre
  // buscar cualquier ranura de nivel >= spellLevel con usos disponibles
  for (let lvl = spellLevel; lvl <= 9; lvl++) {
    const slot = state.spell_slots[lvl];
    if (slot && slot.used < slot.total) return true;
  }
  // ranuras de pacto
  if (state.pact_slots &&
      state.pact_slots.slot_level >= spellLevel &&
      state.pact_slots.used < state.pact_slots.total) return true;
  return false;
}
```

---

## 17. Validaciones y reglas de integridad

### Reglas absolutas (nunca deben violarse)

1. **Un hechizo de nivel N requiere una ranura de nivel ≥ N.** Nunca permitir lanzar con una ranura de nivel inferior.

2. **Los trucos nunca consumen ranuras** y no tienen límite de uso por descanso.

3. **Máximo un hechizo de concentración a la vez.** Si el personaje lanza un segundo hechizo de concentración, el primero termina inmediatamente. Advertir al usuario antes de sobrescribir.

4. **Las ranuras usadas nunca superan las totales:** `used ≤ total` en todo momento. Impedir lanzar si no hay ranuras disponibles del nivel requerido o superior.

5. **Pact Magic se recupera en descanso corto**, todas las demás ranuras en descanso largo. La lógica de recuperación debe distinguirlas.

6. **Solo se puede lanzar lo que está en el repertorio:**
   - Modelo conocido: solo hechizos en `spells_known`
   - Modelo preparado: solo hechizos en `spells_prepared`
   - Mago: solo puede preparar hechizos que estén en `spellbook`

7. **Límite de preparación:** `spells_prepared.length ≤ max_spells_prepared`. Los trucos no cuentan para este límite.

8. **Límite de hechizos conocidos:** `spells_known.length ≤ max_spells_known`.

9. **Límite de trucos:** `cantrips_known.length ≤ max_cantrips`.

10. **Nivel máximo de hechizo:** no se puede conocer/preparar un hechizo cuyo nivel supere `max_spell_level` para el nivel actual del personaje.

11. **Componentes materiales con coste:** si el hechizo requiere un componente con coste en oro (ej: Revivify → diamante 300 po), verificar que el personaje lo tenga en el inventario. Si el componente se consume, descontarlo al lanzar.

12. **Ritual sin gastar ranura:** solo si el hechizo tiene la etiqueta ritual Y la clase puede lanzar rituales (Bardo, Clérigo, Druida, Mago; o Mago con el grimorio aunque no esté preparado). Añade +10 minutos al tiempo de lanzamiento.

### Reglas de recuperación (descansos)

```
DESCANSO CORTO (Short Rest, ~1 hora):
  → Brujo: recupera TODAS las ranuras de Pact Magic
  → Otras clases: NO recuperan ranuras (salvo rasgos específicos como
    Arcane Recovery del Mago, que recupera algunas ranuras 1×/día)

DESCANSO LARGO (Long Rest, ~8 horas):
  → Todas las clases: recuperan TODAS las ranuras
  → Brujo: recupera Pact Magic y Mystic Arcanum
  → Hechicero: recupera puntos de hechicería
  → Lanzadores preparados: pueden CAMBIAR los hechizos preparados
  → Se resetea la concentración (ya debería estar rota al descansar)
```

### Reglas de upcasting

```
Al lanzar con una ranura superior al nivel base del hechizo:
  1. Verificar que el hechizo tenga campo higher_levels
  2. Calcular la diferencia: nivel_ranura - nivel_base_hechizo
  3. Aplicar el efecto de escalado (más dados, más objetivos, etc.)
  4. Gastar la ranura del nivel usado (no del nivel base)

Si el hechizo NO tiene higher_levels:
  → Se puede lanzar con ranura superior, pero sin beneficio adicional
  → Advertir al usuario que "desperdicia" la ranura superior
```

### Advertencias (no bloquean pero informan)

- Lanzar un hechizo sin componente material requerido → advertir (a menos que tenga foco/bolsa)
- Lanzar un segundo hechizo de concentración → advertir que romperá el primero
- Preparar un hechizo que ya no se puede lanzar por falta de ranuras del nivel → informar
- Un lanzador conocido intentando aprender más hechizos del límite → bloquear con mensaje
- Lanzar un hechizo de acción bonus y luego querer lanzar otro hechizo (que no sea truco) en el mismo turno → advertir de la regla de una-acción-bonus-por-turno

### Regla especial: hechizo de acción bonus + hechizo normal

```
REGLA: Si se lanza un hechizo con tiempo "1 acción bonus" en el turno,
el único otro hechizo que se puede lanzar ese turno es un TRUCO con
tiempo de lanzamiento de 1 acción.

Ejemplo válido:   Healing Word (acción bonus) + Fire Bolt (truco, acción)  ✓
Ejemplo inválido: Healing Word (acción bonus) + Fireball (nivel 3, acción) ✗
```

---

*Documento generado para implementación técnica. Fuente principal: Player's Handbook D&D 5e (2014), Xanathar's Guide to Everything (2017), Tasha's Cauldron of Everything (2020). La lista completa de hechizos está disponible bajo la Open Game License en el SRD 5.1 de Wizards of the Coast, recomendada como fuente de datos estructurada para poblar la base de datos de la app.*
