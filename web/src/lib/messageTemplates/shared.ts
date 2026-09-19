import type { LucideIcon } from 'lucide-react'
import { Mail, MessageSquare, Smartphone } from 'lucide-react'

export type MessageTemplateChannel = 'whatsapp' | 'sms' | 'email'
export type MessageTemplateCategory = 'greeting' | 'follow_up' | 'viewing' | 'offer' | 'general'

export type MessageTemplateRow = {
  id: string
  name: string
  channel: MessageTemplateChannel
  category: MessageTemplateCategory
  subject: string | null
  body: string
  variables: string[]
  language: string
  approval_status: string
  owner_type: 'agent' | 'agency' | 'platform'
  owner_id: string | null
  is_default: boolean
  usage_count: number
  created_at: string
  updated_at: string
}

export const MESSAGE_TEMPLATE_CHANNELS: Array<{
  value: MessageTemplateChannel
  label: string
  icon: LucideIcon
}> = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'sms', label: 'SMS', icon: Smartphone },
  { value: 'email', label: 'Email', icon: Mail },
]

export const MESSAGE_TEMPLATE_CATEGORIES: Array<{ value: MessageTemplateCategory; label: string }> = [
  { value: 'greeting', label: 'Greeting' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'viewing', label: 'Viewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'general', label: 'General' },
]

export const VARIABLE_SUGGESTIONS = [
  'client_name',
  'agent_name',
  'property_title',
  'property_address',
  'viewing_date',
  'price',
  'inquiry_message',
]

export function channelLabel(channel: string) {
  return MESSAGE_TEMPLATE_CHANNELS.find((c) => c.value === channel)?.label || channel
}

export function categoryLabel(category: string) {
  return MESSAGE_TEMPLATE_CATEGORIES.find((c) => c.value === category)?.label || category
}

export function extractTemplateVariables(body: string, subject: string | null) {
  const text = [body, subject || ''].join('\n')
  const matches = text.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g) || []
  return Array.from(new Set(matches.map((m) => m.replace(/\{\{\s*|\s*\}\}/g, ''))))
}

/** Segment-aware SMS length hint (GSM-7 approximation). */
export function smsSegmentInfo(text: string) {
  const len = text.length
  if (len <= 160) return { chars: len, segments: 1, limit: 160 }
  const segments = Math.ceil(len / 153)
  return { chars: len, segments, limit: 153 }
}

export const DEFAULT_PREVIEW_VARIABLES: Record<string, string> = {
  client_name: 'John Doe',
  agent_name: 'Agent',
  property_title: 'Luxury Apartment in Beirut',
  property_address: 'Achrafieh, Beirut',
  viewing_date: new Date().toLocaleString(),
  price: '$850,000',
  inquiry_message: 'I am interested in this property.',
}
