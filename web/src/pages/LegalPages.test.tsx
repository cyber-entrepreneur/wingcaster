// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RefundPolicyPage } from './RefundPolicyPage'
import { CookieNoticePage } from './CookieNoticePage'

afterEach(() => cleanup())

describe('SHR-LEG-003 Refund Policy', () => {
  it('renders the heading and the key sections a Paddle MoR refund policy needs', () => {
    render(<RefundPolicyPage />)
    expect(screen.getByRole('heading', { level: 1, name: /Refund Policy/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Subscriptions/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Credits and top-ups/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /How to request a refund/i })).toBeInTheDocument()
    // Names the merchant of record
    expect(screen.getAllByText(/Paddle/i).length).toBeGreaterThan(0)
  })
})

describe('SHR-LEG-004 Cookie & Data Processing Notice', () => {
  it('renders the heading and cookie/processing sections', () => {
    render(<CookieNoticePage />)
    expect(
      screen.getByRole('heading', { level: 1, name: /Cookie & Data Processing Notice/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /What cookies we use/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Processors we rely on/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Your rights/i })).toBeInTheDocument()
  })
})
