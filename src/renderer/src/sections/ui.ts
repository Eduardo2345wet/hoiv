// Definición de las pestañas de las secciones nuevas y registro de sus pantallas. Cada sección
// registra su editor y su acción "Crear …" en su etapa; sin ellos, la pestaña muestra un estado vacío.
import type { ReactNode } from 'react'
import type { Project } from '../types'
import type { RibbonId } from '../store/appStore'
import type { SectionData } from './types'

export interface SectionDef {
  id: Extract<
    RibbonId,
    'eventos' | 'supereventos' | 'decisiones' | 'personajes' | 'ejercito' | 'tecnologias' | 'extras'
  >
  label: string
  /** Colección principal que lista el panel izquierdo */
  collection: keyof SectionData
  createLabel: string
  empty: string
  /** Grupos de la cinta */
  groups: { title: string; actions: { id: string; label: string }[] }[]
}

const groups = (create: string, view = 'Vista previa del script'): SectionDef['groups'] => [
  { title: 'Crear', actions: [{ id: 'create', label: create }] },
  {
    title: 'Editar',
    actions: [
      { id: 'duplicate', label: 'Duplicar' },
      { id: 'delete', label: 'Borrar' }
    ]
  },
  { title: 'Ver', actions: [{ id: 'preview', label: view }] },
  { title: 'Probar', actions: [{ id: 'validate', label: 'Validar' }] }
]

export const SECTIONS: SectionDef[] = [
  {
    id: 'eventos',
    label: 'Eventos',
    collection: 'events',
    createLabel: 'Crear evento',
    empty: 'Aún no hay eventos. Crea el primero para empezar una cadena.',
    groups: groups('Evento', 'Cadena de eventos')
  },
  {
    id: 'supereventos',
    label: 'Súper eventos',
    collection: 'superEvents',
    createLabel: 'Crear súper evento',
    empty: 'Aún no hay súper eventos. Crea el primero: una ventana grande con imagen y sonido.',
    groups: groups('Súper evento')
  },
  {
    id: 'decisiones',
    label: 'Decisiones',
    collection: 'decisions',
    createLabel: 'Crear decisión',
    empty: 'Aún no hay decisiones. Crea una categoría y su primera decisión.',
    groups: groups('Decisión')
  },
  {
    id: 'personajes',
    label: 'Personajes',
    collection: 'characters',
    createLabel: 'Crear personaje',
    empty: 'Aún no hay personajes. Crea un líder, asesor o general.',
    groups: groups('Personaje')
  },
  {
    id: 'ejercito',
    label: 'Ejército',
    collection: 'oobs',
    createLabel: 'Crear plantilla de división',
    empty: 'Aún no hay ejército inicial. Diseña una plantilla de división.',
    groups: groups('Plantilla')
  },
  {
    id: 'tecnologias',
    label: 'Tecnologías',
    collection: 'technologies',
    createLabel: 'Crear tecnología',
    empty: 'Aún no hay tecnologías ni ideologías propias.',
    groups: groups('Tecnología')
  },
  {
    id: 'extras',
    label: 'Extras',
    collection: 'languages',
    createLabel: 'Agregar',
    empty: 'Idiomas, música, pantallas de carga y portada.',
    groups: groups('Extra')
  }
]
export const sectionById = (id: string): SectionDef | undefined => SECTIONS.find((s) => s.id === id)

/** Lo que cada sección registra en su etapa */
export interface SectionScreen {
  /** Crea un elemento nuevo (con deshacer) y devuelve su uid */
  create?: () => string | null
  duplicate?: (uid: string) => string | null
  remove?: (uid: string) => void
  /** Plantillas de partida del menú de crear */
  templates?: { id: string; label: string; create: () => string | null }[]
  /** Vista alternativa de toda la sección (por ejemplo la cadena de eventos) */
  renderOverview?: (
    project: Project,
    selected: string | null,
    select: (uid: string) => void
  ) => ReactNode
  renderEditor?: (project: Project, selected: string | null) => ReactNode
  renderPreview?: (project: Project, selected: string | null) => ReactNode
  label?: (item: Record<string, unknown>) => string
}
const screens = new Map<string, SectionScreen>()
export function registerSectionScreen(id: SectionDef['id'], s: SectionScreen): void {
  screens.set(id, s)
}
export const screenOf = (id: string): SectionScreen | undefined => screens.get(id)
