// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResolverMessage } from './ResolverMessage'

describe('ResolverMessage', () => {
  it('always renders the card for empty messages', () => {
    render(
      <ResolverMessage
        resolver={{ display_name: 'Ahmad Khoury', role_label: 'Owner' }}
        decided_at="2026-09-07T14:22:15Z"
        message={null}
      />,
    )
    expect(screen.getByText('No message provided.')).toBeInTheDocument()
    expect(screen.getByText('Ahmad Khoury')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
  })

  it('renders markdown subset links and strips headings', () => {
    render(
      <ResolverMessage
        resolver={{ display_name: 'Ahmad Khoury', role_label: 'Owner' }}
        decided_at="2026-09-07T14:22:15Z"
        message={'# Secret\n\nWelcome to Elite. [Ping me](https://example.com).'}
      />,
    )
    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Ping me/i })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
