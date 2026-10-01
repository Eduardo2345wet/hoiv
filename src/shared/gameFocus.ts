// Lectura (por texto, sin parser) de common/national_focus/*.txt del juego: los id de los focos y
// los tags que ya tienen un árbol propio (country = { modifier = { add = N tag = XXX } }).
const strip = (t: string): string =>
  t
    .split('\n')
    .map((l) => {
      const i = l.indexOf('#')
      return i >= 0 ? l.slice(0, i) : l
    })
    .join('\n')

export interface FocusInfo {
  focusIds: string[]
  /** tag → prioridad (add) del árbol del juego */
  treeTags: Record<string, number>
}

export function parseFocusFile(text: string): FocusInfo {
  const t = strip(text)
  const focusIds: string[] = []
  const treeTags: Record<string, number> = {}
  // Focos: "focus = {" y su "id = X" al nivel directo del bloque
  const re = /\bfocus\s*=\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    let depth = 1
    let i = m.index + m[0].length
    const start = i
    while (i < t.length && depth > 0) {
      if (t[i] === '{') depth++
      else if (t[i] === '}') depth--
      i++
    }
    const body = t.slice(start, i - 1)
    // id al nivel 1 del bloque
    let d = 0
    let flat = ''
    for (const ch of body) {
      if (ch === '{') d++
      else if (ch === '}') d--
      else if (d === 0) flat += ch
    }
    const id = flat.match(/\bid\s*=\s*([A-Za-z0-9_.\-]+)/)
    if (id) focusIds.push(id[1])
    re.lastIndex = i
  }
  // Árboles: dentro de "focus_tree = { … country = { … modifier = { add = N tag = XXX } } }"
  for (const tree of t.matchAll(/\bcountry\s*=\s*\{([^]*?\})\s*\}/g)) {
    for (const mod of tree[1].matchAll(/modifier\s*=\s*\{([^}]*)\}/g)) {
      const tag = mod[1].match(/\btag\s*=\s*([A-Z][A-Z0-9]{2})\b/)
      if (!tag) continue
      const add = mod[1].match(/\badd\s*=\s*(-?\d+)/)
      treeTags[tag[1]] = add ? Number(add[1]) : 0
    }
  }
  return { focusIds, treeTags }
}
