// Diálogo de texto propio (Electron no soporta window.prompt).
// Lo usan FieldCatalog y Blockly.dialog.prompt a través del store.
import { useEffect, useState } from 'react'
import { store, useApp } from '../store/appStore'
import Modal from './Modal'

export default function PromptDialog(): JSX.Element | null {
  const req = useApp((s) => s.prompt)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setText(req?.defaultValue ?? '')
    setError(null)
  }, [req])

  if (!req) return null
  const accept = (): void => {
    const t = text.trim()
    const err = req.validate?.(t) ?? null
    if (err) return setError(err)
    store.closePrompt(t)
  }
  return (
    <Modal
      title="Escribe un valor"
      width={440}
      onClose={() => store.closePrompt(null)}
      footer={
        <>
          <button className="btn" onClick={() => store.closePrompt(null)}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={accept}>
            Aceptar
          </button>
        </>
      }
    >
      <p className="mb-2 text-sm">{req.message}</p>
      <input
        className="input font-mono"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') accept()
          if (e.key === 'Escape') store.closePrompt(null)
        }}
      />
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </Modal>
  )
}
