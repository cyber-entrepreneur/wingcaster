import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import type { Option } from './contactForm'

/**
 * Contact-form primitives shared across every section of the full form.
 * Native <select>/<textarea> styled to match the Input component's Broadcast
 * tokens (there is no design-system Select component in this app).
 */

export const controlClass =
  'flex min-h-tap w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)] placeholder:text-[var(--lc-text-muted)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

type FieldProps = {
  id?: string
  label: React.ReactNode
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function Field({ id, label, hint, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-[var(--lc-text-muted)]">{hint}</p>}
    </div>
  )
}

type FormSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: Option[]
  placeholder?: string
}

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ className, options, placeholder, ...props }, ref) => (
    <select ref={ref} className={cn(controlClass, className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
)
FormSelect.displayName = 'FormSelect'

export const FormTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...props }, ref) => (
  <textarea ref={ref} rows={rows} className={cn(controlClass, 'resize-y', className)} {...props} />
))
FormTextarea.displayName = 'FormTextarea'
