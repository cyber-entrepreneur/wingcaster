import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, Save } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdPageHeader } from '@/components/layout/CmdPageHeader'
import { initialsFromName } from '@/lib/relative-time'

/** AGT-APP-001 — visibility toggles stored on agent.cta_config.public_profile */
export interface PublicProfileVisibility {
  show_transactions: boolean
  show_reviews: boolean
  show_phone: boolean
  show_email: boolean
}

const DEFAULT_VISIBILITY: PublicProfileVisibility = {
  show_transactions: true,
  show_reviews: true,
  show_phone: true,
  show_email: true,
}

function readVisibility(cta: unknown): PublicProfileVisibility {
  const raw =
    cta && typeof cta === 'object' && 'public_profile' in cta
      ? (cta as { public_profile?: Partial<PublicProfileVisibility> }).public_profile
      : null
  return {
    show_transactions: raw?.show_transactions ?? DEFAULT_VISIBILITY.show_transactions,
    show_reviews: raw?.show_reviews ?? DEFAULT_VISIBILITY.show_reviews,
    show_phone: raw?.show_phone ?? DEFAULT_VISIBILITY.show_phone,
    show_email: raw?.show_email ?? DEFAULT_VISIBILITY.show_email,
  }
}

/**
 * AGT-APP-001 — Public profile editor.
 *
 * Lets agents manage what appears on their public portfolio (SHR-PUB-002).
 * Persists via PUT /api/auth/me (bio, specialization, languages, photo, cta_config).
 */
export function AgentPublicProfileEditorPage() {
  const { agent, updateProfile, refreshAgent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('Public profile')

  const [bio, setBio] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [languages, setLanguages] = useState('')
  const [photo, setPhoto] = useState('')
  const [visibility, setVisibility] = useState<PublicProfileVisibility>(DEFAULT_VISIBILITY)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!agent) return
    setBio(String(agent.bio || ''))
    setSpecialization(String(agent.specialization || ''))
    const langs = agent.languages
    setLanguages(Array.isArray(langs) ? langs.join(', ') : String(langs || ''))
    setPhoto(typeof agent.photo === 'string' ? agent.photo : '')
    setVisibility(readVisibility(agent.cta_config))
    setLoading(false)
  }, [agent?.id, agent?.bio, agent?.specialization, agent?.languages, agent?.photo, agent?.cta_config])

  const previewHref = useMemo(() => {
    if (!agent) return null
    const slug = typeof agent.slug === 'string' && agent.slug ? agent.slug : agent.id
    return `/public/agent/${slug}`
  }, [agent])

  const handleSave = useCallback(async () => {
    if (!agent) return
    setSaving(true)
    try {
      const existingCta =
        agent.cta_config && typeof agent.cta_config === 'object' ? (agent.cta_config as Record<string, unknown>) : {}
      await updateProfile({
        bio: bio.trim(),
        specialization: specialization.trim(),
        languages: languages.trim(),
        photo: photo.trim() || null,
        cta_config: {
          ...existingCta,
          public_profile: visibility,
        },
      })
      await refreshAgent()
      addToast({ title: 'Public profile saved', variant: 'success' })
    } catch (e: unknown) {
      const err = e as { message?: string }
      addToast({
        title: 'Could not save profile',
        description: err?.message || 'Try again.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }, [agent, bio, specialization, languages, photo, visibility, updateProfile, refreshAgent, addToast])

  const displayName = String(agent?.name || 'Agent')

  return (
    <CrmShell>
      <CmdPageHeader
        title="Public profile"
        subtitle="Manage what buyers see on your public agent page."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {previewHref ? (
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={previewHref} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Preview
                </a>
              </Button>
            ) : null}
            <Button size="sm" className="gap-1.5" onClick={() => void handleSave()} disabled={saving || loading}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-2xl flex-1 overflow-y-auto p-4 pb-12" data-testid="agent-public-profile-editor">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" aria-label="Loading" />
          </div>
        ) : (
          <div className="space-y-8">
            <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-20 w-20 shrink-0">
                {photo ? <AvatarImage src={photo} alt="" /> : null}
                <AvatarFallback>{initialsFromName(displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="profile-photo">Photo URL</Label>
                <Input
                  id="profile-photo"
                  value={photo}
                  onChange={(e) => setPhoto(e.target.value)}
                  placeholder="https://…"
                  className="min-h-11"
                />
                <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                  Square image, at least 200×200. Shown on your public portfolio.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-[length:var(--lc-type-heading-3)] font-semibold text-[var(--lc-text-heading)]">
                About you
              </h2>
              <div className="space-y-2">
                <Label htmlFor="profile-bio">Bio</Label>
                <textarea
                  id="profile-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  placeholder="Tell buyers about your experience and approach…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-specialization">Specialization</Label>
                <Input
                  id="profile-specialization"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Luxury villas, off-plan"
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-languages">Languages spoken</Label>
                <Input
                  id="profile-languages"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="English, Arabic"
                  className="min-h-11"
                />
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-[length:var(--lc-type-heading-3)] font-semibold text-[var(--lc-text-heading)]">
                Public visibility
              </h2>
              <ul className="space-y-3">
                {(
                  [
                    ['show_transactions', 'Show closed transactions on public profile'],
                    ['show_reviews', 'Show reviews on public profile'],
                    ['show_phone', 'Show phone number to visitors'],
                    ['show_email', 'Show email address to visitors'],
                  ] as const
                ).map(([key, label]) => (
                  <li key={key}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[var(--lc-text-primary)]">
                      <input
                        type="checkbox"
                        checked={visibility[key]}
                        onChange={(e) => setVisibility((v) => ({ ...v, [key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-[var(--lc-border-strong)]"
                      />
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </CrmShell>
  )
}
