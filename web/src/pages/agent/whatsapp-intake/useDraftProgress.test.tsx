// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useDraftProgress } from './useDraftProgress'

type EsHandler = EventListenerOrEventListenerObject

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  onerror: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  closed = false
  private listeners = new Map<string, EsHandler[]>()

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, cb: EsHandler) {
    const list = this.listeners.get(type) ?? []
    list.push(cb)
    this.listeners.set(type, list)
  }

  close() {
    this.closed = true
  }

  emit(type: string, data: unknown) {
    const evt = new MessageEvent(type, { data: JSON.stringify({ type, ...(data as object) }) })
    const list = this.listeners.get(type) ?? []
    for (const cb of list) {
      if (typeof cb === 'function') cb(evt)
      else cb.handleEvent(evt)
    }
    if (type === 'message' && this.onmessage) this.onmessage(evt)
  }

  fail() {
    this.onerror?.(new Event('error'))
  }
}

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    }),
  )
}

function headResponse(status: number, headers?: Record<string, string>) {
  return Promise.resolve(new Response(null, { status, headers }))
}

const fetchMock = vi.fn()

function Harness({ sessionId }: { sessionId: string }) {
  const p = useDraftProgress(sessionId)
  return (
    <div>
      <span data-testid="transport">{p.transport}</span>
      <span data-testid="connection">{p.connection}</span>
      <span data-testid="ready">{String(p.isReady)}</span>
      <span data-testid="completed">{p.completedCount}</span>
    </div>
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  MockEventSource.instances = []
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('EventSource', MockEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useDraftProgress degradation', () => {
  it('prefers SSE when HEAD advertises it — and does not invent fields on a timer', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('progress-capability')) {
        return jsonResponse({ mode: 'sse', sse: true, poll: true, poll_interval_ms: 3000 })
      }
      if (u.includes('/progress') && init?.method === 'HEAD') {
        return headResponse(200, { 'X-Draft-Progress-SSE': '1' })
      }
      return jsonResponse({ error: 'unexpected' }, 500)
    })
    render(<Harness sessionId="sess-sse" />)
    await waitFor(() => expect(screen.getByTestId('transport')).toHaveTextContent('sse'))
    expect(MockEventSource.instances.length).toBe(1)
    expect(screen.getByTestId('completed')).toHaveTextContent('0')
  })

  it('falls back to polling when SSE HEAD is 404', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('progress-capability')) {
        return jsonResponse({ mode: 'poll', sse: false, poll: true, poll_interval_ms: 3000 })
      }
      if (u.includes('/progress') && init?.method === 'HEAD') {
        return headResponse(404, { 'X-Draft-Progress-SSE': '0' })
      }
      if (u.includes('/state')) {
        return jsonResponse({
          draft_ready: false,
          fields: [
            { key: 'address', state: 'thinking' },
            { key: 'bedrooms', state: 'idle' },
          ],
        })
      }
      return jsonResponse({})
    })
    render(<Harness sessionId="sess-poll" />)
    await waitFor(() => expect(screen.getByTestId('transport')).toHaveTextContent('polling'))
    expect(screen.getByTestId('connection')).toHaveTextContent('polling')
    expect(MockEventSource.instances.length).toBe(0)
  })

  it('degrades EventSource errors to polling, then spinner after poll failures — never fake-streams', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('progress-capability')) {
        return jsonResponse({ mode: 'sse', sse: true, poll: true, poll_interval_ms: 3000 })
      }
      if (u.includes('/progress') && init?.method === 'HEAD') {
        return headResponse(200, { 'X-Draft-Progress-SSE': '1' })
      }
      if (u.includes('/state')) {
        return jsonResponse({ error: 'nope' }, 500)
      }
      return jsonResponse({})
    })
    render(<Harness sessionId="sess-degrade" />)
    await waitFor(() => expect(MockEventSource.instances.length).toBe(1))
    MockEventSource.instances[0].fail()
    await waitFor(() => expect(screen.getByTestId('transport')).toHaveTextContent('fallback'))
    expect(screen.getByTestId('connection')).toHaveTextContent('fallback')
  })

  it('falls straight to determinate spinner when neither SSE nor poll snapshots work', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('progress-capability')) return jsonResponse({}, 404)
      if (u.includes('/progress') && init?.method === 'HEAD') return headResponse(503)
      if (u.includes('/state')) return jsonResponse({ error: 'missing' }, 404)
      return jsonResponse({}, 404)
    })
    render(<Harness sessionId="sess-none" />)
    await waitFor(() => expect(screen.getByTestId('transport')).toHaveTextContent('fallback'))
    expect(MockEventSource.instances.length).toBe(0)
    expect(screen.getByTestId('completed')).toHaveTextContent('0')
  })
})
