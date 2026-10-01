# HOI4 Mod Studio

Estudio de creación de mods para Hearts of Iron IV sin código (Electron + React + TypeScript + Tailwind + Blockly + Editor de Mapa).

## Características principales

- **Editor de Árboles de Focos:** Varios árboles por proyecto (uno por país), interfaz drag-and-drop con Blockly para lógica de recompensas, prerrequisitos y exclusividades.
- **Catálogo de Elementos:** Integración con `FieldCatalog` para autocompletar e inspeccionar elementos del mod y del juego base.
- **Espíritus Nacionales e Íconos:** Diseñador con recetas de emojis, renderizado automático de imágenes `.dds` y `.gfx` en tiempo de exportación.
- **Asistente "Crear País":** Generación de países nuevos (banderas TGA en 3 tamaños, líderes DDS, política e historia) o edición de países existentes.
- **Módulo de Mapa Interactivo:**
  - **Parte 1 — Mapa de Demostración:** Mapa procedural Voronoi (~1200x600 px, ~300 provincias, ~40 estados, 4 países ficticios DMA, DMB, DMC, DMD) determinista, permitiendo probar TODAS las funciones del editor sin tener HOI4 instalado.
  - **Parte 2 — Carga del Mapa Real:** Lector de `map/provinces.bmp` (parser de 24 bits), `map/definition.csv` y `history/states/*.txt` con barra de progreso IPC y sistema de caché rápido en `userData`.
  - **Parte 3 — Herramientas tipo Paint:** Seleccionar (V), Pincel (B), Cubeta (G), Fijar capital (C), Core/Reclamación (K), Borrador (E) y Cuentagotas (I) con historial completo de Deshacer/Rehacer (Ctrl+Z / Ctrl+Y).
  - **Parte 4 — Render e Interacción:** Canvas interactivo con WebGL2 / Canvas 2D fallback, minimapa interactivo, controles de zoom/desplazamiento, mododos de vista (Político, Estados, Cores, Cambios) e imagen de referencia transparente.
  - **Parte 5 — Integración startPick `state`:** Opción "🗺 Elegir en el mapa..." en el asistente de país y en los bloques de Blockly para seleccionar un estado haciendo clic en el mapa.
  - **Parte 6 — Exportador Parcheador:** Parcheador seguro de texto para los archivos `history/states/` que aplica ediciones mínimas conservando comentarios, sangrado, bloques con fecha y finales de línea CRLF/LF.
  - **Parte 7 — Validador del Mod y Navegación:** Comprobador de errores y avisos en tiempo real con botón "Ir" para centrar el mapa o el asistente en el elemento afectado.

## Pasos para probar el proyecto

### 1. Instalación de dependencias
```bash
npm install
```

### 2. Ejecutar las pruebas unitarias e integración
```bash
npm test
```
Ejecuta los 78 tests integrados en Vitest (parsers BMP/CSV, adyacencias del mapa de demostración, herramientas de mapa con deshacer/rehacer, parcheador de estados, validador y migración de proyectos).

### 3. Verificar tipos e interfaz
```bash
npx tsc --noEmit
```

### 4. Modo de desarrollo (Electron + Vite)
```bash
npm run dev
```

## Lista de elementos "// por verificar"

Los siguientes detalles técnicos están definidos en `src/shared/verifyConstants.ts` y marcados para verificación con la wiki de HOI4 o archivos del juego:

1. `STATE_CATEGORIES`: Lista completa de categorías válidas de estado en el juego base (`wasteland`, `enclave`, `tiny_island`, `small_island`, `pastoral`, `rural`, `town`, `large_town`, `city`, `large_city`, `metropolis`, `megalopolis`).
2. `HISTORY_CORE_PRECEDENCE`: Orden exacto de precedencia entre `add_core_of` y `add_claim_by` en el bloque de historia al cargar la partida.
3. `DDS_UNCOMPRESSED_FORMAT`: Formato de pixel no comprimido (A8R8G8B8 / BGRA) utilizado en las imágenes DDS de retratos de líderes.
