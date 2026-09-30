// Texto de los archivos del juego: UTF-8 y, si no es válido, Windows-1252.
export function decodeGameText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}
