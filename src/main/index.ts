import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import path from 'path'
import { handleExportMod } from './export'
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
  ipcMain.handle('set-settings', async (_, s: Settings) => saveSettings(settingsFile, s))
  ipcMain.handle('select-game-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Carpeta de instalación de Hearts of Iron IV',
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('read-game-catalog', async (_, gamePath: string) => readGameCatalog(gamePath))

  ipcMain.handle('read-country-history', async (_, gamePath: string, fileName: string) =>
    readCountryHistory(gamePath, fileName)
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
