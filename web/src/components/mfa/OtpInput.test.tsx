// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { OtpInput } from './OtpInput'

function ControlledOtp() {
  const [value, setValue] = useState('')
  return <OtpInput value={value} onChange={setValue} aria-label="6-digit verification code" />
}

describe('OtpInput digit announcement', () => {
  it('does not spam the live region on each single keystroke', async () => {
    const user = userEvent.setup()
    render(<ControlledOtp />)

    await user.type(screen.getByLabelText('Digit 1 of 6'), '1')
    expect(document.querySelector('[data-otp-announce]')).toHaveTextContent('')
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveAccessibleName('Digit 1 of 6')

    await user.type(screen.getByLabelText('Digit 2 of 6'), '2')
    expect(document.querySelector('[data-otp-announce]')).toHaveTextContent('')
  })

  it('announces a full 6-digit paste into the first cell', async () => {
    const user = userEvent.setup()
    render(<ControlledOtp />)
    const first = screen.getByLabelText('Digit 1 of 6')
    first.focus()
    await user.paste('847291')
    await waitFor(() => {
      expect(document.querySelector('[data-otp-announce]')).toHaveTextContent('6-digit code entered')
    })
    expect(screen.getByLabelText('Digit 6 of 6')).toHaveValue('1')
  })
})
