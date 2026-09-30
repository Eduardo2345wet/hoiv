// Proceso principal de Electron: crea la ventana y maneja el acceso a disco (diálogos, exportar).

import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { ExportModPayload } from '../shared/exportTypes'
import { handleExportMod } from './export/writeMod'

/** Carpeta de mods por defecto: Documentos/Paradox Interactive/Hearts of Iron IV/mod */
function defaultModDir(): string {
  return path.join(app.getPath('documents'), 'Paradox Interactive', 'Hearts of Iron IV', 'mod')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#121214',
    title: 'HOI4 Mod Studio',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
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
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.hoi4modstudio.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Elegir carpeta de exportación (por defecto la carpeta de mods del juego).
  ipcMain.handle('select-folder', async () => {
    const modDir = defaultModDir()
    const result = await dialog.showOpenDialog({
      title: 'Elige la carpeta "mod" de Hearts of Iron IV',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: fs.existsSync(modDir) ? modDir : app.getPath('documents')
    })
    if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0]
    return null
  })

  ipcMain.handle('get-default-mod-path', async () => defaultModDir())

  // Guardar proyecto con diálogo ("Guardar como"). Devuelve la ruta elegida o null.
  ipcMain.handle('save-project-dialog', async (_, content: string, defaultName = 'proyecto.json') => {
    const result = await dialog.showSaveDialog({
      title: 'Guardar proyecto',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'Proyecto de HOI4 Mod Studio', extensions: ['json'] }]
    })
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8')
      return result.filePath
    }
    return null
  })

  // Guardar proyecto en una ruta ya conocida (botón "Guardar").
  ipcMain.handle('save-project', async (_, filePath: string, content: string) => {
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('open-project-dialog', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Abrir proyecto',
      properties: ['openFile'],
      filters: [{ name: 'Proyecto de HOI4 Mod Studio', extensions: ['json'] }]
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      return { path: filePath, content: fs.readFileSync(filePath, 'utf-8') }
    }
    return null
  })

  ipcMain.handle('export-mod', async (_, payload: ExportModPayload) => handleExportMod(payload))

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
