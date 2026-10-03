# HOI4 Mod Studio

App de escritorio (Windows) para crear **países**, editar el **mapa**, **árboles de focos** y **espíritus nacionales** de Hearts of Iron IV sin escribir código.

## Instalar (solo la primera vez)

1. Instala **Node.js LTS** desde https://nodejs.org (botón "LTS", siguiente → siguiente).
2. Instala **Git** desde https://git-scm.com.
3. Abre **PowerShell** y ejecuta:
   ```
   git clone https://github.com/Eduardo2345wet/hoiv.git
   cd hoiv
   git checkout claude/laughing-wozniak-v4q857
   npm install
   ```

No hace falta tener el juego instalado. No se necesitan compiladores: todo (incluido el escritor de .dds) está en TypeScript.

## Usar

| Comando | Qué hace |
|---|---|
| `npm run dev` | Abre la app en modo desarrollo (se recarga sola al cambiar código) |
| `npm test` | Ejecuta las pruebas automáticas |
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npm run build:win` | Crea el instalador `.exe` en la carpeta `dist/` |

## La ventana (como Siemens NX)

- **Cinta de opciones** arriba: menú **Archivo** (Nuevo proyecto Ctrl+N, Abrir Ctrl+O, Abrir
  reciente, Guardar Ctrl+S, Guardar como, Exportar mod, Propiedades del proyecto, Cerrar pestaña
  Ctrl+W, Ajustes, Salir) y las pestañas **Inicio · Mapa · Focos · Países · Espíritus · Íconos ·
  Exportar**, con sus herramientas en grupos (con el título abajo). Elegir una pestaña de la cinta
  también cambia la vista principal.
- **Sin proyecto abierto**: la cinta se ve completa pero en gris (menos Archivo) y el área de
  trabajo muestra solo la **página de inicio**: "Nuevo proyecto", "Abrir proyecto" y la lista de
  **Recientes** (nombre, plantilla, fecha y ruta). Ya no se pide nombre del mod ni tag al abrir.
- **Con proyecto**: a la izquierda el **Navegador del proyecto** (Países con su bandera, Árboles de
  focos, Espíritus, Íconos y, en la vista Mapa, la **Paleta**), a la derecha las propiedades (del
  estado o del foco) y abajo la **barra de estado** con la instrucción de la herramienta activa
  ("Haz clic en los estados para pintarlos con México"), la plantilla, el mapa (p. ej. "Mapa:
  HOI4 real"), el zoom y el motor.

### Proyectos en pestañas
Cada proyecto abierto es una **pestaña de documento** (nombre, ● si hay cambios sin guardar y una
X). **Ctrl+Tab / Ctrl+Shift+Tab** cambian de pestaña. Cada pestaña tiene su PROPIO estado
(proyecto, estados pintados, deshacer/rehacer, vista y zoom del mapa, selección y herramienta):
nada se comparte entre pestañas. Lo pesado sí se comparte: el mapa del juego (y sus fronteras
vectoriales), el catálogo y las banderas se cargan una sola vez. Al cerrar una pestaña con cambios
pregunta si guardar; al cerrar la app, una sola pregunta con la lista de pendientes. La app
recuerda las pestañas abiertas y las vuelve a abrir al iniciar.

### Nuevo proyecto y plantillas
**Archivo → Nuevo proyecto** abre las plantillas por categoría (con miniatura, descripción y vista
previa; abajo el nombre y la carpeta, por defecto `Documentos/HOI4 Mod Studio/Proyectos`):

| Categoría | Plantilla | Qué hace |
|---|---|---|
| Mapa | Lienzo en blanco | Los no pintados conservan su dueño al exportar |
| Mapa | Lienzo en blanco + Sin nación | Lo no pintado queda pendiente (país técnico) |
| Mapa | Mapa del juego | Todos los países con sus colores reales |
| Mapa | Mapa de un mod | Usa el mapa de otro mod instalado (dependencia) |
| Contenido | Mod sin mapa | Solo focos, países y espíritus |

Las miniaturas se dibujan con el mismo motor del mapa a partir de los datos reales (y se guardan
en caché). No se pide tag: los países se crean después ("País rápido" o el asistente) y al crear
el primer árbol de focos se pregunta a qué país pertenece. Se crea la carpeta con su
`proyecto.json` y se abre en una pestaña nueva.

### La plantilla es parte del proyecto
La plantilla se elige al crear el proyecto y queda fija (se ve en la barra de estado y en
Archivo → Propiedades del proyecto). Para otra plantilla: pestaña Mapa → **Nuevo proyecto con otra
plantilla…** (abre una pestaña NUEVA y nunca copia los estados pintados). La opción avanzada
**Reiniciar el mapa con otra plantilla** (Propiedades del proyecto) confirma ("Se borrarán N
estados pintados"), borra lo pintado y se puede deshacer.

> **Por qué antes se quedaba lo pintado:** el antiguo botón "Base del mapa" solo cambiaba
> `mapSettings` (base y mod) y dejaba `stateEdits` intacto; el propio diálogo decía "tus estados
> pintados se conservan". Así los estados pintados sobre un lienzo en blanco pasaban al mapa del
> juego y hasta se exportaban sin querer. Ahora la plantilla no se puede cambiar por esa vía.
> Los proyectos viejos toman como plantilla la base que tenían guardada y conservan todo lo pintado.

## Qué puedes hacer

- **Árbol de focos**: cuadrícula con zoom, arrastrar, prerrequisitos (línea normal) y excluyentes (línea roja).
- **Bloques** (estilo Scratch) con 3 ranuras: Requisitos, Saltar si y Recompensa.
- **Listas en vez de escribir IDs**: espíritus, focos, países y marcas se eligen de un menú.
  Al final del menú están "+ Crear nuevo…" y "Escribir otro ID…" (para cosas de otros mods o DLC).
- **🎯 Elegir en el árbol**: en "completó el foco", haz clic directamente en el foco.
- **Espíritus nacionales**: nombre, id automático, descripción, ícono y modificadores.
- **Íconos**: cada foco o espíritu nuevo recibe solo un ícono con emoji según su nombre
  ("Industrializar" → 🏭). Puedes cambiarlo por otro emoji, subir una imagen o usar uno del juego.
- **Países**: pestaña Países → "Crear país" abre un asistente de 6 pasos (identidad, política,
  capital, bandera, líder y resumen). Puedes crear un país **nuevo** o **modificar uno existente**.
- **Mapa**: pestaña Mapa tipo Paint para repartir estados entre países (pincel, cubeta,
  capital, cores, borrador, cuentagotas). Se ve como un mapa de IDs de estados: mar azul, tierra
  blanca, fronteras finas y nítidas, números y el nombre del país en su capital. Puedes
  **exportarlo como imagen PNG**. Sin el juego instalado usa un **mapa de demostración**.
- **Deshacer / Rehacer**: Ctrl+Z / Ctrl+Y (o Ctrl+Shift+Z) y los botones de la barra.
  Dentro del editor de bloques, Ctrl+Z deshace solo los bloques.
- **Ajustes (⚙)**: la carpeta del juego es OPCIONAL y se detecta sola si tienes HOI4 en Steam
  (registro de Windows, bibliotecas de Steam y rutas típicas); también puedes elegirla a mano. Solo se LEE: más países y espíritus, estados
  (nombre y dueño), subideologías, estilos gráficos y la historia de los países existentes.

> **Marca** = variable del script (`set_country_flag` / `has_country_flag`), no la bandera-imagen del país.

## Qué genera el mod

```
<mod>.mod                                    (fuera de la carpeta)
<mod>/descriptor.mod
<mod>/common/national_focus/TAG_focus.txt
<mod>/common/ideas/<mod>_ideas.txt           (si hay espíritus)
<mod>/gfx/interface/goals/<mod>_*.dds        (íconos de focos, 100×88)
<mod>/gfx/interface/ideas/<mod>_*.dds        (íconos de espíritus, 60×68)
<mod>/interface/<mod>_icons.gfx              (registra los sprites)
<mod>/interface/<mod>_goals_shine.gfx        (brillo "_shine" de cada ícono propio de foco)
<mod>/localisation/english/<mod>_l_english.yml  (UTF-8 con BOM)

Por cada país NUEVO:
<mod>/common/country_tags/01_<mod>_tags.txt
<mod>/common/countries/<Nombre>.txt
<mod>/history/countries/TAG - <Nombre>.txt
<mod>/history/units/TAG_1936.txt
<mod>/gfx/flags/TAG*.tga (+ medium/ y small/)   (15 banderas)
<mod>/gfx/leaders/TAG/<líder>.dds
<mod>/interface/<mod>_leaders.gfx
<mod>/common/characters/<mod>_TAG_characters.txt
<mod>/localisation/english/<mod>_countries_l_english.yml

Por cada estado que cambies en el mapa REAL (mismo nombre que en el juego, cambios mínimos):
<mod>/history/states/<archivo original>.txt
(con Sin nación: casi todos los estados, más el país técnico como país nuevo)
(con base de un mod: dependencies = { "Nombre del mod" } en descriptor.mod)

Por cada país EXISTENTE solo lo que cambies (banderas subidas, líderes nuevos,
historia con el nombre exacto del juego si hay carpeta, nombre en localisation/english/replace/).
```

## Estructura del código

```
src/main/            Proceso principal de Electron (ventanas, archivos, exportar, leer el juego)
src/preload/         Puente seguro entre la interfaz y Node
src/shared/          Compartido: nombres de archivo y el mapa (BMP, CSV, estados, demo, parche,
                     tema de colores, fronteras vectoriales y rectángulos de etiquetas)
src/renderer/src/
  blocks/            Bloques de Blockly y el campo FieldCatalog (menú con catálogo)
  catalog/           Catálogo central (focos, ideas, marcas, países, estados) y modificadores
  generator/         Bloques → script de Paradox; árbol, ideas y localización
  export/            Validador, exportación, escritor DDS/TGA y plan de íconos (.gfx)
  icons/             Emojis, elección automática, tamaños y dibujo con canvas
  store/             Estado central de la app (proyecto, selección, modo "elegir", diálogos)
  ui/                Pantallas y componentes
  map/               Mapa: colores, renderizadores WebGL2/Canvas 2D, etiquetas, exportar PNG,
                     zoom e inercia, herramientas y validación
  countries/         Países: color, popularidades, tags, historia, validación y datos "por verificar"
  types.ts           Formato de proyecto.json (versión 6)
  templates.ts       Plantillas de Nuevo proyecto (la plantilla es parte del proyecto)
  migrate.ts         Abre proyectos viejos (versiones 1 a 5) sin error
tests/               Pruebas automáticas (gpu.test.ts y ui.test.ts usan Chromium o Edge)
scripts/             Mediciones de rendimiento (bench-map.ts, bench-render.mjs)
```

## Probar un país nuevo paso a paso

1. `npm run dev` → **Nuevo proyecto** → plantilla **Mapa del juego** y un nombre.
2. Pestaña **Países** de la cinta → **Crear país**.
   - *Identidad*: nombre "Nueva Granada" (el tag se propone solo, p. ej. `NVG`), adjetivo, color.
   - *Política*: elige la ideología, mueve los sliders y pulsa **Balancear** hasta ver "Suma: 100 %".
   - *Capital*: escribe un número de estado (ej. `64`). Lee el aviso sobre países sin estados.
   - *Bandera*: sube una imagen o deja la de relleno; mira los 3 tamaños.
   - *Líder*: nombre y subideología; sube una foto o deja el retrato de relleno.
   - *Resumen*: elige "Crear un árbol vacío" y pulsa **Crear país**.
3. Pestaña **Focos** → "Añadir foco": te pregunta a qué país pertenece el árbol (elige Nueva Granada).
4. Prueba **Ctrl+Z**: se deshace la creación; **Ctrl+Y** la rehace.
5. **Exportar mod**: si hay errores, el botón **Ir** te lleva al paso que hay que corregir.
6. Revisa en la carpeta del mod los archivos de la lista de arriba.

Para que el país aparezca en la partida debe ser dueño de al menos un estado: píntaselos en
la pestaña **Mapa** (ver abajo).

## Editor de mapa (tipo Paint)

### La base del mapa
Viene de la **plantilla** del proyecto (ver arriba); ya no se pregunta al abrir el mapa ni se
cambia desde aquí. Con **Mod sin mapa** y **Mapa del juego** ves los países con sus colores; con
**Lienzo en blanco** solo ves en color lo que pintas. Sin carpeta del juego se usa el **mapa de
demostración** (40 estados, países DMA–DMD): sirve para practicar, pero sus cambios no se exportan.

### Pintar
1. En la **Paleta** (izquierda) haz clic en un color, o usa las teclas **1–9** (Mis países).
   **+ País rápido** crea un país con solo nombre y color; después "Completar país…" abre el asistente.
2. **Clic izquierdo** pinta; **arrastra** para pintar varios (una pincelada = un Ctrl+Z).
3. **Clic derecho** borra (vuelve a la base o a pendiente).
4. **Cubeta (G)**: rellena la región conectada del mismo color, sin preguntar (aviso con "Deshacer").
5. **Cuentagotas (I)**: toma el país de un estado como pincel.
6. **Capital (C)** y **Core (K / Shift = quitar)**: los errores salen como avisos, nunca ventanas.
7. Países del juego: se pintan directamente (no se agregan a Países). Su menú **⋯ → Editar este
   país…** los agrega como "existente" para cambiar bandera o líder.
8. Arriba a la derecha: modo de vista, **etiquetas** (Ninguna / ID / Nombre / ID + nombre),
   fronteras de provincia y **Colores como en el juego** (ahora en los grupos de la cinta).
9. Rueda = zoom, botón central o espacio + arrastre = mover, **F** = ajustar.

### Modo Sin nación
- La barra inferior muestra **Pendientes: N de M estados**; **Ver pendientes** los resalta y
  **Siguiente / Anterior** los recorre.
- **⚙ Sin nación** cambia el nombre y el tag del país técnico y si se conservan los cores del juego.
- Al exportar, todos los estados no pintados pasan al país técnico (sin cores del juego y sin
  cambios con fecha). El modo está pensado para empezar en 1936.

### Al exportar
Solo con el mapa real: se generan los archivos de `history/states/` necesarios, con el mismo
nombre que en el juego (o en el mod base) y solo las líneas `owner` / `add_core_of` cambiadas.

## Elegir países (selector universal)

Todos los lugares que piden un país (el "País:" del árbol de focos, el primer árbol, "Modificar
uno existente" del asistente, el nombre de la tarjeta del mapa y los campos de país de los
bloques) usan el mismo orden: **Mis países → En el mapa** (dueños actuales según la plantilla y lo
pintado, por número de estados) **→ Todos los países del juego** (plegable; incluye los que no
tienen estados). Buscador por nombre o tag, flechas y Enter; al final "+ Crear país nuevo…"
(rápido o con el asistente). Cada fila muestra la bandera real, el nombre, el tag y los estados.

**País del juego "ligero":** al elegir, por ejemplo, SOV para un árbol, NO se abre nada: se
registra solo el tag como país "existente" (sección **Países del juego usados** del Navegador).
No exporta historia, banderas, personajes ni localización; solo lo que cambies después con
"Editar este país…". Si borras su árbol y no tiene nada más, desaparece solo. Los árboles viejos
"sin país" se pueden asignar a un país del juego con el mismo selector.

**Árbol de un país del juego en el juego:** se exporta con `add = 20` (los árboles únicos del
juego usan 10, para no empatar) y, con la carpeta del juego, el árbol avisa "Este árbol
reemplazará el árbol original de <país>". Los focos nuevos se llaman
`<mod>_<TAG>_<nombre>` para no chocar con los del juego; el validador marca como ERROR un id que
ya exista en `common/national_focus` (o un espíritu en `common/ideas`) con el botón **Renombrar
automáticamente** (actualiza bloques, prerrequisitos y excluyentes).

### "En el mapa" = lo que se ve en TU mapa
Una sola regla, `effectiveOwner` (`map/mapOps.ts`), da el dueño de cada estado tal como se ve en el
mapa del proyecto: con **Lienzo en blanco** (con o sin Sin nación) solo cuenta lo que pintaste;
con **Mapa del juego / de un mod**, lo pintado o, si no, el dueño de la base; el país técnico
"Sin nación" cuenta como en blanco. El selector de país y la Paleta comparten secciones y
conteos: **Mis países** (con su conteo, aunque sea 0), **En el mapa (N)** (solo países con al menos
1 estado en ESTE mapa, de mayor a menor; vacío muestra "Todavía no hay países en tu mapa…") y
**Todos los países del juego** (plegable; "—" si no tienen estados en tu mapa; nunca los conteos
del juego original). El buscador mira las tres secciones. Los conteos se actualizan por
pincelada solo con los estados que cambiaron (y se recalculan completos al abrir o cambiar de
pestaña). Tarjeta del país, Navegador, Paleta y selector dan los mismos números.
El validador y la exportación siguen usando el dueño que tendrá el estado en el JUEGO (los
estados en blanco conservan su dueño o pasan a Sin nación), no el dueño "visual".

### Capas de la interfaz
`ui/layers.ts` es la única escala de capas: base → paneles → cinta → Blockly → menús de Blockly →
menús de la cinta → fondo de ventana → ventana → avisos → tooltips. Todas las ventanas (Modal,
Nuevo proyecto, asistente, confirmaciones, selector de país…) se dibujan en un portal en
`document.body`; al abrir una se cierra lo flotante de Blockly, el resto de la app queda inerte
(`inert`) y al cerrar se devuelve el foco. La letra del toolbox de Blockly (14 px) y las capas de
sus menús se definen junto a su tema (`ui/theme.ts`).

## Guardar y exportar (a mano)

**La app NUNCA escribe en la carpeta del juego ni en la carpeta de mods de HOI4.**

**Guardar:** la primera vez, **Guardar como…** (Ctrl+Shift+S) y, por defecto, también Ctrl+S abren
el diálogo para elegir carpeta y nombre (por defecto `Documentos/HOI4 Mod Studio/Proyectos/<mod>`;
con Ctrl+S ya trae la ubicación actual). En Ajustes → General se puede desactivar "Preguntar
siempre dónde guardar". Guardar solo escribe `proyecto.json`; después sale "Proyecto guardado en
<ruta>" con **Abrir carpeta**. Los proyectos viejos con `modSync` se abren sin problema (el campo
se ignora y se quita al guardar).

**Exportar mod (Ctrl+E):** primero corre el validador (con errores no exporta). Luego abre un
diálogo para elegir la carpeta de destino (por defecto `<Escritorio>/HOI4 Mod Studio - Exportados`,
con OneDrive; se recuerda la última). Ahí se crean EXACTAMENTE dos cosas: la carpeta `<mod>/` y el
archivo `<mod>.mod`. Para jugar, **copia las dos a** `Documentos/Paradox Interactive/Hearts of Iron
IV/mod/`.
- El `path` del `.mod` apunta a donde quedará el mod después de copiarlo
  (`<Documentos de HOI4>/mod/<mod>`, con `/`); `descriptor.mod` no lleva `path` y ninguno de los
  dos lleva BOM. La detección de la carpeta de Documentos solo sirve para mostrar rutas.
- `supported_version` sale de `launcher-settings.json` en la RAÍZ de la carpeta del juego (respaldo:
  `launcher/`): `rawVersion` "1.19.3.0" → `1.19.*`; sin él, X.Y de `version` (formato visto en un
  HOI4 1.19.3 real). Ajustes muestra la versión detectada; si no se puede leer, se usa una
  constante editable (por verificar).
- Si ya hay una exportación anterior del mismo mod en esa carpeta pregunta "¿Reemplazar la
  exportación anterior?"; si aceptas, borra COMPLETAS su carpeta y su `.mod` (solo ahí) y escribe
  de nuevo. Se niega a escribir dentro de Documentos/Paradox Interactive/Hearts of Iron IV o de la
  instalación del juego.
- Archivo → **Abrir carpeta de exportación**.

### Revisar mod instalado (solo lectura)
Botón en la ventana final de exportación y en la pestaña Exportar. LEE `<Documentos de HOI4>/mod/<mod>/`
y `<mod>.mod` y los compara (hash, archivo por archivo) con la última exportación: «Al día» o la
lista de archivos que faltan, sobran (p. ej. el `.hoi4modstudio.json` viejo de la sincronización
automática) o son distintos, y si el `.mod` tiene otra `supported_version` o `path`. Si hay
diferencias: «Borra la carpeta <mod> y el archivo <mod>.mod de la carpeta de mods y copia los
nuevos», con botón para abrir esa carpeta. Nunca escribe nada en la carpeta del juego.

## Bloque único «Foco» (Blockly)

Cada foco tiene UN bloque raíz «🎯 Foco: <nombre>» (estilo Scratch: cada sección es un título y, DEBAJO, su boca donde caen los bloques) con tres secciones: Requisitos (available),
Saltar si (bypass) y Recompensa (completion_reward), cada una solo con condiciones o solo con
efectos. Crece hacia abajo, así nada se superpone. No se puede borrar ni duplicar. Los bloques
sueltos fuera de él se ven grises, no generan código y se ordenan en columna a su derecha al
cargar y al soltar un bloque encima de otro. Los focos guardados con los tres bloques viejos se
migran solos (formato de proyecto 8; el bloque raíz de la versión anterior también).

## Capitales de países del juego

- Se leen de `history/countries/<TAG> - <Nombre>.txt` con un lector con llaves (`capital = N` del
  nivel superior; tolera BOM, sangría, comentarios y CRLF; ignora los bloques con fecha e if/limit).
  **Causa del «sin capital» de la URSS:** esos archivos son UTF-8 con BOM y la capital va en la
  primera línea; la expresión `^capital` no coincidía con el BOM delante, y además la tarjeta solo
  miraba el país del proyecto, no el catálogo del juego.
- Si pintas el estado de la capital de un país del juego para otro, el validador avisa (con **Ir**)
  y la tarjeta dice «capital en territorio ajeno». Es lo que provoca el error del juego
  «Attempting to set capital state #N … they dont own it!».
- Con «Mover automáticamente las capitales perdidas» (activado, en el mapa), al exportar la
  capital pasa al estado del país con más victory points (empate: más provincias; luego id menor)
  y se exporta `history/countries/<archivo exacto>` con un parche mínimo byte a byte (solo cambian
  las cifras de `capital =`). Si el país también se editó con el asistente, el archivo único lleva
  ambos cambios. Si se queda sin estados no se toca. **Elegir otra capital…** (en la tarjeta) usa
  el mapa; tu elección gana a la automática. Si el archivo no se puede localizar o parchar con
  seguridad, es un ERROR y ese archivo no se exporta.

### Barras de desplazamiento de Blockly
Las barras que Blockly oculta con el atributo `display="none"` quedaban visibles porque Tailwind
(preflight) pone `svg { display: block }`, que gana a ese atributo; el tema de Blockly
(`ui/theme.ts`) lo corrige. El editor llama a `svgResize` cada vez que cambia su contenedor
(ventana, pestaña del documento o de la cinta, paneles, ventana cerrada). La rueda del mouse y el
arrastre del fondo mueven el área; el zoom va con los botones de Blockly.

## Banderas reales de los países del juego

Con HOI4 detectado, la Paleta, la tarjeta del país, el Navegador y el asistente muestran la
**bandera real** de cada país: la variante de la ideología gobernante (`set_politics` de
`history/countries`) y, si no existe, `<TAG>.tga`. Si el proyecto usa un mod como base, las
banderas del mod tienen prioridad. Se leen con un lector TGA propio (tipos 2 y 10, de 24 y 32
bits, respetando el bit de origen), se decodifican una vez y se guardan como miniaturas PNG en la
caché de la app (carpeta de datos del usuario, nunca en el repositorio). Si un archivo no se puede
leer se usa la bandera de relleno y se anota en la consola. Los países del MOD siguen usando su
bandera subida o la de relleno.

**Editar una bandera del juego:** "Editar este país…" (o el paso Bandera del asistente) abre con
las banderas reales (la principal y las 4 de ideología, con sus 3 tamaños). Cada variante dice si
es "del juego" o "personalizada"; puedes reemplazarla (editor de recorte 82:52), volver a la del
juego o **Descargar PNG** para editarla fuera de la app.

**Al exportar:** un país del MOD lleva sus 15 banderas TGA; un país del JUEGO, solo las variantes
que personalizaste, en sus 3 tamaños (`gfx/flags/`, `medium/` y `small/`) y con los mismos
nombres que el juego para sustituir a las originales. Una auto-revisión confirma los 3 tamaños.

## Aspecto del mapa (generado, de alta calidad)

El aspecto del mapa **siempre se genera** con los datos del juego (o de la caché del mapa):
no existe ninguna "piel" con una imagen externa. (La *Referencia* de la barra superior es solo
una imagen para calcar encima, apagada por defecto, y nunca cambia el dibujo ni los datos.)

**Estilo** (todos los valores están en un solo archivo, `src/shared/map/theme.ts`):

| Elemento | Valor |
|---|---|
| Mar, lagos y fondo fuera del mapa | `#446BA3` |
| Tierra sin pintar | `#FFFFFF` |
| Frontera de estado | `#BFBFBF`, 1 px |
| Frontera de país (solo entre estados **pintados** de países distintos) | `#6E6E6E`, 1.75 px |
| Frontera de provincia (solo con el interruptor) | `#E6E6E6`, 0.5 px |
| Números | `#000000` |
| País activo | contorno ámbar de 2 px |
| Estado bajo el cursor | contorno gris oscuro de 2 px y un poco más claro por dentro |
| "Ver pendientes" | rayas diagonales suaves de grosor constante |

- **Costas**: sin línea, solo un cambio de color suave (antialias) entre mar y tierra.
- **Fronteras vectoriales**: al cargar el mapa se convierten en polilíneas (marching squares,
  Douglas-Peucker de 0.5 px y un paso de Chaikin, revisando que nunca se crucen). Se guardan en la
  caché del mapa (carpeta de datos de la app, nunca en el repositorio) y se dibujan en WebGL2 con
  **ancho constante en pantalla** a cualquier zoom y `devicePixelRatio`. El color (claro u oscuro)
  lo decide el shader con los dueños de ese momento: pintar no recalcula nada.
- **Etiquetas**: letra sans-serif del sistema; negra sobre tierra blanca y negra o blanca según la
  luminancia sobre un país (con un contorno fino solo si hace falta). Tamaño de 9 a 14 px según lo
  grande que se vea el estado; si no cabe en su estado, se oculta. Sin choques (la que pierde se
  oculta): capitales > estados grandes > el resto. Se recolocan al terminar el zoom o el
  desplazamiento; mientras tanto se mueven con el mapa.
- **Capitales** (casilla *Capitales*): nombre del país en negrita con ★, de 11 a 16 px; si no
  cabe, el tag; si tampoco, solo ★.
- **Zoom y movimiento**: rueda con zoom suave (~120 ms) centrado en el cursor, arrastre con
  inercia ligera (botón central o espacio + arrastre) y límites para que el mapa no se pierda.
- **Minimapa** abajo a la derecha, con el mismo estilo.
- **F3**: overlay con motor, FPS reales mientras te mueves o pintas, tiempo de dibujo, segmentos de
  frontera, tiempos de vectorizar y de etiquetas, y tamaño de la caché.

### Exportar imagen del mapa (PNG)
Botón **🖼 Exportar imagen del mapa (PNG)** (arriba a la derecha del mapa). Tamaños: **1×**
(5632×2048), **2×** (11264×4096) o la **vista actual**; con o sin etiquetas y con o sin fronteras
de provincia. Se genera fuera de pantalla con el mismo motor WebGL2 y se guarda con "Guardar
como" (nunca dentro de la carpeta del juego).

**Imágenes más grandes que tu GPU.** Muchas tarjetas gráficas solo dibujan hasta 8192 px por lado,
así que el 2× (11264 de ancho) no cabe de una vez. En ese caso la imagen se dibuja **por pedazos**
(cuadros de hasta 4096 px, con la vista corrida para que cada uno caiga en su lugar) y se une al
final en un canvas normal: el resultado es idéntico a dibujarla de golpe. Si ni así cabe en la
memoria de tu computadora, el diálogo avisa y ofrece el **mayor tamaño posible** con la misma
composición (botón "Exportar a W × H"). El código está en `map/exportImage.ts`.

### Rendimiento
Mide tú mismo con **F3** en tu computadora. Con un mapa **sintético** del tamaño del real
(5632×2048, ~1 300 estados; `npm run bench:map` y `npm run bench:render`) en este entorno
(sin GPU: SwiftShader por software, que NO sirve para estimar los FPS de una GPU real):

| Medida | Resultado |
|---|---|
| Vectorizar las fronteras (una vez, al cargar el mapa) | ~0.4 s |
| Rectángulos de etiquetas (una vez) | ~0.6 s |
| Fronteras en la caché | ~660 KB (77 000 segmentos; con las costas) |
| Colocar etiquetas tras un zoom | de 0 a 60 ms |
| Pintar un estado (paleta a la GPU) | ~1 ms |
| Exportar PNG 1× con etiquetas | ~3 s |

El mapa real de HOI4 tiene fronteras mucho más irregulares: espera varias veces más puntos y
unos segundos más la primera vez (después sale de la caché).

## Pruebas automáticas

`npm test` incluye pruebas del motor WebGL2 real (tests/gpu.test.ts: colores exactos del estilo,
PNG de 5632×2048, ancho de línea con DPR 1, 2 y 3) y de la interfaz en un navegador real
(tests/ui.test.ts: cinta en gris sin proyecto, plantillas, dos pestañas sin mezclarse). Todas usan Chromium (variable `HOI4_TEST_CHROMIUM`, o
`/opt/pw-browsers`) o Edge/Chrome instalados; si no hay ninguno, esas pruebas se saltan.

`npm run test:build` compila la app y prueba el bundle de `out/` (no el código fuente): jomini con su
`.wasm` y una carga completa del mapa con una carpeta de juego falsa.

## Probar el mod en el juego

1. En la app: **Exportar mod** → elige `Documentos/Paradox Interactive/Hearts of Iron IV/mod`.
2. Abre el **launcher** de HOI4 → *Playsets* → añade tu mod y actívalo.
3. Inicia una partida con el país de tu tag y abre **Focos nacionales**.
4. Si algo falla, mira `Documentos/Paradox Interactive/Hearts of Iron IV/logs/error.log`.
   Tip: arranca el juego con `-debug` (Steam → Propiedades → Opciones de lanzamiento) y en
   la consola usa `focus.autocomplete` para completar focos al instante.

## Avisos del validador
- Solo avisa de capitales/países sin estados cuando el país EXISTÍA al inicio en la base y TUS
  cambios lo afectaron. Los liberables o formables que ya empiezan sin estados (Abjasia, Argelia…)
  no dan ningún aviso. Los que pierden la capital pero conservan estados: aviso y la capital se
  mueve al exportar. Los que se quedan sin estados: UN aviso agrupado (el `error.log` mostrará
  «Attempting to set capital state… they dont own it!», es normal). En la tarjeta del país:
  **Dejarle un estado** (elige en el mapa; vuelve a ser suyo y capital, un paso de deshacer). En
  Sin nación, una sola línea informativa.
- La ventana de avisos agrupa por tipo (errores primero, secciones plegables, «Ver todos»), y cada
  aviso se puede **ignorar** (se guarda en el proyecto) con «Mostrar ignorados».
- Bloques con fecha reales: `1938.10.25 = { if = { limit = { … } remove_core_of = GXC CHI = {
  transfer_state = PREV } } }`. En Sin nación, los estados no pintados pierden `owner`,
  `controller`, `add_core_of`, `remove_core_of` y `transfer_state` (con su `TAG = { }`) dentro de
  bloques con fecha, también dentro de `if`; si un `if` o un `TAG = { }` queda vacío se quita,
  sin tocar el resto byte a byte. El aviso de «cambios con fecha» detecta este patrón.

## Nombres seguros (proyecto y mod)
Un proyecto llamado "." se aceptaba porque el diálogo solo comprobaba que el nombre no estuviera
vacío; ese nombre acabó en el `descriptor.mod` y en la ruta. Ahora «Nuevo proyecto», «Guardar como»
y Propiedades rechazan vacío, ".", "..", `\ / : * ? " < > |` y nombres reservados de Windows (el
botón se deshabilita y explica por qué); un proyecto viejo con nombre inválido se ve como «Sin
título» y al guardar pide uno válido. El slug del mod (`modSlug`) solo tiene minúsculas, números,
`_` y `-`, con al menos una letra o número; si no hay slug válido es un ERROR del validador. La
exportación normaliza con `path.resolve` y nunca escribe ni borra fuera de
`<carpeta elegida>/<slug>` y `<slug>.mod`. «Revisar mod instalado» avisa (sin borrar) si hay
carpetas sueltas `common/gfx/interface/localisation/history` o `.mod` sin nombre en la carpeta de
mods del juego.

## Árbol de focos
- Un clic en un foco lo selecciona con cualquier herramienta. **Prerrequisito**: 1.er clic = padre
  (ámbar), 2.º = hijo; **Excluyente**: igual. Clic en el mismo foco, en el fondo o Esc cancelan la
  conexión pendiente; ciclos, repetidas y a sí mismo avisan y no se crean. Esc sin nada pendiente →
  Mover. Doble clic → cursor en «Nombre». Supr actúa sobre lo seleccionado, pero no mientras se
  escribe en un campo.
- Asas al pasar el mouse: ● abajo (clic = añadir hijo; arrastrar a otro foco = prerrequisito) y ✕
  roja al lado (arrastrar = exclusión), con línea provisional y destino verde/rojo. Las líneas se
  seleccionan con clic y se borran con Supr.
- **Cuadrícula entera** (x, y = columna y fila; proporción de `focus_spacing` de
  `interface/nationalfocusview.gui`, por verificar el valor real): al arrastrar, una sombra marca la
  casilla; casilla ocupada = intercambio; un foco no baja de la fila de sus prerrequisitos (sombra
  roja → primera fila válida); se mueve su RAMA (Alt = solo ese; Shift+clic o recuadro = varios).
- **Ordenar árbol** (y «Orden automático» al crear/conectar, activado): capas con baricentro,
  excluyentes juntos en la misma fila, ramas lado a lado con 2 columnas, mínimo x = y = 0, 📌 fijar
  posición, 200 ms de animación, un paso de deshacer. Líneas en ángulo recto (la bajada larga busca
  una columna libre). Exportación: x e y enteros; opción avanzada `relative_position_id` (Propiedades
  del proyecto) con las mismas posiciones finales. No implementado: línea punteada para «un bloque
  prerequisite con varios focos» (el modelo solo tiene prerrequisitos que se requieren TODOS).

## Espíritus nacionales
Los campos de espíritu en Blockly muestran solo los del mod, «Recientes» (8) y «🔍 Elegir del
juego…», «+ Crear nuevo…», «+ Crear a partir de uno del juego…» y «Escribir otro ID…»: nunca cargan
las miles de ideas del juego (abre en <100 ms). «Elegir del juego» es una ventana con pestañas
(Espíritus nacionales / Leyes / Asesores y diseñadores / Otros), buscador sin acentos, lista
virtualizada, flechas/Enter/Esc y vista previa. El catálogo se lee una vez y se guarda en memoria y
en disco (invalidado por las huellas de `common/ideas` y la localización). «Crear a partir de»
copia nombre, descripción y modificadores (editables); lo no soportado va en «Avanzado (texto)» de
solo lectura y se exporta tal cual; el ícono es el `picture` del original (no se copia ningún
archivo). También en Espíritus → «Nuevo a partir del juego…».

## Mini mapa «Elegir estado»
Los campos de estado de los bloques, la capital del asistente, «Elegir otra capital…» y «Dejarle un
estado» abren un mini mapa con los colores de MI mapa (zoom, arrastre, tooltip con nombre/ID/
dueño/cores, buscador, filtro por país del árbol, 8 recientes; doble clic o Enter confirman). Dibuja
solo lo visible en un canvas 2D pequeño leyendo el mismo `MapData` (sin otro contexto WebGL ni copias).
Los nombres `STATE_N` se buscan en TODOS los `.yml` de `localisation/english` (incluida `replace/`
y DLC).

## Memoria
F3 en el mapa muestra la memoria de la app (principal + interfaz + GPU), el heap JS y los bytes de
texturas WebGL. Con la pestaña Mapa oculta se liberan las dos texturas grandes (≈ 35 MB en el mapa
real) y se suben otra vez desde el `MapData` en memoria al volver. Hay un solo `MapData` compartido.
La caché de banderas conserva solo las 2 más recientes; Ajustes muestra cuánto ocupa la caché y
tiene «Limpiar caché». **Modo ligero** (Ajustes, apagado por defecto): texturas a la mitad (≈ 9 MB),
zoom sin animación ni inercia y liberar las texturas al minimizar.

## Base de las secciones nuevas (eventos, decisiones, personajes…)
- **Modelo:** `events`, `superEvents`, `decisionCategories`, `decisions`, `characters`,
  `countryStart`, `oobs`, `technologies`, `ideologies`, `bookmarks`, `music`, `loadingScreens` y
  `languages` viven DENTRO de `Project` (`proyecto.json`, formato 9, migración con colecciones
  vacías; el inglés es el idioma base). Todo pasa por el store de la pestaña activa (deshacer/rehacer,
  nada compartido entre pestañas). Los líderes del asistente se unificarán con `characters` en la
  sección de personajes (para no exportarlos dos veces).
- **Exportador con registro de rutas** (`export/registry.ts`, `shared/exportPaths.ts`): cada sección
  aporta un generador puro (`sections/generators.ts`). Dos generadores con la misma ruta, la lista
  negra (`map/*`, `interface/countrytechtreeview.gui`, `music/music.asset`,
  `common/characters/<TAG>.txt`), carpetas fuera de la lista blanca y archivos con el nombre de uno
  del juego (índice de solo lectura) son ERRORES; los parches mínimos de `history/states` e
  `history/countries` están registrados. El proceso principal repite la comprobación. Un proyecto
  vacío exporta solo `descriptor.mod` y `<slug>.mod`.
- **Serializador** (`export/clausewitz.ts`): comillas una sola vez, nunca `\"`.
  **Localización** (`export/localisation.ts`): `localisation/<idioma>/<mod>_<sección>_l_<idioma>.yml`,
  UTF-8 con BOM y `l_<idioma>:`.
- **BlocklyArea** (`ui/BlocklyArea.tsx`, `blocks/area.ts`): ranura reutilizable de efectos o
  condiciones (país o estado), con la caja de herramientas de los focos filtrada y el mismo
  generador PDX.
- **Interfaz común:** pestañas Eventos · Súper eventos · Decisiones · Personajes · Ejército ·
  Tecnologías · Extras con grupos Crear / Editar / Ver / Probar y el mismo esqueleto de tres
  columnas (ver «Rediseño de la interfaz» más abajo). Sin datos de ejemplo.

## Eventos
Pestaña **Eventos**: lista por grupos, editor en tarjetas (Básico · Opciones · Avanzado) con vista
previa al estilo del juego (evento de país o noticia mundial), opciones con bloques (condición y efectos) y ai_chance, imagen (del juego, subida o de la
biblioteca; DDS + sprite en `interface/<mod>_events.gfx`), variantes condicionales de título y
descripción, y **cadena** de eventos (grafo). El bloque «Lanzar evento» (país, noticias o estado, con
días, aleatorio y país destino) funciona en focos, eventos y decisiones; «Enlazar a otro evento» lo
agrega a una opción. Plantillas: noticias mundial, oculto con retraso y elección con 2 caminos.
Exporta `events/<mod>_<namespace>.txt` (un archivo por namespace, con `add_namespace`),
`localisation/english/<mod>_events_l_english.yml` y las imágenes. `news_event` siempre lleva `major` y
nunca `fire_only_once`. El validador revisa namespace, ID entero < 100000 y único, major, MTTH con
is_triggered_only, evento automático sin país, al menos una opción sin condición, textos e imagen.
«Copiar comando de consola» (`event <id>`) sirve para probarlo con `-debug`. No hecho: arrastrar
desde una opción hasta un evento en la cadena (se usa el selector «Enlazar a otro evento»).
Constante por verificar: tamaño de las imágenes de evento (210×176).

## Súper eventos
Pestaña **Súper eventos**: ventana grande propia (sistema generado, nada copiado de otros mods) con
imagen, título, cita con autor, botón y sonido `.wav` (con aviso si no es PCM y botón para
reproducirlo). El bloque «Mostrar súper evento» (focos, eventos y decisiones) llama a `<id>_show`.
Exporta `common/scripted_effects`, `common/scripted_guis` (uno por súper evento, visible mientras su
bandera esté activa; la cola respeta el orden de la lista y, sin cola, el nuevo reemplaza al abierto),
`interface/<mod>_super_events.gui` y `.gfx`, `gfx/super_events/*.dds`, `sound/<mod>_super_events.asset`
+ los `.wav`, y la localización. Todo es solo para humanos (`is_ai = no`). Diferencia con lo
planeado: no hay `scripted_localisation` porque cada ventana usa sus propias claves. Por verificar en
el juego: posiciones y tamaños de la ventana, los nombres `<botón>_click_enabled` / `_click` del
scripted GUI y la sintaxis del efecto de sonido (`SOUND_EFFECT`; el validador avisa).

## Decisiones y misiones (S3)

Pestaña **Decisiones**: categorías y decisiones normales, misiones (con temporizador y `activate_mission`) y decisiones con objetivo (países o estados). Editor en tarjetas (Básico · Cuándo se puede tomar · Qué pasa al tomarla · Duración · Opciones avanzadas). Exporta `common/decisions/categories/<mod>_categories.txt`, `common/decisions/<mod>_decisions.txt`, `interface/<mod>_decisions.gfx`, `gfx/interface/decisions/*.dds` y la localización. El validador avisa de misiones con `visible`, costos personalizados sin restar, decisiones sin `ai_will_do`, imágenes de categoría sin descripción y misiones que nadie activa.

Por verificar (constantes marcadas en `sections/decisions.ts`): tamaño de íconos de decisión (66×66) y de imagen de categoría (460×150), nombre completo en `picture` de la categoría, y que `highlight_states`/`on_map_area` lleven la forma usada.

## Personajes (S4)

Pestaña **Personajes**: líder, consejero, general, mariscal y almirante por país, con retratos, rasgos reales del juego (leídos de `common/country_leader` y `common/unit_leader`) y botón para traer los líderes del asistente. Exporta `common/characters/<mod>_<TAG>_characters.txt` (nunca `<TAG>.txt`), `interface/<mod>_portraits.gfx`, `gfx/leaders/<TAG>/*.dds` y localización; `recruit_character` va en la historia del país (generada o parche mínimo) o, si no hay historia editable, en `common/on_actions/<mod>_characters.txt`. Bloques nuevos: Reclutar, Quitar y Activar asesor.

Por verificar: tamaño de retratos de general y consejero, `retire_character` / `activate_advisor`, `legacy_id = -1`.

## Situación inicial y escenarios (S5)

En **Países**, cada tarjeta tiene «Situación inicial»: estabilidad, apoyo a la guerra, convoyes, ranuras de investigación, espíritus iniciales, tecnologías iniciales (buscador sobre `common/technologies` del juego), diplomacia (facción propia o unirse a otra, títeres con autonomía leída de `common/autonomous_states`, garantías) y guerras al inicio (`on_actions` + `declare_war_on`). Todo va a la historia del país (archivo generado si es nuevo, parche mínimo si es del juego). Con fecha 1939, los cambios van en un bloque `1939.1.1`. «Escenarios de inicio…» edita `common/bookmarks`. No hay vista de resumen en el mapa con colores de facción (pendiente).

Por verificar: `declare_war_on` en `on_startup`, imagen de escenario 640×220, forma del bloque `bookmark` (`"---"`).

## Estados a fondo (S6)

En **Mapa → Seleccionar**, el panel derecho «Estado» edita población, categoría (lista de `common/state_category`), recursos, edificios del estado (máximos leídos de `common/buildings`), puntos de victoria y edificios por provincia (haz clic en una provincia; `naval_base` y `coastal_bunker` solo en costa). Los cambios se guardan en `stateEdits` y se exportan con el **parche mínimo** del archivo real del estado: solo cambian las líneas tocadas (comentarios, CRLF y bloques con fecha quedan idénticos, y el parche es idempotente). No se crean `history/states` nuevos ni `map/definition.csv`. Hay dos modos de vista nuevos: Edificios y Recursos. El validador revisa niveles, costa, provincias del estado, población y categoría, y avisa si el estado tiene cambios con fecha.

Por verificar: clave `province_based` en `common/buildings` (`PROVINCE_BASED_KEY`), máximos de reserva (`BUILDING_DEFAULTS`) y lista de categorías de reserva.

## Ejército inicial (S7)

Pestaña **Ejército**: la lista va por país → plantillas → divisiones. Las **plantillas de división** (cuadrícula de combate 5×5 + columna de apoyo) se llenan arrastrando batallones desde la paleta o con un clic; cada casilla muestra el ícono y el nombre del juego. Las **divisiones** (provincia elegida en el mini mapa en modo **provincia**, solo tierra; nombre u orden, experiencia y equipo) y la **producción inicial** (opcional) están en el mismo esqueleto. Exporta `history/units/<mod>_<TAG>_1936.txt` (archivo NUEVO; nunca `<TAG>_1936.txt` del juego) y la historia del país apunta a él con el parche mínimo de la línea `oob`. Un país del juego con ejército propio **reemplaza todo su ejército original** (el validador lo avisa). Además se corrigió que, con un árbol de focos abierto, la barra de bloques de Blockly se veía por encima de las pestañas nuevas.

Pendiente: flotas y aviación (formato sin verificar), estadísticas de la plantilla y `common/units/names_divisions`. Por verificar: cuadrícula 5×5 / apoyo de 5, `division_name` ordenado, producción en `instant_effect` y el nombre de grupo `support` en `common/units`.

## Extras (S9)

Pestaña **Extras**:
- **Idiomas**: elige idiomas además del inglés (obligatorio); tabla de traducción por clave con filtro de las que faltan. Se exporta un `.yml` por idioma y por sección (UTF-8 con BOM, cabecera `l_<idioma>:`, en `localisation/<idioma>/`); lo no traducido sale en inglés.
- **Música**: sube `.ogg` (se valida la firma Ogg); escribe `music/<mod>_music.asset`, una lista de canciones por estación `music/<mod>_<estación>_songs.txt` y los `.ogg` con nombres propios (nunca `music/music.asset`).
- **Pantallas de carga** (`gfx/loadingscreens/*.dds` + `.gfx`) y **portada** (recorte cuadrado, `thumbnail.png` en la raíz y `picture="thumbnail.png"` en el descriptor; se publica desde el launcher).
- **Importar un mod** (solo lectura): trae focos, eventos, decisiones y espíritus nacionales de la carpeta de otro mod con su localización en inglés. Lo que no se entiende se conserva como texto («Avanzado (texto)») y se exporta tal cual; los bloques de script importados se muestran como texto editable.

Pendiente: portada de estaciones de radio propias, y el resto de idiomas en mods importados. Por verificar: forma de `chance`/`music_station` en `music/*.txt`, tamaño y nombre del `.gfx` de pantallas de carga (`LOADING_SIZE`), tamaño de la portada (`COVER_SIZE`).

## Tecnologías e ideologías (S8)

Pestaña **Tecnologías**, «lo seguro primero»:
- **Subideologías** (siempre disponibles): se agregan dentro de uno de los 4 grupos del juego. Al exportar se parte del archivo REAL `common/ideologies/*.txt` de tu juego y un **parche mínimo** inserta solo el `type` en `types = { … }` (idempotente; nunca se escribe ese archivo sin partir del real), más su localización (nombre, descripción y nombre de partido de los países del mod) y un ícono opcional.
- **Bloques nuevos de efecto**: «Ranuras de investigación» (`add_research_slot`), «Bono de investigación» (`add_tech_bonus`) y «Dar la tecnología» (`set_technology`).
- **Modo avanzado** (interruptor en la pestaña): tecnologías nuevas DENTRO de carpetas existentes de la pantalla de investigación. Se escribe `common/technologies/<mod>_technologies.txt` y, si un prerrequisito es una tecnología del juego, un parche mínimo de su `path` en su archivo real. **Nunca se escribe `interface/countrytechtreeview.gui`**: la tecnología se ve porque el gridbox de su carpeta ya existe en el juego.
- Validador: sin ciclos, referencias y carpetas existentes, ID que no pisa al juego, nombre (localización) obligatorio; un archivo parchado se vuelve a leer con jomini antes de exportarlo y los originales del juego jamás se modifican.

Por verificar: forma exacta de `add_tech_bonus`, `research_cost_coeff = 1`, que una carpeta existente muestre tecnologías nuevas sin tocar el .gui, el sprite/tamaño del ícono de subideología y los nombres de partido (`<TAG>_<id>_party`) con un ejemplo real.

## Espíritus, íconos del juego y estilo general

- **Estilo**: la interfaz no usa emojis (solo íconos de línea; los emojis que eliges como ícono de un foco o espíritu son contenido y se conservan), las etiquetas están en español sin nombres de código, y el tono es más tranquilo (el naranja solo para la acción principal y lo seleccionado). La cinta nunca parte el nombre de una pestaña: las que no caben van al menú «Más».
- **Editor de espíritu**: nombre, ID (pequeño y gris), descripción, modificadores en español con % y el ícono a la derecha (Emoji, Subir imagen, Mi biblioteca, Del juego).
- **Íconos «Del juego»** (espíritus y focos): se leen los sprites `GFX_idea_*` y `GFX_goal_*` de `interface/*.gfx` de tu instalación y sus texturas `.dds` con un decodificador DDS propio en JavaScript (DXT1, DXT3, DXT5 y sin comprimir; un formato no soportado, como BC7, da una miniatura genérica). Las miniaturas PNG se guardan solo en la caché (`userData`) y se generan en segundo plano por lotes. Al elegir uno, el espíritu exporta `picture` = nombre del sprite sin `GFX_idea_`; no se copia ningún archivo. El validador avisa si el sprite no existe en tu versión del juego.
- **Ventana «Elegir del juego»**: miniatura real de cada espíritu, nombre normal y debajo, pequeño y gris, el ID y un resumen en español («Estabilidad +10 %»). Los nombres resuelven `$OTRA_CLAVE$`, quitan los códigos de color `§` y los textos dinámicos `[ … ]`. La vista previa muestra icono, nombre, descripción y modificadores; el código del juego queda en «Ver código», plegado.

## Rediseño de la interfaz

Todas las secciones (Eventos, Súper eventos, Decisiones, Personajes, Ejército, Tecnologías y Extras)
comparten el mismo esqueleto (`ui/SectionScreen.tsx` y `ui/SectionParts.tsx`); cada sección solo
registra su contenido con `registerSectionScreen`. **El formato de los archivos exportados no cambió**:
`tests/regression.test.ts` compara el texto exportado de todas las secciones con una copia guardada y
se comprobó además contra el commit anterior al rediseño.

- **Tres columnas.** Izquierda: lista por grupos plegables con buscador, miniaturas y el ID pequeño y
  gris. Centro: el editor en tarjetas, con «Opciones avanzadas» plegadas (el ID casi siempre está ahí).
  Derecha: vista previa visual en vivo y, plegado al final, «Ver código».
- **Estado vacío.** Una o dos líneas que explican la sección, una galería de plantillas con tarjetas
  (miniatura, nombre y una frase) y el botón principal «Crear …». Nunca hay datos de ejemplo.
- **Ventana «Nuevo …».** Pide el nombre, el grupo (uno existente o uno nuevo ahí mismo; en Ejército y
  Personajes, el país) y la plantilla. Nunca pide un ID: se genera solo. Los avisos del validador
  van en texto pequeño con un ícono dentro de la tarjeta del campo afectado; el resumen completo sigue
  en Exportar.
- **Ayuda «?»** (`ui/Help.tsx`; todos los textos en `ui/helpTexts.ts`). Solo está en los conceptos
  difíciles: grupo de eventos, activación, una sola vez, noticia, oculto, tiempo promedio y de
  respuesta, súper evento y sonido, categoría, misión, contra países, sobre estados y costo de las
  decisiones, banderas por ideología, nombre con artículo y tag, cores, sin nación y capital, saltar
  si, excluyente y prerrequisito de los focos, plantilla, batallones de línea y apoyo, subideología y
  Modo avanzado. Se abre al pasar el mouse (o con un clic) y se cierra al quitarlo o con Esc.
  `tests/help.test.ts` impide agregar «?» fuera de la lista sin decirlo.
- **Eventos.** Los eventos se agrupan en **grupos de eventos**: el nombre del grupo genera solo el
  namespace del script. Vista previa visual de un evento de país o de una noticia mundial.
- **Decisiones.** Toda decisión pertenece a una categoría (la ventana obliga a elegirla o crearla). Los
  cuatro tipos se eligen con tarjetas; la vista previa muestra la categoría como en el juego, con
  ícono, nombre, costo y días de cada decisión. Los íconos de decisiones y categorías pueden ser del
  juego (miniaturas reales) o propios.
- **Ejército.** Solo unidades **terrestres**, agrupadas en Infantería, Móviles, Blindados, Artillería,
  antitanque y antiaérea, y Apoyo (las aéreas y navales no aparecen). El nombre sale de la
  localización del juego (español primero, luego una tabla propia y por último el inglés del juego) y
  el ícono, del sprite del batallón en `interface/*.gfx` con miniaturas en la caché; si no se
  encuentra, se usa un ícono genérico por tipo. Plantillas de arranque: en blanco, infantería,
  motorizada y blindada (se omiten los batallones que el juego no tiene).
- **Tecnologías e ideologías.** La lista tiene dos grupos: «Ideologías» (subideologías agrupadas en
  Democracia, Comunismo, Fascismo y No alineado) y «Tecnologías». El color se elige con un **selector
  de color** (en vez de tres cajas r g b) y exporta el mismo valor. El ícono se sube o se toma de la
  biblioteca. El Modo avanzado es un interruptor con una frase corta y su «?». La vista previa muestra
  la subideología como en la ventana de gobierno y la tecnología como una casilla del árbol.
- **Países.** En el paso de banderas cada variante lleva un nombre claro («Bandera si el país es
  comunista»…) y un «?» que explica cuándo la usa el juego.
- **Personajes y Extras.** Mismo esqueleto: Personajes se agrupa por país (papeles como botones y una
  ficha de vista previa); Extras se agrupa en Idiomas, Música, Pantallas de carga y El mod (portada e
  importar), y las canciones se pueden escuchar en la vista previa.

### Arreglos que salieron al probar
- La **cinta** tenía deshabilitado el botón «Crear …» en las secciones nuevas; ahora se activa y abre
  la misma ventana «Nuevo …» (lo cubre `tests/ui.test.ts`).
- La interfaz de Electron **no tiene `Buffer`**: al subir un `.ogg` siempre se marcaba como inválido y
  exportar música, sonidos de súper eventos o la portada habría fallado en la app real (en las pruebas
  de Node sí existía). Ahora se usa `shared/base64.ts` (`atob`), y `tests/noBuffer.test.ts` quita
  `Buffer` durante la prueba y vigila que no vuelva a usarse.
- El aviso de sonido de los súper eventos mostraba «por verificar» en pantalla; ahora lo dice con
  otras palabras (`tests/style.test.ts` revisa todos los textos de la interfaz).

### Constantes por verificar (solo en comentarios del código)
- `shared/gameUnits.ts`: grupos reales de `common/units` (`infantry`, `mobile`, `armor`, `artillery`,
  `support`), cómo se reconocen las unidades aéreas y navales, y los nombres de sprite de los
  batallones (`GFX_unit_<sprite>_icon_strip`…); nombres en español de reserva.
- `sections/oob.ts`: cuadrícula 5×5 y apoyo de 5, formaciones de las plantillas de arranque, nombre
  ordenado de división y producción en `instant_effect`.
- `sections/technologies.ts`: color de cada grupo de ideología y nombres en español de las carpetas
  de investigación; tamaño del ícono de subideología (32×32), nombre del sprite, `research_cost_coeff`
  y partidos por país.
- `sections/superEvents.ts`: sintaxis del efecto de sonido, tamaños de ventana y botones.
- Las ya existentes: tamaño de imagen de evento (si el juego no se puede leer), íconos y categorías de
  decisiones, edificios y categorías de estado de reserva, `chance` de la música, tamaños de pantallas
  de carga y de portada, retratos y `legacy_id`.

## Ronda de correcciones: espíritus, íconos del ejército, ideologías y árbol de tecnologías

- **Espíritus nacionales** usa el esqueleto común: lista agrupada por país (el país que los tiene como
  espíritu inicial, o «Sin país»), editor en tarjetas (Básico, Modificadores y Opciones avanzadas con el
  ID) y vista previa con el espíritu como en la pantalla de gobierno y su globo de información. La galería
  ofrece «Espíritu en blanco», «Copiar uno del juego» (abre «Elegir del juego»), «Bonificación económica» y
  «Penalización temporal».
- **Íconos del ejército.** El sprite de cada batallón es `GFX_unit_<ID de la unidad>_icon_medium`
  (confirmado en 1.19.3, `interface/subuniticons.gfx`); solo si no existe se prueba con el campo `sprite`
  (ver «Ronda del ejército» más abajo: `artillery_brigade` tiene `sprite = artillery`, que es el ícono de la
  artillería de apoyo). Se busca en todos los `interface/*.gfx` y se usa el `textureFile`
  del `.gfx` (nunca se adivina la ruta), con rutas normalizadas (`//`) y sin distinguir mayúsculas.
  Con `noOfFrames = 2` se muestra solo el primer cuadro. El lector DDS ya aceptaba sin compresión
  (máscaras de 16, 24 y 32 bits) y DXT1/3/5; un formato no soportado da el ícono genérico del tipo.
  Aparecen en la paleta, en las casillas y en la lista de plantillas.
- **Ideologías y Tecnologías** son dos secciones con su pestaña, su grupo en el Navegador, su botón
  «Crear», su ventana «Nuevo …» y su galería. Ideologías se agrupa en Democracia, Comunismo, Fascismo y No
  alineado; Tecnologías, por carpeta de investigación, y solo ahí está el Modo avanzado. Los proyectos
  existentes no cambian (mismos datos, mismo formato de exportación).
- **Carpetas de investigación.** El nombre sale de la localización del juego, todas en un mismo idioma
  (español si lo cubre; si no, el del juego). Se detectan los DLC instalados (carpeta `dlc/`) y las
  condiciones `has_dlc` de `common/technology_tags`; solo se ofrece la carpeta que el juego usa de verdad
  (la de un DLC instalado oculta a la normal del mismo nombre). «Mostrar todas» enseña las ocultas con la
  etiqueta del DLC, y una tecnología en una carpeta que no aplica lleva un aviso suave.
- **Árbol interactivo.** La vista previa de una tecnología es el árbol de su carpeta: tarjetas con ícono
  (`GFX_<id>`) y nombre localizado, líneas, años a un lado, zoom con la rueda, arrastre del fondo,
  «Centrar en mi tecnología» y «Ver en grande». Mi tecnología (borde naranja) se arrastra a una casilla
  libre (no se puede encimar); al pasar el mouse sale un globo con nombre, año, costo y efectos. Para
  conectar se arrastra desde el punto de abajo de una tecnología hasta otra; clic en una línea mía y Supr la
  borra. Las tecnologías y líneas del juego no se mueven ni se borran. Se leen las variables `@` de los
  archivos de tecnologías (por ejemplo `@1936`).
- **Cambio de exportación (pedido):** un requisito que sale de una tecnología del juego ya NO parcha el
  archivo del juego: se declara en la tecnología nueva con `dependencies = { <tecnología> = 1 }`. Entre
  dos tecnologías propias se sigue usando `path` → `leads_to_tech`. Nunca se escribe
  `countrytechtreeview.gui`.
- **Cinta.** Los botones de funciones que una sección no tiene ya no se muestran; los deshabilitados
  explican el motivo al pasar el mouse (por ejemplo «Elige un elemento de la lista»). Las pestañas se
  hicieron un poco más angostas para que entren las 15 en una pantalla de 1366 px.

Por verificar: que `dependencies = { … }` exija la tecnología en el juego; la forma de la condición de DLC
en `common/technology_tags` y los nombres de las claves de localización de las carpetas; los prefijos y
nombres de los DLC; el espaciado de la cuadrícula del árbol frente al del juego (`TREE_CELL`). El fondo de
la carpeta del juego no se dibuja (fondo neutro) y la caché de nombres de tecnologías es la del catálogo del
juego en memoria, no un archivo en `userData`.

## Ronda del ejército: íconos y unidades leídos del juego real

Esta ronda se hizo **leyendo tu juego** (1.19.3, solo lectura) en vez de adivinar. Para repetir la
comprobación en tu PC: `npm run report:army` (acepta la ruta del juego como argumento).

**Qué fallaba y por qué**
1. *Aviso falso «usa el batallón artillery_brigade, que no existe».* La lista de unidades solo aceptaba
   los `group` `infantry`, `mobile`, `armor`, `artillery` y `support`, pero la artillería de línea tiene
   `group = combat_support`. Además `type` es un bloque (`type = { infantry artillery }`) y el lector lo
   leía mal. Resultado: la unidad se descartaba y el validador decía que no existía.
2. *Artillería con el ícono genérico.* Se buscaba primero `GFX_unit_<sprite>_icon_medium`, y
   `artillery_brigade` tiene `sprite = artillery`, que es el ícono de la artillería de **apoyo**.
   El nombre del ícono usa el **ID de la unidad**, no el campo `sprite`.
3. *Apoyos de cazacarros con el ícono genérico.* Su línea en `subuniticons.gfx` trae la ruta sin comillas
   y la llave pegada (`noOfFrames = 2}`), y el lector exigía comillas, así que esos sprites no existían
   para la app.

**Cómo funciona ahora**
- **Ícono (Parte 1).** Se busca `GFX_unit_<ID>_icon_medium`; si no existe, `GFX_unit_<sprite>_icon_medium`;
  si tampoco, el ícono genérico del tipo.
- **Lector de `.gfx` (Parte 2).** Usa el mismo lector tolerante que las historias de país
  (`tokenizePdx`): acepta rutas con o sin comillas, la llave pegada al valor, tabuladores, BOM, claves en
  cualquier mayúscula y comentarios. Con tu juego lee 26 202 sprites (el lector anterior se saltaba 1 548 y
  cortaba los nombres con `@` o con letras acentuadas).
- **Unidades terrestres (Parte 3).** Una unidad *existe* si aparece en **cualquier** `sub_units` de
  `common/units`, sea cual sea su grupo. Es *terrestre* según su `group`:

  | `group` en el juego | Unidades | Categoría en la app |
  |---|---|---|
  | `infantry` | 13 | Infantería |
  | `mobile` | 9 | Móviles |
  | `armor` | 11 | Blindados |
  | `combat_support` | 4 | Artillería, antitanque y antiaérea |
  | `mobile_combat_support` | 5 | Artillería, antitanque y antiaérea |
  | `armor_combat_support` | 12 | Artillería, antitanque y antiaérea |
  | `support` | 68 | Apoyo |
  | *(sin `group`)* | 36 | No terrestres: 25 aéreas y misiles, 9 navales y 2 cañones de tren |

  Si un mod usa un `group` que no conocemos, se decide por las palabras de `type` (`support`, `artillery`,
  `armor`, `motorized`, `infantry`…), y un `map_icon_category = ship` nunca cuenta como terrestre. Una unidad
  aérea o naval que se cuele en una plantilla da un aviso distinto («existe, pero no es una unidad
  terrestre»), no el de «no existe».
- **Resultado en tu juego:** de las 122 unidades terrestres, **las 122 tienen ícono real** (todas por su ID;
  ninguna necesitó el respaldo del `sprite` y ninguna queda con el genérico).
