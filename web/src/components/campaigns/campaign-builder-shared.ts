import { Mail, MessageSquare, Phone } from 'lucide-react'

export interface CampaignStep {
  delay_hours: number
  channel: string
  template_id?: string | null
  subject: string
  body: string
}

export interface CampaignTemplate {
  id: string
  name: string
  channel: 'email' | 'sms' | 'whatsapp'
  category: string
  subject: string | null
  body: string
  variables: string[]
  owner_type: 'agent' | 'agency' | 'platform'
  owner_id: string | null
  is_default: boolean
  approval_status: string
  language: string
  usage_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AudienceRule {
  field: 'status' | 'source' | 'tags' | 'territory'
  operator: 'is' | 'is_not' | 'contains'
  value: string
}

export interface CampaignFormState {
  name: string
  description: string
  trigger: string
  target_channel: string
  tags_filter: string[]
  audience_rules: AudienceRule[]
  steps: CampaignStep[]
  /** Wave 2E branching graph; when set, preferred over linear steps on save. */
  graph?: {
    nodes: Array<{ id: string; type: string; config: Record<string, unknown>; x?: number; y?: number }>
    edges: Array<{ from: string; to: string }>
  } | null
  editor_mode?: 'linear' | 'canvas'
}

export const TRIGGERS = [
  { value: 'manual', label: 'Manual', description: 'Enroll contacts by hand or via API' },
  { value: 'new_lead', label: 'New lead', description: 'Fires when a new contact is created' },
  { value: 'inquiry', label: 'New inquiry', description: 'Fires when a property inquiry arrives' },
  { value: 'viewing_completed', label: 'Viewing completed', description: 'Fires after a viewing is marked complete' },
  { value: 'tag', label: 'Tag applied', description: 'Fires when a specific tag is added to a contact' },
]

export const CHANNELS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'sms', label: 'SMS', icon: Phone },
]

export const AUDIENCE_FIELDS: { value: AudienceRule['field']; label: string }[] = [
  { value: 'status', label: 'Contact status' },
  { value: 'source', label: 'Lead source' },
  { value: 'tags', label: 'Tags' },
  { value: 'territory', label: 'Territory' },
]

export const AUDIENCE_OPERATORS: { value: AudienceRule['operator']; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
]

export const WIZARD_STEPS = ['Basics', 'Audience', 'Steps', 'Review']

export const EMPTY_STEP: CampaignStep = {
  delay_hours: 0,
  channel: 'email',
  template_id: null,
  subject: '',
  body: '',
}

export const EMPTY_RULE: AudienceRule = { field: 'status', operator: 'is', value: '' }

export const PRESET_TEMPLATES: { label: string; steps: CampaignStep[] }[] = [
  {
    label: 'New lead 3-touch',
    steps: [
      {
        delay_hours: 0,
        channel: 'email',
        subject: 'We received your inquiry',
        body: "Hi {{client_name}}, thanks for reaching out about {{property_title}}. We'll be in touch shortly.",
      },
      {
        delay_hours: 48,
        channel: 'whatsapp',
        subject: '',
        body: 'Hi {{client_name}}, following up on your inquiry about {{property_title}}. Are you available for a call?',
      },
      {
        delay_hours: 120,
        channel: 'email',
        subject: 'Similar properties you may like',
        body: 'Hi {{client_name}}, here are a few more listings that match your search criteria.',
      },
    ],
  },
  {
    label: 'Post-viewing nurture',
    steps: [
      {
        delay_hours: 2,
        channel: 'whatsapp',
        subject: '',
        body: 'Hi {{client_name}}, hope you enjoyed the viewing at {{property_title}}. Any questions?',
      },
      {
        delay_hours: 48,
        channel: 'email',
        subject: 'Your viewing feedback',
        body: "Hi {{client_name}}, we'd love your thoughts on {{property_title}}. Are you ready to move forward?",
      },
    ],
  },
  {
    label: 'Re-engagement',
    steps: [
      {
        delay_hours: 0,
        channel: 'email',
        subject: 'We miss you',
        body: "Hi {{client_name}}, it's been a while! We have new listings that match your previous searches.",
      },
      {
        delay_hours: 72,
        channel: 'whatsapp',
        subject: '',
        body: "Hi {{client_name}}, just checking in. Can we schedule a call to discuss what you're looking for?",
      },
    ],
  },
]

export const INITIAL_FORM_STATE: CampaignFormState = {
  name: '',
  description: '',
  trigger: 'manual',
  target_channel: 'email',
  tags_filter: [],
  audience_rules: [],
  steps: [{ ...EMPTY_STEP }],
  graph: null,
  editor_mode: 'linear',
}

export function stepsAreValid(steps: CampaignStep[]): boolean {
  return steps.every((s) => Boolean(s.template_id) || s.body.trim().length > 0)
}

export function formCanSave(form: CampaignFormState): boolean {
  if (form.name.trim().length < 2) return false
  if (form.editor_mode === 'canvas') {
    return Boolean(form.graph?.nodes?.some((n) => n.type === 'send' || n.type === 'exit'))
  }
  return stepsAreValid(form.steps)
}
