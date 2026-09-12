declare module 'react-grid-layout' {
  import type { ComponentType, ReactNode } from 'react'
  const ReactGridLayout: ComponentType<{
    className?: string
    layout?: unknown
    cols?: number
    rowHeight?: number
    width?: number
    margin?: [number, number]
    containerPadding?: [number, number]
    isDraggable?: boolean
    isResizable?: boolean
    draggableHandle?: string
    onDragStop?: (layout: unknown) => void
    onResizeStop?: (layout: unknown) => void
    compactType?: 'vertical' | 'horizontal' | null
    useCSSTransforms?: boolean
    children?: ReactNode
  }>
  export default ReactGridLayout
}

declare module 'react-grid-layout/css/styles.css'
