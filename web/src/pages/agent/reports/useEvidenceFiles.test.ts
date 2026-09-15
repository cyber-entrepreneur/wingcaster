// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { EVIDENCE_MAX_BYTES } from './constants'

const apiMock = vi.hoisted(() => ({
  uploadPricingEvidence: vi.fn(),
  deletePricingEvidence: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))

import { useEvidenceFiles } from './useEvidenceFiles'

function makeFile(name: string, size: number, type = 'image/png') {
  const buf = new Uint8Array(Math.min(size, 64))
  const file = new File([buf], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('useEvidenceFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.uploadPricingEvidence.mockResolvedValue({
      id: 'server-1',
      url: '/api/pricing/evidence-uploads/server-1?token=t',
      sha256: 'b'.repeat(64),
      content_type: 'image/png',
      size_bytes: 32,
    })
    apiMock.deletePricingEvidence.mockResolvedValue({ deleted: true, id: 'server-1' })
  })

  it('uploads and captures id/url/sha256 on complete', async () => {
    const { result } = renderHook(() => useEvidenceFiles({ maxFiles: 3, locale: 'en' }))
    const file = makeFile('proof.png', 32)

    act(() => {
      result.current.onAdd([file])
    })

    expect(result.current.uploading).toBe(true)
    await waitFor(() => expect(result.current.uploading).toBe(false))
    expect(result.current.completeIds).toEqual(['server-1'])
    expect(result.current.files[0]?.server_url).toContain('token=')
    expect(result.current.files[0]?.sha256).toHaveLength(64)
    expect(apiMock.uploadPricingEvidence).toHaveBeenCalled()
  })

  it('rejects oversized files with EN toast and AR copy available', async () => {
    const onTooLarge = vi.fn()
    const { result } = renderHook(() =>
      useEvidenceFiles({
        maxFiles: 3,
        locale: 'ar',
        tooLargeCopy: {
          en: 'File too large — 10 MB max.',
          ar: 'الملف كبير جدًا — الحد الأقصى 10 ميجابايت.',
        },
        onTooLarge,
      }),
    )

    act(() => {
      result.current.onAdd([makeFile('huge.png', EVIDENCE_MAX_BYTES + 1)])
    })

    expect(onTooLarge).toHaveBeenCalledWith('الملف كبير جدًا — الحد الأقصى 10 ميجابايت.')
    expect(result.current.files[0]?.status).toBe('error')
    expect(apiMock.uploadPricingEvidence).not.toHaveBeenCalled()
  })

  it('retries a failed upload', async () => {
    apiMock.uploadPricingEvidence
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        id: 'server-2',
        url: '/api/pricing/evidence-uploads/server-2?token=t',
        sha256: 'c'.repeat(64),
        content_type: 'image/png',
        size_bytes: 16,
      })

    const { result } = renderHook(() => useEvidenceFiles(2))
    const file = makeFile('retry.png', 16)

    act(() => {
      result.current.onAdd([file])
    })
    await waitFor(() => expect(result.current.files[0]?.status).toBe('error'))

    const failedId = result.current.files[0]!.id
    await act(async () => {
      await result.current.retry(failedId)
    })
    await waitFor(() => expect(result.current.files[0]?.status).toBe('complete'))
    expect(result.current.completeIds).toEqual(['server-2'])
  })

  it('delete-uploaded removes local tile and calls DELETE', async () => {
    const { result } = renderHook(() => useEvidenceFiles(2))
    act(() => {
      result.current.onAdd([makeFile('gone.png', 8)])
    })
    await waitFor(() => expect(result.current.completeIds).toEqual(['server-1']))

    await act(async () => {
      await result.current.onRemove('server-1')
    })
    expect(result.current.files).toHaveLength(0)
    expect(apiMock.deletePricingEvidence).toHaveBeenCalledWith('server-1')
  })
})
