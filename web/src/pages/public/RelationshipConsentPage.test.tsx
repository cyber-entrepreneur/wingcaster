// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { PublicConsentTerms } from '@/pages/agent/contacts/relationshipTypes'

const apiMocks = vi.hoisted(() => ({
  getPublicRelationshipConsent: vi.fn(),
  acceptPublicRelationshipConsent: vi.fn(),
  rejectPublicRelationshipConsent: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  API_BASE: '/api',
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

import { RelationshipConsentPage } from './RelationshipConsentPage'

function terms(overrides: Partial<PublicConsentTerms> = {}): PublicConsentTerms {
  return {
    purpose: 'relationship_consent',
    relationship_id: 'rel_1',
    contact_id: 'cnt_1',
    party_type: 'buyer',
    relationship_type: 'representation',
    exclusivity: 'exclusive',
    scope: { areas: ['dubai-marina'], property_types: ['apartment'] },
    starts_at: '2026-09-08T00:00:00.000Z',
    ends_at: '2027-03-08T00:00:00.000Z',
    status: 'pending',
    ...overrides,
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/public/relationships/consent" element={<RelationshipConsentPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RelationshipConsentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requires token query param and ignores other params for auth', async () => {
    renderAt('/public/relationships/consent?contactId=cnt_spoof&relationshipId=rel_spoof')
    await waitFor(() => {
      expect(screen.getByText(/Consent link is incomplete/i)).toBeInTheDocument()
    })
    expect(apiMocks.getPublicRelationshipConsent).not.toHaveBeenCalled()
    expect(screen.getByText(/signed token/i)).toBeInTheDocument()
  })

  it('loads terms with token-only auth and accepts', async () => {
    const user = userEvent.setup()
    apiMocks.getPublicRelationshipConsent.mockResolvedValue(terms())
    apiMocks.acceptPublicRelationshipConsent.mockResolvedValue({
      success: true,
      relationship: { ...terms(), status: 'confirmed', consent_record: { decision: 'accepted' } },
    })
    renderAt('/public/relationships/consent?token=signed.token.value&contactId=ignored')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Confirm this relationship/i })).toBeInTheDocument()
    })
    expect(apiMocks.getPublicRelationshipConsent).toHaveBeenCalledWith('signed.token.value')
    expect(apiMocks.getPublicRelationshipConsent).not.toHaveBeenCalledWith(
      expect.stringContaining('contactId'),
    )
    await user.click(screen.getByRole('button', { name: /Accept & confirm/i }))
    await waitFor(() => {
      expect(apiMocks.acceptPublicRelationshipConsent).toHaveBeenCalledWith('signed.token.value')
    })
    expect(screen.getByRole('heading', { name: /Relationship confirmed/i })).toBeInTheDocument()
  })

  it('rejects via token body only', async () => {
    const user = userEvent.setup()
    apiMocks.getPublicRelationshipConsent.mockResolvedValue(terms())
    apiMocks.rejectPublicRelationshipConsent.mockResolvedValue({
      success: true,
      relationship: { ...terms(), status: 'rejected' },
    })
    renderAt('/public/relationships/consent?token=tok_abc')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Decline/i }))
    await waitFor(() => {
      expect(apiMocks.rejectPublicRelationshipConsent).toHaveBeenCalledWith('tok_abc')
    })
    expect(screen.getByRole('heading', { name: /Relationship declined/i })).toBeInTheDocument()
  })

  it('surfaces expired token errors', async () => {
    apiMocks.getPublicRelationshipConsent.mockRejectedValue(
      Object.assign(new Error('expired'), { status: 410, code: 'expired' }),
    )
    renderAt('/public/relationships/consent?token=old')
    await waitFor(() => {
      expect(screen.getByText(/consent link has expired/i)).toBeInTheDocument()
    })
  })
})
