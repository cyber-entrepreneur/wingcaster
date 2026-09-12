// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SourceMark } from '@/components/ui/source-mark'
import { ChannelMark } from '@/components/ui/channel-mark'
import { ChannelSourceBadges } from '@/components/inbox/ChannelSourceBadges'
import { InboxRow } from '@/components/inbox/InboxRow'
import { MessageBubble } from '@/components/inbox/MessageBubble'
import { CharacterCounter } from '@/components/inbox/CharacterCounter'
import { PortalSourceChip } from '@/components/inbox/PortalSourceChip'
import { readChannel, readSource } from '@/lib/channel-source'
import { channelMaxLength, counterThreshold, smsSegmentInfo } from '@/lib/channel-limits'

describe('dual-read channel/source (BE-BLOCKER-04)', () => {
  it('prefers explicit channel+source over source_channel', () => {
    const row = { channel: 'email', source: 'bayut', source_channel: 'whatsapp_olx' }
    expect(readChannel(row)).toBe('email')
    expect(readSource(row)).toBe('bayut')
  })

  it('derives both fields from legacy source_channel', () => {
    const row = { source_channel: 'whatsapp_property_finder' }
    expect(readChannel(row)).toBe('whatsapp')
    expect(readSource(row)).toBe('property_finder')
  })

  it('handles empty channel/source as absent (fall back)', () => {
    const row = { channel: '  ', source: null, source_channel: 'sms_dubizzle' }
    expect(readChannel(row)).toBe('sms')
    expect(readSource(row)).toBe('dubizzle')
  })
})

describe('SourceMark + ChannelMark dual-badge', () => {
  it('renders SourceMark with human label', () => {
    render(<SourceMark source="property_finder" />)
    expect(screen.getByLabelText(/Property Finder/i)).toBeInTheDocument()
  })

  it('renders ChannelMark for coarse + aliased channels', () => {
    const { rerender } = render(<ChannelMark channel="whatsapp" />)
    expect(screen.getByLabelText(/WhatsApp/i)).toBeInTheDocument()
    rerender(<ChannelMark channel="instagram_dm" />)
    expect(screen.getByLabelText(/Instagram/i)).toBeInTheDocument()
    rerender(<ChannelMark channel="email" />)
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
  })

  it('ChannelSourceBadges announces channel from source', () => {
    render(<ChannelSourceBadges channel="whatsapp" source="bayut" />)
    expect(screen.getByLabelText(/WhatsApp from Bayut/i)).toBeInTheDocument()
  })
})

describe('InboxRow dual-read display', () => {
  it('shows contact, dual badges, and unread weight', () => {
    render(
      <InboxRow
        conversation={{
          id: 'c1',
          contact_name: 'Sara Al-Mansoori',
          channel: readChannel({ source_channel: 'whatsapp_bayut' }),
          source: readSource({ source_channel: 'whatsapp_bayut' }),
          last_message_at: new Date().toISOString(),
          last_message_preview: 'Is the 2BR still available?',
          unread_count: 2,
          is_unread_by_agent: true,
          priority_score: 87,
          priority_reason: 'hot lead',
        }}
        onSelect={() => undefined}
      />,
    )
    expect(screen.getByText('Sara Al-Mansoori')).toBeInTheDocument()
    expect(screen.getByText(/Is the 2BR still available/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/WhatsApp from Bayut/i)).toBeInTheDocument()
  })
})

describe('MessageBubble + PortalSourceChip (AGT-INB-002)', () => {
  it('shows portal chip only on first inbound with non-direct source', () => {
    render(
      <MessageBubble
        message={{
          id: 'm1',
          direction: 'inbound',
          content: 'Hi from Bayut',
          status: 'received',
          created_at: '2026-09-08T08:12:00Z',
          is_first_inbound: true,
        }}
        conversationChannel="whatsapp"
        conversationSource="bayut"
        showPortalChip
      />,
    )
    expect(screen.getByLabelText(/Arrived via portal from Bayut/i)).toBeInTheDocument()
    expect(screen.getByText('Hi from Bayut')).toBeInTheDocument()
  })

  it('renders image, audio, and PDF attachments inside the bubble', () => {
    render(
      <MessageBubble
        message={{
          id: 'm-media',
          direction: 'inbound',
          content: '',
          status: 'received',
          created_at: '2026-09-08T08:12:00Z',
          image_url: 'https://cdn.example/plan.jpg',
          audio_url: 'https://cdn.example/note.ogg',
          attachments: [
            { url: 'https://cdn.example/offer.pdf', mime: 'application/pdf', filename: 'offer.pdf', kind: 'pdf' },
          ],
        }}
        conversationChannel="whatsapp"
        conversationSource="bayut"
      />,
    )
    expect(screen.getByAltText(/plan.jpg/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/note\.ogg/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/offer.pdf/i)).toBeInTheDocument()
  })

  it('PortalSourceChip hides for direct/unknown', () => {
    const { container } = render(<PortalSourceChip source="direct" />)
    expect(container.firstChild).toBeNull()
  })

  it('outbound bubble shows delivery glyph', () => {
    render(
      <MessageBubble
        message={{
          id: 'm2',
          direction: 'outbound',
          content: 'Yes, available',
          status: 'read',
          created_at: '2026-09-08T08:14:00Z',
        }}
        conversationChannel="whatsapp"
        conversationSource="bayut"
      />,
    )
    expect(screen.getByLabelText(/Read/i)).toBeInTheDocument()
  })
})

describe('channel-limits + CharacterCounter', () => {
  it('maps channel max lengths', () => {
    expect(channelMaxLength('sms')).toBe(160)
    expect(channelMaxLength('whatsapp')).toBe(4096)
  })

  it('thresholds at 80/90/100%', () => {
    expect(counterThreshold(79, 100)).toBe('hidden')
    expect(counterThreshold(80, 100)).toBe('muted')
    expect(counterThreshold(90, 100)).toBe('warning')
    expect(counterThreshold(100, 100)).toBe('danger')
  })

  it('SMS segments for GSM vs UCS-2', () => {
    expect(smsSegmentInfo('a'.repeat(161)).segments).toBe(2)
    expect(smsSegmentInfo('مرحبا'.repeat(20)).segmentSize).toBe(70)
  })

  it('renders counter when over 80%', () => {
    const text = 'x'.repeat(130) // 130/160 = 81%
    render(<CharacterCounter text={text} channel="sms" />)
    expect(screen.getByText(/130\s*\/\s*160/)).toBeInTheDocument()
  })
})
