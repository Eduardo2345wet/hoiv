// Pestaña "Biblioteca de íconos": miniaturas, "usado en", subir, renombrar y borrar
import { useState } from 'react'
import { Pencil, Trash2, Upload } from 'lucide-react'
import type { Project } from '../types'
import { store } from '../store/appStore'
import { addAsset, assetUsage, removeAsset, updateAsset } from './projectOps'
import ImageUploader from './ImageUploader'

export default function LibraryTab({ project }: { project: Project }): JSX.Element {
  const [uploading, setUploading] = useState(false)
  const [dropped, setDropped] = useState<File | undefined>()

  const rename = (id: string, current: string): void =>
    store.openPrompt({
      message: 'Nuevo nombre del ícono:',
      defaultValue: current,
      validate: (t) => (t.trim() ? null : 'Escribe un nombre'),
      callback: (t) => t && store.updateProject((p) => updateAsset(p, id, { name: t }))
    })

  const remove = (id: string, name: string): void => {
    const used = assetUsage(project, id)
    const msg = used.length
      ? `El ícono "${name}" está en uso en:\n- ${used.join('\n- ')}\n\nSi lo borras, esos elementos volverán a su ícono automático. ¿Borrar?`
      : `¿Borrar el ícono "${name}"?`
    if (confirm(msg)) store.updateProject((p) => removeAsset(p, id))
  }

  return (
    <div
      className="h-full overflow-y-auto p-6"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        setDropped(e.dataTransfer.files[0])
        setUploading(true)
      }}
    >
      <div className="mb-4 flex items-center gap-3">
        <button
          className="btn-primary"
          onClick={() => {
            setDropped(undefined)
            setUploading(true)
          }}
        >
          <Upload size={16} /> Subir imagen
        </button>
        <span className="text-sm text-hoi-muted">
          {project.icons.length} ícono(s). Arrastra imágenes aquí. Los automáticos se crean solos al
          crear focos y espíritus.
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {project.icons.map((a) => {
          const used = assetUsage(project, a.id)
          return (
            <div
              key={a.id}
              className="flex flex-col gap-1 rounded border border-hoi-border bg-hoi-panel p-2"
            >
              <div className="flex h-24 items-center justify-center rounded bg-[#101013]">
                <img src={a.png} alt="" style={{ height: a.target === 'focus' ? 80 : 68 }} />
              </div>
              <div className="truncate text-sm" title={a.name}>
                {a.name}
              </div>
              <div className="text-[10px] text-hoi-muted">
                {a.target === 'focus' ? 'Foco' : 'Espíritu'} · {a.width}×{a.height}
                {a.small && <span className="text-yellow-400"> · borrosa</span>}
                {a.id.startsWith('auto_') && ' · automático'}
              </div>
              <div className="line-clamp-2 text-[10px] text-hoi-muted" title={used.join(', ')}>
                usado en: {used.length ? used.join(', ') : 'nada'}
              </div>
              <div className="mt-auto flex gap-1">
                <button
                  className="btn flex-1 justify-center px-1 py-1 text-xs"
                  onClick={() => rename(a.id, a.name)}
                >
                  <Pencil size={12} /> Renombrar
                </button>
                <button
                  className="btn px-2 py-1 text-xs text-red-400"
                  title="Borrar"
                  onClick={() => remove(a.id, a.name)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {uploading && (
        <ImageUploader
          target="focus"
          allowTargetChange
          initialFile={dropped}
          onAccept={(a) => {
            store.updateProject((p) => addAsset(p, a))
            setUploading(false)
          }}
          onClose={() => setUploading(false)}
        />
      )}
    </div>
  )
}
