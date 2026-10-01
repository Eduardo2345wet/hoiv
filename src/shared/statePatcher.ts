import { parseStateText } from '../main/mapLoader'

export interface StatePatchEdit {
  owner?: string
  addCores?: string[]
  removeCores?: string[]
}

export interface PatchStateResult {
  success: boolean
  patchedText?: string
  error?: string
}

export function patchStateHistory(
  originalText: string,
  edit: StatePatchEdit
): PatchStateResult {
  if (!edit || (edit.owner === undefined && (!edit.addCores || edit.addCores.length === 0) && (!edit.removeCores || edit.removeCores.length === 0))) {
    return { success: true, patchedText: originalText }
  }

  // Detectar salto de línea original (\r\n o \n)
  const eol = originalText.includes('\r\n') ? '\r\n' : '\n'

  // Ubicar el bloque history = { ... }
  const historyStart = originalText.indexOf('history')
  if (historyStart === -1) {
    return { success: false, error: 'No se encontró el bloque "history" en el archivo de estado.' }
  }

  const openBraceIndex = originalText.indexOf('{', historyStart)
  if (openBraceIndex === -1) {
    return { success: false, error: 'Formato inválido: falta "{" después de "history".' }
  }

  // Encontrar la llave de cierre correspondiente
  let depth = 1
  let closeBraceIndex = openBraceIndex + 1
  while (closeBraceIndex < originalText.length && depth > 0) {
    const char = originalText[closeBraceIndex]
    if (char === '{') depth++
    else if (char === '}') depth--
    closeBraceIndex++
  }

  if (depth !== 0) {
    return { success: false, error: 'Bloque history desbalanceado en llaves { }.' }
  }

  // closeBraceIndex apunta al carácter justo después de '}'
  const beforeHistory = originalText.slice(0, openBraceIndex + 1)
  let historyInner = originalText.slice(openBraceIndex + 1, closeBraceIndex - 1)
  const afterHistory = originalText.slice(closeBraceIndex - 1)

  // Separar historyInner en top-level e interior de bloques hijos (fechas, if/limit)
  // Ubicar primer bloque hijo con fecha si existe (ej. 1939.1.1 = {)
  const dateMatch = historyInner.match(/\b\d{4}\.\d{1,2}\.\d{1,2}\s*=\s*\{/)
  const firstChildIndex = dateMatch ? dateMatch.index : -1

  let topPart = firstChildIndex !== -1 ? historyInner.slice(0, firstChildIndex) : historyInner
  const bottomPart = firstChildIndex !== -1 ? historyInner.slice(firstChildIndex) : ''

  // 1. Aplicar cambio de owner
  if (edit.owner !== undefined) {
    const ownerRegex = /^(\s*owner\s*=\s*)([A-Z][A-Z0-9]{2})\b/m
    if (ownerRegex.test(topPart)) {
      topPart = topPart.replace(ownerRegex, `$1${edit.owner}`)
    } else {
      // Insertar owner al inicio de topPart
      const indent = topPart.match(/^\s*/)?.[0] || '\t'
      topPart = `${eol}${indent}owner = ${edit.owner}${topPart}`
    }
  }

  // 2. Aplicar eliminación de cores (removeCores)
  if (edit.removeCores && edit.removeCores.length > 0) {
    edit.removeCores.forEach((tag) => {
      const coreRegex = new RegExp(`^\\s*add_core_of\\s*=\\s*${tag}\\b.*$`, 'gm')
      topPart = topPart.replace(coreRegex, '')
    })
  }

  // 3. Aplicar adición de cores (addCores)
  if (edit.addCores && edit.addCores.length > 0) {
    edit.addCores.forEach((tag) => {
      // Verificar si ya existe en topPart
      const existingCore = new RegExp(`\\badd_core_of\\s*=\\s*${tag}\\b`)
      if (!existingCore.test(topPart)) {
        // Insertar add_core_of conservando sangría
        const indentMatch = topPart.match(/^(\s*)add_core_of\s*=/m) || topPart.match(/^(\s*)owner\s*=/m)
        const indent = indentMatch ? indentMatch[1] : '\t'
        topPart = topPart.replace(/(\s*)$/, `${eol}${indent}add_core_of = ${tag}$1`)
      }
    })
  }

  const patchedInner = topPart + bottomPart
  const patchedText = beforeHistory + patchedInner + afterHistory

  // Verificación posterior con parseStateText
  const parsed = parseStateText(patchedText)
  if (!parsed) {
    return { success: false, error: 'El archivo resultante no pudo ser verificado correctamente.' }
  }

  if (edit.owner !== undefined && parsed.owner !== edit.owner) {
    return { success: false, error: `Verificación fallida: se esperaba owner ${edit.owner} pero se obtuvo ${parsed.owner}.` }
  }

  if (edit.addCores) {
    for (const tag of edit.addCores) {
      if (!parsed.cores.includes(tag)) {
        return { success: false, error: `Verificación fallida: no se encontró el core ${tag} tras parchear.` }
      }
    }
  }

  if (edit.removeCores) {
    for (const tag of edit.removeCores) {
      if (parsed.cores.includes(tag)) {
        return { success: false, error: `Verificación fallida: el core ${tag} no fue eliminado correctamente.` }
      }
    }
  }

  return { success: true, patchedText }
}
