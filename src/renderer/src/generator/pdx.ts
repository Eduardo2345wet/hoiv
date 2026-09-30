// Generador de código propio: convierte los bloques de Blockly en script de Paradox (PDX).

import * as Blockly from 'blockly/core'
import { SLOT_AVAILABLE, SLOT_BYPASS, SLOT_REWARD } from '../blocks/definitions'

export const pdxGenerator = new Blockly.CodeGenerator('PDX')
pdxGenerator.INDENT = '\t'

// Blockly no concatena por sí solo los bloques apilados debajo: lo hacemos aquí.
pdxGenerator.scrub_ = function (block, code, thisOnly) {
  const next = block.nextConnection?.targetBlock()
  if (next && !thisOnly) return code + (pdxGenerator.blockToCode(next) as string)
  return code
}

// ---------- Ayudantes ----------

const field = (block: Blockly.Block, name: string): string => String(block.getFieldValue(name) ?? '')

/** Convierte un porcentaje (5) en la fracción que usa el juego (0.05). */
const percent = (value: string): string => String(Number((Number(value) / 100).toFixed(4)))

/** Genera "NOMBRE = {\n ...contenido indentado... }\n". */
function block_(name: string, body: string): string {
  return `${name} = {\n${body}}\n`
}

const line = (key: string, value: string | number): string => `${key} = ${value}\n`

const inner = (block: Blockly.Block, input: string): string =>
  pdxGenerator.statementToCode(block, input)

const g = pdxGenerator.forBlock

// ---------- Condiciones ----------

g['pdx_has_government'] = (b) => line('has_government', field(b, 'GOV'))
g['pdx_has_completed_focus'] = (b) => line('has_completed_focus', field(b, 'FOCUS'))
g['pdx_has_war'] = (b) => line('has_war', field(b, 'VALUE'))
g['pdx_is_in_faction'] = (b) => line('is_in_faction', field(b, 'VALUE'))
g['pdx_tag'] = (b) => line('tag', field(b, 'TAG'))
g['pdx_has_idea'] = (b) => line('has_idea', field(b, 'IDEA'))
g['pdx_owns_state'] = (b) => line('owns_state', field(b, 'STATE'))
g['pdx_has_country_flag'] = (b) => line('has_country_flag', field(b, 'FLAG'))
g['pdx_date'] = (b) => `date ${field(b, 'OP')} ${field(b, 'DATE')}\n`
g['pdx_has_political_power'] = (b) => `has_political_power ${field(b, 'OP')} ${field(b, 'AMOUNT')}\n`
g['pdx_not'] = (b) => block_('NOT', inner(b, 'STACK'))
g['pdx_or'] = (b) => block_('OR', inner(b, 'STACK'))
g['pdx_and'] = (b) => block_('AND', inner(b, 'STACK'))

// ---------- Efectos ----------

g['pdx_add_political_power'] = (b) => line('add_political_power', field(b, 'AMOUNT'))
g['pdx_add_stability'] = (b) => line('add_stability', percent(field(b, 'PERCENT')))
g['pdx_add_war_support'] = (b) => line('add_war_support', percent(field(b, 'PERCENT')))
g['pdx_add_ideas'] = (b) => line('add_ideas', field(b, 'IDEA'))
g['pdx_add_state_core'] = (b) => line('add_state_core', field(b, 'STATE'))
g['pdx_add_state_claim'] = (b) => line('add_state_claim', field(b, 'STATE'))
g['pdx_transfer_state'] = (b) => line('transfer_state', field(b, 'STATE'))
g['pdx_declare_war_on'] = (b) =>
  block_('declare_war_on', `\t${line('target', field(b, 'TAG'))}\t${line('type', field(b, 'WARGOAL'))}`)
g['pdx_create_wargoal'] = (b) =>
  block_('create_wargoal', `\t${line('type', field(b, 'WARGOAL'))}\t${line('target', field(b, 'TAG'))}`)
g['pdx_create_faction'] = (b) => line('create_faction', `"${field(b, 'NAME')}"`)
g['pdx_add_to_faction'] = (b) => line('add_to_faction', field(b, 'TAG'))
g['pdx_puppet'] = (b) => line('puppet', field(b, 'TAG'))
g['pdx_add_building_construction'] = (b) => {
  // Se ejecuta "en ámbito de estado": NUMERO_ESTADO = { add_building_construction = { ... } }
  const construction = block_(
    'add_building_construction',
    `\t${line('type', field(b, 'BUILDING'))}\t${line('level', field(b, 'LEVEL'))}\t${line('instant_build', field(b, 'INSTANT'))}`
  )
  return block_(field(b, 'STATE'), pdxGenerator.prefixLines(construction, '\t'))
}
g['pdx_add_research_slot'] = (b) => line('add_research_slot', field(b, 'AMOUNT'))
g['pdx_add_manpower'] = (b) => line('add_manpower', field(b, 'AMOUNT'))
g['pdx_add_equipment_to_stockpile'] = (b) =>
  block_(
    'add_equipment_to_stockpile',
    `\t${line('type', field(b, 'EQUIPMENT'))}\t${line('amount', field(b, 'AMOUNT'))}`
  )
g['pdx_army_experience'] = (b) => line('army_experience', field(b, 'AMOUNT'))
g['pdx_country_event'] = (b) => {
  const days = Number(field(b, 'DAYS'))
  if (!days) return line('country_event', field(b, 'EVENT'))
  return block_('country_event', `\t${line('id', field(b, 'EVENT'))}\t${line('days', days)}`)
}
g['pdx_set_country_flag'] = (b) => line('set_country_flag', field(b, 'FLAG'))
g['pdx_if'] = (b) =>
  block_('if', pdxGenerator.prefixLines(block_('limit', inner(b, 'LIMIT')), '\t') + inner(b, 'DO'))

// Las ranuras no generan nada por sí mismas; se leen con generateFromWorkspace().
g[SLOT_AVAILABLE] = () => ''
g[SLOT_BYPASS] = () => ''
g[SLOT_REWARD] = () => ''
