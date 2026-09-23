// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

import { ContactRowActions } from '@/components/contacts/ContactRowActions'

// Radix menus need these in jsdom.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})
afterEach(() => { cleanup(); navigate.mockReset() })

function setup(overrides: Record<string, unknown> = {}) {
  const handlers = { onNewDeal: vi.fn(), onSchedule: vi.fn(), onMerge: vi.fn(), onDelete: vi.fn() }
  render(
    <ContactRowActions
      contact={{ id: 'c1', name: 'Ada', email: 'ada@x.com', phone: '+111', socials: { whatsapp: '+222' }, ...overrides }}
      {...handlers}
    />,
  )
  return handlers
}

describe('ContactRowActions', () => {
  it('opens and shows contact deep links only for available channels', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Actions for Ada' }))
    expect(await screen.findByRole('menuitem', { name: /Email ada@x\.com/ })).toHaveAttribute('href', 'mailto:ada@x.com')
    expect(screen.getByRole('menuitem', { name: /Call \+111/ })).toHaveAttribute('href', 'tel:+111')
    expect(screen.getByRole('menuitem', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/222')
    // No Telegram data → no Telegram item.
    expect(screen.queryByRole('menuitem', { name: /Telegram/ })).not.toBeInTheDocument()
  })

  it('fires the dialog callbacks', async () => {
    const user = userEvent.setup()
    const h = setup()
    await user.click(screen.getByRole('button', { name: 'Actions for Ada' }))
    await user.click(await screen.findByRole('menuitem', { name: /Schedule meeting/ }))
    expect(h.onSchedule).toHaveBeenCalledWith('meeting')

    await user.click(screen.getByRole('button', { name: 'Actions for Ada' }))
    await user.click(screen.getByRole('menuitem', { name: /New deal/ }))
    expect(h.onNewDeal).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Actions for Ada' }))
    await user.click(screen.getByRole('menuitem', { name: /^Delete/ }))
    expect(h.onDelete).toHaveBeenCalled()
  })

  it('navigates to edit', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Actions for Ada' }))
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }))
    expect(navigate).toHaveBeenCalledWith('/contacts/c1/edit')
  })

  it('renders no ⋯ contact section when there is nothing to reach', async () => {
    const user = userEvent.setup()
    setup({ email: '', phone: '', socials: {} })
    await user.click(screen.getByRole('button', { name: 'Actions for Ada' }))
    // Still has meeting/deal actions, but no mailto/tel links.
    expect(await screen.findByRole('menuitem', { name: /Schedule meeting/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /^Email/ })).not.toBeInTheDocument()
  })
})
