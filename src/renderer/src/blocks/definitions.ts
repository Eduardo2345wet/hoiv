// Definición de todos los bloques de Blockly.
// Cada bloque muestra un texto en español, pero el generador (generator/pdx.ts)
// lo convierte en el script de Paradox.
//
// Tipos de conexión (setCheck): así Blockly no deja mezclar bloques.
//   - 'Condition' → bloques azules (condiciones)
//   - 'Effect'    → bloques verdes (efectos)

import * as Blockly from 'blockly/core'

export const CONDITION = 'Condition'
export const EFFECT = 'Effect'

export const COLOURS = {
  condition: '#2563eb',
  logic: '#1e40af',
  effect: '#16a34a',
  control: '#15803d',
  slot: '#ea580c'
}

// Las 3 "ranuras" fijas de cada foco.
export const SLOT_AVAILABLE = 'pdx_slot_available'
export const SLOT_BYPASS = 'pdx_slot_bypass'
export const SLOT_REWARD = 'pdx_slot_reward'
export const SLOT_TYPES = [SLOT_AVAILABLE, SLOT_BYPASS, SLOT_REWARD]

// ---------- Listas para los desplegables ----------

const GOVERNMENTS = [
  ['Democrático', 'democratic'],
  ['Comunista', 'communism'],
  ['Fascista', 'fascism'],
  ['No alineado', 'neutrality']
]

const YES_NO = [
  ['sí', 'yes'],
  ['no', 'no']
]

const WARGOALS = [
  ['anexión total', 'annex_everything'],
  ['convertir en títere', 'puppet_wargoal_focus'],
  ['derrocar gobierno', 'topple_government']
]

// Edificios que se construyen a nivel de estado.
const STATE_BUILDINGS = [
  ['fábrica civil', 'industrial_complex'],
  ['fábrica militar', 'arms_factory'],
  ['astillero', 'dockyard'],
  ['infraestructura', 'infrastructure'],
  ['base aérea', 'air_base'],
  ['antiaéreo', 'anti_air_building'],
  ['radar', 'radar_station'],
  ['refinería sintética', 'synthetic_refinery'],
  ['silo de combustible', 'fuel_silo']
]

const EQUIPMENT = [
  ['equipo de infantería', 'infantry_equipment'],
  ['equipo de apoyo', 'support_equipment'],
  ['artillería', 'artillery_equipment'],
  ['antitanque', 'anti_tank_equipment'],
  ['antiaéreo', 'anti_air_equipment'],
  ['equipo motorizado', 'motorized_equipment'],
  ['trenes', 'train_equipment'],
  ['convoyes', 'convoy']
]

// ---------- Ayudantes para escribir bloques más cortos ----------

type Arg = Record<string, unknown>

const num = (name: string, value: number, min?: number, precision = 1): Arg => ({
  type: 'field_number',
  name,
  value,
  min,
  precision
})
const text = (name: string, value: string): Arg => ({ type: 'field_input', name, text: value })
const dropdown = (name: string, options: string[][]): Arg => ({
  type: 'field_dropdown',
  name,
  options
})
const stack = (name: string, check: string): Arg => ({ type: 'input_statement', name, check })

function condition(type: string, message: string, args: Arg[], tooltip: string): Arg {
  return {
    type,
    message0: message,
    args0: args,
    previousStatement: CONDITION,
    nextStatement: CONDITION,
    colour: COLOURS.condition,
    tooltip,
    extensions: ['pdx_field_validators']
  }
}

function effect(type: string, message: string, args: Arg[], tooltip: string): Arg {
  return {
    type,
    message0: message,
    args0: args,
    previousStatement: EFFECT,
    nextStatement: EFFECT,
    colour: COLOURS.effect,
    tooltip,
    extensions: ['pdx_field_validators']
  }
}

function logic(type: string, message: string, tooltip: string): Arg {
  return {
    type,
    message0: message,
    message1: '%1',
    args1: [stack('STACK', CONDITION)],
    previousStatement: CONDITION,
    nextStatement: CONDITION,
    colour: COLOURS.logic,
    tooltip
  }
}

function slot(type: string, message: string, check: string, tooltip: string): Arg {
  return {
    type,
    // La etiqueta va en una fila y la "boca" para encajar bloques debajo.
    message0: message,
    message1: '%1',
    args1: [stack('STACK', check)],
    colour: COLOURS.slot,
    tooltip,
    extensions: ['pdx_slot']
  }
}

// ---------- Bloques ----------

export const BLOCK_DEFINITIONS: Arg[] = [
  // Ranuras
  slot(SLOT_AVAILABLE, 'Requisitos: el foco se puede elegir si...', CONDITION, 'available = { }'),
  slot(SLOT_BYPASS, 'Saltar si: el foco se completa solo si...', CONDITION, 'bypass = { }'),
  slot(SLOT_REWARD, 'Recompensa: al completar el foco...', EFFECT, 'completion_reward = { }'),

  // Condiciones
  condition('pdx_has_government', 'Tiene gobierno %1', [dropdown('GOV', GOVERNMENTS)], 'has_government'),
  condition('pdx_has_completed_focus', 'Completó el foco %1', [text('FOCUS', 'TAG_foco_1')], 'has_completed_focus'),
  condition('pdx_has_war', 'Está en guerra: %1', [dropdown('VALUE', YES_NO)], 'has_war'),
  condition('pdx_is_in_faction', 'Está en una facción: %1', [dropdown('VALUE', YES_NO)], 'is_in_faction'),
  condition('pdx_tag', 'El país es %1', [text('TAG', 'GER')], 'tag'),
  condition('pdx_has_idea', 'Tiene el espíritu nacional %1', [text('IDEA', 'nombre_idea')], 'has_idea'),
  condition('pdx_owns_state', 'Posee el estado nº %1', [num('STATE', 1, 1)], 'owns_state'),
  condition('pdx_has_country_flag', 'Tiene la bandera %1', [text('FLAG', 'mi_bandera')], 'has_country_flag'),
  condition(
    'pdx_date',
    'La fecha es %1 %2',
    [dropdown('OP', [['posterior a', '>'], ['anterior a', '<']]), text('DATE', '1939.1.1')],
    'date > año.mes.día'
  ),
  condition(
    'pdx_has_political_power',
    'Tiene %1 %2 de poder político',
    [dropdown('OP', [['más de', '>'], ['menos de', '<']]), num('AMOUNT', 100, 0)],
    'has_political_power'
  ),

  // Combinadores lógicos
  logic('pdx_not', 'NO se cumple ninguna de:', 'NOT = { }'),
  logic('pdx_or', 'Se cumple ALGUNA de:', 'OR = { }'),
  logic('pdx_and', 'Se cumplen TODAS:', 'AND = { }'),

  // Efectos
  effect('pdx_add_political_power', 'Ganar %1 de poder político', [num('AMOUNT', 100)], 'add_political_power'),
  effect('pdx_add_stability', 'Ganar %1 %% de estabilidad', [num('PERCENT', 5, -100, 1)], 'add_stability'),
  effect('pdx_add_war_support', 'Ganar %1 %% de apoyo a la guerra', [num('PERCENT', 5, -100, 1)], 'add_war_support'),
  effect('pdx_add_ideas', 'Añadir espíritu nacional %1', [text('IDEA', 'nombre_idea')], 'add_ideas'),
  effect('pdx_add_state_core', 'Obtener núcleo en el estado nº %1', [num('STATE', 1, 1)], 'add_state_core'),
  effect('pdx_add_state_claim', 'Reclamar el estado nº %1', [num('STATE', 1, 1)], 'add_state_claim'),
  effect('pdx_transfer_state', 'Recibir el estado nº %1', [num('STATE', 1, 1)], 'transfer_state'),
  effect(
    'pdx_declare_war_on',
    'Declarar la guerra a %1 con objetivo %2',
    [text('TAG', 'FRA'), dropdown('WARGOAL', WARGOALS)],
    'declare_war_on'
  ),
  effect(
    'pdx_create_wargoal',
    'Obtener objetivo de guerra %1 contra %2',
    [dropdown('WARGOAL', WARGOALS), text('TAG', 'FRA')],
    'create_wargoal'
  ),
  effect('pdx_create_faction', 'Crear la facción %1', [text('NAME', 'Mi Alianza')], 'create_faction'),
  effect('pdx_add_to_faction', 'Invitar a %1 a nuestra facción', [text('TAG', 'ITA')], 'add_to_faction'),
  effect('pdx_puppet', 'Convertir a %1 en títere', [text('TAG', 'AUS')], 'puppet'),
  effect(
    'pdx_add_building_construction',
    'En el estado nº %1 construir %2 x %3 instantáneo: %4',
    [num('STATE', 1, 1), num('LEVEL', 1, 1), dropdown('BUILDING', STATE_BUILDINGS), dropdown('INSTANT', YES_NO)],
    'ESTADO = { add_building_construction = { ... } }'
  ),
  effect('pdx_add_research_slot', 'Ganar %1 espacio(s) de investigación', [num('AMOUNT', 1, 1)], 'add_research_slot'),
  effect('pdx_add_manpower', 'Ganar %1 de mano de obra', [num('AMOUNT', 10000, 0)], 'add_manpower'),
  effect(
    'pdx_add_equipment_to_stockpile',
    'Añadir %1 de %2 al arsenal',
    [num('AMOUNT', 1000, 1), dropdown('EQUIPMENT', EQUIPMENT)],
    'add_equipment_to_stockpile'
  ),
  effect('pdx_army_experience', 'Ganar %1 de experiencia de ejército', [num('AMOUNT', 10, 0)], 'army_experience'),
  effect(
    'pdx_country_event',
    'Lanzar el evento %1 dentro de %2 días',
    [text('EVENT', 'mi_evento.1'), num('DAYS', 0, 0)],
    'country_event'
  ),
  effect('pdx_set_country_flag', 'Activar la bandera %1', [text('FLAG', 'mi_bandera')], 'set_country_flag'),

  // Control: si / entonces
  {
    type: 'pdx_if',
    message0: 'Si se cumple %1 %2',
    args0: [{ type: 'input_dummy' }, stack('LIMIT', CONDITION)],
    message1: 'entonces %1',
    args1: [stack('DO', EFFECT)],
    previousStatement: EFFECT,
    nextStatement: EFFECT,
    colour: COLOURS.control,
    tooltip: 'if = { limit = { } }'
  }
]

// ---------- Validadores de campos ----------
// Evitan que el usuario escriba caracteres que romperían el script.

const tagValidator = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)

const identifierValidator = (value: string): string => value.replace(/[^A-Za-z0-9_.]/g, '')

const textValidator = (value: string): string => value.replace(/["{}]/g, '')

const dateValidator = (value: string): string | null =>
  /^\d{1,4}\.\d{1,2}\.\d{1,2}$/.test(value) ? value : null

const FIELD_VALIDATORS: Record<string, (value: string) => string | null> = {
  TAG: tagValidator,
  FOCUS: identifierValidator,
  IDEA: identifierValidator,
  FLAG: identifierValidator,
  EVENT: identifierValidator,
  NAME: textValidator,
  DATE: dateValidator
}

let registered = false

/** Registra los bloques en Blockly (solo la primera vez que se llama). */
export function registerBlocks(): void {
  if (registered) return
  registered = true

  if (!Blockly.Extensions.isRegistered('pdx_field_validators')) {
    Blockly.Extensions.register('pdx_field_validators', function (this: Blockly.Block) {
      for (const [name, validator] of Object.entries(FIELD_VALIDATORS)) {
        const field = this.getField(name)
        if (field instanceof Blockly.FieldTextInput) field.setValidator(validator)
      }
    })
  }

  // Las ranuras no se pueden borrar.
  if (!Blockly.Extensions.isRegistered('pdx_slot')) {
    Blockly.Extensions.register('pdx_slot', function (this: Blockly.Block) {
      this.setDeletable(false)
    })
  }

  Blockly.common.defineBlocksWithJsonArray(BLOCK_DEFINITIONS)
}
