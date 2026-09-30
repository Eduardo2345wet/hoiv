// Ajustes de la app y lectura OPCIONAL del contenido del juego base.
// Si no hay carpeta de HOI4, la interfaz usa una lista integrada corta.
import fs from 'fs'
import path from 'path'

export interface Settings {
  gamePath: string | null
}

export function loadSettings(file: string): Settings {
  try {
    return { gamePath: null, ...JSON.parse(fs.readFileSync(file, 'utf-8')) }
  } catch {
    return { gamePath: null }
  }
}

export function saveSettings(file: string, s: Settings): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(s, null, 2), 'utf-8')
}

/** Quita comentarios (# ...) respetando comillas */
function stripComments(text: string): string {
  return text
    .split('\n')
    .map((l) => {
      let q = false
      for (let i = 0; i < l.length; i++) {
        if (l[i] === '"') q = !q
        if (l[i] === '#' && !q) return l.slice(0, i)
      }
      return l
    })
    .join('\n')
}

/** common/country_tags/*.txt → [tag, archivo] */
export function parseCountryTags(text: string): string[] {
  const tags: string[] = []
  for (const m of stripComments(text).matchAll(/^\s*([A-Z][A-Z0-9]{2})\s*=/gm)) tags.push(m[1])
  return tags
}

/** common/ideas/*.txt → ids de ideas (claves de 3er nivel: ideas = { categoría = { ID = {...} } }) */
export function parseIdeaIds(text: string): string[] {
  const ids: string[] = []
  const tokens = stripComments(text).match(/"[^"]*"|[{}=]|[^\s{}=]+/g) ?? []
  const stack: string[] = []
  let lastKey: string | null = null
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === '{') {
      stack.push(lastKey ?? '')
      if (
        stack.length === 3 &&
        stack[0] === 'ideas' &&
        lastKey &&
        !['designer', 'law', 'use_list_view'].includes(lastKey)
      )
        ids.push(lastKey)
      lastKey = null
    } else if (t === '}') {
      stack.pop()
      lastKey = null
    } else if (t === '=') {
      // la clave es el token anterior
    } else {
      lastKey = tokens[i + 1] === '=' ? t : null
    }
  }
  return ids
}

function readDir(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.txt'))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
  } catch {
    return []
  }
}

const cache = new Map<string, { countries: [string, string][]; ideas: [string, string][] }>()

export function readGameCatalog(
  gamePath: string
): { countries: [string, string][]; ideas: [string, string][] } | null {
  if (cache.has(gamePath)) return cache.get(gamePath)!
  const tagsDir = path.join(gamePath, 'common', 'country_tags')
  if (!fs.existsSync(tagsDir)) return null
  const tags = [...new Set(readDir(tagsDir).flatMap(parseCountryTags))].sort()
  const ideas = [
    ...new Set(readDir(path.join(gamePath, 'common', 'ideas')).flatMap(parseIdeaIds))
  ].sort()
  const result = {
    countries: tags.map((t): [string, string] => [t, t]),
    ideas: ideas.map((i): [string, string] => [i, i])
  }
  cache.set(gamePath, result)
  return result
}
