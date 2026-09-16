// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { TypeToConfirmInput, phraseMatches } from './type-to-confirm-input'

function Harness({ phrase = 'quiet-copper-lantern-drift' }: { phrase?: string }) {
  const [value, setValue] = useState('')
  return (
    <TypeToConfirmInput
      phrase={phrase}
      value={value}
      onValueChange={setValue}
      renderLabel={(node) => <>Type {node} to confirm</>}
      helper="Case-sensitive."
      mismatchText="Doesn't match. Type the phrase exactly."
    />
  )
}

describe('phraseMatches', () => {
  it('is case-sensitive and trims only outer whitespace', () => {
    expect(phraseMatches('abc-def', 'abc-def')).toBe(true)
    expect(phraseMatches('  abc-def  ', 'abc-def')).toBe(true)
    expect(phraseMatches('Abc-def', 'abc-def')).toBe(false)
    expect(phraseMatches('abc-deff', 'abc-def')).toBe(false)
  })
})

describe('TypeToConfirmInput', () => {
  it('shows neutral state when empty, mismatch on typo, match on exact', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('data-ttc-state', 'empty')
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.change(input, { target: { value: 'quiet-copper-lantern-driftt' } })
    expect(input).toHaveAttribute('data-ttc-state', 'mismatch')
    expect(screen.getByRole('alert')).toHaveTextContent(/doesn't match/i)

    fireEvent.change(input, { target: { value: 'quiet-copper-lantern-drift' } })
    expect(input).toHaveAttribute('data-ttc-state', 'match')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('disables autocomplete + spellcheck (no password-manager fill)', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAttribute('spellcheck', 'false')
  })
})
