// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

import { ContactQuickActionBar } from '@/components/contacts/ContactQuickActionBar'

afterEach(() => cleanup())

function setup() {
  const h = { onNote: vi.fn(), onTask: vi.fn(), onMeeting: vi.fn(), onNewDeal: vi.fn(), onMerge: vi.fn(), onDelete: vi.fn() }
  render(
    <ContactQuickActionBar
      contact={{ id: 'c1', name: 'Ada', email: 'ada@x.com', phone: '+111', socials: { whatsapp: '+222' } }}
      {...h}
    />,
  )
  return h
}

describe('ContactQuickActionBar', () => {
  it('renders primary contact deep links', () => {
    setup()
    expect(screen.getByRole('link', { name: /Email/ })).toHaveAttribute('href', 'mailto:ada@x.com')
    expect(screen.getByRole('link', { name: /Call/ })).toHaveAttribute('href', 'tel:+111')
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/222')
  })

  it('fires the CRM verb callbacks', () => {
    const h = setup()
    fireEvent.click(screen.getByRole('button', { name: /^Note$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Task$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Meeting$/ }))
    fireEvent.click(screen.getByRole('button', { name: /New deal/ }))
    expect(h.onNote).toHaveBeenCalled()
    expect(h.onTask).toHaveBeenCalled()
    expect(h.onMeeting).toHaveBeenCalled()
    expect(h.onNewDeal).toHaveBeenCalled()
  })

  it('omits deep links with no data', () => {
    const h = { onNote: vi.fn(), onTask: vi.fn(), onMeeting: vi.fn(), onNewDeal: vi.fn(), onMerge: vi.fn(), onDelete: vi.fn() }
    render(<ContactQuickActionBar contact={{ id: 'c1', name: 'NoReach' }} {...h} />)
    expect(screen.queryByRole('link', { name: /Email/ })).not.toBeInTheDocument()
    // Verbs are always present.
    expect(screen.getByRole('button', { name: /New deal/ })).toBeInTheDocument()
  })
})
