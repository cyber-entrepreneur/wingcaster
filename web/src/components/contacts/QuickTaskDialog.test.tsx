// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({ createTask: vi.fn() }))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/api/client', () => ({ api: apiMocks }))

import { QuickTaskDialog } from '@/components/contacts/QuickTaskDialog'

beforeEach(() => {
  addToast.mockReset()
  apiMocks.createTask.mockReset().mockResolvedValue({ id: 't1' })
})
afterEach(() => vi.restoreAllMocks())

describe('QuickTaskDialog', () => {
  it('blocks save without a title', async () => {
    render(<QuickTaskDialog open onOpenChange={vi.fn()} contact={{ id: 'c1', name: 'Ada' }} defaultType="meeting" />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(apiMocks.createTask).not.toHaveBeenCalled()
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
  })

  it('creates a meeting task linked to the contact with a composed due_at', async () => {
    const onOpenChange = vi.fn()
    render(<QuickTaskDialog open onOpenChange={onOpenChange} contact={{ id: 'c1', name: 'Ada' }} defaultType="meeting" />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Marina viewing' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '14:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(apiMocks.createTask).toHaveBeenCalledTimes(1))
    const payload = apiMocks.createTask.mock.calls[0][0]
    expect(payload).toMatchObject({ contact_id: 'c1', type: 'meeting', title: 'Marina viewing', priority: 'normal' })
    expect(typeof payload.due_at).toBe('string')
    expect(Number.isFinite(new Date(payload.due_at as string).getTime())).toBe(true)
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
