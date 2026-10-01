// Flujos que usan el selector universal de país (sin ventanas extra al elegir un país del juego)
import { store } from '../store/appStore'
import { assignTreeToTag } from '../countries/countryOps'
import { colorForTag } from '../countries/countryOps'
import { suggestTag } from '../countries/tags'
import { countrySections } from '../countries/choices'
import { createQuickCountry } from '../map/quickCountry'

/** Nombre legible de un tag (mod, juego o el tag) */
export function nameOfTag(tag: string): string {
  const p = store.get().project
  const mine = p?.countries.find((c) => c.tag === tag)
  if (mine) return mine.names.name || tag
  const s = countrySections(p, store.get().map, store.catalogGame())
  return [...s.onMap, ...s.game].find((c) => c.tag === tag)?.name ?? tag
}

/**
 * Abre el selector y devuelve el tag elegido. "+ Crear país nuevo…": rápido pide solo el nombre y
 * lo crea; con el asistente se abre el asistente y devuelve null (se elige después).
 */
export async function chooseCountryTag(title: string): Promise<string | null> {
  const r = await store.pickCountry(title)
  if (!r) return null
  if ('tag' in r) return r.tag
  if (r.create === 'wizard') {
    store.set({ wizardRequest: { n: Date.now() } })
    return null
  }
  const name = await new Promise<string | null>((resolve) =>
    store.openPrompt({
      message: 'Nombre del país nuevo',
      defaultValue: '',
      validate: (t) => (t.trim() ? null : 'Escribe un nombre'),
      callback: resolve
    })
  )
  if (!name) return null
  const taken = [
    ...store.get().project!.countries.map((c) => c.tag),
    ...(store.catalogGame()?.countries.map(([t]) => t) ?? [])
  ]
  const tag = suggestTag(name, taken)
  return createQuickCountry(name.trim(), tag, colorForTag(tag)).tag
}

/**
 * Elige un país y le da un árbol de focos (el existente `treeId` o uno vacío nuevo), sin abrir
 * ventanas: un país del juego se registra como "ligero". Devuelve el id del árbol o null.
 */
export async function giveTreeToChosenCountry(treeId?: string): Promise<string | null> {
  const tag = await chooseCountryTag('¿De qué país es este árbol de focos?')
  if (!tag) return null
  let out = ''
  const name = nameOfTag(tag)
  store.updateProject((p) => {
    const r = assignTreeToTag(p, tag, name, treeId)
    out = r.treeId
    return r.project
  })
  store.set({ activeTreeId: out, selectedUid: null })
  return out
}
