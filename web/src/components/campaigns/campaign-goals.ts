/**
 * AGT-CMP-002 — Guided campaign goal presets.
 * Seeds the wizard via `?goal=` (from AGT-CMP-001 list) or step 1 selection.
 */
export type CampaignGoalId = 'new_listing' | 'price_drop' | 'open_house' | 'custom'

export interface CampaignGoalPreset {
  name: string
  description: string
  trigger: string
  target_channel: string
  tags_filter: string[]
  steps: Array<{
    delay_hours: number
    channel: string
    subject: string
    body: string
  }>
}

export interface CampaignGoal {
  id: CampaignGoalId
  label: string
  description: string
  preset: CampaignGoalPreset | null
}

export const CAMPAIGN_GOALS: CampaignGoal[] = [
  {
    id: 'new_listing',
    label: 'New listing announcement',
    description: 'Tell your audience about a property you just listed.',
    preset: {
      name: 'New listing announcement',
      description: 'Announce a freshly listed property to warm leads.',
      trigger: 'manual',
      target_channel: 'email',
      tags_filter: ['buyer'],
      steps: [
        {
          delay_hours: 0,
          channel: 'email',
          subject: 'Just listed: {{property_title}}',
          body:
            'Hi {{client_name}}, we just listed {{property_title}}. Reply if you would like a viewing or more details.',
        },
        {
          delay_hours: 48,
          channel: 'whatsapp',
          subject: '',
          body: 'Hi {{client_name}}, following up on {{property_title}} — are you available for a tour this week?',
        },
      ],
    },
  },
  {
    id: 'price_drop',
    label: 'Price drop',
    description: 'Re-engage buyers when you reduce a listing price.',
    preset: {
      name: 'Price drop alert',
      description: 'Notify interested contacts about a reduced asking price.',
      trigger: 'tag',
      target_channel: 'whatsapp',
      tags_filter: ['price-sensitive'],
      steps: [
        {
          delay_hours: 0,
          channel: 'whatsapp',
          subject: '',
          body:
            'Hi {{client_name}}, good news — the price on {{property_title}} was reduced. Want the updated details?',
        },
        {
          delay_hours: 72,
          channel: 'email',
          subject: 'Updated price on {{property_title}}',
          body:
            'Hi {{client_name}}, sharing the revised price and terms for {{property_title}}. Let me know if you would like to schedule a viewing.',
        },
      ],
    },
  },
  {
    id: 'open_house',
    label: 'Open house',
    description: 'Invite contacts to an upcoming open house or viewing day.',
    preset: {
      name: 'Open house invitations',
      description: 'Drive RSVPs for an open house at {{property_title}}.',
      trigger: 'viewing_completed',
      target_channel: 'email',
      tags_filter: ['open-house'],
      steps: [
        {
          delay_hours: 0,
          channel: 'email',
          subject: 'You are invited — open house at {{property_title}}',
          body:
            'Hi {{client_name}}, join us for an open house at {{property_title}} on {{viewing_date}}. RSVP by replying to this email.',
        },
        {
          delay_hours: 24,
          channel: 'sms',
          subject: '',
          body: 'Reminder: open house tomorrow at {{property_title}}. See you there, {{agent_name}}.',
        },
      ],
    },
  },
  {
    id: 'custom',
    label: 'Custom campaign',
    description: 'Start from scratch with the full guided wizard.',
    preset: null,
  },
]

export function getCampaignGoal(id: string | null | undefined): CampaignGoal | undefined {
  if (!id) return undefined
  return CAMPAIGN_GOALS.find((goal) => goal.id === id)
}

export function applyCampaignGoalPreset(
  preset: CampaignGoalPreset,
): {
  name: string
  description: string
  trigger: string
  target_channel: string
  tags_filter: string[]
  steps: CampaignGoalPreset['steps']
} {
  return {
    name: preset.name,
    description: preset.description,
    trigger: preset.trigger,
    target_channel: preset.target_channel,
    tags_filter: [...preset.tags_filter],
    steps: preset.steps.map((step) => ({ ...step, template_id: null })),
  }
}
