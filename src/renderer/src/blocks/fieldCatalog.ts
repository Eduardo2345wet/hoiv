// Campo de Blockly reutilizable: un menú desplegable con las opciones del catálogo.
// - Las opciones se calculan al abrir el menú (no se guardan en el bloque).
// - Acepta CUALQUIER id válido (aunque no esté en la lista), para no perder valores
//   al abrir proyectos o al borrar elementos.
// - Las opciones especiales (crear, escribir otro, elegir en el árbol) se interceptan
//   y nunca se guardan como valor.
import { countrySections, type CountryChoice } from '../countries/choices'
import * as Blockly from 'blockly'
import { getCatalogOptions, type CatalogKind, type CatalogOption } from '../catalog/catalog'
import type { Project } from '../types'
import { store } from '../store/appStore'
import { validateTag } from '../export/validator'
import { createFocusBelow, createIdea } from '../ui/projectOps'
import { createEvent, eventId } from '../sections/events'
import { createSuperEvent } from '../sections/superEvents'
import { createCharacter } from '../sections/characters'
import { createDecision } from '../sections/decisions'
import { chooseCountryTag } from '../ui/countryFlow'
import { chooseState } from '../ui/stateFlow'
import type { GameIdea } from '../../../shared/ideasParse'

export const SPECIAL = {
  separator: '__sep__',
  create: '__crear__',
  other: '__otro__',
  pickTree: '__arbol__',
  pickMap: '__mapa__',
  pickGame: '__juego__',
  createFromGame: '__desde_juego__',
  pickCountry: '__pais__'
} as const
const SPECIAL_VALUES: string[] = Object.values(SPECIAL)

/** Ids aceptados como valor (letras, números, _, . y -) */
export const CATALOG_VALUE_REGEX = /^[A-Za-z0-9_.-]+$/
export const FLAG_REGEX = /^[a-z0-9_]+$/

export function isSpecialValue(v: string): boolean {
  return SPECIAL_VALUES.includes(v)
}

type Option = [string, string]

/** Solo las opciones DEL MOD (sin recorrer las listas del juego) */
function modOptions(kind: CatalogKind, project: Project | null): CatalogOption[] {
  if (kind === 'idea')
    return (project?.ideas ?? []).map((i) => ({
      id: i.id,
      etiqueta: i.name || i.id,
      origen: 'mod' as const,
      uid: i.uid
    }))
  return []
}

/** Opciones del menú en orden: especiales arriba (árbol), mod, juego, separador, crear/escribir */
export function buildMenu(kind: CatalogKind, current: string | null): Option[] {
  const s = store.get()
  const project = s.project
  // En "completó el foco" no se ofrece el foco que estoy editando
  const editingId =
    kind === 'focus' ? project?.focuses.find((f) => f.uid === s.selectedUid)?.id : undefined
  // Listas enormes (ideas del juego, estados…) NUNCA se cargan en Blockly: solo lo del mod, los
  // recientes y las opciones especiales; lo demás se busca en una ventana propia.
  const short = kind === 'idea' || kind === 'state'
  const opts = (
    short ? modOptions(kind, project) : getCatalogOptions(kind, project, store.catalogGame())
  ).filter((o) => o.id !== editingId)

  const menu: Option[] = []
  if (kind === 'focus') menu.push(['Elegir en el árbol…', SPECIAL.pickTree])
  if (kind === 'state' && current) {
    // El campo muestra el nombre real; al hacer clic se abre el mini mapa (no hay desplegable largo)
    const st = s.map?.states.find((x) => String(x.id) === current)
    menu.push([
      st
        ? `${st.name} (${st.owner || '—'}) · ${st.id}`
        : s.map
          ? `Estado ${current} (no existe)`
          : `Estado ${current}`,
      current
    ])
  } else if (current && !opts.some((o) => o.id === current)) {
    const why = kind === 'focus' || kind === 'idea' ? 'ya no existe' : 'no está en la lista'
    menu.push([`${current} (${why})`, current])
  } else if (!current) {
    menu.push(['— elige —', ''])
  }
  if (kind === 'idea') menu.push(['Elegir del juego…', SPECIAL.pickGame])
  if (kind === 'country') {
    // Mismo orden que el selector universal: Mis países → En el mapa → Todos (sin banderas)
    const sec = countrySections(project, s.map, store.catalogGame())
    const add = (title: string, list: CountryChoice[]): void => {
      if (!list.length) return
      menu.push([`── ${title} ──`, SPECIAL.separator])
      for (const c of list)
        menu.push([`${c.name} · ${c.tag}${c.states ? `  (${c.states})` : ''}`, c.tag])
    }
    add('Mis países', sec.mine)
    add('En el mapa', sec.onMap)
    // Más de 200 opciones nunca se cargan en Blockly: se elige en el selector universal
    if (sec.game.length > 200) menu.push(['Elegir otro país del juego…', SPECIAL.pickCountry])
    else add('Todos los países del juego', sec.game)
  }
  // Solo el nombre; el id se añade únicamente cuando dos opciones se llaman igual
  const nameCount = new Map<string, number>()
  for (const o of opts) nameCount.set(o.etiqueta, (nameCount.get(o.etiqueta) ?? 0) + 1)
  for (const o of kind === 'country' ? [] : opts) {
    const named = o.etiqueta && o.etiqueta !== o.id
    const label = named
      ? nameCount.get(o.etiqueta)! > 1
        ? `${o.etiqueta} · ${o.id}`
        : o.etiqueta
      : o.id
    menu.push([o.origen === 'juego' ? `${label}  (juego)` : label, o.id])
  }
  if (kind === 'idea' && s.recentIdeas.length) {
    menu.push(['── Recientes ──', SPECIAL.separator])
    for (const id of s.recentIdeas.slice(0, 8))
      if (!opts.some((o) => o.id === id)) menu.push([`${id}  (juego)`, id])
  }
  menu.push(['──────────', SPECIAL.separator])
  if (kind !== 'country' && kind !== 'state' && kind !== 'technology')
    menu.push(['+ Crear nuevo…', SPECIAL.create])
  if (kind === 'idea') menu.push(['+ Crear a partir de uno del juego…', SPECIAL.createFromGame])
  menu.push(['Escribir otro ID…', SPECIAL.other])
  return menu
}

export class FieldCatalog extends Blockly.FieldDropdown {
  readonly kind: CatalogKind

  constructor(kind: CatalogKind, value?: string) {
    super(function (this: Blockly.FieldDropdown) {
      return buildMenu(kind, (this.getValue() as string | null) ?? '')
    })
    this.kind = kind
    this.setValue(value ?? '')
  }

  static fromJson(
    options: Blockly.FieldDropdownFromJsonConfig & {
      kind?: CatalogKind
      value?: string
    }
  ): FieldCatalog {
    return new FieldCatalog(options.kind ?? 'focus', options.value)
  }

  /** Los campos de estado abren el mini mapa en vez de un desplegable */
  protected override showEditor_(e?: MouseEvent): void {
    if (this.kind === 'state') {
      this.handleSpecial(SPECIAL.pickMap)
      return
    }
    super.showEditor_(e)
  }

  /** Acepta cualquier id válido (o vacío), nunca una opción especial */
  protected override doClassValidation_(newValue?: string): string | null {
    if (newValue === undefined || newValue === null) return null
    const v = String(newValue)
    if (isSpecialValue(v)) return null
    if (v === '' || CATALOG_VALUE_REGEX.test(v)) return v
    return null
  }

  /** Recalcula las opciones para que el texto mostrado corresponda al valor nuevo */
  protected override doValueUpdate_(newValue: string): void {
    ;(this as unknown as { generatedOptions: unknown }).generatedOptions = null
    super.doValueUpdate_(newValue)
  }

  protected override onItemSelected_(_menu: Blockly.Menu, item: Blockly.MenuItem): void {
    const v = String(item.getValue())
    if (!isSpecialValue(v)) {
      this.setValue(v)
      return
    }
    this.handleSpecial(v)
  }

  /** Acciones de las opciones especiales (se pueden llamar también desde pruebas) */
  handleSpecial(v: string): void {
    const set = (id: string | null): void => {
      if (id && this.getSourceBlock() && !this.getSourceBlock()!.isDeadOrDying()) this.setValue(id)
    }
    if (v === SPECIAL.separator) return

    if (v === SPECIAL.pickTree) {
      const s = store.get()
      store.startPick({
        kind: 'focus',
        exclude: s.selectedUid ? [s.selectedUid] : [],
        onPick: (uid) => set(store.get().project?.focuses.find((f) => f.uid === uid)?.id ?? null)
      })
      return
    }

    if (v === SPECIAL.pickGame || v === SPECIAL.createFromGame) {
      const copy = v === SPECIAL.createFromGame
      const openCopy = (src: GameIdea): void =>
        store.set({
          ideaCopy: {
            src,
            onCreated: (id, uid) => {
              set(id)
              // Abre el espíritu nuevo para editarlo
              store.set({ ideaToSelect: uid })
              store.setUi({ ribbon: 'ideas' })
            }
          }
        })
      store.set({
        ideaPicker: {
          mode: copy ? 'copy' : 'use',
          onUse: (id) => {
            set(id)
            if (!store.get().project?.ideas.some((i) => i.id === id)) store.pushRecent('idea', id)
          },
          onCopy: openCopy
        }
      })
      return
    }

    if (v === SPECIAL.pickCountry) {
      void chooseCountryTag('Elegir país').then((t) => t && set(t))
      return
    }

    if (v === SPECIAL.pickMap) {
      void chooseState({ current: Number(this.getValue()) || null }).then(
        (id) => id && set(String(id))
      )
      return
    }

    if (v === SPECIAL.other) {
      store.openPrompt({
        message: 'Escribe el ID (para cosas de otros mods o DLC que no estén en la lista):',
        defaultValue: String(this.getValue() ?? ''),
        validate: (t) =>
          this.kind === 'country'
            ? validateTag(t)
            : this.kind === 'state'
              ? /^[1-9]\d*$/.test(t)
                ? null
                : 'El ID de estado es un número entero mayor o igual a 1'
              : CATALOG_VALUE_REGEX.test(t)
                ? null
                : 'Solo letras sin tildes, números, _ . y -',
        callback: set
      })
      return
    }

    // "+ Crear nuevo…"
    if (this.kind === 'countryFlag') {
      store.openPrompt({
        message: 'Nombre de la nueva marca (minúsculas, números y _):',
        defaultValue: '',
        validate: (t) =>
          FLAG_REGEX.test(t) ? null : 'Solo minúsculas, números y _ (sin espacios ni tildes)',
        callback: (t) => {
          if (!t) return
          store.updateProject((p) =>
            p.countryFlags.includes(t) ? p : { ...p, countryFlags: [...p.countryFlags, t] }
          )
          set(t)
        }
      })
    } else if (this.kind === 'idea') {
      store.openPrompt({
        message: 'Nombre del nuevo espíritu nacional:',
        defaultValue: '',
        validate: (t) => (t.trim() ? null : 'Escribe un nombre'),
        callback: (t) => {
          if (!t) return
          let newId: string | null = null
          store.updateProject((p) => {
            const r = createIdea(p, t.trim())
            newId = r.idea.id
            return r.project
          })
          set(newId)
        }
      })
    } else if (this.kind === 'superEvent') {
      store.openPrompt({
        message: 'Título del nuevo súper evento:',
        defaultValue: '',
        validate: (t) => (t.trim() ? null : 'Escribe un título'),
        callback: (t) => {
          if (!t) return
          let newId: string | null = null
          store.updateProject((p) => {
            const r = createSuperEvent(p, { title: t.trim() })
            newId = r.superEvent.id
            return r.project
          })
          set(newId)
        }
      })
    } else if (this.kind === 'character') {
      store.openPrompt({
        message: 'Nombre del nuevo personaje:',
        defaultValue: '',
        validate: (t) => (t.trim() ? null : 'Escribe un nombre'),
        callback: (t) => {
          if (!t) return
          let newId: string | null = null
          store.updateProject((p) => {
            const r = createCharacter(p, { name: t.trim() })
            newId = r.character.id
            return r.project
          })
          set(newId)
        }
      })
    } else if (this.kind === 'decision') {
      store.openPrompt({
        message: 'Nombre de la nueva decisión o misión:',
        defaultValue: '',
        validate: (t) => (t.trim() ? null : 'Escribe un nombre'),
        callback: (t) => {
          if (!t) return
          let newId: string | null = null
          store.updateProject((p) => {
            const r = createDecision(p, { name: t.trim() })
            newId = r.decision.id
            return r.project
          })
          set(newId)
        }
      })
    } else if (this.kind === 'event') {
      store.openPrompt({
        message: 'Título del nuevo evento:',
        defaultValue: '',
        validate: (t) => (t.trim() ? null : 'Escribe un título'),
        callback: (t) => {
          if (!t) return
          let newId: string | null = null
          store.updateProject((p) => {
            const r = createEvent(p, { title: t.trim() })
            newId = eventId(r.event)
            return r.project
          })
          set(newId)
        }
      })
    } else if (this.kind === 'focus') {
      store.openPrompt({
        message: 'Nombre del nuevo foco (se crea debajo del actual):',
        defaultValue: '',
        validate: (t) => (t.trim() ? null : 'Escribe un nombre'),
        callback: (t) => {
          if (!t) return
          let newId: string | null = null
          store.updateProject((p) => {
            const r = createFocusBelow(p, store.get().selectedUid, t.trim())
            newId = r.focus.id
            return r.project
          })
          set(newId)
        }
      })
    }
  }
}

let registered = false
export function registerFieldCatalog(): void {
  if (registered) return
  registered = true
  Blockly.fieldRegistry.register('field_catalog', FieldCatalog)
  // Blockly.dialog.prompt → nuestro diálogo de React
  Blockly.dialog.setPrompt((message, defaultValue, callback) =>
    store.openPrompt({ message, defaultValue, callback })
  )
}
