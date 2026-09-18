import { findAll } from '../db.js'

function parseDate(date) {
  if (!date) return null
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? null : d
}

function isInRange(iso, startDate, endDate) {
  if (!iso) return false
  const d = parseDate(iso)
  if (!d) return false
  if (startDate && d < startDate) return false
  if (endDate && d >= endDate) return false
  return true
}

function pct(numerator, denominator) {
  if (!denominator) return null
  return Math.round((numerator / denominator) * 100)
}

function primaryChannel(campaign) {
  if (campaign.target_channel) return campaign.target_channel
  const steps = Array.isArray(campaign.steps) ? campaign.steps : []
  return steps[0]?.channel || 'mixed'
}

function campaignChannels(campaign) {
  const channels = new Set()
  if (campaign.target_channel) channels.add(campaign.target_channel)
  const steps = Array.isArray(campaign.steps) ? campaign.steps : []
  for (const step of steps) {
    if (step?.channel) channels.add(step.channel)
  }
  return channels.size ? [...channels] : ['mixed']
}

export async function getCampaignPerformance({
  agencyId,
  startDate,
  endDate,
  channel,
  agentId,
} = {}) {
  if (!agencyId) throw new Error('agencyId is required')

  const start = parseDate(startDate)
  const end = parseDate(endDate)

  const [allCampaigns, allEnrollments, allMessages, allAgents] = await Promise.all([
    findAll('campaigns'),
    findAll('campaign_enrollments'),
    findAll('campaign_messages'),
    findAll('agents'),
  ])

  const agentNames = new Map(allAgents.map((row) => [row.id, row.name || row.email || row.id]))

  let campaigns = allCampaigns.filter((row) => row.agency_id === agencyId)
  if (agentId) campaigns = campaigns.filter((row) => row.agent_id === agentId)
  if (channel) {
    campaigns = campaigns.filter((row) => campaignChannels(row).includes(channel))
  }

  const campaignIds = new Set(campaigns.map((row) => row.id))
  const enrollments = allEnrollments.filter((row) => campaignIds.has(row.campaign_id))
  const messages = allMessages.filter((row) => campaignIds.has(row.campaign_id))

  const rows = campaigns.map((campaign) => {
    const campaignEnrollments = enrollments.filter((row) => row.campaign_id === campaign.id)
    const campaignMessages = messages.filter((row) => {
      if (row.campaign_id !== campaign.id) return false
      const sentAt = row.sent_at || row.created_at
      return isInRange(sentAt, start, end)
    })

    const activeEnrollments = campaignEnrollments.filter((row) => row.status === 'active')
    const completedEnrollments = campaignEnrollments.filter((row) => row.status === 'completed')
    const sentMessages = campaignMessages.filter((row) => row.status === 'sent' || row.sent_at)
    const deliveredMessages = campaignMessages.filter((row) => row.status === 'delivered' || row.delivered_at)
    const failedMessages = campaignMessages.filter((row) => row.status === 'failed')

    return {
      id: campaign.id,
      name: campaign.name || 'Untitled campaign',
      status: campaign.status || 'draft',
      trigger: campaign.trigger || 'manual',
      channel: primaryChannel(campaign),
      channels: campaignChannels(campaign),
      agent_id: campaign.agent_id || null,
      agent_name: campaign.agent_id ? agentNames.get(campaign.agent_id) || campaign.agent_id : null,
      enrollments_total: campaignEnrollments.length,
      enrollments_active: activeEnrollments.length,
      enrollments_completed: completedEnrollments.length,
      completion_rate: pct(completedEnrollments.length, campaignEnrollments.length),
      messages_sent: sentMessages.length,
      messages_delivered: deliveredMessages.length,
      messages_failed: failedMessages.length,
      delivery_rate: pct(deliveredMessages.length, sentMessages.length),
      steps_count: Array.isArray(campaign.steps) ? campaign.steps.length : 0,
      href: `/campaigns/${campaign.id}`,
      created_at: campaign.created_at || null,
    }
  }).sort((a, b) => b.enrollments_total - a.enrollments_total)

  const byChannelMap = new Map()
  for (const row of messages) {
    if (!isInRange(row.sent_at || row.created_at, start, end)) continue
    const key = row.channel || 'unknown'
    if (!byChannelMap.has(key)) {
      byChannelMap.set(key, { channel: key, messages_sent: 0, messages_delivered: 0, campaigns: new Set() })
    }
    const bucket = byChannelMap.get(key)
    bucket.campaigns.add(row.campaign_id)
    if (row.status === 'sent' || row.sent_at) bucket.messages_sent += 1
    if (row.status === 'delivered' || row.delivered_at) bucket.messages_delivered += 1
  }

  const byChannel = [...byChannelMap.values()]
    .map((row) => ({
      channel: row.channel,
      messages_sent: row.messages_sent,
      messages_delivered: row.messages_delivered,
      campaigns: row.campaigns.size,
      delivery_rate: pct(row.messages_delivered, row.messages_sent),
    }))
    .sort((a, b) => b.messages_sent - a.messages_sent)

  const channels = [...new Set(campaigns.flatMap((row) => campaignChannels(row)))].sort()
  const agents = [...new Set(campaigns.map((row) => row.agent_id).filter(Boolean))]
    .map((id) => ({ id, name: agentNames.get(id) || id }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    generated_at: new Date().toISOString(),
    agency_id: agencyId,
    filters: {
      start_date: startDate || null,
      end_date: endDate || null,
      channel: channel || null,
      agent_id: agentId || null,
    },
    overview: {
      campaigns: rows.length,
      active_campaigns: rows.filter((row) => row.status === 'active').length,
      total_enrollments: rows.reduce((sum, row) => sum + row.enrollments_total, 0),
      completed_enrollments: rows.reduce((sum, row) => sum + row.enrollments_completed, 0),
      messages_sent: rows.reduce((sum, row) => sum + row.messages_sent, 0),
      messages_delivered: rows.reduce((sum, row) => sum + row.messages_delivered, 0),
      completion_rate: pct(
        rows.reduce((sum, row) => sum + row.enrollments_completed, 0),
        rows.reduce((sum, row) => sum + row.enrollments_total, 0),
      ),
    },
    rows,
    by_channel: byChannel,
    filter_options: { channels, agents },
  }
}

export default { getCampaignPerformance }
