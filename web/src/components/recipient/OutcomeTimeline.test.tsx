// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OutcomeTimeline } from './OutcomeTimeline'

describe('OutcomeTimeline', () => {
  it('marks current step with aria-current and empty labels', () => {
    render(
      <OutcomeTimeline
        events={[
          { key: 'submitted', label: 'Submitted', timestamp: '2026-09-05T09:14:22Z', state: 'complete' },
          { key: 'viewed', label: 'Viewed by agency', emptyLabel: 'Not yet viewed', state: 'pending' },
          { key: 'decided', label: 'Decided', emptyLabel: 'Awaiting decision', state: 'current' },
          { key: 'resolved', label: 'Approved', emptyLabel: 'Pending', state: 'pending' },
        ]}
      />,
    )

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[2]).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Not yet viewed')).toBeInTheDocument()
    expect(screen.getByText('Awaiting decision')).toBeInTheDocument()
  })

  it('renders skipped dots', () => {
    const { container } = render(
      <OutcomeTimeline
        events={[
          { key: 'a', label: 'A', state: 'complete', timestamp: '2026-09-01T00:00:00Z' },
          { key: 'b', label: 'B', state: 'skipped' },
          { key: 'c', label: 'C', state: 'complete', timestamp: '2026-09-02T00:00:00Z' },
        ]}
      />,
    )
    expect(container.querySelector('[data-rec-timeline-state="skipped"]')).toBeTruthy()
  })
})
