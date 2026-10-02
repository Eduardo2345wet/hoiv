// "Exportar mod": elegir la carpeta donde se crea el mod. La app NUNCA escribe en la carpeta de
// mods del juego: el usuario copia a mano la carpeta del mod y su .mod.
import { useState } from 'react'
import { store, useApp } from '../store/appStore'
import { safeFolderName } from '../../../shared/names'
import Modal from './Modal'

export default function ExportDialog(): JSX.Element | null {
  const d = useApp((s) => s.exportDialog)
  const [custom, setCustom] = useState<string | null>(null)
  if (!d) return null
  const folder = custom ?? d.info.lastDir ?? d.info.defaultDir
  const slug = safeFolderName(d.modName)
  const close = (r: string | null): void => {
    setCustom(null)
    store.answerExportFolder(r)
  }
  return (
    <Modal
      title="Exportar mod"
      width={560}
      onClose={() => close(null)}
      footer={
        <>
          <button className="btn" onClick={() => close(null)}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => close(folder)}>
            Exportar
          </button>
        </>
      }
    >
      <label className="label">Carpeta de destino</label>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 break-all rounded border border-hoi-border bg-hoi-card px-2 py-1 font-mono text-xs">
          {folder}
        </span>
        <button
          className="btn text-xs"
          onClick={async () => {
            const f = await window.electronAPI?.selectFolder(folder)
            if (f) setCustom(f)
          }}
        >
          Cambiar…
        </button>
      </div>
      <p className="mt-3 text-sm">En esa carpeta se crearán exactamente dos cosas:</p>
      <ul className="mt-1 list-disc pl-5 font-mono text-xs">
        <li>{slug}/ (el mod)</li>
        <li>{slug}.mod</li>
      </ul>
      <p className="mt-3 text-sm">Para jugar, copia las DOS cosas a la carpeta de mods de HOI4:</p>
      <p className="mt-1 break-all rounded border border-hoi-border bg-hoi-card px-2 py-1 font-mono text-xs">
        {d.info.modsDir}
      </p>
      {!d.info.docsFound && (
        <p className="mt-1 text-xs text-yellow-300">
          No encontré la carpeta de HOI4 en Documentos: esa es la ruta habitual (créala o abre el
          juego una vez).
        </p>
      )}
      <p className="mt-3 text-xs text-hoi-muted">
        La app nunca escribe en la carpeta del juego ni en la de mods de HOI4.
      </p>
    </Modal>
  )
}
