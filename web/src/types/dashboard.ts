/** Dashboard / distribution API shapes (snake_case payloads). */

import type { Agent, Inquiry, Property } from '@/types'

export interface DashboardStats {
  listings?: number
  totalListings?: number
  inquiries?: number
  totalInquiries?: number
  totalViews?: number
  avgViews?: number
  avgPrice?: number
}

export interface DashboardAnalytics {
  overview: {
    listings: number
    active_listings: number
    total_views: number
    total_clicks: number
    total_inquiries: number
    avg_views: number
  }
  by_property: Array<{
    id: string
    title: string
    city: string
    photo?: string
    status?: string
    views: number
    clicks: number
    inquiries: number
    engagement: number
  }>
  by_device: Array<{ label: string; value: number }>
  by_geography: Array<{ label: string; value: number }>
  by_channel: Array<{ label: string; value: number }>
  by_referrer: Array<{ label: string; value: number }>
  inquiries_by_status: Array<{ label: string; value: number }>
  analytics_source?: string
  ga_note?: string
}

export interface DashboardOperations {
  sla_breached_count?: number
  todays_viewings?: Array<{
    id: string
    client_name?: string
    scheduled_at?: string
    mode?: string
    property_title?: string
  }>
  overdue_follow_ups?: number
  follow_ups_due?: number
  pending_viewings?: number
  tasks?: {
    overdue?: unknown[]
    due_soon?: unknown[]
    due_today?: unknown[]
    overdue_count?: number
    due_soon_count?: number
    due_today_count?: number
  }
  pipeline?: {
    total_value?: number
    weighted_value?: number
    open_opportunities?: number
    by_stage?: unknown
  }
  generated_at?: string
}

export interface NotificationPrefs {
  id?: string
  user_id?: string
  channels: { inapp?: boolean; email?: boolean; whatsapp?: boolean }
  events: {
    saved_search_match?: boolean
    inquiry_sla_overdue?: boolean
    viewing_reminder?: boolean
    viewing_no_show?: boolean
  }
  quiet_hours?: {
    enabled?: boolean
    start?: string
    end?: string
    timezone?: string
  }
  created_at?: string
  updated_at?: string
}

export interface DistributionPlatform {
  id: string
  name: string
  type?: string
  icon?: string
  requiresAuth?: boolean
  description?: string
  formats?: string[]
  capabilities?: string[]
  limitations?: string[]
  configured?: boolean
}

export interface AgentConnection {
  id: string
  agent_id?: string
  platform: string
  account_name?: string
  handle?: string
  status?: string
  health?: string
  settings?: {
    notify_number?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface FiAccount {
  id: string
  platform: string
  account_name?: string
  description?: string
  status?: string
  type?: string
  [key: string]: unknown
}

export interface DistributionPerformance {
  overview?: {
    totalListingsPublished?: number
    totalPlatforms?: number
    totalViews?: number
    totalLeads?: number
    fiSubmissions?: { pending?: number; approved?: number; rejected?: number }
  }
  byPlatform?: Array<{
    platform: string
    owner_type?: string
    listings?: number
    views?: number
    leads?: number
    cost?: number
  }>
  total?: number
}

export interface DistributionSubmission {
  id: string
  property_id?: string
  agent_id?: string
  platform?: string
  platform_name?: string
  status?: string
  message?: string
  review_notes?: string
  created_at?: string
  property?: Property
  agent?: Agent
  [key: string]: unknown
}

export interface WhatsAppStatus {
  configured?: boolean
  healthy?: boolean
  error?: string
  phone_number_id?: string
  waba_id?: string
  display_phone_number?: string
  verified_name?: string
  quality_rating?: string
  verify_token_configured?: boolean
  default_recipient_configured?: boolean
  webhook_path?: string
  [key: string]: unknown
}

export interface AgentEngagement {
  views_total?: number
  followers_total?: number
  by_channel?: Record<string, number>
  visibility?: string
  [key: string]: unknown
}

export interface InquiryListItem extends Inquiry {
  sla_overdue?: boolean
  viewings_count?: number
  next_viewing_at?: string | null
  priority?: string
  stage?: string
  client_name?: string
  contact_id?: string
  [key: string]: unknown
}

export interface InquiryListResponse {
  items?: InquiryListItem[]
  next_cursor?: string | null
  has_more?: boolean
}

export interface ViewingRow {
  id: string
  inquiry_id?: string
  property_id?: string
  listing_id?: string
  property_title?: string
  agent_id?: string
  client_name?: string
  client_phone?: string
  client_email?: string
  contact_id?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  scheduled_at: string
  duration_minutes?: number
  mode?: string
  location?: string
  notes?: string
  status: string
  outcome?: string
  outcome_notes?: string
  client_notified?: boolean
  [key: string]: unknown
}

export interface InquiryTimeline {
  viewings?: ViewingRow[]
  follow_ups?: unknown[]
  activities?: unknown[]
  [key: string]: unknown
}

export interface DistributionRow {
  id: string
  platform?: string
  status?: string
  insights?: unknown
  [key: string]: unknown
}
