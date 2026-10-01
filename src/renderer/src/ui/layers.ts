// Escala de capas (z-index) de TODA la app, de abajo hacia arriba. Es la única fuente: nadie
// debe escribir un z-index suelto. Las ventanas (Modal) van en un portal en document.body.
export const Z = {
  base: 0,
  panels: 10,
  ribbon: 20,
  /** Editor de Blockly (con su caja de herramientas y su flyout, dentro de su propio contexto) */
  blockly: 30,
  /** Menús y campos desplegables de Blockly (viven en document.body) */
  blocklyFloating: 35,
  /** Menús de la cinta (Archivo…) */
  ribbonMenu: 40,
  /** Fondo oscuro de las ventanas */
  backdrop: 50,
  /** Ventanas */
  window: 60,
  /** Avisos (toasts) */
  toast: 70,
  /** Tooltips */
  tooltip: 80
} as const

export type Layer = keyof typeof Z
