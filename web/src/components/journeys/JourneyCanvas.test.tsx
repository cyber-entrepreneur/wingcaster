// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JourneyCanvas, emptyJourneyGraph } from './JourneyCanvas'

describe('JourneyCanvas', () => {
  it('renders trigger and exit and can add a condition node', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<JourneyCanvas graph={emptyJourneyGraph()} onChange={onChange} />)

    expect(screen.getByRole('application', { name: /journey canvas/i })).toBeInTheDocument()
    expect(screen.getByText('n_trigger')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /condition/i }))
    expect(onChange).toHaveBeenCalled()
    const calls = onChange.mock.calls
    const next = calls[calls.length - 1]?.[0]
    expect(next.nodes.some((n: { type: string }) => n.type === 'condition')).toBe(true)
  })
})
