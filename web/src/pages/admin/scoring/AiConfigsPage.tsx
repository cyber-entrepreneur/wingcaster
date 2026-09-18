import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Eye, History, Loader2, Pencil, Plus, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useStepUp } from '@/context/StepUpContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import type {
  AdminAreaOption,
  AdminDimensionOption,
  AiConfigPreviewResult,
  AiScoringConfig,
  AiScoringConfigInput,
  AiScoringConfigVersion,
} from './aiConfigTypes'

const EMPTY_FORM: AiScoringConfigInput = {
  name: '',
  description: '',
  provider: 'gemini',
  model: 'gemini-1.5-flash',
  temperature: 0.3,
  max_tokens: 2048,
  system_prompt: '',
  scoring_prompt_template:
    'Analyze {{signals_json}} for {{area_name}} and score {{dimension_name}}. {{task_instructions}}',
  output_schema: {
    type: 'object',
    required: ['score', 'confidence', 'rationale'],
  },
  is_active: true,
}

function parseOutputSchema(value: AiScoringConfig['output_schema']): Record<string, unknown> {
  if (typeof value !== 'string') return value || {}
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return {}
  }
}

function toForm(config: AiScoringConfig): AiScoringConfigInput {
  return {
    name: config.name,
    description: config.description || '',
    provider: config.provider,
    model: config.model,
    temperature: Number(config.temperature),
    max_tokens: Number(config.max_tokens),
    system_prompt: config.system_prompt,
    scoring_prompt_template: config.scoring_prompt_template,
    output_schema: parseOutputSchema(config.output_schema),
    is_active: config.is_active,
  }
}

export function AiConfigsPage() {
  const { isAdmin } = useAuth()
  const { runElevated } = useStepUp()
  const { addToast } = useToast()
  const [configs, setConfigs] = useState<AiScoringConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editor, setEditor] = useState<AiScoringConfig | 'new' | null>(null)
  const [form, setForm] = useState<AiScoringConfigInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [historyFor, setHistoryFor] = useState<AiScoringConfig | null>(null)
  const [versions, setVersions] = useState<AiScoringConfigVersion[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(false)
  const [previewFor, setPreviewFor] = useState<AiScoringConfig | null>(null)
  const [areas, setAreas] = useState<AdminAreaOption[]>([])
  const [dimensions, setDimensions] = useState<AdminDimensionOption[]>([])
  const [areaId, setAreaId] = useState('')
  const [dimensionId, setDimensionId] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewOptionsLoading, setPreviewOptionsLoading] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [preview, setPreview] = useState<AiConfigPreviewResult | null>(null)

  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    setError(false)
    try {
      const body = await api.listAdminAiConfigs()
      setConfigs(body.items || [])
    } catch {
      setError(true)
      setConfigs([])
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  const valid = useMemo(
    () =>
      form.name.trim().length >= 2 &&
      form.provider.trim().length >= 2 &&
      form.model.trim().length > 0 &&
      form.system_prompt.trim().length >= 20 &&
      form.scoring_prompt_template.trim().length >= 20 &&
      form.temperature >= 0 &&
      form.temperature <= 2 &&
      form.max_tokens >= 128,
    [form],
  )

  const openEditor = (config: AiScoringConfig | 'new') => {
    setEditor(config)
    setForm(config === 'new' ? { ...EMPTY_FORM } : toForm(config))
  }

  const save = async () => {
    if (!editor || !valid || saving) return
    setSaving(true)
    try {
      const result = await runElevated(
        () => (editor === 'new' ? api.createAdminAiConfig(form) : api.updateAdminAiConfig(editor.id, form)),
        editor === 'new' ? 'create AI scoring config' : 'update AI scoring config',
      )
      if (!result) return
      addToast({
        variant: 'success',
        title: editor === 'new' ? 'AI config created.' : `Version ${result.version} saved.`,
      })
      setEditor(null)
      await load()
    } catch {
      addToast({ variant: 'error', title: "Couldn't save the AI config." })
    } finally {
      setSaving(false)
    }
  }

  const openHistory = async (config: AiScoringConfig) => {
    setHistoryFor(config)
    setVersions([])
    setHistoryError(false)
    setHistoryLoading(true)
    try {
      const body = await api.listAdminAiConfigVersions(config.id)
      setVersions(body.items || [])
    } catch {
      setHistoryError(true)
    } finally {
      setHistoryLoading(false)
    }
  }

  const openPreview = async (config: AiScoringConfig) => {
    setPreviewFor(config)
    setPreview(null)
    setPreviewError(false)
    setAreaId('')
    setDimensionId('')
    setPreviewOptionsLoading(true)
    try {
      const [areaBody, dimensionBody] = await Promise.all([
        api.listAdminAreas({ limit: '100' }) as Promise<{ items: AdminAreaOption[] }>,
        api.listAdminDimensions({ isActive: 'true' }) as Promise<{
          items: AdminDimensionOption[]
        }>,
      ])
      setAreas(areaBody.items || [])
      setDimensions(dimensionBody.items || [])
      setAreaId(areaBody.items?.[0]?.id || '')
      setDimensionId(dimensionBody.items?.[0]?.id || '')
    } catch {
      setPreviewError(true)
      setAreas([])
      setDimensions([])
    } finally {
      setPreviewOptionsLoading(false)
    }
  }

  const runPreview = async () => {
    if (!previewFor || !areaId || !dimensionId || previewLoading) return
    setPreviewLoading(true)
    setPreviewError(false)
    setPreview(null)
    try {
      const result = await runElevated(
        () => api.previewAdminAiConfig(previewFor.id, { area_id: areaId, dimension_id: dimensionId }),
        'preview AI scoring config',
      )
      if (result) setPreview(result)
    } catch {
      setPreviewError(true)
    } finally {
      setPreviewLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div
          role="alert"
          className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-6"
        >
          Platform admin access is required.
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen bg-[var(--lc-bg-page)] px-4 py-6 text-[var(--lc-text-primary)] sm:px-6 lg:px-8"
      data-screen="PA-SCR-002"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-[var(--lc-space-lg)]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              to="/admin/scoring"
              className="mb-2 inline-flex min-h-tap items-center text-sm text-[var(--lc-text-brand)]"
            >
              <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" aria-hidden />
              Back to scoring
            </Link>
            <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
              AI scoring configs
            </h1>
            <p className="mt-1 max-w-2xl text-[var(--lc-text-muted)]">
              Version prompts and preview area-intelligence output before activating changes.
            </p>
          </div>
          <Button type="button" onClick={() => openEditor('new')}>
            <Plus className="me-2 h-4 w-4" aria-hidden />
            New config
          </Button>
        </header>

        {loading ? (
          <div role="status" aria-label="Loading AI configs" className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((key) => (
              <div
                key={key}
                className="h-44 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-unpublished-bg)] p-4"
          >
            <span>Couldn&apos;t load AI scoring configs.</span>
            <Button type="button" variant="outline" onClick={() => void load()}>
              <RefreshCw className="me-2 h-4 w-4" aria-hidden />
              Retry
            </Button>
          </div>
        ) : configs.length === 0 ? (
          <section className="rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] p-8 text-center">
            <h2 style={{ font: 'var(--lc-type-heading-2)' }}>No AI configs yet</h2>
            <p className="mt-2 text-[var(--lc-text-muted)]">
              Create and preview a prompt before enabling area scoring.
            </p>
            <Button type="button" className="mt-4" onClick={() => openEditor('new')}>
              Create first config
            </Button>
          </section>
        ) : (
          <section aria-label="AI scoring configs" className="grid gap-4 md:grid-cols-2">
            {configs.map((config) => (
              <article
                key={config.id}
                className="min-w-0 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 sm:p-5"
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words" style={{ font: 'var(--lc-type-heading-3)' }}>
                      {config.name}
                    </h2>
                    <p className="mt-1 break-words text-sm text-[var(--lc-text-muted)]">
                      {config.description || 'No description provided.'}
                    </p>
                  </div>
                  <Badge status={config.is_active ? 'published' : 'draft'}>
                    {config.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </header>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-[var(--lc-text-muted)]">Provider</dt>
                    <dd className="break-words">{config.provider}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[var(--lc-text-muted)]">Model</dt>
                    <dd className="break-words">{config.model}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--lc-text-muted)]">Version</dt>
                    <dd>
                      <Numeric>{config.version || 1}</Numeric>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--lc-text-muted)]">Temperature</dt>
                    <dd>
                      <Numeric>{config.temperature}</Numeric>
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void openPreview(config)}>
                    <Eye className="me-2 h-4 w-4" aria-hidden />
                    Preview
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => openEditor(config)}>
                    <Pencil className="me-2 h-4 w-4" aria-hidden />
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void openHistory(config)}>
                    <History className="me-2 h-4 w-4" aria-hidden />
                    Versions
                  </Button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      <Dialog open={editor !== null} onOpenChange={(open) => !open && !saving && setEditor(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editor === 'new' ? 'Create AI config' : 'Edit AI config'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="ai-name">Config name</Label>
              <Input
                id="ai-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ai-provider">Provider</Label>
              <Input
                id="ai-provider"
                value={form.provider}
                onChange={(event) => setForm({ ...form, provider: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ai-temp">Temperature</Label>
              <Input
                id="ai-temp"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={form.temperature}
                onChange={(event) => setForm({ ...form, temperature: Number(event.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="ai-tokens">Max tokens</Label>
              <Input
                id="ai-tokens"
                type="number"
                min="128"
                max="32768"
                value={form.max_tokens}
                onChange={(event) => setForm({ ...form, max_tokens: Number(event.target.value) })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ai-description">Description</Label>
              <Input
                id="ai-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ai-system">System prompt</Label>
              <textarea
                id="ai-system"
                className="mt-1 min-h-28 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2"
                value={form.system_prompt}
                onChange={(event) => setForm({ ...form, system_prompt: event.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ai-scoring">Scoring prompt template</Label>
              <textarea
                id="ai-scoring"
                className="mt-1 min-h-36 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2"
                value={form.scoring_prompt_template}
                onChange={(event) => setForm({ ...form, scoring_prompt_template: event.target.value })}
              />
            </div>
            <label className="flex min-h-tap items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
              />
              Active for scoring
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditor(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={!valid || saving}>
              {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
              {editor === 'new' ? 'Create config' : 'Save new version'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyFor !== null} onOpenChange={(open) => !open && setHistoryFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{historyFor?.name} version history</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <p role="status">Loading version history…</p>
          ) : historyError ? (
            <p role="alert">Couldn&apos;t load version history.</p>
          ) : versions.length === 0 ? (
            <p>No saved versions.</p>
          ) : (
            <ol className="space-y-2">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-3"
                >
                  <span>
                    Version <Numeric>{version.version}</Numeric>
                  </span>
                  <time dateTime={version.created_at} className="text-sm text-[var(--lc-text-muted)]">
                    {new Date(version.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={previewFor !== null} onOpenChange={(open) => !open && !previewLoading && setPreviewFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview {previewFor?.name}</DialogTitle>
          </DialogHeader>
          {previewOptionsLoading ? (
            <p role="status">Loading sample areas and dimensions…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="preview-area">Sample area</Label>
                <select
                  id="preview-area"
                  className="mt-1 min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3"
                  value={areaId}
                  onChange={(event) => setAreaId(event.target.value)}
                >
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="preview-dimension">Dimension</Label>
                <select
                  id="preview-dimension"
                  className="mt-1 min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3"
                  value={dimensionId}
                  onChange={(event) => setDimensionId(event.target.value)}
                >
                  {dimensions.map((dimension) => (
                    <option key={dimension.id} value={dimension.id}>
                      {dimension.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {!previewOptionsLoading && (areas.length === 0 || dimensions.length === 0) ? (
            <p role="status" className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-3">
              A sample area and active dimension are required to run a preview.
            </p>
          ) : null}
          {previewError ? (
            <p role="alert" className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-unpublished-bg)] p-3">
              The preview could not be completed. Check the provider configuration and try again.
            </p>
          ) : null}
          {preview ? (
            <section
              aria-label="Preview result"
              className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-[var(--lc-text-muted)]">Score</p>
                  <Numeric as="p" className="text-xl">
                    {preview.result.score ?? '—'}
                  </Numeric>
                </div>
                <div>
                  <p className="text-sm text-[var(--lc-text-muted)]">Confidence</p>
                  <Numeric as="p" className="text-xl">
                    {Math.round(preview.result.confidence * 100)}%
                  </Numeric>
                </div>
              </div>
              <p className="mt-3 text-sm">{preview.result.rationale}</p>
            </section>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPreviewFor(null)} disabled={previewLoading}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void runPreview()}
              disabled={!areaId || !dimensionId || previewLoading || previewOptionsLoading}
            >
              {previewLoading ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <Eye className="me-2 h-4 w-4" aria-hidden />
              )}
              Run metered preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
