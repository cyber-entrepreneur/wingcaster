import { useMemo, type ComponentType, type ReactNode } from 'react'
import ReactGridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { cn } from '@/lib/utils'
import type { LayoutItem } from '@/hooks/useDashboardLayout'
import { WidgetCard } from '@/pages/agent/dashboard/pro/ProDashboardParts'

type RglLayout = Array<{ i: string; x: number; y: number; w: number; h: number }>

const GridLayout = ReactGridLayout as unknown as ComponentType<{
  className?: string
  layout: RglLayout
  cols: number
  rowHeight: number
  width: number
  margin?: [number, number]
  containerPadding?: [number, number]
  isDraggable?: boolean
  isResizable?: boolean
  draggableHandle?: string
  onDragStop?: (layout: RglLayout) => void
  onResizeStop?: (layout: RglLayout) => void
  compactType?: 'vertical' | 'horizontal' | null
  useCSSTransforms?: boolean
  children?: ReactNode
}>

export interface WidgetGridProps {
  layout: LayoutItem[]
  editMode: boolean
  density: 'compact' | 'comfortable' | 'spacious'
  fullscreenId: string | null
  onLayoutChange: (layout: LayoutItem[]) => void
  onFullscreen: (id: string | null) => void
  onRemove: (id: string) => void
  renderWidget: (id: string) => ReactNode
  titles: Record<string, string>
  className?: string
  width?: number
}

const COLS = 12
const ROW_HEIGHT = 40

/**
 * AGT-DSH-002 — react-grid-layout wrapper with Broadcast drop-zone visuals.
 */
export function WidgetGrid({
  layout,
  editMode,
  density,
  fullscreenId,
  onLayoutChange,
  onFullscreen,
  onRemove,
  renderWidget,
  titles,
  className,
  width = 1200,
}: WidgetGridProps) {
  const margin = density === 'compact' ? 8 : density === 'spacious' ? 20 : 16

  const visibleLayout = useMemo(() => {
    if (fullscreenId) {
      return [{ i: fullscreenId, x: 0, y: 0, w: 12, h: 12, minW: 12, minH: 4 }]
    }
    return layout
  }, [fullscreenId, layout])

  const handleChange = (next: RglLayout) => {
    if (fullscreenId) return
    onLayoutChange(
      next.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: layout.find((l) => l.i === item.i)?.minW,
        minH: layout.find((l) => l.i === item.i)?.minH,
      })),
    )
  }

  return (
    <div
      className={cn('pro-widget-grid', className)}
      data-testid="widget-grid"
      data-edit-mode={editMode ? 'true' : 'false'}
      role={fullscreenId ? 'dialog' : undefined}
      aria-modal={fullscreenId ? true : undefined}
      aria-label={fullscreenId ? titles[fullscreenId] || 'Fullscreen widget' : undefined}
    >
      <GridLayout
        className="layout"
        layout={visibleLayout}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        width={width}
        margin={[margin, margin]}
        containerPadding={[0, 0]}
        isDraggable={editMode && !fullscreenId}
        isResizable={editMode && !fullscreenId}
        draggableHandle=".widget-drag-handle"
        onDragStop={handleChange}
        onResizeStop={handleChange}
        compactType="vertical"
        useCSSTransforms
      >
        {visibleLayout.map((item) => (
          <div key={item.i} className="h-full">
            <WidgetCard
              title={titles[item.i] || item.i}
              className="h-full !col-span-auto"
              span={12}
              dragHandleClassName="widget-drag-handle"
              onFullscreen={() =>
                onFullscreen(fullscreenId === item.i ? null : item.i)
              }
              onRemove={fullscreenId ? undefined : () => onRemove(item.i)}
            >
              {renderWidget(item.i)}
            </WidgetCard>
          </div>
        ))}
      </GridLayout>
      {fullscreenId ? (
        <p className="sr-only">Press Escape to exit fullscreen</p>
      ) : null}
    </div>
  )
}
