// Bloques de EFECTO (verdes). Solo se pueden encajar en "Recompensa"
// o dentro de otros efectos (si/entonces, en el estado...).
import * as Blockly from 'blockly'
import {
  CHECK_CONDITION,
  CHECK_EFFECT,
  CHECK_STATE_EFFECT,
  COLOR_EFFECT,
  COLOR_STATE
} from './checks'

const base = {
  previousStatement: CHECK_EFFECT,
  nextStatement: CHECK_EFFECT,
  colour: COLOR_EFFECT
}

const WAR_GOALS: [string, string][] = [
  ['anexionar', 'annex_everyone'],
  ['tomar estado', 'take_state_focus'],
  ['humillar', 'humiliate'],
  ['imponer gobierno', 'puppet_wargoal_focus']
]

const BUILDINGS: [string, string][] = [
  ['fábrica civil', 'industrial_complex'],
  ['fábrica militar', 'arms_factory'],
  ['infraestructura', 'infrastructure'],
  ['astillero', 'dockyard'],
  ['base aérea', 'air_base'],
  ['antiaéreo', 'anti_air_building'],
  ['refinería', 'synthetic_refinery']
]

const EQUIPMENT: [string, string][] = [
  ['armas de infantería', 'infantry_equipment'],
  ['equipo de apoyo', 'support_equipment'],
  ['artillería', 'artillery_equipment'],
  ['motorizados', 'motorized_equipment'],
  ['tanques ligeros', 'light_tank_equipment'],
  ['cazas', 'fighter_equipment']
]

export const EVENT_TYPES: [string, string][] = [
  ['de país', 'country_event'],
  ['de noticias', 'news_event'],
  ['de estado', 'state_event']
]

export const effectBlocks = [
  {
    type: 'eff_fire_event',
    message0: 'Lanzar evento %1 %2 en %3 días (+ %4 aleatorios) para %5',
    args0: [
      { type: 'field_dropdown', name: 'TYPE', options: EVENT_TYPES },
      { type: 'field_catalog', name: 'EVENT', kind: 'event', value: '' },
      { type: 'field_number', name: 'DAYS', value: 1, min: 0 },
      { type: 'field_number', name: 'RANDOM', value: 0, min: 0 },
      { type: 'field_catalog', name: 'TARGET', kind: 'country', value: '' }
    ],
    tooltip: 'Dispara un evento. Sin país destino, lo recibe este mismo país.',
    ...base
  },
  {
    type: 'eff_add_political_power',
    message0: 'Ganar %1 de poder político',
    args0: [{ type: 'field_number', name: 'AMOUNT', value: 100 }],
    ...base
  },
  {
    type: 'eff_add_stability',
    message0: 'Ganar %1 % de estabilidad',
    args0: [{ type: 'field_number', name: 'PERCENT', value: 5, min: -100, max: 100 }],
    tooltip: 'En porcentaje: 5 = +5%',
    ...base
  },
  {
    type: 'eff_add_war_support',
    message0: 'Ganar %1 % de apoyo a la guerra',
    args0: [{ type: 'field_number', name: 'PERCENT', value: 5, min: -100, max: 100 }],
    ...base
  },
  {
    type: 'eff_add_ideas',
    message0: 'Añadir espíritu nacional %1',
    args0: [{ type: 'field_catalog', name: 'IDEA', kind: 'idea', value: '' }],
    ...base
  },
  {
    type: 'eff_remove_ideas',
    message0: 'Quitar espíritu nacional %1',
    args0: [{ type: 'field_catalog', name: 'IDEA', kind: 'idea', value: '' }],
    ...base
  },
  {
    type: 'eff_add_state_core',
    message0: 'Obtener núcleo en el estado %1',
    args0: [{ type: 'field_catalog', name: 'STATE', kind: 'state', value: '1' }],
    ...base
  },
  {
    type: 'eff_add_state_claim',
    message0: 'Reclamar el estado %1',
    args0: [{ type: 'field_catalog', name: 'STATE', kind: 'state', value: '1' }],
    ...base
  },
  {
    type: 'eff_transfer_state',
    message0: 'Recibir el estado %1',
    args0: [{ type: 'field_catalog', name: 'STATE', kind: 'state', value: '1' }],
    ...base
  },
  {
    type: 'eff_declare_war_on',
    message0: 'Declarar la guerra a %1 con objetivo %2',
    args0: [
      { type: 'field_catalog', name: 'TAG', kind: 'country', value: 'FRA' },
      { type: 'field_dropdown', name: 'WARGOAL', options: WAR_GOALS }
    ],
    ...base
  },
  {
    type: 'eff_create_wargoal',
    message0: 'Crear objetivo de guerra %1 contra %2',
    args0: [
      { type: 'field_dropdown', name: 'WARGOAL', options: WAR_GOALS },
      { type: 'field_catalog', name: 'TAG', kind: 'country', value: 'FRA' }
    ],
    ...base
  },
  {
    type: 'eff_create_faction',
    message0: 'Crear la facción %1',
    args0: [{ type: 'field_input', name: 'NAME', text: 'mi_faccion' }],
    tooltip: 'Nombre (o clave de localización) de la facción',
    ...base
  },
  {
    type: 'eff_add_to_faction',
    message0: 'Añadir a %1 a mi facción',
    args0: [{ type: 'field_catalog', name: 'TAG', kind: 'country', value: 'ITA' }],
    ...base
  },
  {
    type: 'eff_puppet',
    message0: 'Convertir a %1 en títere',
    args0: [{ type: 'field_catalog', name: 'TAG', kind: 'country', value: 'AUS' }],
    ...base
  },
  {
    type: 'eff_state_scope',
    message0: 'En el estado %1 hacer: %2 %3',
    args0: [
      { type: 'field_catalog', name: 'STATE', kind: 'state', value: '1' },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO', check: CHECK_STATE_EFFECT }
    ],
    tooltip: 'Cambia al ámbito de un estado para usar efectos de estado',
    ...base,
    colour: COLOR_STATE
  },
  {
    type: 'eff_add_building_construction',
    message0: 'Construir %1 x %2',
    args0: [
      { type: 'field_number', name: 'LEVEL', value: 1, min: 1, precision: 1 },
      { type: 'field_dropdown', name: 'BUILDING', options: BUILDINGS }
    ],
    tooltip: 'Solo funciona dentro de "En el estado ... hacer"',
    previousStatement: CHECK_STATE_EFFECT,
    nextStatement: CHECK_STATE_EFFECT,
    colour: COLOR_STATE
  },
  {
    type: 'eff_add_research_slot',
    message0: 'Añadir %1 espacio(s) de investigación',
    args0: [{ type: 'field_number', name: 'AMOUNT', value: 1, min: 1, precision: 1 }],
    ...base
  },
  {
    type: 'eff_add_manpower',
    message0: 'Ganar %1 de mano de obra',
    args0: [{ type: 'field_number', name: 'AMOUNT', value: 10000, precision: 1 }],
    ...base
  },
  {
    type: 'eff_add_equipment',
    message0: 'Añadir %1 de %2 al arsenal',
    args0: [
      { type: 'field_number', name: 'AMOUNT', value: 500, precision: 1 },
      { type: 'field_dropdown', name: 'EQUIPMENT', options: EQUIPMENT }
    ],
    ...base
  },
  {
    type: 'eff_army_experience',
    message0: 'Ganar %1 de experiencia de ejército',
    args0: [{ type: 'field_number', name: 'AMOUNT', value: 25 }],
    ...base
  },
  {
    type: 'eff_country_event',
    message0: 'Lanzar evento %1 en %2 días',
    args0: [
      { type: 'field_input', name: 'EVENT', text: 'mi_mod.1' },
      { type: 'field_number', name: 'DAYS', value: 0, min: 0, precision: 1 }
    ],
    ...base
  },
  {
    type: 'eff_set_country_flag',
    message0: 'Poner la marca %1',
    args0: [{ type: 'field_catalog', name: 'FLAG', kind: 'countryFlag', value: '' }],
    tooltip: 'Marca = variable del script (set_country_flag), no la bandera del país',
    ...base
  },
  {
    type: 'eff_if',
    message0: 'si %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'LIMIT', check: CHECK_CONDITION }
    ],
    message1: 'entonces %1',
    args1: [{ type: 'input_statement', name: 'DO', check: CHECK_EFFECT }],
    tooltip: 'Solo aplica los efectos si se cumplen las condiciones',
    ...base
  }
]

export function registerEffectBlocks(): void {
  Blockly.common.defineBlocksWithJsonArray(effectBlocks)
}
