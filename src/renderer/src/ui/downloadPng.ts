// "Descargar PNG": guarda una imagen (data URL) con "Guardar como" (o descarga normal sin Electron)
import { store } from '../store/appStore'

export async function downloadPng(dataUrl: string, fileName: string): Promise<void> {
  const api = window.electronAPI
  if (api?.saveImageDialog) {
    const bin = atob(dataUrl.split(',')[1])
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const r = await api.saveImageDialog(bytes, fileName)
    if (!r) return
    if ('error' in r) return store.toast(r.error, { kind: 'error' })
    return store.toast(`Imagen guardada: ${r.path}`)
  }
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = fileName
  a.click()
}
