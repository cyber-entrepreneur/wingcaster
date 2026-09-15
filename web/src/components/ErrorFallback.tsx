import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

/**
 * Fallback UI for Sentry.ErrorBoundary around AppRoutes.
 */
export function ErrorFallback({
  error,
  resetError,
}: {
  error?: unknown
  resetError?: () => void
  eventId?: string
}) {
  const message =
    error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.'

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-destructive" aria-hidden />
      <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
      <p className="mb-6 max-w-md text-muted-foreground">{message}</p>
      <Button
        type="button"
        onClick={() => {
          if (resetError) resetError()
          else window.location.reload()
        }}
      >
        Try again
      </Button>
    </div>
  )
}
