# HOI4 Mod Studio

App de escritorio (Windows) para crear **árboles de focos** y **espíritus nacionales** de Hearts of Iron IV sin escribir código.

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

## Qué puedes hacer

- **Árbol de focos**: cuadrícula con zoom, arrastrar, prerrequisitos (línea normal) y excluyentes (línea roja).
- **Bloques** (estilo Scratch) con 3 ranuras: Requisitos, Saltar si y Recompensa.
- **Listas en vez de escribir IDs**: espíritus, focos, países y marcas se eligen de un menú.
  Al final del menú están "+ Crear nuevo…" y "Escribir otro ID…" (para cosas de otros mods o DLC).
- **🎯 Elegir en el árbol**: en "completó el foco", haz clic directamente en el foco.
- **Espíritus nacionales**: nombre, id automático, descripción, ícono y modificadores.
- **Íconos**: cada foco o espíritu nuevo recibe solo un ícono con emoji según su nombre
  ("Industrializar" → 🏭). Puedes cambiarlo por otro emoji, subir una imagen o usar uno del juego.
- **Ajustes (⚙)**: carpeta del juego OPCIONAL, solo para leer más países y espíritus.

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
<mod>/localisation/english/<mod>_l_english.yml  (UTF-8 con BOM)
```

## Estructura del código

```
src/main/            Proceso principal de Electron (ventanas, archivos, exportar, leer el juego)
src/preload/         Puente seguro entre la interfaz y Node
src/shared/          Nombres seguros de archivos (compartido)
src/renderer/src/
  blocks/            Bloques de Blockly y el campo FieldCatalog (menú con catálogo)
  catalog/           Catálogo central (focos, ideas, marcas, países, estados) y modificadores
  generator/         Bloques → script de Paradox; árbol, ideas y localización
  export/            Validador, exportación, escritor DDS/TGA y plan de íconos (.gfx)
  icons/             Emojis, elección automática, tamaños y dibujo con canvas
  store/             Estado central de la app (proyecto, selección, modo "elegir", diálogos)
  ui/                Pantallas y componentes
  types.ts           Formato de proyecto.json (versión 2)
  migrate.ts         Abre proyectos viejos (versión 1) sin error
tests/               Pruebas automáticas
```

## Probar el mod en el juego

1. En la app: **Exportar mod** → elige `Documentos/Paradox Interactive/Hearts of Iron IV/mod`.
2. Abre el **launcher** de HOI4 → *Playsets* → añade tu mod y actívalo.
3. Inicia una partida con el país de tu tag y abre **Focos nacionales**.
4. Si algo falla, mira `Documentos/Paradox Interactive/Hearts of Iron IV/logs/error.log`.
   Tip: arranca el juego con `-debug` (Steam → Propiedades → Opciones de lanzamiento) y en
   la consola usa `focus.autocomplete` para completar focos al instante.
