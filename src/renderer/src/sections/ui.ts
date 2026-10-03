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

const groups = (create: string, view = 'Vista general'): SectionDef['groups'] => [
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
    createLabel: 'Crear plantilla',
    empty: 'Aún no hay ejército inicial. Crea la plantilla de división de un país.',
    groups: groups('Plantilla')
  },
  {
    id: 'tecnologias',
    label: 'Tecnologías',
    collection: 'technologies',
    createLabel: 'Crear subideología',
    empty: 'Aún no hay subideologías ni tecnologías propias. Crea una subideología para empezar.',
    groups: groups('Tecnología')
  },
  {
    id: 'extras',
    label: 'Extras',
    collection: 'languages',
    createLabel: 'Crear canción o pantalla',
    empty: 'Idiomas, música, pantallas de carga y portada.',
    groups: groups('Extra')
  }
]
export const sectionById = (id: string): SectionDef | undefined => SECTIONS.find((s) => s.id === id)

/** Un elemento de la lista de la izquierda: nombre normal, ID pequeño y miniatura opcional */
export interface ListItem {
  uid: string
  /** Rótulo pequeño que se muestra encima de este elemento (por ejemplo "Plantillas") */
  heading?: string
  title: string
  /** Texto pequeño y gris (por ejemplo el ID) */
  subtitle?: string
  thumb?: ReactNode
}
/** Un grupo plegable de la lista (grupo de eventos, categoría, país…) */
export interface GroupNode {
  id: string
  title: string
  thumb?: ReactNode
  /** Si se da, el título del grupo también se puede elegir (uid) para editarlo */
  selectUid?: string
  items: ListItem[]
}
/** Una plantilla de la galería (tarjeta con miniatura, nombre y una frase) */
export interface TemplateCard {
  id: string
  label: string
  description: string
  thumb?: ReactNode
}
/** Ventana corta "Nuevo …": nombre, grupo y plantilla. Nunca pide un ID. */
export interface NewSpec {
  title: string
  nameLabel?: string
  namePlaceholder?: string
  /** Plantilla elegida por omisión */
  defaultTemplate?: string
  templates: TemplateCard[]
  /** Si se da, la ventana pide un grupo (existente o nuevo) */
  groupLabel?: string
  /** Ayuda "?" junto al nombre del grupo */
  groupHelp?: string
  /** El grupo es opcional: se ofrece "Sin grupo" */
  groupOptional?: boolean
  groups?: (p: Project) => { id: string; name: string }[]
  /** ¿Esta plantilla necesita grupo? (por omisión sí, cuando hay groupLabel) */
  needsGroup?: (template: string) => boolean
  /** Texto del botón para crear un grupo nuevo ahí mismo (si no se da, no se permite) */
  newGroupLabel?: string
  /** Alternativa a crear un grupo: elegir uno de otro sitio (por ejemplo un país del juego) */
  pickGroup?: { label: string; pick: () => Promise<{ id: string; name: string } | null> }
  create: (v: {
    name: string
    groupId: string | null
    newGroupName: string
    template: string
  }) => string | null | Promise<string | null>
}

/** Lo que cada sección registra en su etapa */
export interface SectionScreen {
  /** Crea un elemento nuevo (con deshacer) y devuelve su uid */
  create?: () => string | null | Promise<string | null>
  duplicate?: (uid: string) => string | null
  remove?: (uid: string) => void
  /** Plantillas de partida del menú de crear */
  templates?: { id: string; label: string; create: () => string | null | Promise<string | null> }[]
  /** Vista alternativa de toda la sección (por ejemplo la cadena de eventos) */
  renderOverview?: (
    project: Project,
    selected: string | null,
    select: (uid: string) => void
  ) => ReactNode
  renderEditor?: (
    project: Project,
    selected: string | null,
    select: (uid: string) => void
  ) => ReactNode
  renderPreview?: (project: Project, selected: string | null) => ReactNode
  label?: (item: Record<string, unknown>) => string
  /** Lista del panel izquierdo si no es la colección principal (p. ej. categorías + decisiones) */
  items?: (project: Project) => Record<string, unknown>[]
  /** Encabezado del panel izquierdo (por ejemplo un interruptor de modo avanzado) */
  renderHeader?: (project: Project) => ReactNode
  /** Lista por grupos plegables (si no se da, se usa `items` en una lista plana) */
  groups?: (project: Project) => GroupNode[]
  /** 1 o 2 líneas de para qué sirve la sección (estado vacío) */
  intro?: string
  /** Ventana "Nuevo …" y galería de plantillas del estado vacío */
  newSpec?: NewSpec
  /** Script generado del elemento elegido (botón "Ver código", plegado) */
  code?: (project: Project, selected: string | null) => string | null
}
const screens = new Map<string, SectionScreen>()
export function registerSectionScreen(id: SectionDef['id'], s: SectionScreen): void {
  screens.set(id, s)
}
export const screenOf = (id: string): SectionScreen | undefined => screens.get(id)
