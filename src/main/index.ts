import { readModFolder } from './modReader'
import type { SpriteKind } from '../shared/gfxSprites'
import { listSprites, prewarm, spriteThumbs } from './gameSprites'
import { planTextPatches, type TextPatchRequest } from './textPatches'
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import path from 'path'
import { exportPreviousExists, handleExportMod } from './export'
import { findInvalidLeftovers, reviewInstalled } from './reviewInstalled'
import { readIdeasCatalog } from './ideasCatalog'
import { cacheInfo, clearCache } from './cacheTools'
import { listGameFiles } from './gameFiles'
import { safeFolderName } from '../shared/names'
import { saveImage } from './saveImage'
import { readGameFlags } from './gameFlags'
import { findHoi4Documents, hoi4DocumentsCandidates } from './hoi4Docs'
import {
  defaultExportDir,
  hoi4ModsDir,
  installedSupportedVersion,
  DEFAULT_SUPPORTED_VERSION
} from './exportInfo'
import { createProjectFolder, readProjectFile } from './projectFiles'
import { getJomini, loadRealMap } from './mapLoader'
import { listInstalledMods, type ModLayer } from './mods'
import { findHoi4, isHoi4Install, systemEnv } from './steamDetect'
import { planStatePatches, type StatePatchRequest } from './statesExport'
import { planCapitalPatches, type CapitalPatchRequest } from './capitalExport'
import {
  loadSettings,
  readCountryHistory,
  readGameCatalog,
  saveSettings,
  type Settings
} from './game'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'HOI4 Mod Studio',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Cerrar la app: la interfaz pregunta UNA vez por los proyectos sin guardar. Si no contesta
  // enseguida (por ejemplo, no cargó), se cierra igual.
  let allowClose = false
  let acked = false
  mainWindow.on('close', (e) => {
    if (allowClose) return
    e.preventDefault()
    acked = false
    mainWindow.webContents.send('app-close-request')
    setTimeout(() => {
      if (!acked && !mainWindow.isDestroyed()) {
        allowClose = true
        mainWindow.close()
      }
    }, 1500)
  })
  ipcMain.removeHandler('app-close-ack')
  ipcMain.handle('app-close-ack', () => {
    acked = true
  })
  ipcMain.removeHandler('app-close-confirmed')
  ipcMain.handle('app-close-confirmed', () => {
    allowClose = true
    if (!mainWindow.isDestroyed()) mainWindow.close()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.hoi4modstudio.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC Handlers
  ipcMain.handle('select-folder', async (_, defaultPath?: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: defaultPath && fs.existsSync(defaultPath) ? defaultPath : app.getPath('desktop')
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle(
    'save-project-dialog',
    async (_, content: string, defaultName = 'proyecto.json') => {
      const result = await dialog.showSaveDialog({
        title: 'Guardar proyecto',
        // defaultName puede ser una ruta completa: el diálogo abre ya en esa carpeta y nombre
        defaultPath: defaultName,
        filters: [{ name: 'HOI4 Mod Studio Project', extensions: ['json'] }]
      })
      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, content, 'utf-8')
        return result.filePath
      }
      return null
    }
  )

  // Imagen PNG del mapa: abre "Guardar como" y escribe los bytes (nunca en la carpeta del juego)
  ipcMain.handle('save-image-dialog', async (_, bytes: Uint8Array, defaultName = 'mapa.png') => {
    const result = await dialog.showSaveDialog({
      title: 'Guardar imagen del mapa',
      defaultPath: defaultName,
      filters: [{ name: 'Imagen PNG', extensions: ['png'] }]
    })
    if (result.canceled || !result.filePath) return null
    const r = saveImage(result.filePath, new Uint8Array(bytes))
    return 'error' in r ? { error: r.error } : { path: result.filePath }
  })

  // Proyectos: carpeta por defecto, crear uno nuevo y abrir por ruta (recientes / pestañas)
  ipcMain.handle('get-projects-dir', async () =>
    path.join(app.getPath('documents'), 'HOI4 Mod Studio', 'Proyectos')
  )
  ipcMain.handle('create-project', async (_, parent: string, name: string, json: string) =>
    createProjectFolder(parent, name, json)
  )
  ipcMain.handle('open-project-path', async (_, file: string) => readProjectFile(file))

  // Datos para "Exportar mod". La app NUNCA escribe en la carpeta de mods del juego: estas rutas
  // solo se muestran y van en el .mod (donde el usuario copiará el mod a mano).
  const hoi4Docs = (): { docs: string | null; modsDir: string } => {
    const docs = findHoi4Documents(
      hoi4DocumentsCandidates(
        app.getPath('documents'),
        process.env as Record<string, string | undefined>
      )
    )
    const docsOrDefault =
      docs ?? path.join(app.getPath('documents'), 'Paradox Interactive', 'Hearts of Iron IV')
    return { docs, modsDir: hoi4ModsDir(docsOrDefault) }
  }
  ipcMain.handle('get-export-info', async () => {
    const st = loadSettings(settingsFile)
    const { docs, modsDir } = hoi4Docs()
    return {
      /** Carpeta de mods de HOI4 (con "/"), exista o no todavía */
      modsDir,
      docsFound: !!docs,
      defaultDir: defaultExportDir(app.getPath('desktop')),
      lastDir: st.lastExportDir ?? null,
      /** Versión del juego instalado como "1.19.*", o null si no se pudo leer */
      installedVersion: installedSupportedVersion(st.gamePath),
      fallbackVersion: st.supportedVersion || DEFAULT_SUPPORTED_VERSION
    }
  })
  ipcMain.handle('read-ideas-catalog', async (_, gamePath: string) =>
    readIdeasCatalog(gamePath, path.join(app.getPath('userData'), 'cache'))
  )
  // Memoria de la app (proceso principal + interfaz + GPU) y caché en disco
  ipcMain.handle('get-memory', async () => {
    const m = app.getAppMetrics()
    const kb = (f: (x: Electron.ProcessMetric) => number): number =>
      m.reduce((a, x) => a + f(x), 0) * 1024
    return {
      main: process.memoryUsage().rss,
      total: kb((x) => x.memory.workingSetSize),
      processes: m.map((x) => ({ type: x.type, bytes: x.memory.workingSetSize * 1024 }))
    }
  })
  const cacheDirPath = (): string => path.join(app.getPath('userData'), 'cache')
  ipcMain.handle('cache-info', async () => cacheInfo(cacheDirPath()))
  ipcMain.handle('clear-cache', async () => {
    clearCache(cacheDirPath())
    return cacheInfo(cacheDirPath())
  })
  ipcMain.handle('list-game-sprites', async (_, gamePath: string, kind: SpriteKind) =>
    listSprites(gamePath, kind)
  )
  ipcMain.handle('get-sprite-thumbs', async (_, gamePath: string, names: string[]) =>
    spriteThumbs(gamePath, path.join(app.getPath('userData'), 'cache'), names)
  )
  ipcMain.handle('prewarm-sprites', async (_, gamePath: string, kind: SpriteKind) =>
    prewarm(gamePath, path.join(app.getPath('userData'), 'cache'), kind)
  )
  ipcMain.handle('read-mod-folder', async (_, folder: string) => readModFolder(folder))
  ipcMain.handle('list-game-files', async (_, gamePath: string) => listGameFiles(gamePath))
  ipcMain.handle('export-exists', async (_, folder: string, modName: string) =>
    exportPreviousExists(folder, modName)
  )

  // Abre una carpeta (o muestra un archivo seleccionado) en el explorador del sistema
  ipcMain.handle('open-folder', async (_, p: string) => {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) shell.showItemInFolder(p)
      else await shell.openPath(p)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('save-project-to-path', async (_, filePath: string, content: string) => {
    if (!filePath.toLowerCase().endsWith('.json')) return false
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('open-project-dialog', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Abrir Proyecto',
      properties: ['openFile'],
      filters: [{ name: 'HOI4 Mod Studio Project', extensions: ['json'] }]
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const content = fs.readFileSync(filePath, 'utf-8')
      return { path: filePath, content }
    }
    return null
  })

  // ---- Ajustes y juego base (opcional) ----
  const settingsFile = path.join(app.getPath('userData'), 'settings.json')
  ipcMain.handle('get-settings', async () => loadSettings(settingsFile))
  // Se mezcla con lo guardado: quien cambia un campo no borra los demás
  ipcMain.handle('set-settings', async (_, s: Partial<Settings>) =>
    saveSettings(settingsFile, { ...loadSettings(settingsFile), ...s })
  )
  ipcMain.handle('select-game-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Carpeta de instalación de Hearts of Iron IV',
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  // ---- Detección automática de HOI4 (al arrancar, sin bloquear) ----
  ipcMain.handle('detect-game', async () => {
    const s = loadSettings(settingsFile)
    const env = systemEnv()
    // Una ruta elegida a mano se respeta mientras siga siendo válida
    if (s.gamePath && !s.gamePathAuto && isHoi4Install(env, s.gamePath))
      return { gamePath: s.gamePath, auto: false, via: 'manual' }
    const found = await findHoi4(env)
    if (found.gamePath) {
      saveSettings(settingsFile, { ...s, gamePath: found.gamePath, gamePathAuto: true })
      return { gamePath: found.gamePath, auto: true, via: found.via }
    }
    // No se encontró: si había una ruta guardada que ya no existe, se olvida
    if (s.gamePath && !isHoi4Install(env, s.gamePath))
      saveSettings(settingsFile, { ...s, gamePath: null })
    return { gamePath: null, auto: false, via: null, libraries: found.libraries }
  })

  ipcMain.handle('read-game-catalog', async (_, gamePath: string) => readGameCatalog(gamePath))

  ipcMain.handle('read-country-history', async (_, gamePath: string, fileName: string) =>
    readCountryHistory(gamePath, fileName)
  )

  // ---- Mapa real (con progreso). Los arreglos viajan como arreglos tipados, no como JSON ----
  ipcMain.handle('list-mods', async (_, gamePath: string | null) =>
    listInstalledMods(
      path.join(app.getPath('documents'), 'Paradox Interactive', 'Hearts of Iron IV'),
      gamePath
    )
  )

  // Banderas reales del juego (y del mod base, que tiene prioridad), como miniaturas PNG en la caché
  ipcMain.handle('read-game-flags', async (_, gamePath: string, mod: ModLayer | null) =>
    readGameFlags(gamePath, mod, path.join(app.getPath('userData'), 'cache'))
  )

  ipcMain.handle('load-map', async (event, gamePath: string, mod: ModLayer | null) => {
    try {
      const map = await loadRealMap(
        gamePath,
        path.join(app.getPath('userData'), 'cache'),
        (pct, message) => event.sender.send('map-progress', { pct, message }),
        mod
      )
      return { ok: true, map }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(
    'plan-state-patches',
    async (event, gamePath: string, requests: StatePatchRequest[], mod: ModLayer | null) =>
      planStatePatches(gamePath, requests, undefined, mod, (done, total) =>
        event.sender.send('states-progress', { done, total })
      )
  )

  ipcMain.handle(
    'plan-capital-patches',
    async (_, gamePath: string, requests: CapitalPatchRequest[], mod: ModLayer | null) =>
      planCapitalPatches(gamePath, requests, mod)
  )

  ipcMain.handle(
    'plan-text-patches',
    async (_, gamePath: string, requests: TextPatchRequest[], mod: ModLayer | null) =>
      planTextPatches(gamePath, requests, mod)
  )

  ipcMain.handle('export-mod', async (_, payload) => {
    const res = await handleExportMod(payload)
    // Se recuerda lo exportado para "Revisar mod instalado" (se guarda en los ajustes de la app)
    if (res.success && res.manifest) {
      const st = loadSettings(settingsFile)
      saveSettings(settingsFile, {
        ...st,
        lastExports: { ...st.lastExports, [res.manifest.slug]: res.manifest }
      })
    }
    return res
  })
  // Solo lectura: compara la copia de la carpeta de mods del juego con la última exportación
  ipcMain.handle('review-installed', async (_, modName: string) => {
    const slug = safeFolderName(modName)
    const manifest = loadSettings(settingsFile).lastExports?.[slug]
    const { modsDir } = hoi4Docs()
    const leftovers = findInvalidLeftovers(modsDir)
    if (!manifest) return { result: { status: 'no-export' }, modsDir, slug, leftovers }
    return { result: reviewInstalled(modsDir, manifest), modsDir, slug, leftovers }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Solo para `npm run test:build`: deja jomini y la carga del mapa a mano para probar el bundle
if (process.env.HOI4_BUNDLE_TEST)
  (globalThis as Record<string, unknown>).__hoi4Core = { getJomini, loadRealMap }
