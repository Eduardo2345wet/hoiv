// Informe del ejército LEYENDO TU JUEGO (solo lectura): cuántas unidades terrestres hay, cómo se
// clasifica cada `group` y cuáles tienen ícono real. No escribe nada en el juego ni en el proyecto.
// Uso: npx vite-node scripts/army-report.ts ["C:\ruta\a\Hearts of Iron IV"]
import fs from 'fs'
import path from 'path'
import { readGameCatalog } from '../src/main/game'
import { resolveTexture, spriteIndex } from '../src/main/gameSprites'
import { unitCategory } from '../src/shared/gameUnits'

const game =
  process.argv[2] ?? 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hearts of Iron IV'
if (!fs.existsSync(path.join(game, 'common', 'units'))) {
  console.error(`No encuentro common/units en: ${game}`)
  process.exit(1)
}

const cat = readGameCatalog(game)
const units = cat?.subUnits ?? []
const idx = spriteIndex(game)
/** ¿El ícono tiene su textura en disco? (juego base o DLC) */
const hasTexture = (gfx: string | null | undefined): boolean => {
  const sp = gfx ? idx.sprites.get(gfx) : undefined
  return !!sp && idx.roots.some((r) => !!resolveTexture(r, sp.texture))
}

console.log(`sub_units leídos: ${units.length}`)

// ---- group → categoría
const groups = new Map<string, { cat: string; ids: string[] }>()
for (const u of units) {
  const c = unitCategory(u) ?? 'NO terrestre'
  const key = `${u.group || '(sin group)'} → ${c}`
  const e = groups.get(key) ?? { cat: c, ids: [] }
  e.ids.push(u.id)
  groups.set(key, e)
}
console.log('\n== group → categoría ==')
for (const [k, v] of [...groups].sort((a, b) => a[0].localeCompare(b[0])))
  console.log(`${k.padEnd(44)} ${String(v.ids.length).padStart(3)}`)

// ---- no terrestres: de qué tipo son
const notLand = units.filter((u) => unitCategory(u) === null)
console.log(`\nNo terrestres (${notLand.length}): ${notLand.map((u) => u.id).join(', ')}`)
const sneaky = notLand.filter((u) => u.group)
console.log(
  `  con group pero excluidas (deberían ser 0): ${sneaky.map((u) => u.id).join(', ') || '0'}`
)
const landNoGroup = units.filter((u) => !u.group && unitCategory(u) !== null)
console.log(
  `  terrestres SIN group (deberían ser 0): ${landNoGroup.map((u) => u.id).join(', ') || '0'}`
)

// ---- terrestres: con ícono real o genérico
const land = units.filter((u) => unitCategory(u) !== null)
const withIcon = land.filter((u) => u.gfx && hasTexture(u.gfx))
const generic = land.filter((u) => !(u.gfx && hasTexture(u.gfx)))
console.log(`\nTerrestres: ${land.length}`)
console.log(`  con ícono real (GFX + textura en disco): ${withIcon.length}`)
const byId = withIcon.filter((u) => u.gfx === `GFX_unit_${u.id}_icon_medium`).length
console.log(`    · por el ID de la unidad: ${byId}`)
console.log(`    · por el sprite (respaldo): ${withIcon.length - byId}`)
const viaSprite = withIcon.filter((u) => u.gfx !== `GFX_unit_${u.id}_icon_medium`)
for (const u of viaSprite) console.log(`        ${u.id} (sprite ${u.sprite}) → ${u.gfx}`)
console.log(
  `  con el ícono genérico (${generic.length}): ${generic.map((u) => u.id).join(', ') || '—'}`
)

// ---- comprobaciones puntuales pedidas
const get = (id: string): (typeof units)[number] | undefined => units.find((u) => u.id === id)
console.log('\n== comprobaciones ==')
const ab = get('artillery_brigade')
console.log(`artillery_brigade: group=${ab?.group} type=[${ab?.type}] ícono=${ab?.gfx}`)
console.log(
  `  usa el de línea y no el de apoyo: ${ab?.gfx === 'GFX_unit_artillery_brigade_icon_medium'} (apoyo = ${get('artillery')?.gfx})`
)
for (const id of [
  'light_tank_destroyer_support',
  'medium_tank_destroyer_support',
  'heavy_tank_destroyer_support',
  'modern_tank_destroyer_support'
]) {
  const u = get(id)
  console.log(`${id}: ${u?.gfx ?? 'SIN ÍCONO'} textura en disco: ${hasTexture(u?.gfx)}`)
}
