import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { LC_STATUS_GLYPH } from '@/theme/status'

export type ToastVariant = 'default' | 'success' | 'error' | 'warning'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

export function useToast() {
  return React.useContext(ToastContext)
}

const VARIANT_CLASS: Record<ToastVariant, string> = {
  default: 'border-[var(--lc-border)] bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]',
  success: 'border-[var(--lc-status-published-bg)] bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]',
  error: 'border-[var(--lc-status-unpublished-bg)] bg-[var(--lc-status-unpublished-bg)] text-[var(--lc-status-unpublished-fg)]',
  warning: 'border-[var(--lc-status-underOffer-bg)] bg-[var(--lc-status-underOffer-bg)] text-[var(--lc-status-underOffer-fg)]',
}

const VARIANT_GLYPH: Record<ToastVariant, string | null> = {
  default: null,
  success: LC_STATUS_GLYPH.published,
  error: LC_STATUS_GLYPH.unpublished,
  warning: LC_STATUS_GLYPH.underOffer,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setToasts((prev) => [...prev, { ...toast, id }])
    if (toast.duration !== 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, toast.duration ?? 5000)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastPrimitive.Provider swipeDirection="right">
        {toasts.map((toast) => {
          const variant = toast.variant ?? 'default'
          const glyph = VARIANT_GLYPH[variant]
          return (
            <ToastPrimitive.Root
              key={toast.id}
              className={`group relative flex items-start gap-3 rounded-lg border p-4 shadow-lg data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full data-[state=closed]:slide-out-to-right-full ${VARIANT_CLASS[variant]}`}
            >
              {glyph ? (
                <span aria-hidden="true" className="mt-0.5 text-sm">
                  {glyph}
                </span>
              ) : null}
              <div className="flex-1">
                {toast.title && (
                  <ToastPrimitive.Title className="text-sm font-semibold">{toast.title}</ToastPrimitive.Title>
                )}
                {toast.description && (
                  <ToastPrimitive.Description className="mt-1 text-sm opacity-90">{toast.description}</ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close
                className="inline-flex h-tap w-tap items-center justify-center rounded p-1 opacity-60 transition-opacity hover:opacity-100"
                aria-label="Close"
                onClick={() => removeToast(toast.id)}
              >
                <X className="h-4 w-4" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          )
        })}
        <ToastPrimitive.Viewport className="fixed top-0 z-toast flex max-w-[420px] flex-col gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
