// @vitest-environment jsdom
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewToggleGroup, type ViewMode } from './ViewToggle'
import { StatusPill } from './StatusPill'
import { InquiriesBadge } from './InquiriesBadge'

describe('listings list primitives', () => {
  it('preserves viewMode union card | list | gallery', async () => {
    const user = userEvent.setup()
    const modes: ViewMode[] = []

    function Harness() {
      const [active, setActive] = useState<ViewMode>('card')
      return (
        <ViewToggleGroup
          active={active}
          onSelect={(m) => {
            modes.push(m)
            setActive(m)
          }}
        />
      )
    }

    render(<Harness />)

    expect(screen.getByRole('group', { name: /view mode/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /list view/i }))
    await user.click(screen.getByRole('button', { name: /gallery view/i }))
    expect(modes).toEqual(['list', 'gallery'])
  })

  it('StatusPill renders glyph + label', () => {
    render(<StatusPill status="published" />)
    expect(screen.getByLabelText(/status: published/i)).toBeInTheDocument()
  })

  it('InquiriesBadge hides when count is 0', () => {
    const { container } = render(<InquiriesBadge count={0} />)
    expect(container).toBeEmptyDOMElement()
    render(<InquiriesBadge count={3} />)
    expect(screen.getByLabelText(/3 new inquiries/i)).toBeInTheDocument()
  })
})
