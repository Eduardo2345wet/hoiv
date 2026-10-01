// Campo de Blockly reutilizable: un menú desplegable con las opciones del catálogo.
// - Las opciones se calculan al abrir el menú (no se guardan en el bloque).
// - Acepta CUALQUIER id válido (aunque no esté en la lista), para no perder valores
//   al abrir proyectos o al borrar elementos.
// - Las opciones especiales (crear, escribir otro, elegir en el árbol) se interceptan
//   y nunca se guardan como valor.
import * as Blockly from 'blockly'
import { getCatalogOptions, type CatalogKind } from '../catalog/catalog'
import { store } from '../store/appStore'
import { validateTag } from '../export/validator'
import { createFocusBelow, createIdea } from '../ui/projectOps'

export const SPECIAL = {
  separator: '__sep__',
  create: '__crear__',
  other: '__otro__',
  pickTree: '__arbol__'
} as const
const SPECIAL_VALUES: string[] = Object.values(SPECIAL)

/** Ids aceptados como valor (letras, números, _, . y -) */
export const CATALOG_VALUE_REGEX = /^[A-Za-z0-9_.-]+$/
export const FLAG_REGEX = /^[a-z0-9_]+$/

export function isSpecialValue(v: string): boolean {
  return SPECIAL_VALUES.includes(v)
}

type Option = [string, string]

/** Opciones del menú en orden: especiales arriba (árbol), mod, juego, separador, crear/escribir */
export function buildMenu(kind: CatalogKind, current: string | null): Option[] {
  const s = store.get()
  const project = s.project
  // En "completó el foco" no se ofrece el foco que estoy editando
  const editingId =
    kind === 'focus' ? project?.focuses.find((f) => f.uid === s.selectedUid)?.id : undefined
  const opts = getCatalogOptions(kind, project, s.game).filter((o) => o.id !== editingId)

  const menu: Option[] = []
  if (kind === 'focus') menu.push(['🎯 Elegir en el árbol…', SPECIAL.pickTree])
  if (kind === 'state') menu.push(['🗺 Elegir en el mapa…', SPECIAL.pickTree])
  if (current && !opts.some((o) => o.id === current)) {
    const why = kind === 'focus' || kind === 'idea' ? 'ya no existe' : 'no está en la lista'
    menu.push([`⚠ ${current} (${why})`, current])
  } else if (!current) {
    menu.push(['— elige —', ''])
  }
  for (const o of opts) {
    const label = o.etiqueta && o.etiqueta !== o.id ? `${o.etiqueta} · ${o.id}` : o.id
    menu.push([o.origen === 'juego' ? `${label}  (juego)` : label, o.id])
  }
  menu.push(['──────────', SPECIAL.separator])
  if (kind !== 'country' && kind !== 'state') menu.push(['+ Crear nuevo…', SPECIAL.create])
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
      if (this.kind === 'state') {
        store.startPick({
          kind: 'state',
          exclude: [],
          onPick: (stateIdStr) => set(stateIdStr)
        })
      } else {
        store.startPick({
          kind: 'focus',
          exclude: s.selectedUid ? [s.selectedUid] : [],
          onPick: (uid) => set(store.get().project?.focuses.find((f) => f.uid === uid)?.id ?? null)
        })
      }
      return
    }

    if (v === SPECIAL.other) {
      store.openPrompt({
        message: 'Escribe el ID (para cosas de otros mods o DLC que no estén en la lista):',
        defaultValue: String(this.getValue() ?? ''),
        validate: (t) =>
          this.kind === 'country'
            ? validateTag(t)
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
