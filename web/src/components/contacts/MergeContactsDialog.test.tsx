// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'

const apiMocks = vi.hoisted(() => ({
  mergeContacts: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
}))

import { MergeContactsDialog } from './MergeContactsDialog'

const source = {
  id: 'cnt_a',
  name: 'Alice',
  email: 'alice@example.com',
  phone: '+1',
  status: 'lead',
  source: 'portal',
  tags: [],
}

const target = {
  id: 'cnt_b',
  name: 'Alicia',
  email: 'alicia@example.com',
  phone: '+2',
  status: 'client',
  source: 'whatsapp',
  tags: ['buyer'],
}

function renderDialog(props: Partial<Parameters<typeof MergeContactsDialog>[0]> = {}) {
  const onMerged = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <ToastProvider>
      <MergeContactsDialog
        open
        onOpenChange={onOpenChange}
        sourceContact={source}
        presetTarget={target}
        contacts={[source, target]}
        onMerged={onMerged}
        {...props}
      />
    </ToastProvider>,
  )
  return { onMerged, onOpenChange }
}

beforeEach(() => {
  apiMocks.mergeContacts.mockReset()
  apiMocks.mergeContacts.mockResolvedValue({ ...source, name: 'Alicia' })
})

afterEach(() => cleanup())

describe('MergeContactsDialog', () => {
  it('shows irreversible warning and field diff', () => {
    renderDialog()
    expect(screen.getByRole('alert')).toHaveTextContent(/irreversible/i)
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Alicia').length).toBeGreaterThan(0)
    expect(screen.getByText(/Preview/i)).toBeInTheDocument()
  })

  it('submits merge with field selections', async () => {
    const user = userEvent.setup()
    const { onMerged } = renderDialog()
    await user.click(screen.getByRole('radio', { name: /Alicia/ }))
    await user.click(screen.getByRole('button', { name: /Merge contacts/i }))
    await waitFor(() => {
      expect(apiMocks.mergeContacts).toHaveBeenCalledWith('cnt_a', {
        target_contact_id: 'cnt_b',
        field_selections: expect.objectContaining({ name: 'target' }),
      })
    })
    expect(onMerged).toHaveBeenCalled()
  })

  it('searches for duplicate when no preset target', async () => {
    const user = userEvent.setup()
    renderDialog({ presetTarget: null })
    expect(screen.getByLabelText(/Find duplicate/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Alicia/ }))
    expect(screen.getByText(/keeps record/i)).toBeInTheDocument()
  })
})

describe('MergeContactsDialog RTL', () => {
  it('uses logical layout classes only', () => {
    const { container } = render(
      <ToastProvider>
        <div dir="rtl">
          <MergeContactsDialog
            open
            onOpenChange={() => undefined}
            sourceContact={source}
            presetTarget={target}
            contacts={[source, target]}
            onMerged={() => undefined}
          />
        </div>
      </ToastProvider>,
    )
    expect(container.innerHTML).not.toMatch(/\bml-\d|\bmr-\d|\bpl-\d|\bpr-\d|\btext-left|\btext-right\b/)
  })
})
