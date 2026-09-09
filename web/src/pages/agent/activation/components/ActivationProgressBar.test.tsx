// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivationProgressBar } from './ActivationProgressBar'

describe('ActivationProgressBar', () => {
  it('renders 0 of 5 complete with empty bar', () => {
    render(<ActivationProgressBar completed={0} total={5} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText(/complete/i)).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: 'Activation progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '5')
    expect(screen.queryByText(/You're activated/i)).not.toBeInTheDocument()
  })

  it('renders 3 of 5 complete', () => {
    render(<ActivationProgressBar completed={3} total={5} />)
    const bar = screen.getByRole('progressbar', { name: 'Activation progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '5')
    expect(screen.queryByText(/You're activated/i)).not.toBeInTheDocument()
  })

  it('does not celebrate at 5/5 unless celebrate is set (4→5 only)', () => {
    const { rerender } = render(<ActivationProgressBar completed={5} total={5} celebrate={false} />)
    expect(screen.queryByText(/You're activated/i)).not.toBeInTheDocument()
    rerender(<ActivationProgressBar completed={5} total={5} celebrate />)
    expect(screen.getByText(/You're activated/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('uses the provided total rather than a hardcoded count', () => {
    render(<ActivationProgressBar completed={2} total={4} />)
    const bar = screen.getByRole('progressbar', { name: 'Activation progress' })
    expect(bar).toHaveAttribute('aria-valuemax', '4')
    expect(bar).toHaveAttribute('aria-valuenow', '2')
  })
})
