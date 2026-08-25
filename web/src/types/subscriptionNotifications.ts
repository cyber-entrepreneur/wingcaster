export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'in_app'

export interface NotificationPreferenceRow {
  event_kind: string
  channel: NotificationChannel
  enabled: boolean
  explicit: boolean
  pref_id: string | null
  updated_at: string | null
}

export interface NotificationEventRow {
  id: string
  event_kind: string
  subscription_id: string | null
  subject: string | null
  created_at: string
  deliveries_sent?: number
  deliveries_skipped?: number
  deliveries_failed?: number
}
