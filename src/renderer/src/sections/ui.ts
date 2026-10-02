// Definición de las pestañas de las secciones nuevas y registro de sus pantallas. Cada sección
// registra su editor y su acción "Crear …" en su etapa; sin ellos, la pestaña muestra un estado vacío.
import type { ReactNode } from 'react'
import type { Project } from '../types'
import type { RibbonId } from '../store/appStore'
import type { SectionData } from './types'

export interface SectionDef {
  id: Extract<
    RibbonId,
    'eventos' | 'decisiones' | 'personajes' | 'ejercito' | 'tecnologias' | 'extras'
  >
  label: string
  /** Colección principal que lista el panel izquierdo */
  collection: keyof SectionData
  createLabel: string
  empty: string
  /** Grupos de la cinta */
  groups: { title: string; actions: { id: string; label: string }[] }[]
}

const groups = (create: string): SectionDef['groups'] => [
  { title: 'Crear', actions: [{ id: 'create', label: create }] },
  {
    title: 'Editar',
    actions: [
      { id: 'duplicate', label: 'Duplicar' },
      { id: 'delete', label: 'Borrar' }
    ]
  },
  { title: 'Ver', actions: [{ id: 'preview', label: 'Vista previa del script' }] },
  { title: 'Probar', actions: [{ id: 'validate', label: 'Validar' }] }
]

export const SECTIONS: SectionDef[] = [
  {
    id: 'eventos',
    label: 'Eventos',
    collection: 'events',
    createLabel: 'Crear evento',
    empty: 'Aún no hay eventos. Crea el primero para empezar una cadena.',
    groups: groups('Evento')
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
  renderEditor?: (project: Project, selected: string | null) => ReactNode
  renderPreview?: (project: Project, selected: string | null) => ReactNode
  label?: (item: Record<string, unknown>) => string
}
const screens = new Map<string, SectionScreen>()
export function registerSectionScreen(id: SectionDef['id'], s: SectionScreen): void {
  screens.set(id, s)
}
export const screenOf = (id: string): SectionScreen | undefined => screens.get(id)
