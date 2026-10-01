// Tema oscuro de Blockly con acentos naranjas
import * as Blockly from 'blockly'
import { Z } from './layers'

// CSS de Blockly que va JUNTO con su tema (se registra antes de crear el espacio de trabajo y se
// inyecta con el CSS propio de Blockly, así ningún CSS suelto de la app lo pisa):
//  - letra de las categorías del toolbox de 14 px (la clase cambió entre versiones de Blockly)
//  - capas de lo flotante (menús, widgets, tooltips) según la escala única de layers.ts
export const TOOLBOX_FONT_PX = 14
Blockly.Css.register(
  [
    `.injectionDiv .blocklyToolboxCategoryLabel,
.injectionDiv .blocklyTreeLabel { font: ${TOOLBOX_FONT_PX}px 'Segoe UI', sans-serif !important; }`,
    `.injectionDiv .blocklyToolboxCategory, .injectionDiv .blocklyTreeRow { height: 30px !important; line-height: 30px !important; }`,
    // Tailwind (preflight) pone `svg { display: block }`, que gana al atributo display="none" con el
    // que Blockly oculta las barras de desplazamiento: quedaban flotando (y tapaban clics).
    `.injectionDiv svg[display='none'] { display: none !important; }`,
    // (la barra del flyout de la papelera nunca llega a tener tamaño: sin `height` mediría 150 px)
  `.injectionDiv svg.blocklyFlyoutScrollbar:not([height]) { display: none !important; }`,
  `.blocklyWidgetDiv, .blocklyDropDownDiv { z-index: ${Z.blocklyFloating} !important; }`,
    `.blocklyTooltipDiv { z-index: ${Z.blocklyFloating} !important; }`
  ].join('\n')
)

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
