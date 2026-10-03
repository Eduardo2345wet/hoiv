// Pestaña Súper eventos: ventanas grandes con imagen, cita y sonido. Lista con miniaturas y grupos
// opcionales, editor en tarjetas y vista previa visual de la ventana del juego.
import { useRef, useState } from 'react'
import { Image as ImageIcon, Play, Quote, Square } from 'lucide-react'
import type { Project } from '../types'
import { store } from '../store/appStore'
import { registerSectionScreen, type GroupNode } from '../sections/ui'
import {
  SUPER_IMAGE_SIZE,
  SUPER_WINDOW,
  createSuperEvent,
  deleteSuperEvent,
  superEventFiles,
  updateSuperEvent,
  validateSuperEvents
} from '../sections/superEvents'
import { eventPng } from '../sections/events'
import type { SuperEvent } from '../sections/types'
import { chooseCountryTag } from './countryFlow'
import ImageUploader from './ImageUploader'
import Modal from './Modal'
import Help from './Help'
import { Button, Card, Field, Select, type CardNote } from './kit'

const patch = (uid: string, p: Partial<SuperEvent>, group?: string): void =>
  store.updateProject(
    (pr) => updateSuperEvent(pr, uid, p),
    group ? { group: `field:${uid}:${group}` } : undefined
  )

/** Reproduce el sonido de la ventana (un solo reproductor a la vez) */
function useSound(base64: string | undefined): { playing: boolean; toggle: () => void } {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  return {
    playing,
    toggle: () => {
      if (!base64) return
      if (audio.current && playing) {
        audio.current.pause()
        setPlaying(false)
        return
      }
      const a = new Audio(`data:audio/wav;base64,${base64}`)
      audio.current = a
      a.onended = () => setPlaying(false)
      setPlaying(true)
      void a.play().catch(() => setPlaying(false))
    }
  }
}

/** Vista previa: la ventana del súper evento a escala (imagen, título, cita y botón) */
function SuperPreview({ project, se }: { project: Project; se: SuperEvent }): JSX.Element {
  const png = eventPng(project, se.image)
  const sound = useSound(se.sound?.base64)
  const k = 0.42
  return (
    <div data-super-preview>
      <div
        className="relative mx-auto rounded-sm border-2 border-[#8c7b4f] bg-[#1c222b] shadow-lg"
        style={{ width: SUPER_WINDOW.width * k, height: SUPER_WINDOW.height * k }}
      >
        <div
          className="absolute overflow-hidden bg-black/50"
          style={{ left: 20 * k, top: 20 * k, width: 760 * k, height: 300 * k }}
        >
          {png ? (
            <img src={png} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-hoi-muted">
              Sin imagen
            </div>
          )}
        </div>
        <div
          data-preview-title
          className="absolute text-center font-semibold text-hoi-text"
          style={{ left: 20 * k, top: 332 * k, width: 760 * k, fontSize: 24 * k }}
        >
          {se.title || 'Título'}
        </div>
        <div
          data-preview-quote
          className="absolute text-center italic text-gray-300"
          style={{ left: 40 * k, top: 380 * k, width: 720 * k, fontSize: 17 * k }}
        >
          {se.quote || 'La cita aparece aquí'}
          {se.author ? ` — ${se.author}` : ''}
        </div>
        <div
          data-preview-button
          className="absolute rounded-sm border border-[#5a6578] bg-[#2f3947] text-center text-gray-200"
          style={{
            left: 300 * k,
            top: 462 * k,
            width: 200 * k,
            fontSize: 16 * k,
            lineHeight: `${34 * k}px`,
            height: 34 * k
          }}
        >
          {se.button || 'Continuar'}
        </div>
      </div>
      {se.sound && (
        <div className="mt-3 flex justify-center">
          <Button small onClick={sound.toggle}>
            {sound.playing ? <Square size={12} /> : <Play size={12} />}{' '}
            {sound.playing ? 'Detener' : 'Escuchar'}
          </Button>
        </div>
      )}
    </div>
  )
}

function ImageCard({ project, se }: { project: Project; se: SuperEvent }): JSX.Element {
  const [dlg, setDlg] = useState<'upload' | 'library' | null>(null)
  const png = eventPng(project, se.image)
  return (
    <Field label="Imagen">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded bg-hoi-bg">
          {png ? (
            <img src={png} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-hoi-muted" />
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Button small onClick={() => setDlg('upload')}>
            Subir imagen
          </Button>
          <Button small onClick={() => setDlg('library')}>
            Mi biblioteca
          </Button>
          {se.image && (
            <Button small onClick={() => patch(se.uid, { image: null })}>
              Quitar
            </Button>
          )}
        </div>
      </div>
      {dlg === 'upload' && (
        <ImageUploader
          size={SUPER_IMAGE_SIZE}
          title="Imagen del súper evento"
          onClose={() => setDlg(null)}
          onAcceptImage={(url) => {
            patch(se.uid, { image: { kind: 'upload', png: url, name: 'imagen.png' } })
            setDlg(null)
          }}
        />
      )}
      {dlg === 'library' && (
        <Modal title="Mi biblioteca" width={560} onClose={() => setDlg(null)}>
          <div className="grid grid-cols-4 gap-2">
            {project.icons.map((a) => (
              <button
                key={a.id}
                className="flex flex-col items-center gap-1 rounded border border-hoi-border p-2 hover:bg-hoi-card"
                onClick={() => {
                  patch(se.uid, { image: { kind: 'asset', assetId: a.id } })
                  setDlg(null)
                }}
              >
                <img src={a.png} alt="" style={{ height: 48 }} />
                <span className="w-full truncate text-[11px]">{a.name}</span>
              </button>
            ))}
          </div>
          {!project.icons.length && (
            <p className="text-sm text-hoi-muted">Tu biblioteca está vacía.</p>
          )}
        </Modal>
      )}
    </Field>
  )
}

function SoundCard({ se, notes }: { se: SuperEvent; notes: CardNote[] }): JSX.Element {
  const sound = useSound(se.sound?.base64)
  const input = useRef<HTMLInputElement>(null)
  return (
    <Card title="Sonido" notes={notes} help={<Help id="super.sonido" />}>
      <div className="flex flex-wrap items-center gap-2">
        <Button small onClick={() => input.current?.click()}>
          {se.sound ? 'Cambiar sonido' : 'Elegir archivo .wav'}
        </Button>
        {se.sound && (
          <>
            <Button small onClick={sound.toggle}>
              {sound.playing ? <Square size={12} /> : <Play size={12} />}{' '}
              {sound.playing ? 'Detener' : 'Escuchar'}
            </Button>
            <Button small onClick={() => patch(se.uid, { sound: null })}>
              Quitar
            </Button>
            <span className="text-xs text-hoi-muted">{se.sound.name}</span>
          </>
        )}
        {!se.sound && <span className="text-xs text-hoi-muted">Sin sonido</span>}
      </div>
      <input
        ref={input}
        type="file"
        accept=".wav,audio/wav"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (!f) return
          const r = new FileReader()
          r.onload = () =>
            patch(se.uid, { sound: { name: f.name, base64: String(r.result).split(',')[1] ?? '' } })
          r.readAsDataURL(f)
          e.target.value = ''
        }}
      />
    </Card>
  )
}

function Editor({ project, uid }: { project: Project; uid: string }): JSX.Element | null {
  const se = project.superEvents.find((s) => s.uid === uid)
  if (!se) return null
  const all = validateSuperEvents(project).filter((i) => i.uid === se.uid)
  const clean = (m: string): string => {
    const t = m.replace(/^Súper evento [^:]+: /, '')
    return t.charAt(0).toUpperCase() + t.slice(1)
  }
  const mk = (re: RegExp): CardNote[] =>
    all
      .filter((i) => re.test(i.message))
      .map((i) => ({
        severity: i.severity === 'error' ? 'error' : 'aviso',
        text: clean(i.message)
      }))
  const soundNotes = mk(/sonido|wav/i)
  const basicNotes = all
    .filter((i) => !/sonido|wav/i.test(i.message))
    .map((i): CardNote => ({
      severity: i.severity === 'error' ? 'error' : 'aviso',
      text: clean(i.message)
    }))
  return (
    <div className="mx-auto max-w-3xl p-5" data-super-editor>
      <Card title="Básico" notes={basicNotes} help={<Help id="super.que" />}>
        <Field label="Título">
          <input
            className="input"
            value={se.title}
            onChange={(e) => patch(se.uid, { title: e.target.value }, 'title')}
          />
        </Field>
        <ImageCard project={project} se={se} />
        <Field label="Cita">
          <textarea
            className="input h-16"
            value={se.quote}
            onChange={(e) => patch(se.uid, { quote: e.target.value }, 'quote')}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Autor de la cita">
            <input
              className="input"
              value={se.author}
              onChange={(e) => patch(se.uid, { author: e.target.value }, 'author')}
            />
          </Field>
          <Field label="Texto del botón">
            <input
              className="input"
              value={se.button}
              onChange={(e) => patch(se.uid, { button: e.target.value }, 'button')}
            />
          </Field>
        </div>
      </Card>
      <SoundCard se={se} notes={soundNotes} />
      <Card title="Quién la ve">
        <Field label="Se muestra a" help="Siempre solo a jugadores humanos, nunca a la IA.">
          <Select
            value={se.audience}
            options={[
              { value: 'self', label: 'Solo el país que la activa' },
              { value: 'all', label: 'Todos los jugadores' },
              { value: 'list', label: 'Una lista de países' }
            ]}
            onChange={(v) => patch(se.uid, { audience: v as SuperEvent['audience'] })}
          />
          {se.audience === 'list' && (
            <div className="mt-2 flex flex-wrap gap-1">
              {se.countries.map((t) => (
                <span key={t} className="rounded bg-hoi-card px-2 py-0.5 font-mono text-xs">
                  {t}{' '}
                  <button
                    onClick={() =>
                      patch(se.uid, { countries: se.countries.filter((x) => x !== t) })
                    }
                  >
                    x
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
                Añadir país
              </Button>
            </div>
          )}
        </Field>
      </Card>
      <Card title="Opciones avanzadas" collapsible defaultOpen={false}>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={se.queue}
            onChange={(e) => patch(se.uid, { queue: e.target.checked })}
          />
          Si ya hay una abierta, esperar su turno
        </label>
        <Field label="Grupo (opcional)" help="Solo sirve para ordenar la lista.">
          <input
            className="input"
            value={se.group ?? ''}
            onChange={(e) => patch(se.uid, { group: e.target.value }, 'group')}
          />
        </Field>
        <Field label="Identificador">
          <input className="input font-mono text-xs" value={se.id} readOnly />
        </Field>
      </Card>
    </div>
  )
}

const groupsOf = (p: Project): string[] => [
  ...new Set(p.superEvents.map((s) => (s.group ?? '').trim()).filter(Boolean))
]

registerSectionScreen('supereventos', {
  intro:
    'Un súper evento es una ventana grande con imagen, cita y sonido para los momentos importantes de la partida. No ofrece opciones: solo un botón para continuar.',
  newSpec: {
    title: 'Nuevo súper evento',
    nameLabel: 'Título',
    namePlaceholder: 'Por ejemplo: La caída del gobierno',
    defaultTemplate: 'cita',
    groupLabel: 'Grupo (opcional)',
    groupOptional: true,
    newGroupLabel: 'Crear un grupo nuevo…',
    groups: (p) => groupsOf(p).map((g) => ({ id: g, name: g })),
    templates: [
      {
        id: 'cita',
        label: 'Con cita',
        description: 'Imagen, título y una cita de alguien.',
        thumb: <Quote size={20} />
      },
      {
        id: 'simple',
        label: 'Solo imagen y título',
        description: 'Sin cita: lo esencial.',
        thumb: <ImageIcon size={20} />
      }
    ],
    create: ({ name, groupId, newGroupName, template }) => {
      let uid = ''
      store.updateProject((p) => {
        const group = (groupId ?? newGroupName ?? '').trim()
        const r = createSuperEvent(p, {
          title: name,
          ...(template === 'cita' ? { quote: 'Escribe aquí la cita', author: 'Autor' } : {}),
          ...(group ? { group } : {})
        })
        uid = r.superEvent.uid
        return r.project
      })
      return uid
    }
  },
  groups: (p): GroupNode[] => {
    const mk = (s: SuperEvent): GroupNode['items'][number] => {
      const png = eventPng(p, s.image)
      return {
        uid: s.uid,
        title: s.title,
        subtitle: s.id,
        thumb: png ? (
          <img src={png} alt="" className="h-6 rounded object-cover" />
        ) : (
          <ImageIcon size={16} className="text-hoi-muted" />
        )
      }
    }
    const named = groupsOf(p)
    const loose = p.superEvents.filter((s) => !(s.group ?? '').trim())
    if (!named.length) return [{ id: '_', title: '', items: loose.map(mk) }]
    return [
      ...named.map((g) => ({
        id: g,
        title: g,
        items: p.superEvents.filter((s) => (s.group ?? '').trim() === g).map(mk)
      })),
      ...(loose.length ? [{ id: '_sin', title: 'Sin grupo', items: loose.map(mk) }] : [])
    ]
  },
  remove: (uid) => {
    if (confirm('¿Borrar el súper evento?')) store.updateProject((p) => deleteSuperEvent(p, uid))
  },
  renderEditor: (p, sel) => (sel ? <Editor project={p} uid={sel} /> : null),
  renderPreview: (p, sel) => {
    const se = p.superEvents.find((s) => s.uid === sel)
    return se ? <SuperPreview project={p} se={se} /> : null
  },
  code: (p, sel) => {
    const se = p.superEvents.find((s) => s.uid === sel)
    return se
      ? (superEventFiles({ ...p, superEvents: [se] }).find((f) => f.path.endsWith('.gui'))?.text ??
          null)
      : null
  }
})
