// Tema oscuro de Blockly con acentos naranjas
import * as Blockly from 'blockly'

export const hoiDarkTheme = Blockly.Theme.defineTheme('hoiDark', {
  name: 'hoiDark',
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#16161a',
    toolboxBackgroundColour: '#1e1e24',
    toolboxForegroundColour: '#f3f4f6',
    flyoutBackgroundColour: '#2a2a32',
    flyoutForegroundColour: '#f3f4f6',
    flyoutOpacity: 0.95,
    scrollbarColour: '#3f3f4e',
    scrollbarOpacity: 0.7,
    insertionMarkerColour: '#f97316',
    insertionMarkerOpacity: 0.4,
    cursorColour: '#f97316'
  },
  fontStyle: { family: 'Segoe UI, sans-serif', size: 11 }
})
