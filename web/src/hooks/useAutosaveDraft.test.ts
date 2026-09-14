// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAutosaveDraft } from './useAutosaveDraft'

const createProperty = vi.fn()
const updateProperty = vi.fn()

vi.mock('@/api/client', () => ({
  api: {
    createProperty: (...args: unknown[]) => createProperty(...args),
    updateProperty: (...args: unknown[]) => updateProperty(...args),
  },
}))

describe('useAutosaveDraft', () => {
  beforeEach(() => {
    createProperty.mockReset()
    updateProperty.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('POSTs on first saveNow when no property id, then PUTs on subsequent saves', async () => {
    createProperty.mockResolvedValue({ id: 'prop_1' })
    updateProperty.mockResolvedValue({ id: 'prop_1' })
    const onCreated = vi.fn()

    const { result, rerender } = renderHook(
      ({ form, id }) =>
        useAutosaveDraft({
          propertyId: id,
          formState: form,
          enabled: true,
          debounceMs: 60_000,
          onCreated,
        }),
      { initialProps: { form: { title: 'A' }, id: null as string | null } },
    )

    rerender({ form: { title: 'Marina Gate' }, id: null })
    result.current.markDirty()

    await act(async () => {
      const ok = await result.current.saveNow()
      expect(ok).toBe(true)
    })

    expect(createProperty).toHaveBeenCalledTimes(1)
    expect(createProperty.mock.calls[0][0]).toMatchObject({ title: 'Marina Gate', status: 'draft' })
    expect(result.current.propertyId).toBe('prop_1')
    expect(result.current.status).toBe('saved')
    expect(onCreated).toHaveBeenCalledWith('prop_1')

    rerender({ form: { title: 'Marina Gate 1' }, id: 'prop_1' })
    result.current.markDirty()

    await act(async () => {
      await result.current.saveNow()
    })

    expect(updateProperty).toHaveBeenCalled()
    expect(updateProperty.mock.calls[0][0]).toBe('prop_1')
    expect(updateProperty.mock.calls[0][1]).toMatchObject({ title: 'Marina Gate 1' })
  })

  it('exposes failed status when PUT rejects', async () => {
    updateProperty.mockRejectedValue(new Error('network'))
    // Swallow exponential-backoff retries scheduled by the hook
    vi.spyOn(window, 'setTimeout').mockReturnValue(0 as unknown as ReturnType<typeof setTimeout>)

    const { result, rerender } = renderHook(
      ({ form }) =>
        useAutosaveDraft({
          propertyId: 'prop_existing',
          formState: form,
          enabled: true,
          debounceMs: 60_000,
        }),
      { initialProps: { form: { title: 'One' } } },
    )

    rerender({ form: { title: 'Two' } })
    result.current.markDirty()

    await act(async () => {
      const ok = await result.current.saveNow()
      expect(ok).toBe(false)
    })

    expect(result.current.status).toBe('failed')
    expect(result.current.error).toMatch(/network/i)
  })

  it('debounced idle typing triggers autosave (happy path)', async () => {
    vi.useFakeTimers()
    createProperty.mockResolvedValue({ id: 'prop_debounce' })

    const { result, rerender } = renderHook(
      ({ form }) =>
        useAutosaveDraft({
          propertyId: null,
          formState: form,
          enabled: true,
          debounceMs: 50,
        }),
      { initialProps: { form: { title: 'Start' } } },
    )

    rerender({ form: { title: 'After typing' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
      // flush microtasks from the promise returned by createProperty
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(createProperty).toHaveBeenCalledTimes(1)
    expect(result.current.propertyId).toBe('prop_debounce')
    expect(result.current.status).toBe('saved')
  })
})
