# HOI4 Mod Studio

App de escritorio (Windows) para crear **árboles de focos** de Hearts of Iron IV sin escribir código.

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

## Usar

| Comando | Qué hace |
|---|---|
| `npm run dev` | Abre la app en modo desarrollo (se recarga sola al cambiar código) |
| `npm test` | Ejecuta las pruebas automáticas |
| `npm run build:win` | Crea el instalador `.exe` en la carpeta `dist/` |

## Estructura del código

```
src/main/            Proceso principal de Electron (ventanas, archivos, exportar)
src/preload/         Puente seguro entre la interfaz y Node
src/renderer/src/
  blocks/            Bloques de Blockly (condiciones, efectos, ranuras)
  generator/         Bloques → script de Paradox, y proyecto → archivos del mod
  export/            Validador y exportación
  ui/                Pantallas y componentes (lienzo, panel, Blockly, vista previa)
  types.ts           Formato de proyecto.json
tests/               Pruebas automáticas
```

## Probar el mod en el juego

1. En la app: **Exportar mod** → elige `Documentos/Paradox Interactive/Hearts of Iron IV/mod`.
2. Abre el **launcher** de HOI4 → *Playsets* → añade tu mod y actívalo.
3. Inicia una partida con el país de tu tag y abre **Focos nacionales**.
4. Si algo falla, mira `Documentos/Paradox Interactive/Hearts of Iron IV/logs/error.log`.
   Tip: arranca el juego con `-debug` (Steam → Propiedades → Opciones de lanzamiento) y en
   la consola usa `focus.autocomplete` para completar focos al instante.
