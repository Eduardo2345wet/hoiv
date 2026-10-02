// Pestaña Súper eventos: ventana grande con imagen, cita y sonido (sistema propio).
import { useState } from 'react'
import type { Project } from '../types'
import { store } from '../store/appStore'
import { registerSectionScreen } from '../sections/ui'
import {
  createSuperEvent,
  deleteSuperEvent,
  isPcmWav,
  SUPER_WINDOW,
  superEventFiles,
  updateSuperEvent,
  validateSuperEvents
} from '../sections/superEvents'
import { eventPng } from '../sections/events'
import type { SuperEvent } from '../sections/types'
import { chooseCountryTag } from './countryFlow'
import { Badge, Button, Card, Field, Select } from './kit'

const patch = (uid: string, p: Partial<SuperEvent>, group?: string): void =>
  store.updateProject(
    (pr) => updateSuperEvent(pr, uid, p),
    group ? { group: `field:${uid}:${group}` } : undefined
  )

function Preview({ project, se }: { project: Project; se: SuperEvent }): JSX.Element {
  const png = eventPng(project, se.image)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  // Vista a escala de la ventana real
  const k = 0.5
  return (
    <div>
      <div
        className="relative mx-auto rounded border border-hoi-border bg-black/50"
        style={{ width: SUPER_WINDOW.width * k, height: SUPER_WINDOW.height * k }}
      >
        <div
          className="absolute overflow-hidden bg-hoi-card"
          style={{ left: 20 * k, top: 20 * k, width: 760 * k, height: 300 * k }}
        >
          {png ? (
            <img src={png} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="p-2 text-xs text-hoi-muted">sin imagen</span>
          )}
        </div>
        <div
          className="absolute text-center font-semibold"
          style={{ left: 20 * k, top: 330 * k, width: 760 * k, fontSize: 20 * k }}
        >
          {se.title || 'Título'}
        </div>
        <div
          className="absolute text-center italic text-hoi-muted"
          style={{ left: 20 * k, top: 380 * k, width: 760 * k, fontSize: 16 * k }}
        >
          {se.quote || 'Cita'}
          {se.author ? ` — ${se.author}` : ''}
        </div>
        <div
          className="absolute rounded border border-hoi-border bg-hoi-panel text-center"
          style={{ left: 330 * k, top: 470 * k, width: 140 * k, fontSize: 14 * k }}
        >
          {se.button || 'Continuar'}
        </div>
      </div>
      {se.sound && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Button
            small
            onClick={() => {
              audio?.pause()
              const a = new Audio(`data:audio/wav;base64,${se.sound!.base64}`)
              setAudio(a)
              void a.play()
            }}
          >
            ▶ Reproducir
          </Button>
          <span className="text-hoi-muted">{se.sound.name}</span>
          {!isPcmWav(se.sound.base64) && <Badge tone="warn">no es WAV PCM</Badge>}
        </div>
      )}
    </div>
  )
}

function Editor({ project, uid }: { project: Project; uid: string }): JSX.Element | null {
  const se = project.superEvents.find((s) => s.uid === uid)
  if (!se) return null
  const upload = (file: File | undefined, kind: 'image' | 'sound'): void => {
    if (!file) return
    const r = new FileReader()
    r.onload = () => {
      const url = String(r.result)
      if (kind === 'image') patch(se.uid, { image: { kind: 'upload', png: url, name: file.name } })
      else patch(se.uid, { sound: { name: file.name, base64: url.split(',')[1] ?? '' } })
    }
    r.readAsDataURL(file)
  }
  return (
    <div className="max-w-3xl p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-mono text-sm">{se.id}</h2>
        <Badge>{`efecto: ${se.id}_show`}</Badge>
      </div>
      <Field label="Título">
        <input
          className="input"
          value={se.title}
          onChange={(e) => patch(se.uid, { title: e.target.value }, 'title')}
        />
      </Field>
      <Card
        title="Cita"
        actions={
          <Button small onClick={() => patch(se.uid, { quote: '«…»', author: 'Autor' })}>
            Plantilla
          </Button>
        }
      >
        <Field label="Cita">
          <textarea
            className="input h-16"
            value={se.quote}
            onChange={(e) => patch(se.uid, { quote: e.target.value }, 'quote')}
          />
        </Field>
        <Field label="Autor">
          <input
            className="input"
            value={se.author}
            onChange={(e) => patch(se.uid, { author: e.target.value }, 'author')}
          />
        </Field>
      </Card>
      <Field label="Texto del botón">
        <input
          className="input w-64"
          value={se.button}
          onChange={(e) => patch(se.uid, { button: e.target.value }, 'button')}
        />
      </Field>
      <Field label="Imagen" help="Se recorta al tamaño de la ventana al exportar">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => upload(e.target.files?.[0], 'image')}
        />
        {project.icons.length > 0 && (
          <Select
            value=""
            options={[
              { value: '', label: 'O elige de mi biblioteca…' },
              ...project.icons.map((a) => ({ value: a.id, label: a.name }))
            ]}
            onChange={(v) => v && patch(se.uid, { image: { kind: 'asset', assetId: v } })}
          />
        )}
      </Field>
      <Field
        label="Sonido (.wav)"
        help="Los efectos de sonido solo aceptan .wav sin comprimir (PCM)"
      >
        <input
          type="file"
          accept=".wav,audio/wav"
          onChange={(e) => upload(e.target.files?.[0], 'sound')}
        />
        {se.sound && (
          <Button small onClick={() => patch(se.uid, { sound: null })}>
            Quitar sonido
          </Button>
        )}
      </Field>
      <Field label="Quién la ve" help="Siempre solo jugadores humanos (is_ai = no)">
        <Select
          value={se.audience}
          options={[
            { value: 'self', label: 'Solo el país que la dispara' },
            { value: 'all', label: 'Todos los jugadores' },
            { value: 'list', label: 'Una lista de países' }
          ]}
          onChange={(v) => patch(se.uid, { audience: v as SuperEvent['audience'] })}
        />
        {se.audience === 'list' && (
          <div className="mt-1 flex flex-wrap gap-1">
            {se.countries.map((t) => (
              <span key={t} className="rounded bg-hoi-card px-2 py-0.5 font-mono text-xs">
                {t}{' '}
                <button
                  onClick={() => patch(se.uid, { countries: se.countries.filter((x) => x !== t) })}
                >
                  ✕
                </button>
              </span>
            ))}
            <Button
              small
              onClick={() =>
                void chooseCountryTag('Añadir país').then(
                  (t) =>
                    t &&
                    !se.countries.includes(t) &&
                    patch(se.uid, { countries: [...se.countries, t] })
                )
              }
            >
              + País
            </Button>
          </div>
        )}
      </Field>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={se.queue}
          onChange={(e) => patch(se.uid, { queue: e.target.checked })}
        />
        Si ya hay una abierta, esperar su turno (cola)
      </label>
      <Preview project={project} se={se} />
    </div>
  )
}

registerSectionScreen('supereventos', {
  create: () => {
    let uid = ''
    store.updateProject((p) => {
      const r = createSuperEvent(p, { title: `super ${p.superEvents.length + 1}` })
      uid = r.superEvent.uid
      return r.project
    })
    return uid
  },
  remove: (uid) => {
    if (confirm('¿Borrar el súper evento?')) store.updateProject((p) => deleteSuperEvent(p, uid))
  },
  label: (i) => String(i.title || i.id),
  renderEditor: (p, sel) => (sel ? <Editor project={p} uid={sel} /> : null),
  renderPreview: (p, sel) => {
    const se = p.superEvents.find((s) => s.uid === sel)
    if (!se) return <p className="text-xs text-hoi-muted">Elige un súper evento.</p>
    const issues = validateSuperEvents(p).filter((i) => i.uid === se.uid)
    const gui =
      superEventFiles({ ...p, superEvents: [se] }).find((f) => f.path.endsWith('.gui'))?.text ?? ''
    return (
      <div className="text-xs">
        {issues.map((i, n) => (
          <p
            key={n}
            className={`mb-1 ${i.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}
          >
            {i.message}
          </p>
        ))}
        <pre className="whitespace-pre-wrap rounded bg-hoi-card p-2 font-mono text-[11px]">
          {gui}
        </pre>
      </div>
    )
  }
})
