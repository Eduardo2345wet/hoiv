// Tema oscuro de Blockly con acentos naranjas (a juego con el resto de la app).

import * as Blockly from 'blockly/core'

export const hoiDarkTheme = Blockly.Theme.defineTheme('hoi4-dark', {
  name: 'hoi4-dark',
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#18181c',
    toolboxBackgroundColour: '#1e1e24',
    toolboxForegroundColour: '#f3f4f6',
    flyoutBackgroundColour: '#2a2a32',
    flyoutForegroundColour: '#f3f4f6',
    flyoutOpacity: 0.95,
    scrollbarColour: '#3f3f4e',
    scrollbarOpacity: 0.8,
    insertionMarkerColour: '#f97316',
    insertionMarkerOpacity: 0.4,
    cursorColour: '#f97316',
    selectedGlowColour: '#f97316'
  },
  fontStyle: {
    family: "'Segoe UI', Roboto, sans-serif",
    size: 11
  }
})
