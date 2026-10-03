// Pestaña Extras: idiomas (tabla de traducción), música propia, pantallas de carga, portada del mod
// e importación de un mod existente (solo lectura). Mismo esqueleto que las demás secciones.
import { useMemo, useState } from 'react'
import { Image as ImageIcon, Music as MusicIcon } from 'lucide-react'
import type { Project } from '../types'
import { newUid } from '../types'
import { store } from '../store/appStore'
import { registerSectionScreen, type GroupNode } from '../sections/ui'
import { LANGUAGES } from '../export/localisation'
import {
  COVER_SIZE,
  LOADING_SIZE,
  isOgg,
  languageLabel,
  loadingPng,
  missingKeys,
  musicFiles,
  newTrack,
  setLanguages,
  setTranslation,
  stationOf,
  translatableEntries,
  translationOf,
  extraLanguages
} from '../sections/extras'
import type { LoadingScreen, MusicTrack } from '../sections/types'
import BlocklyArea from './BlocklyArea'
import ImageUploader from './ImageUploader'
import ImportPanel from './ImportPanel'
import { Button, Card, Field, NumberField, type CardNote } from './kit'

// Identificadores de lo que se puede elegir en la lista
const LANGS = 'idiomas'
const COVER = 'portada'
const IMPORT = 'importar'
const trackUid = (uid: string): string => `musica:${uid}`
const screenUid = (uid: string): string => `carga:${uid}`
const parse = (sel: string | null): { kind: string; uid: string } => {
  const [kind, ...rest] = (sel ?? '').split(':')
  return { kind, uid: rest.join(':') }
}

// ---------------------------------------------------------------- idiomas
function Languages({ project }: { project: Project }): JSX.Element {
  const extras = extraLanguages(project)
  const [lang, setLang] = useState<string>(extras[0] ?? '')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [query, setQuery] = useState('')
  const current = extras.includes(lang) ? lang : (extras[0] ?? '')
  const entries = useMemo(() => translatableEntries(project), [project])
  const rows = entries
    .filter(
      (e) =>
        !query || e.key.includes(query) || e.english.toLowerCase().includes(query.toLowerCase())
    )
    .filter((e) => !onlyMissing || translationOf(project, current, e.key) === undefined)
  const missing = current ? missingKeys(project, current).length : 0
  return (
    <div className="mx-auto max-w-3xl p-5">
      <Card title="Idiomas del mod">
        <p className="mb-3 text-xs text-hoi-muted">
          El inglés es la base obligatoria. Lo que no traduzcas en otro idioma sale en inglés, así
          el juego nunca muestra un texto vacío.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          {LANGUAGES.map((l) => (
            <label key={l.code} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={l.code === 'english' || extras.includes(l.code)}
                disabled={l.code === 'english'}
                onChange={(e) =>
                  store.updateProject((p) =>
                    setLanguages(
                      p,
                      e.target.checked
                        ? [...extraLanguages(p), l.code]
                        : extraLanguages(p).filter((c) => c !== l.code)
                    )
                  )
                }
              />
              {l.label}
            </label>
          ))}
        </div>
      </Card>
      {extras.length > 0 && (
        <Card title="Traducciones">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {extras.map((c) => (
              <button
                key={c}
                className={`btn px-2 py-0.5 text-xs ${c === current ? 'border-hoi-accent' : ''}`}
                onClick={() => setLang(c)}
              >
                {languageLabel(c)}
              </button>
            ))}
            <input
              className="input w-52"
              placeholder="Filtrar por clave o texto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
              />
              Solo las que faltan ({missing})
            </label>
          </div>
          <div className="max-h-[60vh] overflow-y-auto rounded border border-hoi-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-hoi-panel text-left text-hoi-muted">
                <tr>
                  <th className="p-1">Clave</th>
                  <th className="p-1">Inglés</th>
                  <th className="p-1">{languageLabel(current)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((e) => {
                  const own = translationOf(project, current, e.key)
                  return (
                    <tr key={e.key} className="border-t border-hoi-border align-top">
                      <td className="p-1 font-mono">{e.key}</td>
                      <td className="p-1 text-hoi-muted">{e.english}</td>
                      <td className="p-1">
                        <input
                          className={`input w-full ${own === undefined ? 'border-yellow-600' : ''}`}
                          placeholder={e.english}
                          value={own ?? ''}
                          onChange={(ev) =>
                            store.updateProject(
                              (p) => setTranslation(p, current, e.key, ev.target.value),
                              {
                                group: `tr:${current}:${e.key}`
                              }
                            )
                          }
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {rows.length > 300 && (
              <p className="p-2 text-xs text-hoi-muted">
                Se muestran 300 de {rows.length}: usa el filtro.
              </p>
            )}
            {!rows.length && <p className="p-2 text-xs text-hoi-muted">Nada que mostrar.</p>}
          </div>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- música
const patchTrack = (uid: string, p: Partial<MusicTrack>, g?: string): void =>
  store.updateProject(
    (pr) => ({ ...pr, music: pr.music.map((t) => (t.uid === uid ? { ...t, ...p } : t)) }),
    g ? { group: `music:${uid}:${g}` } : undefined
  )

function Track({ project, t }: { project: Project; t: MusicTrack }): JSX.Element {
  const bad = !!t.ogg && !isOgg(t.ogg.base64)
  const notes: CardNote[] = [
    ...(bad
      ? [{ severity: 'error' as const, text: 'Ese archivo no es un .ogg válido (Ogg Vorbis).' }]
      : []),
    ...(!t.ogg ? [{ severity: 'aviso' as const, text: 'Falta el archivo de la canción.' }] : [])
  ]
  return (
    <div className="mx-auto max-w-3xl p-5" data-track-editor>
      <Card
        title="Canción"
        notes={notes}
        actions={
          <Button
            small
            onClick={() =>
              store.updateProject((p) => ({ ...p, music: p.music.filter((x) => x.uid !== t.uid) }))
            }
          >
            Borrar canción
          </Button>
        }
      >
        <Field label="Nombre">
          <input
            className="input"
            value={t.name}
            onChange={(e) => patchTrack(t.uid, { name: e.target.value }, 'name')}
          />
        </Field>
        <Field label="Archivo de audio" help="Formato .ogg (Ogg Vorbis).">
          <div className="flex items-center gap-2">
            <label className="btn cursor-pointer px-2 py-0.5 text-xs">
              {t.ogg ? 'Cambiar archivo' : 'Subir archivo'}
              <input
                type="file"
                accept=".ogg,audio/ogg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const r = new FileReader()
                  r.onload = () => {
                    const b64 = String(r.result).split(',')[1] ?? ''
                    if (!isOgg(b64))
                      store.toast('Ese archivo no es un .ogg válido (Ogg Vorbis).', {
                        kind: 'error'
                      })
                    patchTrack(t.uid, {
                      ogg: { name: f.name, base64: b64 },
                      name: t.name || f.name.replace(/\.[^.]+$/, '')
                    })
                  }
                  r.readAsDataURL(f)
                }}
              />
            </label>
            {t.ogg && (
              <span className="text-xs text-hoi-muted">
                {t.ogg.name} · {Math.round((t.ogg.base64.length * 3) / 4 / 1024)} KB
              </span>
            )}
          </div>
        </Field>
      </Card>
      <Card title="Opciones avanzadas" collapsible defaultOpen={false}>
        <div className="flex flex-wrap gap-4">
          <Field label="Emisora" help={`Vacío: la del mod (${stationOf(project, t)}).`}>
            <input
              className="input w-52"
              value={t.station}
              onChange={(e) => patchTrack(t.uid, { station: e.target.value.trim() }, 'st')}
            />
          </Field>
          <Field label="Frecuencia" help="Más alto suena más seguido.">
            <NumberField
              value={t.weight}
              min={0}
              onChange={(v) => patchTrack(t.uid, { weight: v })}
            />
          </Field>
        </div>
        <Field label="Solo suena si se cumple (opcional)">
          <BlocklyArea
            mode="condition"
            value={t.condition}
            onChange={(v) => patchTrack(t.uid, { condition: v })}
            height={140}
          />
        </Field>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- pantallas de carga
function Loading({ project, s }: { project: Project; s: LoadingScreen }): JSX.Element {
  const [uploading, setUploading] = useState(false)
  const set = (p: Partial<LoadingScreen>): void =>
    store.updateProject((pr) => ({
      ...pr,
      loadingScreens: pr.loadingScreens.map((x) => (x.uid === s.uid ? { ...x, ...p } : x))
    }))
  const png = loadingPng(project, s)
  return (
    <div className="mx-auto max-w-3xl p-5" data-loading-editor>
      <Card
        title="Pantalla de carga"
        notes={png ? [] : [{ severity: 'aviso', text: 'Falta la imagen.' }]}
        actions={
          <Button
            small
            onClick={() =>
              store.updateProject((p) => ({
                ...p,
                loadingScreens: p.loadingScreens.filter((x) => x.uid !== s.uid)
              }))
            }
          >
            Borrar pantalla
          </Button>
        }
      >
        <Field label="Nombre (opcional)">
          <input
            className="input w-72"
            value={s.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </Field>
        <Field label="Imagen" help="Pantalla completa, en proporción 16:9.">
          <Button small onClick={() => setUploading(true)}>
            {png ? 'Cambiar imagen' : 'Subir imagen'}
          </Button>
        </Field>
      </Card>
      {uploading && (
        <ImageUploader
          size={LOADING_SIZE}
          title="Pantalla de carga"
          onClose={() => setUploading(false)}
          onAcceptImage={(img) => {
            set({ upload: { name: 'pantalla.png', png: img }, image: null })
            setUploading(false)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- portada
function Cover({ project }: { project: Project }): JSX.Element {
  const [up, setUp] = useState(false)
  return (
    <div className="mx-auto max-w-3xl p-5">
      <Card title="Portada del mod">
        <p className="mb-3 text-xs text-hoi-muted">
          Una imagen cuadrada: es la que se ve en el lanzador del juego y en el Workshop.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => setUp(true)}>
            {project.cover ? 'Cambiar imagen' : 'Subir imagen'}
          </Button>
          {project.cover && (
            <Button onClick={() => store.updateProject((p) => ({ ...p, cover: null }))}>
              Quitar
            </Button>
          )}
        </div>
      </Card>
      {up && (
        <ImageUploader
          size={{ w: COVER_SIZE, h: COVER_SIZE }}
          title="Portada del mod (cuadrada)"
          onClose={() => setUp(false)}
          onAcceptImage={(png) => {
            store.updateProject((p) => ({ ...p, cover: png }))
            setUp(false)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- vista previa
function Preview({ project, sel }: { project: Project; sel: string | null }): JSX.Element | null {
  const { kind, uid } = parse(sel)
  if (kind === LANGS) {
    const extras = extraLanguages(project)
    const total = translatableEntries(project).length
    return (
      <div className="space-y-1 text-xs">
        <div className="text-hoi-text">Inglés (base): {total} textos</div>
        {extras.map((c) => (
          <div key={c} className="text-hoi-muted">
            {languageLabel(c)}: faltan {missingKeys(project, c).length} de {total}
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'musica') {
    const t = project.music.find((x) => x.uid === uid)
    if (!t) return null
    return (
      <div data-track-preview className="rounded border border-hoi-border bg-hoi-bg p-3">
        <div className="mb-2 flex items-center gap-2 text-sm text-hoi-text">
          <MusicIcon size={16} className="text-hoi-muted" />
          {t.name || 'Canción sin nombre'}
        </div>
        {t.ogg && isOgg(t.ogg.base64) ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio controls className="w-full" src={`data:audio/ogg;base64,${t.ogg.base64}`} />
        ) : (
          <p className="text-xs text-hoi-muted">Sube un archivo para poder escucharla.</p>
        )}
      </div>
    )
  }
  if (kind === 'carga') {
    const s = project.loadingScreens.find((x) => x.uid === uid)
    const png = s ? loadingPng(project, s) : null
    return png ? (
      <img data-loading-preview src={png} alt="" className="w-full rounded" />
    ) : (
      <div className="flex h-28 items-center justify-center rounded bg-hoi-card text-xs text-hoi-muted">
        Sin imagen
      </div>
    )
  }
  if (kind === COVER)
    return project.cover ? (
      <img
        src={project.cover}
        alt=""
        className="mx-auto h-48 w-48 rounded border border-hoi-border"
      />
    ) : (
      <div className="mx-auto flex h-48 w-48 items-center justify-center rounded border border-dashed border-hoi-border text-xs text-hoi-muted">
        Sin portada
      </div>
    )
  return null
}

registerSectionScreen('extras', {
  intro: 'Idiomas, música propia, pantallas de carga y portada de tu mod.',
  newSpec: {
    title: 'Nueva canción o pantalla',
    nameLabel: 'Nombre',
    defaultTemplate: 'cancion',
    templates: [
      {
        id: 'cancion',
        label: 'Canción',
        description: 'Un archivo de audio propio que suena en el juego.',
        thumb: <MusicIcon size={20} />
      },
      {
        id: 'carga',
        label: 'Pantalla de carga',
        description: 'Una imagen grande que se ve mientras el juego carga.',
        thumb: <ImageIcon size={20} />
      }
    ],
    create: ({ name, template }) => {
      if (template === 'carga') {
        const s: LoadingScreen = { uid: newUid(), name, image: null, upload: null }
        store.updateProject((p) => ({ ...p, loadingScreens: [...p.loadingScreens, s] }))
        return screenUid(s.uid)
      }
      const t = newTrack({ name })
      store.updateProject((p) => ({ ...p, music: [...p.music, t] }))
      return trackUid(t.uid)
    }
  },
  groups: (p): GroupNode[] => [
    {
      id: 'idiomas',
      title: 'Idiomas',
      items: [
        {
          uid: LANGS,
          title: 'Idiomas del mod',
          subtitle: `Inglés y ${extraLanguages(p).length} más`
        }
      ]
    },
    {
      id: 'musica',
      title: 'Música',
      items: (p.music ?? []).map((t) => ({
        uid: trackUid(t.uid),
        title: t.name,
        subtitle: t.ogg ? t.ogg.name : 'Falta el archivo',
        thumb: <MusicIcon size={16} className="text-hoi-muted" />
      }))
    },
    {
      id: 'carga',
      title: 'Pantallas de carga',
      items: (p.loadingScreens ?? []).map((s, i) => {
        const png = loadingPng(p, s)
        return {
          uid: screenUid(s.uid),
          title: s.name || `Pantalla ${i + 1}`,
          thumb: png ? (
            <img src={png} alt="" className="h-5 rounded-sm" />
          ) : (
            <ImageIcon size={16} className="text-hoi-muted" />
          )
        }
      })
    },
    {
      id: 'mod',
      title: 'El mod',
      items: [
        {
          uid: COVER,
          title: 'Portada del mod',
          thumb: p.cover ? (
            <img src={p.cover} alt="" className="h-5 w-5 rounded-sm" />
          ) : (
            <ImageIcon size={16} className="text-hoi-muted" />
          )
        },
        { uid: IMPORT, title: 'Importar un mod' }
      ]
    }
  ],
  remove: (sel) => {
    const { kind, uid } = parse(sel)
    if (kind === 'musica')
      store.updateProject((p) => ({ ...p, music: p.music.filter((x) => x.uid !== uid) }))
    else if (kind === 'carga')
      store.updateProject((p) => ({
        ...p,
        loadingScreens: p.loadingScreens.filter((x) => x.uid !== uid)
      }))
    else if (kind === COVER) store.updateProject((p) => ({ ...p, cover: null }))
  },
  renderEditor: (p, sel) => {
    const { kind, uid } = parse(sel)
    if (kind === LANGS)
      return (
        <div data-extras={LANGS}>
          <Languages project={p} />
        </div>
      )
    if (kind === 'musica') {
      const t = p.music.find((x) => x.uid === uid)
      return t ? <Track project={p} t={t} /> : null
    }
    if (kind === 'carga') {
      const s = p.loadingScreens.find((x) => x.uid === uid)
      return s ? <Loading project={p} s={s} /> : null
    }
    if (kind === COVER)
      return (
        <div data-extras={COVER}>
          <Cover project={p} />
        </div>
      )
    if (kind === IMPORT)
      return (
        <div className="mx-auto max-w-3xl p-5" data-extras={IMPORT}>
          <Card>
            <ImportPanel project={p} />
          </Card>
        </div>
      )
    return null
  },
  renderPreview: (p, sel) => <Preview project={p} sel={sel} />,
  code: (p, sel) => {
    if (parse(sel).kind !== 'musica') return null
    return musicFiles(p).find((f) => f.path.endsWith('_music.asset'))?.text ?? null
  }
})
