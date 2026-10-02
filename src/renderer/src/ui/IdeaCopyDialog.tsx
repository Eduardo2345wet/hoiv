// "Crear a partir de <idea del juego>": copia nombre, descripción, modificadores (editables) y el
// resto como texto avanzado de solo lectura. El ícono es el picture del original (no se copia nada).
import { useEffect, useState } from 'react'
import { store, useApp } from '../store/appStore'
import { createIdeaFrom } from './projectOps'
import { modifierDef } from '../catalog/modifiers'
import Modal from './Modal'

export default function IdeaCopyDialog(): JSX.Element | null {
  const req = useApp((s) => s.ideaCopy)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [mods, setMods] = useState<[string, number][]>([])
  useEffect(() => {
    if (!req) return
    setName(`${req.src.name || req.src.id} (copia)`)
    setDesc(req.src.desc)
    setMods(req.src.modifiers)
  }, [req])
  if (!req) return null
  const close = (): void => store.set({ ideaCopy: null })
  return (
    <Modal
      title={`Crear a partir de ${req.src.id}`}
      width={560}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            Cancelar
          </button>
          <button
            className="btn-primary disabled:opacity-40"
            disabled={!name.trim()}
            onClick={() => {
              let uid = ''
              let id = ''
              store.updateProject((p) => {
                const r = createIdeaFrom(p, { ...req.src, desc, modifiers: mods }, name.trim())
                uid = r.idea.uid
                id = r.idea.id
                return r.project
              })
              close()
              req.onCreated(id, uid)
            }}
          >
            Crear espíritu
          </button>
        </>
      }
    >
      <label className="label">Nombre</label>
      <input className="input mb-2" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="label">Descripción</label>
      <textarea
        className="input mb-2 h-16 resize-none"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <label className="label">Modificadores</label>
      {mods.map(([k, v], n) => (
        <div key={k} className="mb-1 flex items-center gap-2 text-sm">
          <span className="flex-1 font-mono text-xs">{k}</span>
          <input
            type="number"
            className="input w-24"
            value={v}
            onChange={(e) =>
              setMods(mods.map((m, i) => (i === n ? [m[0], Number(e.target.value)] : m)))
            }
          />
          <span className="w-4 text-hoi-muted">{modifierDef(k)?.percent ? '%' : ''}</span>
        </div>
      ))}
      {(req.src.extraModifierText || req.src.extraText) && (
        <>
          <label className="label mt-2">Avanzado (texto, solo lectura: se exporta tal cual)</label>
          <textarea
            readOnly
            className="input h-28 resize-none font-mono text-[11px]"
            value={[
              req.src.extraModifierText && `modifier = {\n${req.src.extraModifierText}\n}`,
              req.src.extraText
            ]
              .filter(Boolean)
              .join('\n')}
          />
        </>
      )}
      <p className="mt-2 text-xs text-hoi-muted">
        Ícono: usa <span className="font-mono">picture = {req.src.picture || '—'}</span> (el
        GFX_idea_ del juego); no se copia ningún archivo. Se puede cambiar después.
      </p>
    </Modal>
  )
}
