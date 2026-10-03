// Pestaña Extras: idiomas (tabla de traducción), música propia, pantallas de carga, portada del mod
// e importación de un mod existente (solo lectura).
import { useMemo, useState } from 'react'
import type { Project } from '../types'
import { newUid } from '../types'
import { store } from '../store/appStore'
import { registerSectionScreen } from '../sections/ui'
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
  songPath,
  translatableEntries,
  translationOf,
  extraLanguages
} from '../sections/extras'
import type { LoadingScreen, MusicTrack } from '../sections/types'
import BlocklyArea from './BlocklyArea'
import ImageUploader from './ImageUploader'
import ImportPanel from './ImportPanel'
import { Button, Field, NumberField } from './kit'

const PARTS = [
  { id: 'idiomas', name: 'Idiomas' },
  { id: 'musica', name: 'Música' },
  { id: 'carga', name: 'Pantallas de carga' },
  { id: 'portada', name: 'Portada del mod' },
  { id: 'importar', name: 'Importar un mod' }
]

const Title = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <h2 className="mb-2 text-sm font-semibold">{children}</h2>
)

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
    <div>
      <Title>Idiomas del mod</Title>
      <p className="mb-2 text-xs text-hoi-muted">
        El inglés es la base obligatoria. Lo que no traduzcas en otro idioma sale en inglés (así el
        juego no muestra la clave cruda).
      </p>
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
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
      {extras.length > 0 && (
        <>
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
        </>
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

function Music({ project }: { project: Project }): JSX.Element {
  return (
    <div>
      <Title>Música propia</Title>
      <p className="mb-2 text-xs text-hoi-muted">
        Sube archivos .ogg (Ogg Vorbis). Se escriben <code>music/&lt;mod&gt;_music.asset</code> y
        una lista de canciones por estación, siempre con nombres propios (nunca el{' '}
        <code>music.asset</code> del juego). La portada de una estación de radio propia queda para
        una etapa posterior. Algunos usuarios reportan que la música de mods funciona mejor subida
        al Workshop.
      </p>
      {project.music.map((t) => {
        const bad = t.ogg && !isOgg(t.ogg.base64)
        return (
          <div key={t.uid} className="mb-2 space-y-2 rounded border border-hoi-border p-2">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Nombre">
                <input
                  className="input w-48"
                  value={t.name}
                  onChange={(e) => patchTrack(t.uid, { name: e.target.value }, 'name')}
                />
              </Field>
              <Field label="Estación" help={`Vacío = la del mod (${stationOf(project, t)})`}>
                <input
                  className="input w-48"
                  value={t.station}
                  onChange={(e) => patchTrack(t.uid, { station: e.target.value.trim() }, 'st')}
                />
              </Field>
              <Field label="Peso">
                <NumberField
                  value={t.weight}
                  min={0}
                  onChange={(v) => patchTrack(t.uid, { weight: v })}
                />
              </Field>
              <Button
                small
                onClick={() =>
                  store.updateProject((p) => ({
                    ...p,
                    music: p.music.filter((x) => x.uid !== t.uid)
                  }))
                }
              >
                Borrar
              </Button>
            </div>
            <div className="text-xs">
              <input
                type="file"
                accept=".ogg,audio/ogg"
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
              {t.ogg && (
                <span className={bad ? 'ml-2 text-red-400' : 'ml-2 text-hoi-muted'}>
                  {t.ogg.name} · {Math.round((t.ogg.base64.length * 3) / 4 / 1024)} KB
                  {bad ? ' · no es un .ogg válido' : ` → ${songPath(project, t)}`}
                </span>
              )}
            </div>
            <Field label="Condición simple (opcional)" help="Solo suena si se cumple">
              <BlocklyArea
                mode="condition"
                value={t.condition}
                onChange={(v) => patchTrack(t.uid, { condition: v })}
                height={140}
              />
            </Field>
          </div>
        )
      })}
      <Button
        onClick={() => store.updateProject((p) => ({ ...p, music: [...p.music, newTrack()] }))}
      >
        + Canción
      </Button>
      {musicFiles(project).length > 0 && (
        <p className="mt-2 text-xs text-hoi-muted">
          Se exportan {musicFiles(project).length} archivo(s) en music/.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- pantallas de carga
function Loading({ project }: { project: Project }): JSX.Element {
  const [uploading, setUploading] = useState<string | null>(null)
  const set = (uid: string, p: Partial<LoadingScreen>): void =>
    store.updateProject((pr) => ({
      ...pr,
      loadingScreens: pr.loadingScreens.map((s) => (s.uid === uid ? { ...s, ...p } : s))
    }))
  return (
    <div>
      <Title>Pantallas de carga</Title>
      <p className="mb-2 text-xs text-hoi-muted">
        Imágenes de {LOADING_SIZE.w}×{LOADING_SIZE.h} (por verificar con archivos del juego). Se
        exportan como .dds en gfx/loadingscreens/.
      </p>
      <div className="flex flex-wrap gap-3">
        {project.loadingScreens.map((s, i) => {
          const png = loadingPng(project, s)
          return (
            <div key={s.uid} className="w-56 rounded border border-hoi-border p-2">
              {png ? (
                <img src={png} alt="" className="mb-1 w-full rounded" />
              ) : (
                <div className="mb-1 flex h-28 items-center justify-center rounded bg-hoi-card text-xs text-hoi-muted">
                  sin imagen
                </div>
              )}
              <input
                className="input mb-1 w-full"
                placeholder={`Pantalla ${i + 1}`}
                value={s.name}
                onChange={(e) => set(s.uid, { name: e.target.value })}
              />
              <div className="flex gap-1">
                <Button small onClick={() => setUploading(s.uid)}>
                  Subir…
                </Button>
                <Button
                  small
                  onClick={() =>
                    store.updateProject((p) => ({
                      ...p,
                      loadingScreens: p.loadingScreens.filter((x) => x.uid !== s.uid)
                    }))
                  }
                >
                  Borrar
                </Button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2">
        <Button
          onClick={() =>
            store.updateProject((p) => ({
              ...p,
              loadingScreens: [
                ...p.loadingScreens,
                { uid: newUid(), name: '', image: null, upload: null }
              ]
            }))
          }
        >
          + Pantalla de carga
        </Button>
      </div>
      {uploading && (
        <ImageUploader
          size={LOADING_SIZE}
          title="Pantalla de carga"
          onClose={() => setUploading(null)}
          onAcceptImage={(png) => {
            set(uploading, { upload: { name: 'pantalla.png', png }, image: null })
            setUploading(null)
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
    <div>
      <Title>Portada del mod</Title>
      <p className="mb-2 text-xs text-hoi-muted">
        Imagen cuadrada ({COVER_SIZE}×{COVER_SIZE}). Se exporta como <code>thumbnail.png</code> y el
        descriptor lleva <code>picture="thumbnail.png"</code>. Se publica desde el launcher (Mod
        Tools / Workshop).
      </p>
      {project.cover ? (
        <img
          src={project.cover}
          alt=""
          className="mb-2 h-40 w-40 rounded border border-hoi-border"
        />
      ) : (
        <div className="mb-2 flex h-40 w-40 items-center justify-center rounded border border-dashed border-hoi-border text-xs text-hoi-muted">
          sin portada
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={() => setUp(true)}>
          {project.cover ? 'Cambiar…' : 'Subir y recortar…'}
        </Button>
        {project.cover && (
          <Button onClick={() => store.updateProject((p) => ({ ...p, cover: null }))}>
            Quitar
          </Button>
        )}
      </div>
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

registerSectionScreen('extras', {
  items: () => PARTS.map((p) => ({ uid: p.id, id: p.id, name: p.name })),
  renderEditor: (p, sel) => (
    <div className="p-3" data-extras={sel}>
      {sel === 'idiomas' && <Languages project={p} />}
      {sel === 'musica' && <Music project={p} />}
      {sel === 'carga' && <Loading project={p} />}
      {sel === 'portada' && <Cover project={p} />}
      {sel === 'importar' && <ImportPanel project={p} />}
    </div>
  )
})
