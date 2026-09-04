import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const numericTypes = new Set(['number', 'tel'])
const numericModes = new Set(['numeric', 'decimal', 'tel'])

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, inputMode, ...props }, ref) => {
  const isNumeric = numericTypes.has(type || '') || numericModes.has(inputMode || '')
  return (
    <input
      type={type}
      inputMode={inputMode}
      data-lc-numeric={isNumeric ? '' : undefined}
      className={cn(
        'flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--lc-text-muted)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        isNumeric && 'font-[family-name:var(--lc-font-mono)] tabular-nums',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
