// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PathSelector } from './PathSelector'

describe('PathSelector', () => {
  it('renders three path cards with brief copy', () => {
    render(<PathSelector value={null} onChange={() => undefined} />)
    expect(screen.getByText('Who is signing up?')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Solo agent/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Agent joining an agency/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Agency owner/i })).toBeInTheDocument()
  })

  it('selects a path on click and announces', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PathSelector value={null} onChange={onChange} />)
    await user.click(screen.getByTestId('path-card-solo'))
    expect(onChange).toHaveBeenCalledWith('solo')
  })

  it('marks selected card aria-checked', () => {
    render(<PathSelector value="join" onChange={() => undefined} />)
    expect(screen.getByTestId('path-card-join')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('path-card-solo')).toHaveAttribute('aria-checked', 'false')
  })
})
