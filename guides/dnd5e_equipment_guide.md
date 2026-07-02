# Guía Definitiva: Equipamiento, Objetos y Economía en D&D 5e
## Documento de especificación para implementación en app

> **Propósito:** Este documento describe con precisión técnica todos los tipos de objetos, sus propiedades, efectos mecánicos, interacciones con el personaje y el sistema económico de D&D 5e. Complementa la Guía de Creación de Personaje. Está escrito para que Claude Code implemente un sistema de inventario, tienda y gestión de equipo completo y sin ambigüedades.

---

## Índice

1. [Arquitectura del inventario](#1-arquitectura-del-inventario)
2. [Sistema monetario](#2-sistema-monetario)
3. [Propiedades universales de los objetos](#3-propiedades-universales-de-los-objetos)
4. [Armaduras](#4-armaduras)
5. [Armas](#5-armas)
6. [Herramientas y kits](#6-herramientas-y-kits)
7. [Adventuring Gear — equipo de aventurero](#7-adventuring-gear--equipo-de-aventurero)
8. [Packs de aventurero](#8-packs-de-aventurero)
9. [Consumibles](#9-consumibles)
10. [Vehículos y monturas](#10-vehículos-y-monturas)
11. [Objetos mágicos](#11-objetos-mágicos)
12. [Efectos mecánicos sobre el personaje](#12-efectos-mecánicos-sobre-el-personaje)
13. [Capacidad de carga y encumbramiento](#13-capacidad-de-carga-y-encumbramiento)
14. [Comercio y precios](#14-comercio-y-precios)
15. [Modelo de datos sugerido](#15-modelo-de-datos-sugerido)
16. [Validaciones y reglas de integridad](#16-validaciones-y-reglas-de-integridad)

---

## 1. Arquitectura del inventario

### Taxonomía de objetos

Todo objeto en D&D 5e pertenece a exactamente una categoría principal y puede tener subcategorías:

```
Objeto
├── Mundano (sin magia)
│   ├── Armadura
│   │   ├── Ligera
│   │   ├── Media
│   │   ├── Pesada
│   │   └── Escudo
│   ├── Arma
│   │   ├── Sencilla cuerpo a cuerpo
│   │   ├── Sencilla a distancia
│   │   ├── Marcial cuerpo a cuerpo
│   │   └── Marcial a distancia
│   ├── Herramienta
│   │   ├── Artesanal
│   │   ├── Musical
│   │   ├── Juego de azar
│   │   └── Especializada
│   ├── Adventuring Gear (equipo general)
│   ├── Consumible
│   │   ├── Poción
│   │   ├── Pergamino
│   │   ├── Alimento / Ración
│   │   └── Veneno
│   └── Vehículo / Montura
└── Mágico
    ├── Armadura mágica
    ├── Arma mágica
    ├── Objeto maravilloso (Wondrous Item)
    ├── Anillo
    ├── Bastón / Báculo / Varita
    ├── Poción mágica
    ├── Pergamino de hechizo
    └── Objeto de atunamiento (requiere Attunement)
```

### Slots de equipo (zonas del cuerpo)

Un personaje puede llevar objetos equipados en los siguientes slots. Cada slot acepta exactamente 1 objeto (salvo dedos: 2 anillos):

| Slot ID | Nombre | Acepta |
|---------|--------|--------|
| `head` | Cabeza | Casco, sombrero, capucha, diadema |
| `neck` | Cuello / Pecho | Amuleto, colgante, capa, manto |
| `body` | Cuerpo (torso) | Armadura (ligera, media, pesada), ropa |
| `cloak` | Espalda | Capa, manto |
| `hands` | Manos | Guantes, manoplas |
| `ring_left` | Dedo izquierdo | Anillo |
| `ring_right` | Dedo derecho | Anillo |
| `waist` | Cintura | Cinturón |
| `feet` | Pies | Botas |
| `main_hand` | Mano principal | Arma a 1 mano, arma a 2 manos |
| `off_hand` | Mano secundaria | Arma ligera, escudo, foco arcano, símbolo sagrado |
| `back` | Espalda / hombro | Mochila, carcaj |
| `carried` | Llevado (bolsa/mochila) | Todo lo que no está equipado |

> **Regla de manos:** Un arma a 2 manos ocupa `main_hand` Y `off_hand` simultáneamente. Un arma versátil ocupa `main_hand`; si se decide usar a 2 manos, bloquea `off_hand`. No se puede tener escudo Y arma a 2 manos al mismo tiempo.

### Atunamiento (Attunement)

Algunos objetos mágicos requieren **atunamiento** para funcionar:
- El personaje puede tener atunamiento con máximo **3 objetos** simultáneamente
- Afinarse requiere un descanso corto dedicado en contacto con el objeto
- Romper el atunamiento requiere otro descanso corto (o muerte del personaje)
- Si un personaje muere, pierde todos sus atunamientos

---

## 2. Sistema monetario

### Denominaciones de moneda

D&D 5e usa 5 tipos de moneda, todas monedas físicas con peso:

| Abreviatura | Nombre español | Nombre inglés | Peso por moneda | Conversión base |
|-------------|---------------|---------------|-----------------|-----------------|
| `pp` | Pieza de platino | Platinum piece | 1/50 lb | 1 pp = 10 po |
| `po` / `gp` | Pieza de oro | Gold piece | 1/50 lb | 1 po = 10 pa = 100 pc |
| `pe` / `ep` | Pieza de electro | Electrum piece | 1/50 lb | 1 pe = 5 pa |
| `pa` / `sp` | Pieza de plata | Silver piece | 1/50 lb | 1 pa = 10 pc |
| `pc` / `cp` | Pieza de cobre | Copper piece | 1/50 lb | unidad base |

### Tabla de conversión completa

| De / A | pp | po | pe | pa | pc |
|--------|----|----|----|----|-----|
| 1 pp = | 1 | 10 | 20 | 100 | 1000 |
| 1 po = | 1/10 | 1 | 2 | 10 | 100 |
| 1 pe = | 1/20 | 1/2 | 1 | 5 | 50 |
| 1 pa = | 1/100 | 1/10 | 1/5 | 1 | 10 |
| 1 pc = | 1/1000 | 1/100 | 1/50 | 1/10 | 1 |

> **Nota de implementación:** Almacenar siempre en **piezas de cobre enteras** como unidad base interna para evitar decimales. Mostrar en la UI la denominación más significativa. La pieza de electro es rara en muchas campañas — es opcional incluirla.

### Peso de la moneda

Las monedas tienen peso físico, lo cual es relevante para el sistema de carga:

```
50 monedas (cualquier tipo) = 1 libra
```

### Precio de referencia: la pieza de oro como estándar

La economía del juego está calibrada en torno a la **po (pieza de oro)**:
- 1 po = salario diario de un artesano calificado
- 1 po = hospedaje cómodo por 1 noche + comida
- Equipo básico de aventurero: 10–50 po
- Armadura completa: 1.500 po
- Un caballo de guerra: 400 po

---

## 3. Propiedades universales de los objetos

Todo objeto, sin importar su tipo, tiene estos campos comunes:

| Propiedad | Tipo de dato | Descripción |
|-----------|-------------|-------------|
| `id` | string / uuid | Identificador único |
| `name` | string | Nombre del objeto |
| `name_en` | string | Nombre en inglés (para referencias al PHB) |
| `category` | enum | Ver taxonomía sección 1 |
| `subcategory` | enum | Subtipo dentro de la categoría |
| `weight` | number (lb) | Peso en libras; 0 si no tiene peso (pergaminos, pociones pequeñas ≈ 0.5) |
| `cost` | number (cp) | Precio estándar en piezas de cobre |
| `cost_display` | string | Precio para mostrar en UI ("50 po", "5 pa") |
| `description` | string | Descripción narrativa |
| `properties` | string[] | Lista de propiedades especiales (Finesse, Light, Heavy, etc.) |
| `requires_attunement` | boolean | Si es mágico y necesita atunamiento |
| `attunement_requirements` | string? | Restricciones de atunamiento (ej: "solo lanzadores de hechizos") |
| `magical` | boolean | Si es un objeto mágico |
| `rarity` | enum | Common / Uncommon / Rare / Very Rare / Legendary / Artifact |
| `stackable` | boolean | Si puede apilarse (monedas, flechas, raciones, pociones) |
| `quantity` | number | Cantidad en el inventario (siempre 1 para no apilables) |
| `equipped_slot` | string? | Slot donde está equipado, null si está en bolsa |
| `source` | string | "PHB", "DMG", "XGE", "TCoE", etc. |

---

## 4. Armaduras

Las armaduras afectan directamente la **Clase de Armadura (CA)** del personaje. Ver fórmulas completas en la Guía de Creación de Personaje, sección 8.3.

### 4.1 Armaduras ligeras

Usar DES completo. No requieren FUE mínima.

| Nombre | CA base | Bonus DES | Desventaja Sigilo | Peso | Precio |
|--------|---------|-----------|-------------------|------|--------|
| Acolchada | 11 | + DES (sin límite) | **Sí** | 8 lb | 5 po |
| Cuero | 11 | + DES (sin límite) | No | 10 lb | 10 po |
| Cuero tachonado | 12 | + DES (sin límite) | No | 13 lb | 45 po |

### 4.2 Armaduras medias

Usan DES pero con máximo +2.

| Nombre | CA base | Bonus DES | Desventaja Sigilo | Peso | Precio |
|--------|---------|-----------|-------------------|------|--------|
| Piel | 12 | + DES (máx +2) | No | 12 lb | 10 po |
| Armadura de cadenas | 13 | + DES (máx +2) | No | 20 lb | 50 po |
| Cota de escamas | 14 | + DES (máx +2) | **Sí** | 45 lb | 50 po |
| Coraza (Breastplate) | 14 | + DES (máx +2) | No | 20 lb | 400 po |
| Media armadura | 15 | + DES (máx +2) | **Sí** | 40 lb | 750 po |

### 4.3 Armaduras pesadas

Sin bonus de DES. Requieren FUE mínima.

| Nombre | CA base | Bonus DES | FUE mínima | Desventaja Sigilo | Peso | Precio |
|--------|---------|-----------|-----------|-------------------|------|--------|
| Anillos | 14 | Ninguno | — | No | 40 lb | 30 po |
| Cota tachonada | 14 | Ninguno | — | **Sí** | 45 lb | 75 po |
| Cota de malla | 15 | Ninguno | FUE 13 | **Sí** | 55 lb | 75 po |
| Cota de placas | 17 | Ninguno | FUE 15 | **Sí** | 60 lb | 1.500 po |
| Armadura completa (Full Plate) | 18 | Ninguno | FUE 15 | **Sí** | 65 lb | 1.500 po |

> **Regla de FUE mínima:** Si el personaje no alcanza la FUE mínima, su velocidad se reduce en 10 ft mientras lleva esa armadura.

### 4.4 Escudos

| Nombre | Bonus CA | Peso | Precio | Notas |
|--------|---------|------|--------|-------|
| Escudo (Shield) | +2 CA | 6 lb | 10 po | Ocupa off_hand; incompatible con armas a 2 manos y arcos |

### 4.5 Propiedades de armaduras como objeto

Cada armadura tiene estos campos adicionales:

```typescript
interface Armor {
  // Hereda todas las propiedades universales
  armor_type: 'light' | 'medium' | 'heavy' | 'shield';
  base_ac: number;
  dex_bonus: 'full' | 'max2' | 'none';      // cómo se aplica el mod. DES
  min_strength: number;                       // 0 si no requiere
  stealth_disadvantage: boolean;
  // Efectos calculados (dependen del personaje que la usa)
  effective_ac?: number;                      // calculado: base_ac + aplicación DES
}
```

### 4.6 Armaduras mágicas — variantes comunes

Las armaduras mágicas mantienen la mecánica base y añaden bonus o propiedades especiales:

| Nombre | Tipo base | Bonus | Requiere atunamiento | Rareza |
|--------|-----------|-------|---------------------|--------|
| Armor +1 / +2 / +3 | Cualquiera | +1/+2/+3 a la CA final | No | Uncommon / Rare / Very Rare |
| Mithral Armor | Media o pesada | Sin desventaja Sigilo, sin req. FUE | No | Uncommon |
| Adamantine Armor | Media o pesada | Los críticos contra el portador se convierten en golpes normales | No | Uncommon |
| Armor of Invulnerability | Full Plate | Resistencia a daño no mágico; 1×/día inmunidad a daño no mágico | **Sí** | Legendary |
| Demon Armor | Full Plate | +1 CA; ataques sin armas hacen 1d6+FUE daño infernal; maldita | **Sí** | Very Rare |
| Dragon Scale Mail | Media | +1 CA; ventaja en salvaciones vs. aliento del tipo del dragón | **Sí** | Very Rare |
| Dwarven Plate | Full Plate | +2 CA; reacción para reducir movimiento forzado en 10 ft | **Sí** | Very Rare |
| Elven Chain | Cota de malla | +1 CA; puede usarse sin competencia (sin penalización) | No | Rare |

---

## 5. Armas

### 5.1 Propiedades de armas (completo)

Cada arma puede tener una o más propiedades que modifican cómo funciona:

| Propiedad | ID | Efecto mecánico |
|-----------|-----|----------------|
| Finesse | `finesse` | El atacante elige usar FUE o DES para ataque Y daño (debe ser el mismo mod para ambos en ese ataque) |
| Versatile | `versatile` | Puede usarse a 1 o 2 manos; el dado 2 manos va en paréntesis en la descripción |
| Two-Handed | `two_handed` | Requiere 2 manos obligatoriamente; incompatible con escudo |
| Light | `light` | Permite Two-Weapon Fighting (ataque bonus con la otra mano) |
| Thrown | `thrown` | Puede lanzarse como ataque a distancia; rango en pies entre paréntesis; usa misma característica que CaC si no es Finesse |
| Reach | `reach` | El arma tiene alcance de 10 ft en lugar de 5 ft |
| Heavy | `heavy` | Criaturas de tamaño Pequeño o Diminuto tienen desventaja en ataques |
| Loading | `loading` | Máximo 1 ataque con esta arma por turno, sin importar cuántos ataques tenga el personaje |
| Ammunition | `ammunition` | Requiere munición; recuperar munición después del combate: 50% de la munición disparada |
| Special | `special` | Tiene reglas únicas descritas por separado (ej: red, lanza de caballería) |
| Silvered | `silvered` | El arma está plateada; supera resistencias a daño no mágico de ciertos monstruos |

### 5.2 Armas sencillas cuerpo a cuerpo

| Nombre | Daño | Tipo daño | Propiedades | Peso | Precio |
|--------|------|-----------|-------------|------|--------|
| Club (Garrote) | 1d4 | Contundente | Light | 2 lb | 1 pa |
| Dagger (Daga) | 1d4 | Perforante | Finesse, Light, Thrown (20/60) | 1 lb | 2 po |
| Greatclub (Gran garrote) | 1d8 | Contundente | Two-Handed | 10 lb | 2 pa |
| Handaxe (Hacha de mano) | 1d6 | Cortante | Light, Thrown (20/60) | 2 lb | 5 po |
| Javelin (Jabalina) | 1d6 | Perforante | Thrown (30/120) | 2 lb | 5 pa |
| Light Hammer (Martillo ligero) | 1d4 | Contundente | Light, Thrown (20/60) | 2 lb | 2 po |
| Mace (Maza) | 1d6 | Contundente | — | 4 lb | 5 po |
| Quarterstaff (Bastón) | 1d6 | Contundente | Versatile (1d8) | 4 lb | 2 pa |
| Sickle (Hoz) | 1d4 | Cortante | Light | 2 lb | 1 po |
| Spear (Lanza) | 1d6 | Perforante | Thrown (20/60), Versatile (1d8) | 3 lb | 1 po |

### 5.3 Armas sencillas a distancia

| Nombre | Daño | Tipo daño | Propiedades | Rango | Peso | Precio |
|--------|------|-----------|-------------|-------|------|--------|
| Crossbow, Light (Ballesta ligera) | 1d8 | Perforante | Ammunition, Loading, Two-Handed | 80/320 ft | 5 lb | 25 po |
| Dart (Dardo) | 1d4 | Perforante | Finesse, Thrown | 20/60 ft | 1/4 lb | 5 pc |
| Shortbow (Arco corto) | 1d6 | Perforante | Ammunition, Two-Handed | 80/320 ft | 2 lb | 25 po |
| Sling (Honda) | 1d4 | Contundente | Ammunition | 30/120 ft | — | 1 pa |

### 5.4 Armas marciales cuerpo a cuerpo

| Nombre | Daño | Tipo daño | Propiedades | Peso | Precio |
|--------|------|-----------|-------------|------|--------|
| Battleaxe (Hacha de batalla) | 1d8 | Cortante | Versatile (1d10) | 4 lb | 10 po |
| Flail (Mangual) | 1d8 | Contundente | — | 2 lb | 10 po |
| Glaive | 1d10 | Cortante | Heavy, Reach, Two-Handed | 6 lb | 20 po |
| Greataxe (Gran hacha) | 1d12 | Cortante | Heavy, Two-Handed | 7 lb | 30 po |
| Greatsword (Espadón) | 2d6 | Cortante | Heavy, Two-Handed | 6 lb | 50 po |
| Halberd (Alabarda) | 1d10 | Cortante | Heavy, Reach, Two-Handed | 6 lb | 20 po |
| Lance (Lanza de caballería) | 1d12 | Perforante | Reach, Special | 6 lb | 10 po |
| Longsword (Espada larga) | 1d8 | Cortante | Versatile (1d10) | 3 lb | 15 po |
| Maul (Maza de guerra) | 2d6 | Contundente | Heavy, Two-Handed | 10 lb | 10 po |
| Morningstar | 1d8 | Perforante | — | 4 lb | 15 po |
| Pike (Pica) | 1d10 | Perforante | Heavy, Reach, Two-Handed | 18 lb | 5 po |
| Rapier (Espada ropera) | 1d8 | Perforante | Finesse | 2 lb | 25 po |
| Scimitar (Cimitarra) | 1d6 | Cortante | Finesse, Light | 3 lb | 25 po |
| Shortsword (Espada corta) | 1d6 | Perforante | Finesse, Light | 2 lb | 10 po |
| Trident (Tridente) | 1d6 | Perforante | Thrown (20/60), Versatile (1d8) | 4 lb | 5 po |
| War Pick (Pico de guerra) | 1d8 | Perforante | — | 2 lb | 5 po |
| Warhammer (Martillo de guerra) | 1d8 | Contundente | Versatile (1d10) | 2 lb | 15 po |
| Whip (Látigo) | 1d4 | Cortante | Finesse, Reach | 3 lb | 2 po |

### 5.5 Armas marciales a distancia

| Nombre | Daño | Tipo daño | Propiedades | Rango | Peso | Precio |
|--------|------|-----------|-------------|-------|------|--------|
| Blowgun (Cerbatana) | 1 | Perforante | Ammunition, Loading | 25/100 ft | 1 lb | 10 po |
| Crossbow, Hand (Ballesta de mano) | 1d6 | Perforante | Ammunition, Light, Loading | 30/120 ft | 3 lb | 75 po |
| Crossbow, Heavy (Ballesta pesada) | 1d10 | Perforante | Ammunition, Heavy, Loading, Two-Handed | 100/400 ft | 18 lb | 50 po |
| Longbow (Arco largo) | 1d8 | Perforante | Ammunition, Heavy, Two-Handed | 150/600 ft | 2 lb | 50 po |
| Net (Red) | — | — | Special, Thrown | 5/15 ft | 3 lb | 1 po |

> **Regla de rango:** Los rangos se muestran como "normal/largo". Ataques dentro del rango normal: normal. Ataques entre rango normal y largo: desventaja. Ataques más allá del rango largo: imposible.

### 5.6 Munición

| Tipo | Usos | Precio | Peso |
|------|------|--------|------|
| Arrows (Flechas) | Arco corto, arco largo | 1 po / 20 | 1 lb / 20 |
| Bolts (Virotes) | Ballestas | 1 po / 20 | 1.5 lb / 20 |
| Bullets, Sling (Balas de honda) | Honda | 4 pc / 20 | 1.5 lb / 20 |
| Needles, Blowgun (Agujas de cerbatana) | Cerbatana | 1 po / 50 | 1 lb / 50 |

> **Recuperación de munición:** Tras un combate, un personaje puede recuperar la mitad de la munición disparada (redondeado hacia abajo). La munición destruida (crítico fallido, daño especial) no se recupera.

### 5.7 Armas improvisadas

Cualquier objeto puede usarse como arma improvisada:
- Daño base: 1d4 (tipo determinado por el DM según el objeto)
- Sin propiedades de arma
- Sin bonus de BPC al ataque (a menos que se parezca a un arma real)
- Rango a distancia si se lanza: 20/60 ft

### 5.8 Armas mágicas — variantes comunes

| Nombre | Tipo base | Bonus | Propiedades adicionales | Req. atunamiento | Rareza |
|--------|-----------|-------|------------------------|-----------------|--------|
| Weapon +1 / +2 / +3 | Cualquier arma | +1/+2/+3 a ataque Y daño | — | No | Uncommon / Rare / Very Rare |
| Flame Tongue | Espada | +2d6 fuego al activarla | Brillar como antorcha | **Sí** | Rare |
| Frost Brand | Espada | +1d6 frío; ventaja vs. calor extremo | Al desenfundar: extingue llamas cercanas | **Sí** | Very Rare |
| Luck Blade | Espada corta/larga/ropera | +1 ataque y daño; re-tirar 1 ataque/habilidad/salvación por día | Deseos (1–3) | **Sí** | Legendary |
| Sun Blade | Longsword (trato como Shortsword) | +2 ataque y daño; 1d8 extra vs. muertos vivientes | Emite luz solar | **Sí** | Rare |
| Vorpal Sword | Espada cortante | +3 ataque y daño; decapitar en crítico (mata si no es inmune) | — | **Sí** | Legendary |
| Sword of Wounding | Espada | +1 ataque y daño; herida que no sana sin acción (1d4 extra/turno) | — | **Sí** | Rare |
| Dagger of Venom | Daga | +1 ataque y daño; 1×/día envenenar (2d10 veneno, CD 15 CON o envenenado 1 min.) | — | No | Rare |
| Javelin of Lightning | Jabalina | 1×/día: lanzar como rayo 5×120 ft (4d6 rayo; CD 13 DES mitad) | — | No | Uncommon |
| Trident of Fish Command | Tridente | +1 ataque y daño; 1×/día controlar criaturas acuáticas | — | **Sí** | Uncommon |
| Berserker Axe | Hacha | +1 ataque y daño; +PG máx por nivel mientras afinado; MALDITA | **Sí** | Rare |
| Nine Lives Stealer | Espada | +2 ataque y daño; mata instantáneamente (9 cargas totales) con 7 o menos PG | **Sí** | Very Rare |
| Holy Avenger | Paladin espada | +3 ataque y daño; +2d10 vs. fiends/undead; aura antimagia | **Sí** (paladín) | Legendary |

---

## 6. Herramientas y kits

Las herramientas otorgan **competencia** que se añade a las tiradas de característica relevantes cuando se usan.

### 6.1 Herramientas artesanales (Artisan's Tools)

Cada kit requiere 1 hora de trabajo mínimo para producir resultados. Un personaje con competencia añade BPC a las tiradas.

| Herramienta | Característica principal | Usos típicos | Peso | Precio |
|-------------|-------------------------|--------------|------|--------|
| Alchemist's Supplies | INT | Crear pociones básicas, identificar sustancias alquímicas | 8 lb | 50 po |
| Brewer's Supplies | INT | Fabricar alcohol, identificar bebidas, crear antídotos | 9 lb | 20 po |
| Calligrapher's Supplies | DES | Copiar pergaminos, falsificar documentos | 5 lb | 10 po |
| Carpenter's Tools | FUE | Construir o reparar estructuras de madera | 6 lb | 8 po |
| Cartographer's Tools | INT | Crear mapas, navegar terrenos desconocidos | 6 lb | 15 po |
| Cobbler's Tools | DES | Reparar calzado, crear suelas especiales | 5 lb | 5 po |
| Cook's Utensils | SAB | Preparar comidas con efectos de recuperación | 8 lb | 1 po |
| Glassblower's Tools | DES | Crear objetos de vidrio, lentes, recipientes | 5 lb | 30 po |
| Jeweler's Tools | INT | Tasar gemas, reparar joyería | 2 lb | 25 po |
| Leatherworker's Tools | DES | Crear armadura de cuero, artículos de cuero | 5 lb | 5 po |
| Mason's Tools | FUE | Trabajo en piedra, identificar estructuras | 8 lb | 10 po |
| Painter's Supplies | SAB | Crear pinturas, retratos, arte | 5 lb | 10 po |
| Potter's Tools | DES | Crear cerámica | 3 lb | 10 po |
| Smith's Tools | FUE | Crear y reparar metal, forjar armas/armaduras | 8 lb | 20 po |
| Tinker's Tools | DES | Reparar mecanismos, crear artilugios pequeños | 10 lb | 50 po |
| Weaver's Tools | DES | Crear tela y ropa | 5 lb | 1 po |
| Woodcarver's Tools | DES | Tallar madera, crear flechas, objetos de madera | 5 lb | 1 po |

### 6.2 Instrumentos musicales

Un personaje con competencia en un instrumento añade BPC a las tiradas de Performance con ese instrumento.

| Instrumento | Precio | Peso |
|-------------|--------|------|
| Bagpipes (Gaita) | 30 po | 6 lb |
| Drum (Tambor) | 6 po | 3 lb |
| Dulcimer (Dulcémele) | 25 po | 10 lb |
| Flute (Flauta) | 2 po | 1 lb |
| Horn (Cuerno) | 3 po | 2 lb |
| Lute (Laúd) | 35 po | 2 lb |
| Lyre (Lira) | 30 po | 2 lb |
| Pan flute (Flauta de pan) | 12 po | 2 lb |
| Shawm (Chirimía) | 2 po | 1 lb |
| Viol (Viola) | 30 po | 1 lb |

### 6.3 Juegos de azar y entretenimiento

| Objeto | Precio | Peso | Usos |
|--------|--------|------|------|
| Dice set (Dados) | 1 pa | — | Deception al hacer trampas, Insight para detectarlas |
| Playing card set (Cartas) | 5 pa | — | Ídem |
| Dragon chess set (Ajedrez dragón) | 1 po | 1/2 lb | Historia, táctica |
| Three-Dragon Ante set | 1 po | — | Socialización, Persuasión |

### 6.4 Herramientas especializadas

| Herramienta | Competencia otorga BPC en | Peso | Precio |
|-------------|--------------------------|------|--------|
| Thieves' Tools (Herramientas de ladrón) | Abrir cerraduras, desactivar trampas (DES) | 1 lb | 25 po |
| Herbalism Kit (Kit de herboristería) | Identificar plantas medicinales, crear pociones de curación (SAB) | 3 lb | 5 po |
| Healer's Kit (Kit de curandero) | Estabilizar heridos sin tirada, curación adicional (Medicine) | 3 lb | 5 po |
| Poisoner's Kit (Kit de envenenador) | Crear y aplicar venenos, identificarlos (INT) | 2 lb | 50 po |
| Navigator's Tools (Herramientas de navegante) | Navegación marítima, orientación por estrellas (SAB) | 2 lb | 25 po |
| Land vehicles | Conducir carros, carruajes (DES o FUE) | — | — |
| Water vehicles | Navegar embarcaciones (SAB) | — | — |
| Disguise Kit (Kit de disfraz) | Crear disfraces, pasar por otra persona (CAR/DES) | 3 lb | 25 po |
| Forgery Kit (Kit de falsificación) | Falsificar documentos, sellos, sellos de cera (DES) | 5 lb | 15 po |

---

## 7. Adventuring Gear — equipo de aventurero

Objetos sin mecánicas de combate directas pero fundamentales para la exploración y la supervivencia.

### 7.1 Iluminación

| Objeto | Radio de luz brillante | Radio de luz tenue | Duración | Precio | Notas |
|--------|----------------------|-------------------|----------|--------|-------|
| Torch (Antorcha) | 20 ft | + 20 ft | 1 hora | 1 pc | Se usa como arma improvisada (1 daño fuego) |
| Candle (Vela) | 5 ft | + 5 ft | 1 hora | 1 pc | Apagable fácilmente |
| Lantern, Bullseye (Linterna bullseye) | Cono de 60 ft | + 60 ft | 6 horas / frasco aceite | 10 po | Iluminación direccional |
| Lantern, Hooded (Linterna encapuchada) | 30 ft | + 30 ft | 6 horas / frasco aceite | 5 po | Puede encapucharse (oscuridad) |
| Oil Flask (Frasco de aceite) | — | — | — | 1 pa | Combustible para linternas; 1 frasco = 6 horas |

> **Mecánica de oscuridad:** En oscuridad total, criaturas sin Darkvision están efectivamente ciegas (desventaja en ataques, ventaja para los atacantes). La iluminación es una de las mecánicas más tácticamente relevantes del juego.

### 7.2 Contenedores

| Objeto | Capacidad | Peso vacío | Precio | Notas |
|--------|-----------|-----------|--------|-------|
| Backpack (Mochila) | 1 pie³ / 30 lb | 5 lb | 2 po | Contenedor principal |
| Barrel (Barril) | 40 galones líquido / 4 pies³ sólido | 70 lb | 2 po | No portátil normalmente |
| Basket (Cesto) | 2 pies³ / 40 lb | 2 lb | 4 pa | |
| Chest (Cofre) | 12 pies³ / 300 lb | 25 lb | 5 po | |
| Component pouch (Bolsa de componentes) | — | 2 lb | 25 po | Sustituye los componentes M sin precio de hechizos |
| Flask / Tankard (Frasco / Jarra) | 1 pinta líquido | 1 lb | 2 pc | |
| Jug / Pitcher (Jarra grande) | 1 galón | 4 lb | 2 pc | |
| Pouch (Bolsita) | 1/5 pie³ / 6 lb | 1 lb | 5 pa | Guarda monedas u objetos pequeños |
| Sack (Saco) | 1 pie³ / 30 lb | 1/2 lb | 1 pc | |
| Vial (Vial) | 4 onzas líquido | — | 1 po | Para pociones, venenos, tinta |
| Waterskin (Odre) | 4 pintas líquido | 5 lb (lleno) | 2 pa | Agua para 1 persona por 1 día |

### 7.3 Cuerdas y sujeción

| Objeto | Longitud | Resistencia | Peso | Precio |
|--------|----------|-------------|------|--------|
| Rope, Hempen (Cuerda de cáñamo) | 50 ft | Romperse: CD 17 FUE | 10 lb | 1 po |
| Rope, Silk (Cuerda de seda) | 50 ft | Romperse: CD 20 FUE | 5 lb | 10 po |
| Chain (Cadena) | 10 ft | Romperse: CD 20 FUE | 10 lb | 5 po |
| Manacles (Esposas) | — | Romperse: CD 20 FUE; escapar: CD 20 DES (Acrobacias) | 6 lb | 2 po |
| Grappling Hook (Gancho) | — | — | 4 lb | 2 po |
| Piton (Piqueta) | — | Soporta hasta 250 lb | 1/4 lb | 5 pc |

### 7.4 Escalada y exploración

| Objeto | Efecto mecánico | Peso | Precio |
|--------|----------------|------|--------|
| Climber's Kit | Ventaja en Atletismo para escalar (se ancla el personaje) | 12 lb | 25 po |
| Crowbar (Palanca) | Ventaja en FUE para abrir puertas y cofres | 5 lb | 2 po |
| Hammer (Martillo) | Clavar piquetas; arma improvisada 1d4 | 3 lb | 1 po |
| Mallet (Mazo de madera) | Clavar estacas (vampiros) | 3 lb | — |
| Picks, Miner's (Pico de minero) | Arma improvisada 1d6; cavar | 10 lb | 2 po |
| Shovel (Pala) | Cavar, 1 pie³ de tierra cada 10 minutos | 5 lb | 2 po |
| Ladder (Escalera, 10 ft) | Acceso vertical | 25 lb | 1 pa |

### 7.5 Supervivencia

| Objeto | Efecto mecánico | Peso | Precio |
|--------|----------------|------|--------|
| Rations (Raciones, 1 día) | Evita las reglas de hambre (1 lb de comida/día requerida) | 2 lb | 5 pa |
| Tinderbox (Caja de yesca) | Encender fuego en 1 acción (yesca seca) o 1 minuto (húmedo) | 1 lb | 5 pa |
| Bedroll (Kit de cama rodante) | Dormir cómodamente; descanso largo válido | 7 lb | 1 po |
| Blanket (Manta) | Confort en clima frío | 3 lb | 5 pa |
| Mess Kit (Menaje de campaña) | Cocinar; comer sin penalización | 1 lb | 2 pa |
| Fishing Tackle (Utensilios de pesca) | Pescar (Survival o Animal Handling CD variable) | 4 lb | 1 po |
| Hunting Trap (Trampa de caza) | CD 13 FUE para escapar; 1d4 daño por turno si atrapado | 25 lb | 5 po |
| Tent (Tienda, 2 personas) | Protección contra la intemperie | 20 lb | 2 po |

### 7.6 Comunicación y escritura

| Objeto | Usos | Peso | Precio |
|--------|------|------|--------|
| Ink (Tinta, 1 onza) | Escribir documentos, copiar pergaminos | — | 10 po |
| Ink pen (Pluma) | Escribir | — | 2 pc |
| Paper (Papel, 1 hoja) | Documentos | — | 2 pa |
| Parchment (Pergamino, 1 hoja) | Documentos, hechizos copiados | — | 1 pa |
| Sealing Wax (Lacre) | Sellar documentos | — | 5 pa |
| Candle, Wax (Vela de cera) | Iluminar, sellar | — | 5 pc |
| Bell (Campanilla) | Alarma simple | — | 1 pa |
| Signal Whistle (Silbato) | Comunicación a distancia (hasta 600 ft) | — | 5 pc |
| Horn (Cuerno de señal) | Señal auditiva (hasta 600 ft) | 2 lb | 3 po |
| Mirror, Steel (Espejo de acero) | Ver esquinas, señales de luz | 1/2 lb | 5 po |

### 7.7 Visión y óptica

| Objeto | Efecto mecánico | Peso | Precio |
|--------|----------------|------|--------|
| Spyglass (Catalejo) | ×2 zoom visual; ventaja en Perception (vista) a distancia | 1 lb | 1.000 po |
| Magnifying Glass (Lupa) | Ventaja en Arcana/Investigation examinando detalles pequeños | — | 100 po |

### 7.8 Miscelánea

| Objeto | Notas | Peso | Precio |
|--------|-------|------|--------|
| Abacus (Ábaco) | Historia/Investigation sobre cálculos matemáticos | 2 lb | 2 po |
| Alms Box (Caja de limosna) | Narrativo | 1 lb | — |
| Amulet (Amuleto) | Foco sagrado si es un símbolo de deidad | 1 lb | 5 po |
| Antitoxin (Antitoxina) | +ventaja en salvaciones vs. veneno durante 1 hora | — | 50 po |
| Ball Bearings (Canicas, 1000) | Esparcir: CD 10 Acrobacias para cruzar sin caer | 2 lb | 1 po |
| Caltrops (Abrojos, bolsa 20) | Esparcir (10 ft²): primer movimiento en la zona → 1 daño perforante + velocidad -10 ft hasta curar | 2 lb | 1 po |
| Chalk (Tiza, 1 pieza) | Marcar superficies | — | 1 pc |
| Clothes, Common (Ropa común) | No otorga protección | 3 lb | 5 pa |
| Clothes, Costume (Ropa de disfraz) | Performance / Deception con disfraz | 4 lb | 5 po |
| Clothes, Fine (Ropa fina) | Persuasión en contextos nobles | 6 lb | 15 po |
| Clothes, Traveler's (Ropa de viaje) | Resistencia al clima | 4 lb | 2 po |
| Crowbar (Palanca) | Ventaja en FUE para apalancar | 5 lb | 2 po |
| Holy Water (Agua bendita, frasco) | 2d6 daño radiante a muertos vivientes y fiends al tirarla | 1 lb | 25 po |
| Lock (Cerradura) | CD 15 para abrir con herramientas de ladrón | 1 lb | 10 po |
| Perfume (Perfume, frasco) | Social / narrativo | — | 5 po |
| Poison, Basic (Veneno básico, frasco) | Aplicar a arma/munición; 1d4 daño veneno + CD 10 CON o envenenado 1 hora | — | 100 po |
| Sand (Arena, bolsa) | Lanzar a ojos: cegar 1 turno (CD 10 CON) | — | — |
| Soap (Jabón) | Narrativo | — | 2 pc |
| Spike, Iron (Pica de hierro) | Asegurar puertas, anclar cuerdas | 1/2 lb | 1 pa |

---

## 8. Packs de aventurero

Los packs son conjuntos de equipo predefinidos que se pueden tomar como equipo de clase en la creación de personaje.

| Pack | Contenido | Precio total |
|------|-----------|-------------|
| **Burglar's Pack** | Mochila, 1000 canicas, 10 ft hilo, campanilla, 5 velas, palanca, martillo, 10 piquetas, linterna bullseye, 2 frascos aceite, 5 días raciones, caja de yesca, odre, 50 ft cuerda de seda | 16 po |
| **Diplomat's Pack** | Cofre, 2 cajas para cartas de presentación, ropa fina, frasco tinta, pluma, lámpara, 2 frascos aceite, 5 hojas papel, frasco perfume, lacre, jabón | 39 po |
| **Dungeoneer's Pack** | Mochila, palanca, martillo, 10 piquetas, caja de yesca, linterna, 2 frascos aceite, 5 días raciones, odre, 50 ft cuerda cáñamo | 12 po |
| **Entertainer's Pack** | Mochila, kit de cama rodante, 5 velas, 5 días raciones, odre, kit de disfraz | 40 po |
| **Explorer's Pack** | Mochila, kit de cama rodante, cantimplora (=odre), 10 antorchas, caja de yesca, 10 días raciones, 50 ft cuerda cáñamo, ropa de viaje | 10 po |
| **Priest's Pack** | Mochila, manta, 10 velas, caja de yesca, caja de limosna, 2 bloques incienso, vestiduras, 2 días raciones, odre | 19 po |
| **Scholar's Pack** | Mochila, libro de lore, frasco tinta, pluma, 10 hojas pergamino, bolsita arena, cuchillo pequeño | 40 po |

---

## 9. Consumibles

Los consumibles se gastan al usarlos. Son objetos con un número limitado de usos (normalmente 1).

### 9.1 Pociones

Las pociones son líquidos mágicos. Tomarlas o administrarlas cuesta **1 acción**. Salvo indicación contraria, cada poción es de un solo uso.

#### Pociones de curación

| Nombre | PG restaurados | Rareza | Precio estimado |
|--------|---------------|--------|----------------|
| Potion of Healing | 2d4 + 2 (promedio 7) | Common | 50 po |
| Potion of Greater Healing | 4d4 + 4 (promedio 14) | Uncommon | 150 po |
| Potion of Superior Healing | 8d4 + 8 (promedio 28) | Rare | 450 po |
| Potion of Supreme Healing | 10d4 + 20 (promedio 45) | Very Rare | 1.350 po |

> **Regla de acción:** Tomar **tu propia** poción cuesta 1 acción. Administrar una poción a **otra** criatura también cuesta 1 acción (requiere que la criatura esté a alcance).

#### Pociones de mejora de características

Cada poción otorga la puntuación indicada en esa característica durante 1 hora (si la del personaje es menor) o +2 (si ya es mayor o igual a la otorgada):

| Poción | Característica | Puntuación otorgada | Rareza | Precio estimado |
|--------|---------------|-------------------|--------|----------------|
| Potion of Hill Giant Strength | FUE | 21 | Uncommon | 200 po |
| Potion of Stone Giant Strength | FUE | 23 | Rare | 400 po |
| Potion of Frost Giant Strength | FUE | 23 | Rare | 400 po |
| Potion of Fire Giant Strength | FUE | 25 | Rare | 400 po |
| Potion of Cloud Giant Strength | FUE | 27 | Very Rare | 1.000 po |
| Potion of Storm Giant Strength | FUE | 29 | Legendary | 10.000 po |

#### Otras pociones notables

| Nombre | Efecto | Duración | Rareza | Precio estimado |
|--------|--------|----------|--------|----------------|
| Potion of Animal Friendship | Hechizo Animal Friendship (CD 13) | 1 hora | Uncommon | 100 po |
| Potion of Clairvoyance | Hechizo Clairvoyance | 10 minutos | Rare | 300 po |
| Potion of Climbing | +velocidad de escalar igual a velocidad de caminar; ventaja en Athletics (escalar) | 1 hora | Common | 75 po |
| Potion of Diminution | Reducción a tamaño Tiny (efecto Reduce) | 1d4 horas | Rare | 270 po |
| Potion of Flying | Velocidad de vuelo = velocidad de caminar | 1 hora | Very Rare | 500 po |
| Potion of Gaseous Form | Hechizo Gaseous Form | 1 hora | Rare | 300 po |
| Potion of Giant Size | Crecimiento a tamaño Huge; +2 dados de daño en armas | 24 horas | Legendary | 5.000 po |
| Potion of Growth | Ampliación a tamaño Large (efecto Enlarge) | 1d4 horas | Uncommon | 150 po |
| Potion of Heroism | +10 PG temporales; bajo efectos del hechizo Bless | 1 hora | Uncommon | 180 po |
| Potion of Invisibility | Hechizo Invisibility | 1 hora | Very Rare | 180 po |
| Potion of Mind Reading | Hechizo Detect Thoughts (CD 13) | 1 hora | Rare | 180 po |
| Potion of Poison | Apariencia idéntica a poción de curación; 3d6 veneno, CD 13 CON o envenenado 1 hora | Instantáneo | Uncommon | — (como trampa) |
| Potion of Resistance | Resistencia a un tipo de daño a elección | 1 hora | Uncommon | 300 po |
| Potion of Speed | Hechizo Haste | 1 minuto | Very Rare | 400 po |
| Potion of Vitality | Elimina enfermedades y venenos; 2d4+2 PG por hora durante 24 horas | 24 horas | Very Rare | 960 po |
| Potion of Water Breathing | Respirar bajo el agua | 1 hora | Uncommon | 180 po |

### 9.2 Pergaminos de hechizo (Spell Scrolls)

Un pergamino de hechizo contiene un hechizo escrito. Se destruye al usarse.

**Reglas de uso:**
- El hechizo del pergamino debe estar en la lista de hechizos del personaje (o en la lista de su clase)
- Si el nivel del pergamino es mayor que el nivel más alto que el personaje puede lanzar: tirada de INT CD 10 + nivel del hechizo; fallo = el pergamino se destruye sin efecto
- Un Mago puede copiar el hechizo de un pergamino a su grimorio (50 po + 2 h por nivel del hechizo); el pergamino se destruye
- La CD del hechizo y el bonus de ataque son fijos según la tabla de rareza del pergamino

| Nivel hechizo | Rareza | CD de salvación | Bonus ataque hechizo | Precio estimado |
|--------------|--------|----------------|---------------------|----------------|
| Truco (0) | Common | 13 | +5 | 25 po |
| Nivel 1 | Common | 13 | +5 | 75 po |
| Nivel 2 | Uncommon | 13 | +5 | 150 po |
| Nivel 3 | Uncommon | 15 | +7 | 300 po |
| Nivel 4 | Rare | 15 | +7 | 500 po |
| Nivel 5 | Rare | 17 | +9 | 1.000 po |
| Nivel 6 | Very Rare | 17 | +9 | 2.000 po |
| Nivel 7 | Very Rare | 18 | +10 | 4.000 po |
| Nivel 8 | Very Rare | 18 | +10 | 8.000 po |
| Nivel 9 | Legendary | 19 | +11 | 20.000 po |

### 9.3 Venenos

Los venenos son sustancias que dañan o incapacitan. Son ilegales en muchas ciudades.

**Método de aplicación:**
- `Contact` (contacto): tocar con piel desnuda
- `Ingested` (ingerido): añadir a comida/bebida
- `Inhaled` (inhalado): crear nube, inhalar involuntariamente
- `Injury` (herida): aplicar a arma o munición; activa al dañar

| Veneno | Método | Efecto | CD | Precio |
|--------|--------|--------|-----|--------|
| Assassin's Blood | Ingerido | 1d12 veneno; envenenado 24 h si falla | CON 10 | 150 po |
| Burnt Othur Fumes | Inhalado | 0 o 3d6 veneno; 1d6 veneno/turno | CON 13 | 500 po |
| Crawler Mucus | Contacto | Envenenado, paralizado 1 min | CON 13 | 200 po |
| Drow Poison | Herida | Inconsciente 1 hora | CON 13 | 200 po |
| Essence of Ether | Inhalado | Inconsciente 8 horas | CON 15 | 300 po |
| Malice | Inhalado | Cegado 1 hora | CON 15 | 250 po |
| Midnight Tears | Ingerido | Nada hasta medianoche; 9d6 veneno | CON 17 | 1.500 po |
| Oil of Taggit | Contacto | Inconsciente 24 horas | CON 13 | 400 po |
| Pale Tincture | Ingerido | 3d6 veneno/día durante 10 días | CON 16 | 250 po |
| Purple Worm Poison | Herida | 12d6 veneno | CON 19 | 2.000 po |
| Serpent Venom | Herida | 3d6 veneno | CON 11 | 200 po |
| Torpor | Ingerido | Ralentizado 4d6 horas | CON 15 | 600 po |
| Truth Serum | Ingerido | No puede mentir intencionalmente 1 hora | CON 11 | 150 po |
| Wyvern Poison | Herida | 7d6 veneno | CON 15 | 1.200 po |
| Basic Poison | Herida | 1d4 veneno; envenenado 1 hora | CON 10 | 100 po |

### 9.4 Alimentos y raciones

| Objeto | Duración | Peso | Precio | Notas |
|--------|----------|------|--------|-------|
| Rations (Raciones, 1 día) | 1 persona 1 día | 2 lb | 5 pa | Alimento y agua para 1 día |
| Rations, Elven (Raciones élficas) | 1 persona 1 día | 1/4 lb | 5 po | No se echan a perder (Lembas) |
| Ale (Cerveza, galón) | — | 8 lb | 2 pa | Narrativo |
| Ale (Cerveza, jarra) | — | — | 4 pc | |
| Banquet (Banquete, por persona) | — | — | 10 po | |
| Bread (Pan, hogaza) | — | — | 2 pc | |
| Cheese (Queso, trozo) | — | — | 1 pa | |
| Inn meal (Comida de posada) | — | — | 3 pa–5 pa | |
| Meat (Carne, trozo) | — | — | 3 pa | |
| Wine (Vino, botella común) | — | — | 2 pa | |
| Wine (Vino, botella fino) | — | — | 10 po | |

### 9.5 Miscelánea consumible

| Objeto | Efecto | Usos | Precio |
|--------|--------|------|--------|
| Acid (Ácido, frasco) | 2d6 daño ácido al lanzar (acción, criatura u objeto a 5 ft) | 1 | 25 po |
| Alchemist's Fire | 1d4 fuego/turno hasta apagarlo (acción CD 10 DES) | 1 | 50 po |
| Healer's Kit (Componentes) | 10 usos; estabilizar sin tirada; restaurar 1d6+4 PG (+BPC usos) si tiene competencia | 10 | 5 po |
| Holy Water | 2d6 daño radiante a undead/fiends (lanzar como ataque de área a 5 ft) | 1 | 25 po |
| Smokestick (Barra de humo) | Nube de humo 10 ft radio, 1 minuto (oscurece visión) | 1 | 10 po |
| Tanglefoot Bag | Objetivo CD 15 FUE o velocidad 0 hasta superar la tirada | 1 | 50 po |
| Thunderstone | Criatura en 10 ft: CD 15 CON o ensordecer 1 hora | 1 | 30 po |
| Tindertwig (Cerilla) | Encender en 1 acción | 1 | 1 pa |

---

## 10. Vehículos y monturas

### 10.1 Monturas terrestres

| Montura | Velocidad | Capacidad de carga | Precio | PG | CA | Notas |
|---------|-----------|-------------------|--------|-----|-----|-------|
| Camel (Camello) | 50 ft | 480 lb | 50 po | 15 | 9 | Desierto; sin agua 8 días |
| Donkey / Mule (Burro/Mulo) | 40 ft | 420 lb | 8 po | 11 | 10 | Carga pesada, terreno difícil |
| Elephant (Elefante) | 40 ft | 1320 lb | 200 po | 76 | 12 | |
| Draft Horse (Caballo de tiro) | 40 ft | 540 lb | 50 po | 19 | 10 | |
| Riding Horse (Caballo de monta) | 60 ft | 480 lb | 75 po | 13 | 10 | |
| Warhorse (Caballo de guerra) | 60 ft | 540 lb | 400 po | 19 | 11 | Entrenado para combate |
| Mastiff (Mastín) | 40 ft | 195 lb | 25 po | 5 | 12 | |
| Pony (Poni) | 40 ft | 225 lb | 30 po | 11 | 10 | |

### 10.2 Equipo de montura

| Objeto | Peso | Precio | Notas |
|--------|------|--------|-------|
| Bit and Bridle (Bocado y brida) | 1 lb | 2 po | Necesario para montar |
| Saddle, Exotic (Silla exótica) | 40 lb | 60 po | Para grifos, pegasos, etc. |
| Saddle, Military (Silla militar) | 30 lb | 20 po | Ventaja vs. ser desmontado |
| Saddle, Pack (Silla de carga) | 15 lb | 5 po | Para transporte de mercancías |
| Saddle, Riding (Silla de monta) | 25 lb | 10 po | Montura estándar |
| Saddlebags (Alforjas) | 8 lb | 4 po | +20 lb capacidad de transporte |
| Feed, per day (Forraje, por día) | 10 lb | 5 pc | Alimentar 1 montura |
| Stabling, per day (Establo, por día) | — | 5 pa | Alojamiento para 1 montura |

### 10.3 Vehículos terrestres

| Vehículo | Velocidad | Capacidad | Tripulación | Precio |
|----------|-----------|-----------|-------------|--------|
| Carriage (Carruaje) | Según caballos | 2.700 lb | 1 cochero | 100 po |
| Cart (Carreta) | Según caballos | 200 lb | 1 | 15 po |
| Chariot (Carro de guerra) | Según caballos | 100 lb | 1 | 250 po |
| Wagon (Vagón) | Según caballos | 4.000 lb | 1 | 35 po |

### 10.4 Embarcaciones

| Embarcación | Velocidad | PG | CA | Tripulación mín. | Pasajeros | Carga (ton.) | Precio |
|-------------|-----------|-----|-----|-----------------|-----------|-------------|--------|
| Canoe (Canoa) | 1.5 mph | 50 | 11 | 1 | 6 | — | 50 po |
| Galley (Galera) | 4 mph | 500 | 15 | 80 | — | 150 | 30.000 po |
| Keelboat | 1 mph (vela: 3 mph) | 100 | 15 | 1 | 6 | 1/2 | 3.000 po |
| Longship | 3 mph (vela: 7 mph) | 300 | 15 | 40 | 150 | 10 | 10.000 po |
| Rowboat (Bote de remos) | 1.5 mph | 50 | 11 | 1 | 3 | — | 50 po |
| Sailing Ship | 2 mph (vela: 7 mph) | 300 | 15 | 20 | 20 | 100 | 10.000 po |
| Warship (Barco de guerra) | 2.5 mph (vela: 7 mph) | 500 | 15 | 60 | 60 | 200 | 25.000 po |

---

## 11. Objetos mágicos

### 11.1 Rareza y poder

| Rareza | Nivel del personaje típico | Precio de mercado estimado |
|--------|--------------------------|--------------------------|
| Common | 1–4 | 50–100 po |
| Uncommon | 1–4 | 101–500 po |
| Rare | 5–10 | 501–5.000 po |
| Very Rare | 11–16 | 5.001–50.000 po |
| Legendary | 17–20 | 50.001+ po |
| Artifact | Cualquier nivel | Único / inapreciable |

### 11.2 Objetos maravillosos (Wondrous Items)

Son objetos mágicos que no son armas, armaduras ni anillos. Se equipan en slots específicos del cuerpo.

#### Capas y mantos

| Nombre | Slot | Efecto | Req. atunamiento | Rareza |
|--------|------|--------|-----------------|--------|
| Cloak of Displacement | `cloak` | Desventaja en ataques contra el portador hasta recibir daño en ese turno | **Sí** | Rare |
| Cloak of Elvenkind | `cloak` | Desventaja en Perception vs. el portador; ventaja en Stealth | **Sí** | Uncommon |
| Cloak of Protection | `cloak` o `neck` | +1 CA y +1 a todas las salvaciones | **Sí** | Uncommon |
| Cloak of the Bat | `cloak` | Vuelo 40 ft (en oscuridad), transformación en murciélago | **Sí** | Rare |
| Mantle of Spell Resistance | `cloak` | Ventaja en salvaciones vs. hechizos | **Sí** | Rare |

#### Botas

| Nombre | Slot | Efecto | Req. atunamiento | Rareza |
|--------|------|--------|-----------------|--------|
| Boots of Elvenkind | `feet` | Sin sonido al moverse; ventaja en Stealth | No | Uncommon |
| Boots of Speed | `feet` | 1×/día doblar velocidad, desventaja en ataques contra portador | **Sí** | Rare |
| Boots of Striding and Springing | `feet` | Velocidad mínima 30 ft, saltar tres veces más lejos | **Sí** | Uncommon |
| Boots of the Winterlands | `feet` | Resistencia al frío; caminar sobre hielo/nieve sin penalización | **Sí** | Uncommon |
| Winged Boots | `feet` | Vuelo 30 ft (hasta 4 horas, recarga descanso largo) | **Sí** | Uncommon |

#### Guantes y manoplas

| Nombre | Slot | Efecto | Req. atunamiento | Rareza |
|--------|------|--------|-----------------|--------|
| Gauntlets of Ogre Power | `hands` | FUE = 19 (si ya es mayor, no aplica) | **Sí** | Uncommon |
| Gloves of Missile Snaring | `hands` | Reacción para agarrar proyectil: reduce daño 1d10 + mod. DES | **Sí** | Uncommon |
| Gloves of Swimming and Climbing | `hands` | Vel. nado y escala = vel. caminar, sin desventaja en Athletics | **Sí** | Uncommon |
| Gloves of Thievery | `hands` | +5 a Sleight of Hand y a abrir cerraduras | No | Uncommon |

#### Cinturones

| Nombre | Slot | Efecto | Req. atunamiento | Rareza |
|--------|------|--------|-----------------|--------|
| Belt of Dwarvenkind | `waist` | +2 CON, ventaja en CAR (Persuasión con enanos), barba | **Sí** | Rare |
| Belt of Giant Strength (Hill) | `waist` | FUE = 21 | **Sí** | Uncommon |
| Belt of Giant Strength (Stone/Frost) | `waist` | FUE = 23 | **Sí** | Rare |
| Belt of Giant Strength (Fire) | `waist` | FUE = 25 | **Sí** | Rare |
| Belt of Giant Strength (Cloud) | `waist` | FUE = 27 | **Sí** | Very Rare |
| Belt of Giant Strength (Storm) | `waist` | FUE = 29 | **Sí** | Legendary |

#### Cabeza

| Nombre | Slot | Efecto | Req. atunamiento | Rareza |
|--------|------|--------|-----------------|--------|
| Helm of Brilliance | `head` | Resistencias al fuego; hechizos de luz solar; 100 gemas recargables | **Sí** | Very Rare |
| Helm of Comprehending Languages | `head` | Hechizo Comprehend Languages a voluntad | No | Uncommon |
| Helm of Telepathy | `head` | Detect Thoughts a voluntad; telepathy 30 ft con objetivo | **Sí** | Uncommon |
| Helm of Teleportation | `head` | 3 cargas; Teleport; recarga amanecer | **Sí** | Rare |
| Hat of Disguise | `head` | Disguise Self a voluntad | **Sí** | Uncommon |
| Circlet of Blasting | `head` | 1×/día Scorching Ray como ataque de hechizo | No | Uncommon |

#### Anillos

Máximo 2 anillos equipados simultáneamente (1 por mano).

| Nombre | Efecto | Req. atunamiento | Rareza |
|--------|--------|-----------------|--------|
| Ring of Protection | +1 CA y +1 a todas las salvaciones | **Sí** | Rare |
| Ring of Resistance | Resistencia a un tipo de daño (indicado en el anillo) | **Sí** | Rare |
| Ring of Spell Storing | Almacena hasta 5 niveles de hechizos; quien lleva puede lanzarlos | **Sí** | Rare |
| Ring of Spell Turning | Ventaja en salvaciones vs. hechizos; reflexión de hechizos de nivel 1–7 | **Sí** | Legendary |
| Ring of Swimming | Vel. nado 40 ft | No | Uncommon |
| Ring of Feather Falling | Cae a 60 ft/turno; no sufre daño por caída | **Sí** | Rare |
| Ring of Invisibility | Invisible mientras se lleve puesto y no se ataque ni lance hechizos | **Sí** | Legendary |
| Ring of Regeneration | Regenera 1d6 PG cada 10 minutos; miembros perdidos crecen en 1d6+1 días | **Sí** | Very Rare |
| Ring of Telekinesis | Telekinesis a voluntad | **Sí** | Very Rare |
| Ring of Three Wishes | Contiene 3 deseos (hechizo Wish); se vuelve mundano | No | Legendary |
| Ring of Mind Shielding | Immune a detect thoughts; alma atrapada en el anillo al morir | **Sí** | Uncommon |
| Ring of X-Ray Vision | Acción: ver a través de hasta 1 ft de piedra/metal, 1 ft madera/suciedad, 3 ft de los demás | **Sí** | Rare |

#### Bastones, básculos y varitas

| Nombre | Tipo | Cargas | Efecto | Req. atunamiento | Rareza |
|--------|------|--------|--------|-----------------|--------|
| Staff of Power | Bastón | 20 | Múltiples hechizos, +2 ataque/daño/CA/salvaciones, golpe de poder | **Sí** (lanzador) | Very Rare |
| Staff of the Magi | Bastón | 50 | Hechizos máximos, absorber hechizos, ruptura catastrófica | **Sí** (lanzador) | Legendary |
| Staff of Fire | Bastón | 10 | Burning Hands, Fireball, Wall of Fire | **Sí** (druida/hechicero/mago) | Very Rare |
| Staff of Frost | Bastón | 10 | Cone of Cold, Fog Cloud, Ice Storm, Wall of Ice | **Sí** (druida/hechicero/mago) | Very Rare |
| Staff of Healing | Bastón | 10 | Cure Wounds, Lesser Restoration, Mass Cure Wounds | **Sí** (bardo/clérigo/druida) | Rare |
| Staff of Swarming Insects | Bastón | 10 | Giant Insect, Insect Plague | **Sí** (bardo/clérigo/druida) | Rare |
| Wand of Fireballs | Varita | 7 | Fireball (nivel 3) | **Sí** (lanzador) | Rare |
| Wand of Magic Missiles | Varita | 7 | Magic Missile (1–3 niveles) | No | Uncommon |
| Wand of Paralysis | Varita | 7 | Paralizar criatura CD 15 CON | **Sí** (lanzador) | Rare |
| Wand of Polymorph | Varita | 7 | Polymorph CD 15 SAB | **Sí** (lanzador) | Very Rare |
| Wand of Web | Varita | 7 | Web CD 15 DES | **Sí** (lanzador FUE/DES) | Uncommon |
| Wand of Wonder | Varita | 7 | Efecto aleatorio de tabla d100 | **Sí** (lanzador) | Rare |
| Rod of Absorption | Vara | — | Absorber ranuras de hechizos; máx 50 niveles | **Sí** | Very Rare |
| Rod of Lordly Might | Vara | 6 | Arma +3; 6 funciones únicas (estandarte, hacha, etc.) | **Sí** | Legendary |

### 11.3 Objetos que modifican puntuaciones de características

Estos objetos son mecánicamente especiales porque sobreescriben o añaden a las características directamente:

| Objeto | Característica | Efecto | Req. atunamiento | Rareza |
|--------|---------------|--------|-----------------|--------|
| Gauntlets of Ogre Power | FUE | Fija FUE en 19 (si es menor) | **Sí** | Uncommon |
| Belt of Giant Strength (varios) | FUE | Fija FUE en 21/23/25/27/29 | **Sí** | Uncommon–Legendary |
| Headband of Intellect | INT | Fija INT en 19 (si es menor) | **Sí** | Uncommon |
| Amulet of Health | CON | Fija CON en 19 (si es menor) | **Sí** | Rare |
| Gloves of Dexterity | DES | Fija DES en 20 (si es menor) | **Sí** | Uncommon |
| Ioun Stone of Fortitude | CON | +2 CON (máx 20) | **Sí** | Very Rare |
| Ioun Stone of Intellect | INT | +2 INT (máx 20) | **Sí** | Very Rare |
| Ioun Stone of Insight | SAB | +2 SAB (máx 20) | **Sí** | Very Rare |
| Ioun Stone of Leadership | CAR | +2 CAR (máx 20) | **Sí** | Very Rare |
| Ioun Stone of Strength | FUE | +2 FUE (máx 20) | **Sí** | Very Rare |
| Ioun Stone of Agility | DES | +2 DES (máx 20) | **Sí** | Very Rare |
| Manual of Gainful Exercise | FUE | +2 FUE máx permanente | No | Very Rare |
| Manual of Quickness of Action | DES | +2 DES máx permanente | No | Very Rare |
| Manual of Bodily Health | CON | +2 CON máx permanente | No | Very Rare |
| Tome of Clear Thought | INT | +2 INT máx permanente | No | Very Rare |
| Tome of Leadership and Influence | CAR | +2 CAR máx permanente | No | Very Rare |
| Tome of Understanding | SAB | +2 SAB máx permanente | No | Very Rare |

> **Regla de "fija en X":** Si la puntuación actual del personaje ya es mayor que el valor del objeto, el objeto no tiene efecto sobre esa característica. Por ejemplo, un personaje con FUE 21 que equipa Gauntlets of Ogre Power (FUE 19) no ve cambio alguno.

---

## 12. Efectos mecánicos sobre el personaje

Esta sección resume cómo cada tipo de objeto afecta los parámetros del personaje. Es el núcleo de la lógica de la app.

### 12.1 Mapa de efectos por tipo de objeto

```
Armadura equipada en slot `body`:
  → recalcular CA según tipo de armadura y mod. DES del personaje
  → activar/desactivar desventaja en Stealth
  → verificar req. FUE mínima → ajustar velocidad si no se cumple

Escudo equipado en slot `off_hand`:
  → CA += 2
  → bloquea uso de arma a 2 manos en `main_hand`

Arma equipada en slot `main_hand`:
  → establece dados de daño disponibles
  → determina si el ataque usa FUE, DES o ambos (Finesse)
  → si Two-Handed → bloquea slot `off_hand`

Arma equipada en slot `off_hand` (solo si es Light):
  → permite Two-Weapon Fighting (ataque bonus por acción bonus)
  → daño del arma secundaria NO añade modificador de característica (salvo rasgo Fighting Style: Two-Weapon Fighting)

Objeto mágico de característica (ej. Gauntlets of Ogre Power):
  → sobreescribe o suma la puntuación de característica afectada
  → recalcula el modificador de esa característica
  → recalcula TODOS los parámetros derivados de esa característica:
    - FUE: bonificador de ataque/daño CaC, Athletics, capacidad de carga
    - DES: CA (si armadura ligera/sin armadura), iniciativa, Acrobatics, Stealth, Sleight of Hand
    - CON: PG máximos (retroactivamente), salvación CON
    - INT: CD hechizos (si aplica), Arcana/History/Investigation/Nature/Religion
    - SAB: CD hechizos (si aplica), percepción pasiva, Insight/Medicine/Perception/Survival
    - CAR: CD hechizos (si aplica), Deception/Intimidation/Performance/Persuasion

Objeto mágico de +X a CA (Cloak of Protection, Ring of Protection):
  → CA += X  (se acumula con armadura; no se acumula con otro objeto de mismo tipo si la regla es "no acumulación")

Objeto mágico de +X a salvaciones (Cloak of Protection, Ring of Protection):
  → todas las tiradas de salvación += X
```

### 12.2 Reglas de acumulación (Stacking)

Regla general: los **bonus de mismo tipo no se acumulan**. En D&D 5e los tipos de bonus más comunes son:

| Tipo de bonus | Se acumula | Ejemplo |
|--------------|-----------|---------|
| Bonus genérico (sin nombre) | **Sí** entre sí | +1 CA de escudo + +1 CA de Cloak of Protection = +2 total |
| Bonus de característica | No (sobreescribe) | Gauntlets of Ogre Power (FUE 19) + Belt of Giant Strength (FUE 21) → solo aplica el mayor |
| Ventaja/Desventaja | No se acumulan | 3 fuentes de ventaja sigue siendo 1 ventaja; 1 ventaja + 1 desventaja = tirada normal |
| Bonus de BPC (Proficiency) | No duplicable en misma habilidad | No puede tener BPC×3 en una habilidad |
| Concentración | Solo 1 hechizo | No puede concentrarse en dos hechizos simultáneamente |

### 12.3 Recálculo en cadena al equipar/desequipar

Cuando el personaje equipa o desequipa un objeto, la app debe recalcular en este orden:

```
1. Actualizar puntuaciones de características (si el objeto modifica alguna)
2. Recalcular modificadores de características afectadas
3. Recalcular CA (depende de armadura equipada y mod. DES)
4. Recalcular PG máximos (si cambió CON)
5. Recalcular iniciativa (si cambió DES)
6. Recalcular salvaciones afectadas
7. Recalcular habilidades afectadas
8. Recalcular CD de hechizos (si cambió la característica mágica)
9. Recalcular bonificadores de ataque (si cambió FUE o DES)
10. Actualizar restricciones de slots (Two-Handed, escudo, etc.)
11. Activar/desactivar penalizaciones (desventaja Stealth, -velocidad por FUE)
```

---

## 13. Capacidad de carga y encumbramiento

### 13.1 Sistema estándar

```
Carga máxima (Encumbered limit) = STR × 15 lb
Push / Drag / Lift máximo       = STR × 30 lb
```

### 13.2 Sistema de encumbramiento opcional (Variant: Encumbrance)

Más detallado; penaliza a partir de cierto umbral:

| Umbral | Condición | Penalización |
|--------|-----------|-------------|
| ≤ STR × 5 lb | Sin carga significativa | Ninguna |
| STR × 5 + 1 a STR × 10 lb | Encumbered (Cargado) | −10 ft velocidad |
| STR × 10 + 1 a STR × 15 lb | Heavily Encumbered (Muy cargado) | −20 ft velocidad, desventaja en tiradas DES/FUE/CON y salvaciones DES/FUE/CON |
| > STR × 15 lb | Sobre el límite | No puede moverse |

### 13.3 Peso de monedas

```
50 monedas = 1 lb  →  1 moneda = 0.02 lb

Para calcular el peso total de monedas:
  peso_monedas = (pp + po + pe + pa + pc) / 50  lb
```

### 13.4 Objetos sin peso

Por convención del sistema, estos objetos no tienen peso mecánico:
- Pergaminos (< 0.1 lb, se ignoran)
- Componentes de hechizos sin precio (se asume en bolsa de componentes)
- Ropa que se lleva puesta (ya incluida en el peso base del personaje)

---

## 14. Comercio y precios

### 14.1 Modificadores de precio en tienda

Los precios del PHB son el **precio base de referencia**. En la práctica:

| Situación | Multiplicador sobre precio base |
|-----------|--------------------------------|
| Ciudad grande, tienda normal | × 1.0 (precio base) |
| Pueblo pequeño (oferta limitada) | × 1.5 – × 2.0 |
| Aventurero comprando en mercado negro | × 2.0 – × 5.0 |
| Vender equipo usado a mercader | × 0.5 (mitad del precio base) |
| Vender equipo usado a otro aventurero | × 0.75 – × 1.0 |
| Objeto mágico (muy variable) | Sin precio estándar — trato directo |
| Regateo con Persuasión o Deception | −10% a −25% a criterio del DM |

### 14.2 Servicios comunes

| Servicio | Precio |
|----------|--------|
| Alojamiento modesto, por noche | 5 pa |
| Alojamiento cómodo, por noche | 1 po |
| Alojamiento lujoso, por noche | 4 po |
| Comida modesta | 1 pa |
| Comida cómoda | 5 pa |
| Comida lujosa | 3 po |
| Mensajero (en ciudad) | 2 pc |
| Mensajero (entre ciudades, por milla) | 1 pa |
| Transporte en barco (por milla) | 1 pa |
| Transporte en barca fluvial (por milla) | 1 pc |
| Transporte en carruaje (por milla) | 3 pc |
| Curandero (1 poción de curación) | 50 po |
| Herrero (reparar armadura, por día) | 1 po |
| Escriba (por página) | 1 pa |
| Intérprete (por día) | 1 po |
| Guardaespaldas no cualificado (por día) | 5 pa |
| Soldado contratado (por día) | 2 po |

### 14.3 Salarios de referencia (contexto económico)

| Ocupación | Salario diario |
|-----------|---------------|
| Campesino / peón | 2 pc |
| Artesano no cualificado | 2 pa |
| Artesano cualificado | 2 po |
| Mercader próspero | 5 po |
| Aventurero nivel 1–4 (pago por misión típico) | 10–50 po |
| Aventurero nivel 5–10 | 50–500 po |
| Aventurero nivel 11+ | 500–5.000 po |

---

## 15. Modelo de datos sugerido

```typescript
// ── Moneda ─────────────────────────────────────────────────────────────
interface Currency {
  pp: number;   // platinum pieces
  gp: number;   // gold pieces
  ep: number;   // electrum pieces (opcional)
  sp: number;   // silver pieces
  cp: number;   // copper pieces
  // Helpers
  totalInCP(): number;  // pp×1000 + gp×100 + ep×50 + sp×10 + cp
}

// ── Objeto base ────────────────────────────────────────────────────────
interface Item {
  id: string;
  name: string;
  name_en: string;
  category: ItemCategory;
  subcategory: string;
  weight: number;               // en libras; 0 si no tiene peso
  cost_cp: number;              // precio en piezas de cobre
  description: string;
  magical: boolean;
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';
  requires_attunement: boolean;
  attunement_requirements?: string;
  stackable: boolean;
  quantity: number;
  equipped_slot?: EquipmentSlot | null;
  source: string;               // "PHB", "DMG", etc.
}

// ── Armadura ───────────────────────────────────────────────────────────
interface ArmorItem extends Item {
  armor_type: 'light' | 'medium' | 'heavy' | 'shield';
  base_ac: number;
  dex_bonus_type: 'full' | 'max2' | 'none';
  min_strength: number;         // 0 si no requiere
  stealth_disadvantage: boolean;
  ac_bonus?: number;            // para armaduras mágicas +X
}

// ── Arma ───────────────────────────────────────────────────────────────
interface WeaponItem extends Item {
  weapon_type: 'simple_melee' | 'simple_ranged' | 'martial_melee' | 'martial_ranged';
  damage_dice: string;          // ej: "1d8", "2d6"
  damage_type: 'bludgeoning' | 'piercing' | 'slashing';
  damage_dice_versatile?: string; // ej: "1d10" si es Versatile
  range_normal?: number;        // pies, solo para ranged
  range_long?: number;          // pies, solo para ranged
  properties: WeaponProperty[]; // ['finesse', 'light', 'thrown', ...]
  attack_bonus?: number;        // para armas mágicas +X
  damage_bonus?: number;        // para armas mágicas +X
  thrown_range_normal?: number;
  thrown_range_long?: number;
}

// ── Herramienta ────────────────────────────────────────────────────────
interface ToolItem extends Item {
  tool_type: 'artisan' | 'musical' | 'gaming' | 'specialist';
  primary_ability: AbilityKey;  // la característica principal que usa
  skill_bonuses?: SkillBonus[]; // habilidades específicas que mejora
}

// ── Consumible ─────────────────────────────────────────────────────────
interface ConsumableItem extends Item {
  consumable_type: 'potion' | 'scroll' | 'poison' | 'food' | 'ammunition' | 'other';
  uses: number;                 // cuántos usos quedan (normalmente 1)
  max_uses: number;
  effect: ItemEffect;           // ver abajo
  // Para pociones de curación
  healing_dice?: string;        // ej: "2d4+2"
  // Para pergaminos de hechizo
  spell_name?: string;
  spell_level?: number;
  spell_save_dc?: number;
  spell_attack_bonus?: number;
  // Para venenos
  poison_application?: 'contact' | 'ingested' | 'inhaled' | 'injury';
  poison_save_ability?: AbilityKey;
  poison_save_dc?: number;
}

// ── Efecto de objeto ────────────────────────────────────────────────────
interface ItemEffect {
  type: EffectType;
  // Bonus a parámetros del personaje
  ac_bonus?: number;
  saving_throw_bonus?: number;
  skill_bonus?: { skill: SkillKey; bonus: number }[];
  ability_score_set?: { ability: AbilityKey; value: number };   // fija en X si es menor
  ability_score_bonus?: { ability: AbilityKey; bonus: number }; // suma +X
  max_hp_bonus?: number;
  speed_bonus?: number;
  attack_bonus?: number;
  damage_bonus?: number;
  // Condiciones
  grants_advantage?: { on: string }[];
  grants_disadvantage?: { on: string }[];
  grants_resistance?: DamageType[];
  grants_immunity?: DamageType[];
  // Hechizos
  grants_spell?: { spell: string; uses_per_day: number; save_dc?: number }[];
  // Narrativo / especial
  special_description?: string;
  duration?: string;            // "1 hour", "until dawn", "permanent"
}

// ── Inventario del personaje ────────────────────────────────────────────
interface Inventory {
  items: Item[];
  equipped: {
    [slot in EquipmentSlot]?: Item | null;
  };
  currency: Currency;
  attuned_items: string[];      // array de item.id; máximo 3
  total_weight: number;         // calculado
  encumbrance_status: 'none' | 'encumbered' | 'heavily_encumbered' | 'over_limit';
}

// ── Slots de equipo ─────────────────────────────────────────────────────
type EquipmentSlot =
  | 'head' | 'neck' | 'body' | 'cloak'
  | 'hands' | 'ring_left' | 'ring_right'
  | 'waist' | 'feet'
  | 'main_hand' | 'off_hand'
  | 'back';

type ItemCategory =
  | 'armor' | 'weapon' | 'tool' | 'adventuring_gear'
  | 'consumable' | 'vehicle' | 'mount' | 'wondrous_item'
  | 'ring' | 'rod' | 'staff' | 'wand' | 'currency';

type WeaponProperty =
  | 'finesse' | 'versatile' | 'two_handed' | 'light'
  | 'thrown' | 'reach' | 'heavy' | 'loading'
  | 'ammunition' | 'special' | 'silvered';

type DamageType =
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force'
  | 'lightning' | 'necrotic' | 'piercing' | 'poison'
  | 'psychic' | 'radiant' | 'slashing' | 'thunder';

type AbilityKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
```

---

## 16. Validaciones y reglas de integridad

### Reglas absolutas (nunca deben violarse)

1. **Máximo 3 objetos afinados** simultáneamente. Si se intenta afinar un 4.º, se debe primero romper uno de los existentes.

2. **Slots únicos:** No puede haber dos objetos en el mismo slot corporal, excepto:
   - Hasta 2 anillos (ring_left + ring_right)
   - La bolsa/inventario (`carried`) no tiene límite de objetos, solo de peso

3. **Arma a 2 manos bloquea off_hand:** Si `main_hand` tiene un arma con propiedad `two_handed`, `off_hand` no puede tener nada.

4. **Escudo es incompatible con Two-Handed y arcos:** Si `off_hand` tiene un escudo, `main_hand` no puede tener arma `two_handed`, longbow, ni shortbow.

5. **Druida no usa metal:** Si la clase es Druida, las armaduras metálicas (cota de malla, cota de placas, armadura completa, cota tachonada, cota de escamas) y escudos metálicos no pueden equiparse. Mostrar advertencia clara, no bloquear silenciosamente.

6. **FUE mínima de armadura pesada:** Si FUE < min_strength del armor, velocidad -= 10 ft (nunca menor que 0).

7. **Desventaja en Stealth:** Si la armadura equipada tiene `stealth_disadvantage: true`, el personaje tiene desventaja en todas las tiradas de Stealth (Sigilo).

8. **No competencia en armadura:** Si el personaje no tiene competencia en el tipo de armadura equipada: desventaja en tiradas de Atletismo y Sigilo + no puede lanzar hechizos mientras la lleva.

9. **Objetos que fijan características:** Si un objeto fija una característica en X (ej. Gauntlets: FUE = 19), solo aplica si la puntuación actual es menor que X. Si el personaje ya tiene FUE 20, el objeto no hace nada al equiparlo. Al desequiparlo, la característica vuelve a su valor original.

10. **Cantidades no negativas:** El stock de munición, raciones y objetos apilables nunca puede ser < 0. Impedir el disparo si la munición llega a 0.

11. **Pociones y pergaminos se destruyen al usarlos:** La cantidad debe decrementarse en 1 (y eliminarse del inventario si quantity llega a 0).

12. **Veneno se aplica a arma, no al personaje:** El veneno modifica el arma, no se "equipa" en un slot corporal.

### Advertencias (no bloquean pero informan al usuario)

- Peso total > umbral de encumbramiento → mostrar estado de carga
- Peso total > FUE × 15 → mostrar "sobre el límite"
- Armor Class efectiva calculada con armadura de la que no tiene competencia → advertir
- Equipar objeto mágico sin reunir requisitos de atunamiento (ej. Holy Avenger requiere ser paladín) → advertir
- Llevar monedas que suman > 10 lb → sugerir banco o bolsa de monedas
- Arma Finesse en `main_hand` y escudo en `off_hand` → informar que se puede usar DES para el ataque

### Lógica de recálculo sugerida (pseudocódigo)

```
function onEquip(item, slot):
  validate(item, slot)  // ver reglas absolutas
  equipped[slot] = item
  if item.type == 'armor':
    recalculate_AC()
    recalculate_speed()       // por req. FUE
    update_stealth_penalty()
  if item.effect.ability_score_set:
    original = character.abilities[item.effect.ability_score_set.ability]
    if original.total < item.effect.ability_score_set.value:
      apply_override(ability, item.effect.ability_score_set.value)
      recalculate_all_derived_from(ability)
  if item.effect.ac_bonus:
    character.ac += item.effect.ac_bonus
  if item.effect.saving_throw_bonus:
    character.saving_throws.all += item.effect.saving_throw_bonus
  recalculate_total_weight()
  recalculate_encumbrance()

function onUnequip(item, slot):
  equipped[slot] = null
  reverse_all_effects(item)   // deshacer exactamente lo que aplicó onEquip
  recalculate_AC()
  recalculate_speed()
  update_stealth_penalty()
  recalculate_total_weight()
  recalculate_encumbrance()
```

---

*Documento generado para implementación técnica. Fuente principal: Player's Handbook D&D 5e (2014), Dungeon Master's Guide (2014), Xanathar's Guide to Everything (2017). Los precios de objetos mágicos son estimaciones del DMG Appendix A; en juego el DM tiene discreción total sobre disponibilidad y precio de objetos mágicos.*
