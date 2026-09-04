import { Monitor, Moon, Sun } from 'lucide-react'
import { useBrand } from '@/context/BrandContext'
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
  const { colorMode, setColorMode } = useBrand()
  const Icon = colorMode === 'dark' ? Moon : colorMode === 'system' ? Monitor : Sun

  return (
    <button
      type="button"
      className={className}
      aria-label={`Colour mode: ${LABEL[colorMode]}. Click to switch.`}
      title={`${LABEL[colorMode]} mode`}
      onClick={() => setColorMode(NEXT[colorMode])}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Colour mode: {LABEL[colorMode]}</span>
    </button>
  )
}
