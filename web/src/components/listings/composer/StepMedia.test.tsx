// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StepMedia } from './StepMedia'
import { emptyComposerForm, type ComposerFormState } from './types'

describe('StepMedia dnd + hero', () => {
  it('exposes reorder handles and set-as-hero beyond the first photo', () => {
    let form: ComposerFormState = {
      ...emptyComposerForm(),
      photos: [
        { id: 'a', url: 'https://cdn.example/a.jpg', alt_text: 'A', isHero: true },
        { id: 'b', url: 'https://cdn.example/b.jpg', alt_text: 'B', isHero: false },
        { id: 'c', url: 'https://cdn.example/c.jpg', alt_text: 'C', isHero: false },
      ],
    }

    const onChange = vi.fn((key: keyof ComposerFormState, value: ComposerFormState[typeof key]) => {
      form = { ...form, [key]: value } as ComposerFormState
    })

    const { rerender } = render(
      <StepMedia form={form} errors={{}} onChange={onChange} />,
    )

    expect(screen.getByLabelText(/reorder photo 1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/reorder photo 2/i)).toBeInTheDocument()
    expect(screen.getByText('Hero')).toBeInTheDocument()

    fireEvent.click(screen.getAllByLabelText(/set as hero photo/i)[0])
    expect(onChange).toHaveBeenCalled()
    const nextPhotos = onChange.mock.calls[0][1] as ComposerFormState['photos']
    expect(nextPhotos[0].id).toBe('b')
    expect(nextPhotos[0].isHero).toBe(true)

    form = { ...form, photos: nextPhotos }
    rerender(<StepMedia form={form} errors={{}} onChange={onChange} />)
    expect(screen.getAllByText('Hero').length).toBe(1)
  })
})
