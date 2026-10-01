// "Tipos" de conexión de los bloques. Blockly usa setCheck / "check" para
// impedir que un bloque se enchufe donde no corresponde.
export const CHECK_CONDITION = 'Condicion'
export const CHECK_EFFECT = 'Efecto'
/** Efectos que solo valen dentro de un estado (ámbito de estado) */
export const CHECK_STATE_EFFECT = 'EfectoEstado'

// Colores (tono HSV de Blockly)
export const COLOR_CONDITION = 210 // azul
export const COLOR_EFFECT = 120 // verde
export const COLOR_STATE = 160 // verde azulado
export const COLOR_SLOT = 25 // naranja
