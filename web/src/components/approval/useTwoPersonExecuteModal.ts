import { useCallback, useMemo, useState } from 'react'
import type { ExecuteResult } from './approvalTypes'
import type { TwoPersonExecuteModalProps } from './TwoPersonExecuteModal'

export interface OpenExecuteArgs {
  requestId: string
}

export interface UseTwoPersonExecuteModalOptions {
  onExecuted?: (result: ExecuteResult) => void
  onEscalate?: (requestId: string) => void
  onReloadRequest?: (requestId: string) => void
}

/**
 * Orchestrates the WF-20 execute modal for any approval-detail screen.
 *
 *   const { openExecuteModal, executeModalProps } = useTwoPersonExecuteModal({ onExecuted })
 *   <Button onClick={() => openExecuteModal({ requestId })}>Confirm & execute</Button>
 *   <TwoPersonExecuteModal {...executeModalProps} />
 */
export function useTwoPersonExecuteModal(options: UseTwoPersonExecuteModalOptions = {}) {
  const { onExecuted, onEscalate, onReloadRequest } = options
  const [requestId, setRequestId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const openExecuteModal = useCallback((args: OpenExecuteArgs) => {
    setRequestId(args.requestId)
    setOpen(true)
  }, [])

  const closeExecuteModal = useCallback(() => setOpen(false), [])

  const executeModalProps: TwoPersonExecuteModalProps = useMemo(
    () => ({
      requestId,
      open,
      onClose: closeExecuteModal,
      onExecuted,
      onEscalate,
      onReloadRequest,
    }),
    [requestId, open, closeExecuteModal, onExecuted, onEscalate, onReloadRequest],
  )

  return { openExecuteModal, closeExecuteModal, executeModalProps, isOpen: open }
}
