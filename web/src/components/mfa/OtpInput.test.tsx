// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { OtpInput } from './OtpInput'

function ControlledOtp() {
  const [value, setValue] = useState('')
  return <OtpInput value={value} onChange={setValue} aria-label="6-digit verification code" />
}

describe('OtpInput digit announcement', () => {
  it('announces digit progression as the user types', async () => {
    const user = userEvent.setup()
    render(<ControlledOtp />)

    await user.type(screen.getByLabelText('Digit 1 of 6'), '1')
    expect(document.querySelector('[data-otp-announce]')).toHaveTextContent('Digit 1 of 6')

    await user.type(screen.getByLabelText('Digit 2 of 6'), '2')
    expect(document.querySelector('[data-otp-announce]')).toHaveTextContent('Digit 2 of 6')
  })

  it('announces a full 6-digit paste into the first cell', async () => {
    const user = userEvent.setup()
    render(<ControlledOtp />)
    const first = screen.getByLabelText('Digit 1 of 6')
    first.focus()
    await user.paste('847291')
    expect(document.querySelector('[data-otp-announce]')).toHaveTextContent('6-digit code entered')
    expect(screen.getByLabelText('Digit 6 of 6')).toHaveValue('1')
  })
})
