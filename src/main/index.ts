import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import path from 'path'
import { handleExportMod } from './export'
import { saveImage } from './saveImage'
import { readGameFlags } from './gameFlags'
import { createProjectFolder, readProjectFile } from './projectFiles'
import { getJomini, loadRealMap } from './mapLoader'
import { listInstalledMods, type ModLayer } from './mods'
import { findHoi4, isHoi4Install, systemEnv } from './steamDetect'
import { planStatePatches, type StatePatchRequest } from './statesExport'
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
  ipcMain.handle('select-folder', async () => {
    const defaultModDir = path.join(
      app.getPath('documents'),
      'Paradox Interactive',
      'Hearts of Iron IV',
      'mod'
    )
    const defaultPath = fs.existsSync(defaultModDir) ? defaultModDir : app.getPath('documents')

    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('get-default-mod-path', async () => {
    const defaultModDir = path.join(
      app.getPath('documents'),
      'Paradox Interactive',
      'Hearts of Iron IV',
      'mod'
    )
    return defaultModDir
  })

  ipcMain.handle(
    'save-project-dialog',
    async (_, content: string, defaultName = 'proyecto.json') => {
      const result = await dialog.showSaveDialog({
        title: 'Guardar proyecto',
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

  ipcMain.handle('export-mod', async (_, payload) => {
    return handleExportMod(payload)
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
