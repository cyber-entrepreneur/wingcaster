import { useState, type FormEvent } from 'react'
import { api } from '@/api/client'
import { SettingsPaneHeader } from '@/components/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'

export function PasswordPage() {
  const { addToast } = useToast()
  usePageTitle('Change password')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (next !== confirm) {
      addToast({ title: 'New passwords do not match.', variant: 'error' })
      return
    }
    setBusy(true)
    try {
      await api.changePassword(current, next)
      addToast({ title: 'Password updated.', variant: 'success' })
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      addToast({
        title: 'Could not change password.',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-[var(--lc-space-lg)]">
      <SettingsPaneHeader title="Change password" sub="Choose a new password for email sign-in." />
      <div className="space-y-[var(--lc-space-2xs)]">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="space-y-[var(--lc-space-2xs)]">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </div>
      <div className="space-y-[var(--lc-space-2xs)]">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={busy || !current || !next}>
        {busy ? 'Saving…' : 'Update password'}
      </Button>
    </form>
  )
}
