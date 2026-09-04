import { Monitor, Moon, Sun } from 'lucide-react'
import { useMode } from '@/context/BrandContext'
import type { LcColorMode } from '@/theme/mode'

const NEXT: Record<LcColorMode, LcColorMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

const LABEL: Record<LcColorMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

export function ColorModeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useMode()
  const Icon = mode === 'dark' ? Moon : mode === 'system' ? Monitor : Sun

  return (
    <button
      type="button"
      className={className}
      aria-label={`Colour mode: ${LABEL[mode]}. Click to switch.`}
      title={`${LABEL[mode]} mode`}
      onClick={() => setMode(NEXT[mode])}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Colour mode: {LABEL[mode]}</span>
    </button>
  )
}
