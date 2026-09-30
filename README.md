# HOI4 Mod Studio

Aplicación de escritorio (Windows) para crear mods de **Hearts of Iron IV** sin escribir código.
En esta primera etapa incluye el **editor de árboles de focos** (focus tree).

- Lienzo con cuadrícula: añade focos, arrástralos, conéctalos como prerrequisitos (línea blanca) o como mutuamente excluyentes (línea roja). Zoom con la rueda del ratón y desplazamiento arrastrando el fondo.
- Panel del foco: id, nombre, descripción, costo (1 unidad = 7 días) e ícono genérico.
- Editor de bloques (Blockly, estilo Scratch) con 3 ranuras: **Requisitos**, **Saltar si** (bloques azules de condición) y **Recompensa** (bloques verdes de efecto).
- Vista previa en vivo del script que se genera.
- Validador y exportación a un mod listo para el lanzador del juego.

---

## 1. Instalar lo necesario (solo la primera vez)

1. **Node.js 20 LTS**: descárgalo de <https://nodejs.org/> (botón «LTS») e instálalo con las opciones por defecto.
   Para comprobarlo, abre **PowerShell** (tecla Windows → escribe «PowerShell») y ejecuta:
   ```powershell
   node -v
   npm -v
   ```
   Debe mostrar algo como `v20.x.x` y `10.x.x`.
2. **Git** (opcional, para descargar el proyecto): <https://git-scm.com/download/win>.
3. Descarga el proyecto:
   ```powershell
   git clone https://github.com/Eduardo2345wet/hoiv.git
   cd hoiv
   ```
   (Sin Git: en GitHub pulsa **Code → Download ZIP**, descomprímelo y abre PowerShell dentro de la carpeta.)
4. Instala las dependencias (tarda unos minutos):
   ```powershell
   npm install
   ```

## 2. Correr la app

```powershell
npm run dev
```

Se abre la ventana de **HOI4 Mod Studio**. Mientras está abierta, cualquier cambio en el código se recarga solo.
Para cerrarla, cierra la ventana o pulsa `Ctrl + C` en PowerShell.

Otros comandos útiles:

| Comando | Para qué sirve |
| --- | --- |
| `npm test` | Ejecuta las pruebas automáticas. |
| `npm run lint` | Revisa el estilo del código. |
| `npm run build` | Comprueba los tipos y compila la app a la carpeta `out/`. |
| `npm run build:win` | Crea un instalador `.exe` en la carpeta `dist/`. |

## 3. Usar el editor

1. **Nuevo mod** → escribe el nombre del mod y el **tag** del país (3 letras, p. ej. `SPR` = España, `MEX` = México, `GER` = Alemania). No se permiten `NOT`, `AND`, `TAG`, `OOB`, `LOG`, `NUM`, `RED`.
2. Pulsa **Añadir foco** (o doble clic en la cuadrícula). Selecciónalo para editar nombre, descripción, costo e ícono en el panel derecho.
3. Conectar focos (barra del lienzo):
   - **Prerrequisito**: clic en el foco «padre» y luego en el «hijo».
   - **Excluyente**: clic en los dos focos. Repite los mismos clics para quitar una conexión.
4. En la parte de abajo arrastra bloques desde las categorías de la izquierda hasta las ranuras naranjas. Los bloques azules solo encajan en *Requisitos* y *Saltar si*; los verdes solo en *Recompensa*.
5. **Guardar** (`Ctrl + S`) crea tu `proyecto.json`. Con **Abrir proyecto** lo recuperas más tarde.

## 4. Exportar y probar el mod dentro del juego

1. Pulsa **Exportar mod**. Si el validador encuentra errores (ids repetidos, focos sin nombre, prerrequisitos a focos borrados, llaves `{ }` desbalanceadas...) los verás en español; haz clic en uno para ir al foco.
2. Pulsa **Elegir carpeta y exportar** y elige:
   ```
   Documentos\Paradox Interactive\Hearts of Iron IV\mod
   ```
   ⚠️ No elijas nunca la carpeta donde está instalado el juego (`...\steamapps\common\Hearts of Iron IV`); la app lo bloquea.
3. Se crean estos archivos:
   ```
   mod\
   ├── mi_mod.mod                       ← le dice al lanzador dónde está el mod
   └── mi_mod\
       ├── descriptor.mod
       ├── common\national_focus\TAG_focus.txt
       └── localisation\english\mi_mod_l_english.yml
   ```
4. Abre **Steam → Hearts of Iron IV → Jugar** para abrir el lanzador de Paradox.
5. En el lanzador ve a **Todos los mods** (o **Conjuntos de reproducción**), crea un conjunto nuevo y **añade tu mod**. Actívalo.
6. Pulsa **Jugar**. Empieza una partida (1936 o 1939) **eligiendo el país cuyo tag usaste** (p. ej. España si pusiste `SPR`).
7. Abre la pestaña de **Focos nacionales** (tecla `F` o el botón de arriba a la izquierda): deberías ver tu árbol.
8. Consejos para probar rápido:
   - Abre la consola con la tecla `º` (teclado español) o `~` (teclado inglés). Escribe `Focus.AutoComplete` para que los focos se completen al instante y comprobar las recompensas, y `debug` para ver más información.
   - Si algo falla, revisa el archivo de errores: `Documentos\Paradox Interactive\Hearts of Iron IV\logs\error.log` y busca el nombre de tu mod o de tus focos.
   - El idioma del juego debe estar en **inglés** para ver los nombres (la localización se exporta en `english`). En otro idioma verás los ids en lugar de los nombres.
   - Si el lanzador marca el mod como incompatible, abre `descriptor.mod` y el `.mod` exterior y cambia `supported_version="1.16.*"` por tu versión (se ve abajo a la izquierda del lanzador, p. ej. `1.15.*`).

## 5. Organización del código

```
src/
├── main/                 Proceso principal de Electron (ventanas, diálogos, escritura de archivos)
│   └── export/writeMod.ts  Escribe el mod en disco (con/sin BOM) y bloquea la carpeta del juego
├── preload/              Puente seguro entre la interfaz y el proceso principal
├── shared/               Código común (validación del tag, nombre de carpeta del mod)
└── renderer/src/         Interfaz (React)
    ├── blocks/           Definición de los bloques de Blockly, tema oscuro y caja de herramientas
    ├── generator/        Generador propio `new Blockly.CodeGenerator('PDX')` → script de Paradox
    ├── export/           Construye focus_tree, localización y el validador
    ├── model/            Modelo del proyecto (proyecto.json) e íconos genéricos
    └── ui/               Pantallas y paneles (inicio, lienzo, panel del foco, bloques, vista previa)
```
