// Componente raíz: muestra la pantalla de inicio o el editor
import { useEffect } from 'react'
import { useApp } from './store/appStore'
import StartScreen from './ui/StartScreen'
import Editor from './ui/Editor'
import PromptDialog from './ui/PromptDialog'
import { loadGameSettings } from './ui/SettingsDialog'
import { setIconRenderer } from './icons/renderer'
import { renderEmojiToPng } from './icons/canvasRender'

// Los íconos con emoji se dibujan con canvas (solo en la interfaz)
setIconRenderer(renderEmojiToPng)

export default function App(): JSX.Element {
  const hasProject = useApp((s) => !!s.project)

  useEffect(() => {
    void loadGameSettings()
  }, [])

  return (
    <>
      {hasProject ? <Editor /> : <StartScreen />}
      <PromptDialog />
    </>
  )
}
