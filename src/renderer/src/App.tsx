// Componente raíz: muestra la pantalla de inicio o el editor
import { useEffect } from 'react'
import { store, useApp } from './store/appStore'
import StartScreen from './ui/StartScreen'
import Editor from './ui/Editor'
import PromptDialog from './ui/PromptDialog'
import ToastHost from './ui/ToastHost'
import { loadGameSettings } from './ui/SettingsDialog'
import { setIconRenderer, setPlaceholderRenderers } from './icons/renderer'
import { drawFlagPlaceholder, drawPortraitPlaceholder } from './countries/placeholders'
import { renderEmojiToPng } from './icons/canvasRender'

// Los íconos con emoji se dibujan con canvas (solo en la interfaz)
setIconRenderer(renderEmojiToPng)
// Bandera y retrato de relleno de los países
setPlaceholderRenderers({ flag: drawFlagPlaceholder, portrait: drawPortraitPlaceholder })

export default function App(): JSX.Element {
  const hasProject = useApp((s) => !!s.project)

  useEffect(() => {
    void loadGameSettings()
    // Salir de un campo de texto cierra su paso de deshacer
    const onFocusOut = (): void => store.endGroup()
    window.addEventListener('focusout', onFocusOut)
    return () => window.removeEventListener('focusout', onFocusOut)
  }, [])

  return (
    <>
      {hasProject ? <Editor /> : <StartScreen />}
      <PromptDialog />
      <ToastHost />
    </>
  )
}
