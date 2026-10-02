// Lee common/ideas/*.txt del juego: categoría, picture, modificadores y el resto del texto de cada
// idea. No interpreta lo que no entiende: lo guarda tal cual para exportarlo idéntico.
import { tokenizePdx } from './countryHistory'

export type IdeaTab = 'espiritus' | 'leyes' | 'asesores' | 'otros'

export interface GameIdea {
  id: string
  category: string
  tab: IdeaTab
  file: string
  picture: string
  /** Nombre y descripción localizados (los rellena el catálogo) */
  name: string
  desc: string
  /** Modificadores soportados: [clave, valor tal como lo escribe el usuario] (% × 100) */
  modifiers: [string, number][]
  /** Líneas de `modifier = { }` que no son filas soportadas (texto original) */
  extraModifierText: string
  /** Resto de sentencias de la idea (allowed, on_add, cost…) en texto original */
  extraText: string
}

/** Claves de modificador soportadas como filas editables (valor, ¿porcentaje?) */
export const SUPPORTED_MODIFIERS: Record<string, boolean> = {
  stability_factor: true,
  war_support_factor: true,
  political_power_gain: false,
  consumer_goods_factor: true,
  industrial_capacity_factory: true,
  production_speed_buildings_factor: true,
  research_speed_factor: true,
  army_attack_factor: true,
  army_defence_factor: true,
  conscription_factor: true
}

const ADVISOR_CATEGORIES = new Set([
  'political_advisor',
  'army_chief',
  'navy_chief',
  'air_chief',
  'high_command',
  'theorist',
  'tank_manufacturer',
  'naval_manufacturer',
  'aircraft_manufacturer',
  'materiel_manufacturer',
  'industrial_concern',
  'military_staff'
])

interface Stmt {
  key: string
  keyTok: number
  valStart: number
  valEnd: number
  block: boolean
}

type Tok = ReturnType<typeof tokenizePdx>[number]

function statements(t: Tok[], from: number, to: number): Stmt[] {
  const out: Stmt[] = []
  let i = from
  while (i < to) {
    if (t[i + 1]?.v === '=' && t[i + 2]) {
      if (t[i + 2].v === '{') {
        let d = 0
        let j = i + 2
        for (; j < to; j++) {
          if (t[j].v === '{') d++
          else if (t[j].v === '}' && --d === 0) break
        }
        out.push({ key: t[i].v, keyTok: i, valStart: i + 2, valEnd: j, block: true })
        i = j + 1
      } else {
        out.push({ key: t[i].v, keyTok: i, valStart: i + 2, valEnd: i + 2, block: false })
        i += 3
      }
    } else i++
  }
  return out
}

export function parseGameIdeas(text: string, file: string): GameIdea[] {
  const t = tokenizePdx(text)
  const out: GameIdea[] = []
  const root = statements(t, 0, t.length).find((s) => s.key === 'ideas' && s.block)
  if (!root) return out
  const raw = (s: Stmt): string => text.slice(t[s.keyTok].s, t[s.valEnd].e)
  for (const cat of statements(t, root.valStart + 1, root.valEnd)) {
    if (!cat.block) continue
    const inner = statements(t, cat.valStart + 1, cat.valEnd)
    const flag = (k: string): boolean =>
      inner.some((s) => s.key === k && !s.block && t[s.valStart].v === 'yes')
    const tab: IdeaTab =
      flag('designer') || ADVISOR_CATEGORIES.has(cat.key)
        ? 'asesores'
        : flag('law')
          ? 'leyes'
          : cat.key === 'country'
            ? 'espiritus'
            : 'otros'
    for (const idea of inner) {
      if (!idea.block) continue
      let picture = ''
      const mods: [string, number][] = []
      const extraMod: string[] = []
      const extra: string[] = []
      for (const st of statements(t, idea.valStart + 1, idea.valEnd)) {
        if (st.key === 'picture' && !st.block) picture = t[st.valStart].v.replace(/"/g, '')
        else if (st.key === 'modifier' && st.block) {
          for (const m of statements(t, st.valStart + 1, st.valEnd)) {
            const v = m.block ? NaN : Number(t[m.valStart].v)
            if (!m.block && m.key in SUPPORTED_MODIFIERS && Number.isFinite(v))
              mods.push([
                m.key,
                SUPPORTED_MODIFIERS[m.key] ? Math.round(v * 100 * 10000) / 10000 : v
              ])
            else extraMod.push(raw(m))
          }
        } else extra.push(raw(st))
      }
      out.push({
        id: t[idea.keyTok].v,
        category: cat.key,
        tab,
        file,
        picture,
        name: '',
        desc: '',
        modifiers: mods,
        extraModifierText: extraMod.join('\n'),
        extraText: extra.join('\n')
      })
    }
  }
  return out
}
