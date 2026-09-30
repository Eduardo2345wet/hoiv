// Diálogo "Nuevo mod": pide el nombre del mod y el tag del país.

import { useState } from 'react'
import { validateTag } from '../../../shared/tag'
import Modal, { primaryButton, secondaryButton } from './Modal'

interface Props {
  onCreate: (modName: string, tag: string) => void
  onCancel: () => void
}

export default function NewModDialog({ onCreate, onCancel }: Props): JSX.Element {
  const [modName, setModName] = useState('')
  const [tag, setTag] = useState('')
  const tagError = tag ? validateTag(tag) : null
  const canCreate = modName.trim().length > 0 && !validateTag(tag)

  const submit = (): void => {
    if (canCreate) onCreate(modName.trim(), tag)
  }

  const input =
    'w-full rounded border border-hoi-border bg-hoi-bg px-3 py-2 text-hoi-text outline-none focus:border-hoi-accent select-text'

  return (
    <Modal
      title="Nuevo mod"
      onClose={onCancel}
      footer={
        <>
          <button className={secondaryButton} onClick={onCancel}>
            Cancelar
          </button>
          <button className={primaryButton} disabled={!canCreate} onClick={submit}>
            Crear
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label className="mb-1 block text-xs font-semibold text-hoi-muted">Nombre del mod</label>
        <input
          autoFocus
          className={input}
          placeholder="Ej: Imperio Español"
          value={modName}
          onChange={(e) => setModName(e.target.value)}
        />

        <label className="mb-1 mt-4 block text-xs font-semibold text-hoi-muted">Tag del país</label>
        <input
          className={input + ' w-32 font-mono uppercase'}
          placeholder="SPR"
          maxLength={3}
          value={tag}
          onChange={(e) => setTag(e.target.value.toUpperCase())}
        />
        <p className={'mt-1 text-xs ' + (tagError ? 'text-red-400' : 'text-hoi-muted')}>
          {tagError ??
            'Las 3 letras con las que el juego identifica al país (GER = Alemania, SPR = España, MEX = México...).'}
        </p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
