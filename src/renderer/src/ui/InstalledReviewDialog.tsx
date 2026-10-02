// Ventana final de exportación + "Revisar mod instalado". SOLO LEE la carpeta de mods del juego:
// compara la copia instalada con la última exportación; nunca modifica nada ahí.
import { useCallback, useEffect, useState } from 'react'
import type { ReviewData } from '../../../preload/index.d'
import { store, useApp } from '../store/appStore'
import { safeFolderName } from '../../../shared/names'
import Modal from './Modal'

type Loaded = { result: ReviewData; modsDir: string; slug: string }

function List({ title, items }: { title: string; items: string[] }): JSX.Element | null {
  if (!items.length) return null
  return (
    <div className="mt-2">
      <div className="text-xs font-semibold text-hoi-muted">
        {title} ({items.length})
      </div>
      <ul className="max-h-24 list-disc overflow-y-auto pl-5 font-mono text-xs">
        {items.slice(0, 50).map((f) => (
          <li key={f}>{f}</li>
        ))}
        {items.length > 50 && <li>… y {items.length - 50} más</li>}
      </ul>
    </div>
  )
}

export default function InstalledReviewDialog(): JSX.Element | null {
  const d = useApp((s) => s.reviewDialog)
  const [data, setData] = useState<Loaded | null>(null)
  const [busy, setBusy] = useState(false)
  const run = useCallback(async (): Promise<void> => {
    const api = window.electronAPI
    if (!d || !api) return
    setBusy(true)
    try {
      setData(await api.reviewInstalled(d.modName))
    } finally {
      setBusy(false)
    }
  }, [d])
  useEffect(() => {
    setData(null)
    if (d) void run()
  }, [d, run])
  if (!d) return null
  const close = (): void => store.set({ reviewDialog: null })
  const slug = data?.slug ?? safeFolderName(d.modName)
  const r = data?.result
  return (
    <Modal
      title={d.folder ? 'Mod exportado' : 'Revisar mod instalado'}
      width={600}
      onClose={close}
      footer={
        <>
          {d.folder && (
            <button className="btn" onClick={() => void window.electronAPI?.openFolder(d.folder!)}>
              Abrir carpeta de exportación
            </button>
          )}
          <button
            className="btn"
            disabled={busy}
            onClick={() => void run()}
            title="Vuelve a leer la carpeta de mods del juego (solo lectura)"
          >
            Revisar mod instalado
          </button>
          <button className="btn-primary" onClick={close}>
            Cerrar
          </button>
        </>
      }
    >
      {d.folder && (
        <div className="mb-3 text-sm">
          <p>
            Mod exportado en <span className="break-all font-mono text-xs">{d.folder}</span>
          </p>
          <p className="mt-1">
            Para jugar, copia {slug}/ y {slug}.mod a la carpeta de mods de HOI4.
          </p>
          {d.moves.map((m) => (
            <p key={m} className="mt-1 text-xs text-hoi-muted">
              {m}
            </p>
          ))}
        </div>
      )}
      <div className="rounded border border-hoi-border p-3 text-sm">
        <div className="mb-1 text-xs font-semibold uppercase text-hoi-muted">
          Copia instalada en el juego (solo lectura)
        </div>
        {!r || busy ? (
          <p className="text-hoi-muted">Leyendo la carpeta de mods…</p>
        ) : r.status === 'ok' ? (
          <p className="text-green-400">
            ✔ Al día: la copia del juego es idéntica a la última exportación.
          </p>
        ) : r.status === 'no-export' ? (
          <p>Todavía no has exportado este mod desde esta app: usa «Exportar mod…» primero.</p>
        ) : r.status === 'missing-copy' ? (
          <p className="text-yellow-300">
            No hay copia de «{slug}» en <span className="font-mono text-xs">{data!.modsDir}</span>.
            Copia {slug}/ y {slug}.mod ahí.
          </p>
        ) : (
          <>
            <p className="text-yellow-300">La copia instalada NO es la última exportación:</p>
            <List title="Faltan en el juego" items={r.missing} />
            <List title="Sobran en el juego (la app ya no los genera)" items={r.extra} />
            <List title="Distintos" items={r.different} />
            {(r.mod.missing ||
              r.mod.pathDiffers ||
              r.mod.versionDiffers ||
              r.mod.contentDiffers) && (
              <div className="mt-2 text-xs">
                <div className="font-semibold text-hoi-muted">Archivo {slug}.mod</div>
                <ul className="list-disc pl-5">
                  {r.mod.missing && <li>no está en la carpeta de mods</li>}
                  {r.mod.versionDiffers && !r.mod.missing && (
                    <li>supported_version distinta ({r.mod.current?.supportedVersion || '—'})</li>
                  )}
                  {r.mod.pathDiffers && !r.mod.missing && (
                    <li>path distinto ({r.mod.current?.path || '—'})</li>
                  )}
                  {r.mod.contentDiffers &&
                    !r.mod.missing &&
                    !r.mod.pathDiffers &&
                    !r.mod.versionDiffers && <li>contenido distinto</li>}
                </ul>
              </div>
            )}
            <p className="mt-3 font-semibold">
              Borra la carpeta {slug} y el archivo {slug}.mod de la carpeta de mods y copia los
              nuevos.
            </p>
          </>
        )}
        {data && r && r.status !== 'ok' && r.status !== 'no-export' && (
          <button
            className="btn mt-3 text-xs"
            onClick={() => void window.electronAPI?.openFolder(data.modsDir)}
          >
            Abrir carpeta de mods del juego
          </button>
        )}
      </div>
    </Modal>
  )
}
