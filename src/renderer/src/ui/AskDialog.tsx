// Pregunta con botones (guardar / no guardar / cancelar…), controlada por store.askUser()
import { store, useApp } from '../store/appStore'
import Modal from './Modal'

export default function AskDialog(): JSX.Element | null {
  const ask = useApp((s) => s.ask)
  if (!ask) return null
  return (
    <Modal
      title={ask.title}
      width={440}
      onClose={() => store.answerAsk('')}
      footer={ask.buttons.map((b) => (
        <button
          key={b.value}
          className={b.primary ? 'btn-primary' : 'btn'}
          onClick={() => store.answerAsk(b.value)}
        >
          {b.label}
        </button>
      ))}
    >
      <p className="text-sm">{ask.message}</p>
      {ask.items && (
        <ul className="mt-2 list-disc pl-5 text-sm text-hoi-muted">
          {ask.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
