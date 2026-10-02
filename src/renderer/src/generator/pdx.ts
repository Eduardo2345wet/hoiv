// Generador propio que convierte los bloques en script de Paradox (PDX).
// Cada bloque devuelve una o varias líneas terminadas en "\n".
import * as Blockly from 'blockly'
import { FOCUS_ROOT, SLOT_INPUTS } from '../blocks/slots'
import type { FocusScripts } from '../types'

export const pdxGenerator = new Blockly.CodeGenerator('PDX')
pdxGenerator.INDENT = '\t'

/** Limpia un texto para que sea un identificador válido (sin espacios, llaves ni comillas) */
export function cleanId(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/[\s{}"=#]+/g, '_')
}

/** Encadena el bloque siguiente (los bloques "apilados" uno debajo de otro) */
pdxGenerator.scrub_ = function (block, code, thisOnly) {
  const next = block.nextConnection && block.nextConnection.targetBlock()
  if (next && !thisOnly) return code + pdxGenerator.blockToCode(next)
  return code
}

const f = (b: Blockly.Block, name: string): string => String(b.getFieldValue(name))
const id = (b: Blockly.Block, name: string): string => cleanId(f(b, name))
/** Porcentaje (5) → decimal (0.05) sin decimales basura */
const pct = (b: Blockly.Block, name: string): string =>
  String(Math.round(Number(f(b, name)) * 100) / 10000)

/** Genera "clave = {\n <hijos> }\n" con los hijos indentados */
function wrap(key: string, block: Blockly.Block, input: string): string {
  const inner = pdxGenerator.statementToCode(block, input)
  if (!inner.trim()) return `${key} = { }\n`
  return `${key} = {\n${inner}}\n`
}

const g = pdxGenerator.forBlock

// ---------------- Condiciones ----------------
g['cond_has_government'] = (b) => `has_government = ${f(b, 'IDEOLOGY')}\n`
g['cond_has_completed_focus'] = (b) => `has_completed_focus = ${id(b, 'FOCUS')}\n`
g['cond_has_war'] = (b) => `has_war = ${f(b, 'VALUE')}\n`
g['cond_is_in_faction'] = (b) => `is_in_faction = ${f(b, 'VALUE')}\n`
g['cond_tag'] = (b) => `tag = ${id(b, 'TAG').toUpperCase()}\n`
g['cond_has_idea'] = (b) => `has_idea = ${id(b, 'IDEA')}\n`
g['cond_owns_state'] = (b) => `owns_state = ${f(b, 'STATE')}\n`
g['cond_has_country_flag'] = (b) => `has_country_flag = ${id(b, 'FLAG')}\n`
g['cond_date_after'] = (b) => `date > ${f(b, 'YEAR')}.${f(b, 'MONTH')}.${f(b, 'DAY')}\n`
g['cond_has_political_power'] = (b) => `has_political_power > ${f(b, 'AMOUNT')}\n`
g['cond_not'] = (b) => wrap('NOT', b, 'CHILDREN')
g['cond_or'] = (b) => wrap('OR', b, 'CHILDREN')
g['cond_and'] = (b) => wrap('AND', b, 'CHILDREN')

// ---------------- Efectos ----------------
g['eff_add_political_power'] = (b) => `add_political_power = ${f(b, 'AMOUNT')}\n`
g['eff_add_stability'] = (b) => `add_stability = ${pct(b, 'PERCENT')}\n`
g['eff_add_war_support'] = (b) => `add_war_support = ${pct(b, 'PERCENT')}\n`
g['eff_add_ideas'] = (b) => `add_ideas = ${id(b, 'IDEA')}\n`
g['eff_remove_ideas'] = (b) => `remove_ideas = ${id(b, 'IDEA')}\n`
g['eff_add_state_core'] = (b) => `add_state_core = ${f(b, 'STATE')}\n`
g['eff_add_state_claim'] = (b) => `add_state_claim = ${f(b, 'STATE')}\n`
g['eff_transfer_state'] = (b) => `transfer_state = ${f(b, 'STATE')}\n`
g['eff_declare_war_on'] = (b) =>
  `declare_war_on = {\n\ttarget = ${id(b, 'TAG').toUpperCase()}\n\ttype = ${f(b, 'WARGOAL')}\n}\n`
g['eff_create_wargoal'] = (b) =>
  `create_wargoal = {\n\ttype = ${f(b, 'WARGOAL')}\n\ttarget = ${id(b, 'TAG').toUpperCase()}\n}\n`
g['eff_create_faction'] = (b) => `create_faction = ${id(b, 'NAME')}\n`
g['eff_add_to_faction'] = (b) => `add_to_faction = ${id(b, 'TAG').toUpperCase()}\n`
g['eff_puppet'] = (b) => `puppet = ${id(b, 'TAG').toUpperCase()}\n`
g['eff_state_scope'] = (b) => wrap(f(b, 'STATE'), b, 'DO')
g['eff_add_building_construction'] = (b) =>
  `add_building_construction = {\n\ttype = ${f(b, 'BUILDING')}\n\tlevel = ${f(b, 'LEVEL')}\n\tinstant_build = yes\n}\n`
g['eff_add_research_slot'] = (b) => `add_research_slot = ${f(b, 'AMOUNT')}\n`
g['eff_add_manpower'] = (b) => `add_manpower = ${f(b, 'AMOUNT')}\n`
g['eff_add_equipment'] = (b) =>
  `add_equipment_to_stockpile = {\n\ttype = ${f(b, 'EQUIPMENT')}\n\tamount = ${f(b, 'AMOUNT')}\n}\n`
g['eff_army_experience'] = (b) => `army_experience = ${f(b, 'AMOUNT')}\n`
g['eff_country_event'] = (b) => {
  const days = Number(f(b, 'DAYS'))
  const d = days > 0 ? `\n\tdays = ${days}\n` : ' '
  return days > 0
    ? `country_event = {\n\tid = ${id(b, 'EVENT')}${d}}\n`
    : `country_event = ${id(b, 'EVENT')}\n`
}
g['eff_set_country_flag'] = (b) => `set_country_flag = ${id(b, 'FLAG')}\n`
g['eff_if'] = (b) => {
  const limit = pdxGenerator.statementToCode(b, 'LIMIT')
  const body = pdxGenerator.statementToCode(b, 'DO')
  return `if = {\n\tlimit = {\n${pdxGenerator.prefixLines(limit, '\t')}\t}\n${body}}\n`
}

// Las ranuras no generan nada por sí mismas (se leen con generateSlots)
g[FOCUS_ROOT] = () => ''

/** Lee las 3 secciones del bloque raíz "Foco" y devuelve su código */
export function generateSlots(ws: Blockly.Workspace): FocusScripts {
  pdxGenerator.init(ws)
  const root = ws.getBlocksByType(FOCUS_ROOT, false)[0]
  const read = (input: string): string => (root ? pdxGenerator.statementToCode(root, input) : '')
  return {
    available: read(SLOT_INPUTS.available),
    bypass: read(SLOT_INPUTS.bypass),
    reward: read(SLOT_INPUTS.reward)
  }
}
