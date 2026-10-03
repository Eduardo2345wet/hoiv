# HOI4 Mod Studio — contexto y reglas del proyecto

## Qué es
App de escritorio para Windows que permite a principiantes crear mods de Hearts of Iron IV (HOI4) sin escribir código: focos con bloques estilo Scratch (Blockly), mapa tipo Paint, países, ideologías, espíritus, eventos, súper eventos, decisiones, personajes, ejército, tecnologías, extras y exportación manual del mod.

## Usuario
- Eduardo: habla español y es principiante en programación. Explícale todo en español, de forma sencilla. Al terminar, dale un resumen corto y claro, y los pasos exactos para probar.
- A veces pasa las instrucciones como archivos .txt (por ejemplo, en la carpeta prompts/). Léelos completos antes de empezar.

## Rutas (trabajo LOCAL en su PC)
- Proyecto: C:\dev\hoiv (rama claude/laughing-wozniak-v4q857). Haz commit y push al terminar cada parte, como respaldo.
- Juego HOI4 1.19.3 (Steam): C:\Program Files (x86)\Steam\steamapps\common\Hearts of Iron IV → SOLO LECTURA. Nunca escribas ahí.
- Documentos de HOI4: C:\Users\jecal\Documents\Paradox Interactive\Hearts of Iron IV (mod\, logs\error.log, crashes\) → SOLO LECTURA, salvo que Eduardo pida explícitamente otra cosa.
- Proyectos de la app: C:\Users\jecal\Documents\HOI4 Mod Studio\Proyectos
- El Escritorio está redirigido a OneDrive: en PowerShell usa [Environment]::GetFolderPath("Desktop").
- El disco C: ha estado casi lleno: no generes archivos grandes innecesarios y limpia lo temporal.

## Comandos
- npm install · npm run dev · npm test · npm run test:build · typecheck
- Al terminar cada parte: typecheck + npm test + npm run test:build, y un commit con un mensaje claro.

## Reglas de trabajo
- Antes de programar, lee el código existente y REUTILIZA lo que ya hay. No dupliques nada y no rompas nada.
- Para cada bug: PRIMERO una prueba que lo reproduzca y falle; luego el arreglo; explica la causa.
- Ahora que trabajas local, VERIFICA con los archivos reales del juego en lugar de adivinar. Lo que solo se puede comprobar jugando va marcado "// verificar en el juego".
- No copies archivos ni texto de Paradox al repositorio: las pruebas usan fixtures escritos por ti. Las imágenes del juego se leen de la instalación y sus miniaturas van solo a la caché (userData).
- Exportación MANUAL: la app nunca escribe ni borra en la carpeta del juego ni en su carpeta de mods. "Exportar mod" crea <slug>/ y <slug>.mod en una carpeta elegida, y Eduardo los copia a mano.
- Para cambios de interfaz, el script exportado debe quedar idéntico para el mismo contenido (prueba de regresión), salvo cambios pedidos explícitamente.

## Estilo de la interfaz (respétalo siempre)
- Español. Sin emojis en la interfaz (los íconos que elige el usuario son contenido y sí se quedan). Íconos de línea (lucide-react).
- Sin nombres en inglés ni nombres de código en las etiquetas; los IDs solo pequeños y en gris.
- Tono tranquilo: naranja (#e8913a) solo para la acción principal y para lo seleccionado; tema oscuro.
- Esqueleto de 3 columnas en cada sección: lista por grupos (izquierda), editor en tarjetas con "Opciones avanzadas" plegada (centro) y vista previa visual con "Ver código" plegado (derecha). Galería de plantillas en el estado vacío. La ventana "Nuevo …" pide nombre y grupo, nunca un ID.
- Ayuda "?" solo en los conceptos difíciles (los textos están en helpTexts.ts).
- Nunca mostrar "por verificar" en la interfaz.

## Datos del juego ya confirmados
- Steam app 394360. dependencies hace que el mod cargue después de los mods listados. replace_path sustituye solo esa carpeta exacta.
- launcher-settings.json está en la RAÍZ del juego, con "rawVersion": "1.19.3.0" → supported_version="1.19.*".
- history/countries empieza con BOM y "capital = N" va en la primera línea.
- Árboles de focos de países del juego con add = 20: CONFIRMADO en el juego.
- Íconos de batallón: GFX_unit_<ID de la unidad>_icon_medium en interface/subuniticons.gfx (noOfFrames = 2: usar el primer cuadro). NO usar el campo sprite como primera opción: por ejemplo, GFX_unit_artillery_icon_medium es la artillería de APOYO y GFX_unit_artillery_brigade_icon_medium la de línea.
- Algunos .gfx tienen textureFile sin comillas y llaves pegadas ("noOfFrames = 2}"): usar un lector tolerante (jomini).
- artillery_brigade está en common/units/artillery_brigade.txt con group = combat_support, map_icon_category = infantry, type = { infantry artillery }.
- Rutas del juego con barras dobles ("gfx//interface//…"): normalizarlas.
- Muchas texturas DDS del juego no tienen compresión (FourCC vacío).
- Errores del juego base que NO son del mod: IRQ_kamil_shabib, CHL_famae_organization, GER/SOV_super_heavy_armor_entity, SOV_*_character_for_loc.
- Los crashes que hubo se debieron al disco lleno (memoria virtual) y a un mod llamado "."; no eran del código del mod.

## Formato de archivos (decisiones fijas)
- Localización en UTF-8 CON BOM; descriptor.mod SIN BOM.
- Banderas: TGA de 32 bits sin compresión (82×52, 41×26, 10×7), origen abajo-izquierda. Retrato de líder: 156×210 DDS. Ícono de foco: 100×88 (+ sprite _shine). Ícono de espíritu: 60×68.
- Parches mínimos sobre los bytes originales de los archivos del juego (estados, capitales), con el mismo nombre de archivo.
- Personajes en <mod>_TAG_characters.txt.
