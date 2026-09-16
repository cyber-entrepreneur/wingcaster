import { Loader2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { memberInitials } from '@/pages/agency/settings/rolesTypes'
import { tRoles, type RolesLocale } from '@/pages/agency/settings/rolesCopy'

interface AgencyMember {
  user_id: string
  display_name: string | null
  email: string | null
  capability_packs: string[]
}

export interface PackAssignSheetProps {
  packId: string
  packName: string
  /** Finance requires a second owner before it can be assigned. */
  requiresTwoPerson: boolean
  ownerCount: number
  locale: RolesLocale
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after at least one successful assignment so the list can refresh. */
  onAssigned: () => void
}

function normalizeMembers(raw: unknown): AgencyMember[] {
  const list = Array.isArray((raw as { members?: unknown })?.members)
    ? ((raw as { members: unknown[] }).members)
    : []
  return list
    .map((entry) => {
      const m = entry as Record<string, unknown>
      const user = (m.user as Record<string, unknown>) || {}
      const userId = String(m.user_id || user.id || '')
      if (!userId) return null
      const packs = Array.isArray(m.capability_packs)
        ? (m.capability_packs as unknown[]).map((p) => String(p))
        : []
      return {
        user_id: userId,
        display_name: (m.name as string) || (user.name as string) || (user.email as string) || null,
        email: (m.email as string) || (user.email as string) || null,
        capability_packs: packs,
      }
    })
    .filter((m): m is AgencyMember => m !== null)
}

/**
 * AGN-ROL-001 R13 assign-to-members panel. Wired to PATCH
 * /api/agency/members/:userId/capability-packs (202 → Finance approval pending,
 * 409 → second owner required). Batches per-member writes with allSettled so a
 * single failure never aborts the successful ones.
 */
export function PackAssignSheet({
  packId,
  packName,
  requiresTwoPerson,
  ownerCount,
  locale,
  open,
  onOpenChange,
  onAssigned,
}: PackAssignSheetProps) {
  const { addToast } = useToast()
  const searchRef = useRef<HTMLInputElement>(null)
  const [members, setMembers] = useState<AgencyMember[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const blockedByOwners = requiresTwoPerson && ownerCount < 2

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setQuery('')
    api
      .getMyAgency()
      .then((res) => {
        if (cancelled) return
        const list = normalizeMembers(res)
        setMembers(list)
        setChecked(
          new Set(list.filter((m) => m.capability_packs.includes(packId)).map((m) => m.user_id)),
        )
      })
      .catch(() => {
        if (!cancelled) {
          addToast({ description: tRoles('error.load', locale), variant: 'error' })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, packId, locale, addToast])

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => searchRef.current?.focus(), 0)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [open])

  const initial = useMemo(
    () => new Set(members.filter((m) => m.capability_packs.includes(packId)).map((m) => m.user_id)),
    [members, packId],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) =>
        (m.display_name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q),
    )
  }, [members, query])

  const newlySelected = useMemo(
    () => [...checked].filter((id) => !initial.has(id)),
    [checked, initial],
  )
  const dirty = newlySelected.length > 0

  if (!open) return null

  const toggle = (id: string, already: boolean) => {
    if (already || blockedByOwners) return
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async () => {
    if (!dirty || saving) return
    setSaving(true)
    const results = await Promise.allSettled(
      newlySelected.map((userId) => {
        const member = members.find((m) => m.user_id === userId)
        const nextPacks = [...new Set([...(member?.capability_packs || []), packId])]
        return api.assignMemberCapabilityPacks(userId, { packs: nextPacks })
      }),
    )
    setSaving(false)
    const failures = results.filter((r) => r.status === 'rejected').length
    const succeeded = newlySelected.length - failures
    if (requiresTwoPerson) {
      addToast({ description: tRoles('sheet.pendingApproval', locale), variant: 'warning' })
      onOpenChange(false)
      return
    }
    if (succeeded > 0) {
      addToast({
        description: tRoles('sheet.success', locale, { pack: packName, n: succeeded }),
        variant: 'success',
      })
      onAssigned()
    }
    if (failures > 0) {
      addToast({ description: tRoles('error.assign', locale), variant: 'error' })
    } else {
      onOpenChange(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label={tRoles('sheet.cancel', locale)}
        className="absolute inset-0 bg-[var(--lc-action-primary-scrim)]"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tRoles('sheet.title', locale, { pack: packName })}
        className="relative flex h-full w-full max-w-[400px] flex-col bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-lg)]"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onOpenChange(false)
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--lc-border)] p-4">
          <h2
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-3)' }}
          >
            {tRoles('sheet.title', locale, { pack: packName })}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tRoles('sheet.cancel', locale)}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="border-b border-[var(--lc-border)] p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-y-0 start-2 my-auto h-4 w-4 text-[var(--lc-text-muted)]"
              aria-hidden="true"
            />
            <Input
              ref={searchRef}
              type="search"
              className="ps-8"
              placeholder={tRoles('sheet.search', locale)}
              aria-label={tRoles('sheet.search', locale)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <p
            className="px-2 py-1 text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-overline)' }}
          >
            {tRoles('sheet.listHeader', locale, { total: members.length })}
          </p>
          {loading ? (
            <p
              className="px-2 py-2 text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              {tRoles('loading.packs', locale)}
            </p>
          ) : filtered.length === 0 ? (
            <p
              className="px-2 py-2 text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              {tRoles('sheet.empty', locale)}
            </p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((m) => {
                const already = initial.has(m.user_id)
                const isChecked = checked.has(m.user_id)
                const disabled = already || blockedByOwners
                return (
                  <li key={m.user_id}>
                    <label
                      className={cn(
                        'flex min-h-tap cursor-pointer items-center gap-3 rounded-[var(--lc-radius-md)] px-2 py-2',
                        disabled ? 'cursor-not-allowed opacity-70' : 'hover:bg-[var(--lc-surface-sunken)]',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--lc-action-primary)]"
                        checked={isChecked}
                        disabled={disabled}
                        onChange={() => toggle(m.user_id, already)}
                      />
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]"
                        style={{ font: 'var(--lc-type-caption)' }}
                        aria-hidden="true"
                      >
                        {memberInitials(m.display_name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-[var(--lc-text-primary)]"
                          style={{ font: 'var(--lc-type-body)' }}
                        >
                          {m.display_name || m.email || m.user_id}
                        </span>
                        {already ? (
                          <span
                            className="block text-[var(--lc-text-muted)]"
                            style={{ font: 'var(--lc-type-caption)' }}
                          >
                            {tRoles('sheet.already', locale, { pack: packName })}
                          </span>
                        ) : blockedByOwners ? (
                          <span
                            className="block text-[var(--lc-status-underOffer-fg)]"
                            style={{ font: 'var(--lc-type-caption)' }}
                          >
                            {tRoles('sheet.secondOwnerRow', locale)}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--lc-border)] p-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tRoles('sheet.cancel', locale)}
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={!dirty || saving || blockedByOwners}
            onClick={submit}
          >
            {saving ? (
              <>
                <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />
                {tRoles('sheet.saving', locale)}
              </>
            ) : (
              <>
                {tRoles('sheet.assign', locale)}
                {newlySelected.length > 0 ? (
                  <>
                    {' '}
                    <Numeric className="ms-1">{newlySelected.length}</Numeric>
                  </>
                ) : null}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
