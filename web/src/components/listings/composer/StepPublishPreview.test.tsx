// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepPublishPreview } from './StepPublishPreview'
import { emptyComposerForm } from './types'

describe('StepPublishPreview ChannelMark', () => {
  it('renders real ChannelMark for Bayut / Property Finder / Dubizzle / Aqar (not initials fallback)', () => {
    const form = emptyComposerForm()
    form.price = '2400000'
    form.location = 'Dubai Marina'
    form.country = 'AE'
    form.photos = [
      { id: '1', url: 'https://cdn.example/1.jpg', alt_text: 'a', isHero: true },
      { id: '2', url: 'https://cdn.example/2.jpg', alt_text: 'b', isHero: false },
      { id: '3', url: 'https://cdn.example/3.jpg', alt_text: 'c', isHero: false },
    ]

    render(
      <StepPublishPreview form={form} onJumpToStep={() => undefined} />,
    )

    for (const portal of ['Bayut', 'Property Finder', 'Dubizzle', 'Aqar', 'OLX']) {
      expect(screen.getByLabelText(portal)).toBeInTheDocument()
    }
    // ChannelMark (not initials fallback) — marks carry channel CSS vars
    const bayut = screen.getByLabelText('Bayut')
    expect(bayut.getAttribute('style') || '').toMatch(/--lc-channel-bayut/)
    const pf = screen.getByLabelText('Property Finder')
    expect(pf.getAttribute('style') || '').toMatch(/--lc-channel-property_finder/)
  })
})
