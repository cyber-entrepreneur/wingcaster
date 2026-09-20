import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/toast'
import { api } from '@/api/client'
import {
  AudienceRule,
  CampaignFormState,
  CampaignStep,
  CampaignTemplate,
  EMPTY_RULE,
  EMPTY_STEP,
  INITIAL_FORM_STATE,
  PRESET_TEMPLATES,
  formCanSave,
  stepsAreValid,
} from './campaign-builder-shared'

export function useCampaignBuilderForm(initialForm?: CampaignFormState) {
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [form, setForm] = useState<CampaignFormState>(() => initialForm ?? { ...INITIAL_FORM_STATE })
  const [templates, setTemplates] = useState<CampaignTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setTemplatesLoading(true)
    api
      .getMessageTemplates()
      .then((rows) => {
        if (!cancelled) setTemplates(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setTemplates([])
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setField = <K extends keyof CampaignFormState>(k: K, v: CampaignFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags_filter.includes(t)) setField('tags_filter', [...form.tags_filter, t])
    setTagInput('')
  }

  const removeTag = (t: string) => setField('tags_filter', form.tags_filter.filter((x) => x !== t))

  const addRule = () => setField('audience_rules', [...form.audience_rules, { ...EMPTY_RULE }])

  const updateRule = (i: number, r: AudienceRule) =>
    setField('audience_rules', form.audience_rules.map((x, idx) => (idx === i ? r : x)))

  const removeRule = (i: number) =>
    setField('audience_rules', form.audience_rules.filter((_, idx) => idx !== i))

  const addStep = () => setField('steps', [...form.steps, { ...EMPTY_STEP }])

  const updateStep = (i: number, s: CampaignStep) =>
    setField('steps', form.steps.map((x, idx) => (idx === i ? s : x)))

  const removeStep = (i: number) => setField('steps', form.steps.filter((_, idx) => idx !== i))

  const applyTemplate = (t: typeof PRESET_TEMPLATES[number]) => {
    setField('steps', t.steps)
    setField('target_channel', t.steps[0]?.channel || 'email')
  }

  const handleSave = async (status: 'draft' | 'active') => {
    setSaving(true)
    try {
      await api.createJourney({
        name: form.name.trim(),
        description: form.description.trim(),
        status,
        trigger: form.trigger,
        target_channel: form.target_channel,
        tags_filter: form.tags_filter,
        audience_rules: form.audience_rules,
        steps: form.steps,
        ...(form.editor_mode === 'canvas' && form.graph ? { graph: form.graph } : {}),
      })
      addToast({
        title: `Journey ${status === 'active' ? 'launched' : 'saved as draft'}`,
        variant: 'success',
      })
      navigate('/journeys')
    } catch (e: any) {
      addToast({ title: 'Could not save journey', description: e.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return {
    form,
    setField,
    tagInput,
    setTagInput,
    addTag,
    removeTag,
    addRule,
    updateRule,
    removeRule,
    addStep,
    updateStep,
    removeStep,
    applyTemplate,
    templates,
    templatesLoading,
    saving,
    handleSave,
    canSave: formCanSave(form),
    stepsAreValid: stepsAreValid(form.steps),
  }
}
