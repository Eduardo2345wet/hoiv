// Bloques de CONDICIÓN (azules). Solo se pueden encajar en "Requisitos",
// "Saltar si", dentro de NOT/OR/AND o en el "limit" del bloque si/entonces.
import * as Blockly from 'blockly'
import { CHECK_CONDITION, COLOR_CONDITION } from './checks'

const base = {
  previousStatement: CHECK_CONDITION,
  nextStatement: CHECK_CONDITION,
  colour: COLOR_CONDITION
}

export const IDEOLOGIES: [string, string][] = [
  ['democrático', 'democratic'],
  ['comunista', 'communism'],
  ['fascista', 'fascism'],
  ['no alineado', 'neutrality']
]

export const conditionBlocks = [
  {
    type: 'cond_has_government',
    message0: 'tiene gobierno %1',
    args0: [{ type: 'field_dropdown', name: 'IDEOLOGY', options: IDEOLOGIES }],
    tooltip: 'El país tiene esta ideología en el gobierno',
    ...base
  },
  {
    type: 'cond_has_completed_focus',
    message0: 'completó el foco %1',
    args0: [{ type: 'field_catalog', name: 'FOCUS', kind: 'focus', value: '' }],
    tooltip: 'Se completó el foco con este id',
    ...base
  },
  {
    type: 'cond_has_war',
    message0: 'está en guerra %1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'VALUE',
        options: [
          ['sí', 'yes'],
          ['no', 'no']
        ]
      }
    ],
    ...base
  },
  {
    type: 'cond_is_in_faction',
    message0: 'está en una facción %1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'VALUE',
        options: [
          ['sí', 'yes'],
          ['no', 'no']
        ]
      }
    ],
    ...base
  },
  {
    type: 'cond_tag',
    message0: 'el país es %1',
    args0: [{ type: 'field_catalog', name: 'TAG', kind: 'country', value: 'GER' }],
    tooltip: 'Etiqueta de 3 letras del país',
    ...base
  },
  {
    type: 'cond_has_idea',
    message0: 'tiene el espíritu nacional %1',
    args0: [{ type: 'field_catalog', name: 'IDEA', kind: 'idea', value: '' }],
    ...base
  },
  {
    type: 'cond_owns_state',
    message0: 'posee el estado %1',
    args0: [{ type: 'field_number', name: 'STATE', value: 1, min: 1, precision: 1 }],
    ...base
  },
  {
    type: 'cond_has_country_flag',
    message0: 'tiene la marca %1',
    args0: [{ type: 'field_catalog', name: 'FLAG', kind: 'countryFlag', value: '' }],
    tooltip: 'Marca = variable del script (has_country_flag), no la bandera del país',
    ...base
  },
  {
    type: 'cond_date_after',
    message0: 'la fecha es posterior a %1 . %2 . %3',
    args0: [
      {
        type: 'field_number',
        name: 'YEAR',
        value: 1938,
        min: 1936,
        max: 1999,
        precision: 1
      },
      {
        type: 'field_number',
        name: 'MONTH',
        value: 1,
        min: 1,
        max: 12,
        precision: 1
      },
      {
        type: 'field_number',
        name: 'DAY',
        value: 1,
        min: 1,
        max: 31,
        precision: 1
      }
    ],
    tooltip: 'Año . mes . día',
    ...base
  },
  {
    type: 'cond_has_political_power',
    message0: 'tiene más de %1 de poder político',
    args0: [{ type: 'field_number', name: 'AMOUNT', value: 50, min: 0 }],
    ...base
  },
  // --- Combinadores lógicos ---
  {
    type: 'cond_not',
    message0: 'NO se cumple %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'CHILDREN', check: CHECK_CONDITION }
    ],
    tooltip: 'Verdadero si NINGUNA de las condiciones de dentro se cumple',
    ...base
  },
  {
    type: 'cond_or',
    message0: 'se cumple ALGUNA (O) %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'CHILDREN', check: CHECK_CONDITION }
    ],
    ...base
  },
  {
    type: 'cond_and',
    message0: 'se cumplen TODAS (Y) %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'CHILDREN', check: CHECK_CONDITION }
    ],
    ...base
  }
]

export function registerConditionBlocks(): void {
  Blockly.common.defineBlocksWithJsonArray(conditionBlocks)
}
