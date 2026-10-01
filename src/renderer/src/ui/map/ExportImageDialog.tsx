// "Exportar imagen del mapa (PNG)": tamaño (1×, 2× o la vista actual), con o sin etiquetas y con
// o sin fronteras de provincia. La imagen se genera fuera de pantalla con el mismo motor.
import { useState } from 'react'
import {
  EXPORT_BASE,
  exportFileName,
  type ExportOptions,
  type ExportSize
} from '../../map/exportImage'
import type { MapViewHandle } from './MapView'
import { store } from '../../store/appStore'
import Modal from '../Modal'

interface Props {
  view: MapViewHandle | null
  modName: string
  /** Ajustes que ya tiene el mapa en pantalla (punto de partida de las casillas) */
  initial: { labels: boolean; provinceBorders: boolean }
  onClose: () => void
}

const SIZES: [ExportSize, string][] = [
  ['1x', '1× (tamaño del mapa)'],
  ['2x', '2× (el doble)'],
  ['view', 'La vista actual']
]

export default function ExportImageDialog({ view, modName, initial, onClose }: Props): JSX.Element {
  const [size, setSize] = useState<ExportSize>('1x')
  const [labels, setLabels] = useState(initial.labels)
  const [prov, setProv] = useState(initial.provinceBorders)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dpr = window.devicePixelRatio || 1

  const screen = view?.screen() ?? { width: 0, height: 0 }
  const dims = (s: ExportSize): string =>
    s === 'view'
      ? `${Math.round(screen.width * dpr)} × ${Math.round(screen.height * dpr)}`
      : `${EXPORT_BASE.w * (s === '2x' ? 2 : 1)} × ${EXPORT_BASE.h * (s === '2x' ? 2 : 1)}`

  const run = async (): Promise<void> => {
    if (!view) return
    setBusy(true)
    setError(null)
    try {
      // Deja pintar el "Generando…" antes de empezar el trabajo pesado
      await new Promise((r) => setTimeout(r, 30))
      const opts: ExportOptions = { size, labels, provinceBorders: prov }
      const r = await view.exportImage(opts)
      const name = exportFileName(modName, size)
      const bytes = new Uint8Array(await r.blob.arrayBuffer())
      if (window.electronAPI?.saveImageDialog) {
        const res = await window.electronAPI.saveImageDialog(bytes, name)
        if (!res) return setBusy(false) // canceló "Guardar como"
        if ('error' in res) {
          setError(res.error)
          return setBusy(false)
        }
        store.toast(`Imagen guardada (${r.width}×${r.height}): ${res.path}`)
      } else {
        // Sin Electron (pruebas en el navegador): descarga normal
        const a = document.createElement('a')
        a.href = URL.createObjectURL(r.blob)
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 10000)
        store.toast(`Imagen creada (${r.width}×${r.height})`)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Exportar imagen del mapa (PNG)"
      width={460}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button className="btn" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary disabled:opacity-40"
            disabled={busy || !view}
            onClick={run}
          >
            {busy ? 'Generando imagen…' : 'Exportar PNG'}
          </button>
        </>
      }
    >
      <label className="label">Tamaño</label>
      <div className="mb-3 flex flex-col gap-1">
        {SIZES.map(([s, text]) => (
          <label key={s} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="export-size"
              checked={size === s}
              onChange={() => setSize(s)}
            />
            {text}
            <span className="ml-auto font-mono text-xs text-hoi-muted">{dims(s)}</span>
          </label>
        ))}
      </div>
      <label className="label">Incluir</label>
      <label className="mb-1 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
        Etiquetas (números, nombres y capitales)
      </label>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={prov} onChange={(e) => setProv(e.target.checked)} />
        Fronteras de provincia
      </label>
      <p className="text-xs text-hoi-muted">
        La imagen sale del mismo dibujo que ves en pantalla (mar azul, tierra blanca o del color del
        país). El tamaño 2× necesita bastante memoria; si falla, usa 1×.
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </Modal>
  )
}
