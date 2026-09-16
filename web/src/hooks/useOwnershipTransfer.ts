import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import type {
  OwnershipTransfer,
  OwnershipTransferStateResponse,
} from '@/types/ownershipTransfer'

const POLL_MS = 60_000

const ELIGIBLE_ROLES = new Set(['admin', 'senior_admin'])

export interface EligibleAdmin {
  user_id: string
  display_name: string
  role: string
  avatar_url: string | null
}

export interface OwnershipAgencyContext {
  agencyId: string
  agencyName: string
  myUserId: string
  ownerEmailMasked: string
  eligibleAdmins: EligibleAdmin[]
}

export type OwnershipLoadState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      agency: OwnershipAgencyContext
      data: OwnershipTransferStateResponse
    }

export function maskEmail(email: string | null | undefined): string {
  const raw = String(email || '').trim()
  const at = raw.indexOf('@')
  if (at <= 0) return '•••'
  return `${raw.slice(0, 1)}•••@${raw.slice(at + 1)}`
}

type RawMember = {
  user_id?: string
  role?: string
  status?: string
  user?: { id?: string; name?: string; email?: string; avatar_url?: string | null } | null
}

type RawAgency = {
  id?: string
  name?: string
  members?: RawMember[]
} | null

function toEligibleAdmins(members: RawMember[], myUserId: string): EligibleAdmin[] {
  return members
    .filter(
      (m) =>
        m.status === 'active' &&
        ELIGIBLE_ROLES.has(String(m.role)) &&
        (m.user_id ?? m.user?.id) !== myUserId,
    )
    .map((m) => ({
      user_id: String(m.user_id ?? m.user?.id ?? ''),
      display_name: m.user?.name || m.user?.email || 'Admin',
      role: String(m.role || 'admin'),
      avatar_url: m.user?.avatar_url ?? null,
    }))
    .filter((m) => m.user_id)
}

/**
 * Loads the caller's agency + current ownership-transfer state (WF-31), polls
 * every 60s, revalidates on focus, and exposes the mutation actions. Shared by
 * AGN-SET-005 (initiator), AGN-SET-005b (recipient), and AGT-REC-006 (outcome).
 */
export function useOwnershipTransfer(myUserId: string | null | undefined, myEmail: string | null | undefined) {
  const [state, setState] = useState<OwnershipLoadState>({ status: 'loading' })
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const prevStatusRef = useRef<string | null>(null)
  const [statusChangedTo, setStatusChangedTo] = useState<OwnershipTransfer['status'] | null>(null)
  const agencyRef = useRef<OwnershipAgencyContext | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }))
      }
      try {
        const agencyRaw = (await api.getMyAgency()) as RawAgency
        if (!agencyRaw?.id) {
          setState({ status: 'forbidden' })
          return
        }
        const uid = String(myUserId || '')
        const agency: OwnershipAgencyContext = {
          agencyId: String(agencyRaw.id),
          agencyName: String(agencyRaw.name || ''),
          myUserId: uid,
          ownerEmailMasked: maskEmail(myEmail),
          eligibleAdmins: toEligibleAdmins(agencyRaw.members ?? [], uid),
        }
        agencyRef.current = agency
        const data = await api.getOwnershipTransferState(agency.agencyId)
        const nextStatus = data.transfer?.status ?? null
        if (prevStatusRef.current && nextStatus && prevStatusRef.current !== nextStatus) {
          setStatusChangedTo(nextStatus)
        }
        prevStatusRef.current = nextStatus
        setState({ status: 'ready', agency, data })
      } catch (err) {
        const httpStatus = (err as { status?: number })?.status
        if (httpStatus === 403) {
          setState({ status: 'forbidden' })
          return
        }
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Request failed',
        })
      }
    },
    [myUserId, myEmail],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => void load({ silent: true }), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    const onFocus = () => void load({ silent: true })
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => {
      setOffline(false)
      void load({ silent: true })
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [load])

  const requireAgencyId = useCallback(() => {
    const id = agencyRef.current?.agencyId
    if (!id) throw new Error('Agency not loaded')
    return id
  }, [])

  const sendOtp = useCallback(async () => {
    return api.sendOwnershipTransferOtp(requireAgencyId())
  }, [requireAgencyId])

  const initiate = useCallback(
    async (body: { target_user_id: string; rationale: string; otp_code: string; typed_agency_name: string }) => {
      const result = await api.initiateOwnershipTransfer(requireAgencyId(), body)
      await load({ silent: true })
      return result
    },
    [requireAgencyId, load],
  )

  const accept = useCallback(
    async (transferId: string, body: { otp_code: string; typed_agency_name: string }) => {
      const result = await api.acceptOwnershipTransfer(requireAgencyId(), transferId, body)
      await load({ silent: true })
      return result
    },
    [requireAgencyId, load],
  )

  const decline = useCallback(
    async (transferId: string, reason: string) => {
      const result = await api.declineOwnershipTransfer(requireAgencyId(), transferId, { reason })
      await load({ silent: true })
      return result
    },
    [requireAgencyId, load],
  )

  const cancel = useCallback(
    async (transferId: string) => {
      const result = await api.cancelOwnershipTransfer(requireAgencyId(), transferId)
      await load({ silent: true })
      return result
    },
    [requireAgencyId, load],
  )

  const acknowledge = useCallback(
    async (transferId: string) => {
      const result = await api.acknowledgeOwnershipTransfer(requireAgencyId(), transferId)
      await load({ silent: true })
      return result
    },
    [requireAgencyId, load],
  )

  const reverse = useCallback(
    async (transferId: string, body: { otp_code: string; typed_agency_name: string }) => {
      const result = await api.reverseOwnershipTransfer(requireAgencyId(), transferId, body)
      await load({ silent: true })
      return result
    },
    [requireAgencyId, load],
  )

  const clearStatusChange = useCallback(() => setStatusChangedTo(null), [])

  return useMemo(
    () => ({
      state,
      offline,
      statusChangedTo,
      clearStatusChange,
      reload: load,
      sendOtp,
      initiate,
      accept,
      decline,
      cancel,
      acknowledge,
      reverse,
    }),
    [
      state,
      offline,
      statusChangedTo,
      clearStatusChange,
      load,
      sendOtp,
      initiate,
      accept,
      decline,
      cancel,
      acknowledge,
      reverse,
    ],
  )
}
