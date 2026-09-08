// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  EMPTY_IDENTITY_FORM_VALUES,
  IdentityForm,
  estimatePasswordStrength,
  isIdentityFormValid,
  isEmailValid,
  isPasswordAcceptable,
} from './IdentityForm'

describe('estimatePasswordStrength', () => {
  it('bands weak → fair → strong → excellent', () => {
    expect(estimatePasswordStrength('')).toBe('empty')
    expect(estimatePasswordStrength('abc')).toBe('weak')
    expect(estimatePasswordStrength('abcdefghijkl')).toBe('fair') // len>=8 + len>=12
    expect(estimatePasswordStrength('Abcdefgh1')).toBe('strong')
    expect(estimatePasswordStrength('Abcdefgh1!')).toBe('excellent')
  })
})

describe('isIdentityFormValid', () => {
  it('requires terms + fair password + email in full mode', () => {
    const base = {
      ...EMPTY_IDENTITY_FORM_VALUES,
      email: 'sara@example.com',
      password: 'Abcdefgh1!',
      consent_terms: true,
    }
    expect(isIdentityFormValid(base, { variant: 'full', identifier_type: 'email' })).toBe(true)
    expect(
      isIdentityFormValid(
        { ...base, consent_terms: false },
        { variant: 'full', identifier_type: 'email' },
      ),
    ).toBe(false)
    expect(
      isIdentityFormValid({ ...base, password: 'abc' }, { variant: 'full', identifier_type: 'email' }),
    ).toBe(false)
  })

  it('compact requires display_name + email', () => {
    const values = {
      ...EMPTY_IDENTITY_FORM_VALUES,
      display_name: 'Sara',
      email: 'sara@example.com',
      password: 'Abcdefgh1!',
      consent_terms: true,
    }
    expect(isIdentityFormValid(values, { variant: 'compact', identifier_type: 'email' })).toBe(
      true,
    )
    expect(
      isIdentityFormValid(
        { ...values, display_name: '' },
        { variant: 'compact', identifier_type: 'email' },
      ),
    ).toBe(false)
  })

  it('username requires recovery identifier', () => {
    const values = {
      ...EMPTY_IDENTITY_FORM_VALUES,
      username: 'sara.al',
      password: 'Abcdefgh1!',
      consent_terms: true,
    }
    expect(isIdentityFormValid(values, { variant: 'full', identifier_type: 'username' })).toBe(
      false,
    )
    expect(
      isIdentityFormValid(
        { ...values, recovery_email: 'sara@example.com' },
        { variant: 'full', identifier_type: 'username' },
      ),
    ).toBe(true)
  })
})

describe('IdentityForm full variant', () => {
  it('hides Continue until valid; shows tabs and strength', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const Wrapper = () => {
      const [values, setValues] = React.useState({ ...EMPTY_IDENTITY_FORM_VALUES })
      const [tab, setTab] = React.useState<'email' | 'username' | 'phone'>('email')
      return (
        <IdentityForm
          variant="full"
          values={values}
          identifier_type={tab}
          onChange={setValues}
          onIdentifierTypeChange={setTab}
          onSubmit={onSubmit}
        />
      )
    }

    render(<Wrapper />)

    expect(screen.getByRole('button', { name: 'Continue →' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: /^Email$/i })).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'sara@example.com')
    await user.type(screen.getByPlaceholderText('Choose a strong password'), 'Abcdefgh1!')
    expect(screen.getByText(/Password strength: Excellent/i)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /Terms of Service/i }))
    expect(screen.getByRole('button', { name: 'Continue →' })).not.toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Continue →' }))
    expect(onSubmit).toHaveBeenCalled()
  })
})

describe('IdentityForm compact variant', () => {
  it('shows name + email without identifier tabs', () => {
    render(
      <IdentityForm
        variant="compact"
        values={EMPTY_IDENTITY_FORM_VALUES}
        onChange={() => undefined}
      />,
    )
    expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Your email/i)).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^Username$/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/product updates and MENA/i)).not.toBeInTheDocument()
  })
})

describe('helpers', () => {
  it('validates email and password floor', () => {
    expect(isEmailValid('a@b.co')).toBe(true)
    expect(isEmailValid('nope')).toBe(false)
    expect(isPasswordAcceptable('weak')).toBe(false)
    expect(isPasswordAcceptable('abcdefghijkl')).toBe(true)
  })
})
