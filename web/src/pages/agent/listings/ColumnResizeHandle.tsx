import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'

const MIN_WIDTH = 60
const MAX_WIDTH = 640
const STEP = 8

function clampWidth(n: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(n)))
}

export interface ColumnResizeHandleProps {
  columnId: string
  width: number | undefined
  defaultWidth?: number
  onWidthChange: (columnId: string, width: number) => void
  onWidthCommit: (columnId: string, width: number) => void
  label: string
}

/**
 * Live column-resize separator for Pro listings table headers.
 * Parent persists via useListPrefs.widths on commit (mouseup / keyboard).
 */
export function ColumnResizeHandle({
  columnId,
  width,
  defaultWidth = 140,
  onWidthChange,
  onWidthCommit,
  label,
}: ColumnResizeHandleProps) {
  const startX = useRef(0)
  const startW = useRef(defaultWidth)
  const liveW = useRef(width ?? defaultWidth)
  const dragging = useRef(false)
  const [liveMsg, setLiveMsg] = useState('')

  const announce = useCallback((next: number) => {
    setLiveMsg(`${label} column width ${next} pixels`)
  }, [label])

  useEffect(() => {
    liveW.current = width ?? defaultWidth
  }, [width, defaultWidth])

  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      if (!dragging.current) return
      const next = clampWidth(startW.current + (e.clientX - startX.current))
      liveW.current = next
      onWidthChange(columnId, next)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      const next = clampWidth(liveW.current)
      announce(next)
      onWidthCommit(columnId, next)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [announce, columnId, onWidthChange, onWidthCommit])

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragging.current = true
    startX.current = e.clientX
    startW.current = width ?? defaultWidth
    liveW.current = startW.current
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const base = width ?? defaultWidth
    const next = clampWidth(base + (e.key === 'ArrowRight' ? STEP : -STEP))
    onWidthChange(columnId, next)
    onWidthCommit(columnId, next)
    announce(next)
  }

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label} column`}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={width ?? defaultWidth}
        tabIndex={0}
        data-resize-col={columnId}
        onMouseDown={onMouseDown}
        onKeyDown={onKeyDown}
        className={cn(
          'absolute end-0 top-0 z-20 h-full w-2 cursor-col-resize touch-none',
          'hover:bg-[color-mix(in_srgb,var(--lc-action-primary)_35%,transparent)]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lc-focus-ring)]',
        )}
      />
      <span className="sr-only" aria-live="polite">
        {liveMsg}
      </span>
    </>
  )
}

export { clampWidth, MIN_WIDTH, MAX_WIDTH }
