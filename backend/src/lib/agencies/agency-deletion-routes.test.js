import { beforeEach, describe, expect, it, vi } from 'vitest'

const service = vi.hoisted(() => ({
  getAgencyDeletionState: vi.fn(),
  regenerateAgencyDeletionWord: vi.fn(),
  initiateAgencyDeletion: vi.fn(),
  cancelAgencyDeletion: vi.fn(),
}))

vi.mock('./agency-deletion.js', () => ({
  ...service,
  AgencyDeletionError: class AgencyDeletionError extends Error {
    constructor(status, code, message) {
      super(message)
      this.status = status
      this.code = code
    }
  },
}))

let registerAgencyDeletionRoutes

beforeEach(async () => {
  vi.resetModules()
  Object.values(service).forEach((fn) => fn.mockReset())
  service.getAgencyDeletionState.mockResolvedValue({ agency: { id: 'agc_1' } })
  ;({ registerAgencyDeletionRoutes } = await import('./agency-deletion-routes.js'))
})

function makeApp() {
  const routes = []
  const app = {
    get(path, ...handlers) {
      routes.push({ method: 'get', path, handlers })
    },
    post(path, ...handlers) {
      routes.push({ method: 'post', path, handlers })
    },
  }
  return {
    app,
    async invoke(method, path, { body, userId = 'usr_owner' } = {}) {
      const route = routes.find((row) => row.method === method && row.path === path)
      const chain = route.handlers
      const handler = chain[chain.length - 1]
      const req = { params: { id: 'agc_1' }, body, user: { id: userId } }
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code
          return this
        },
        json(payload) {
          this.body = payload
          return this
        },
      }
      for (const middleware of chain.slice(0, -1)) {
        let nextCalled = false
        await middleware(req, res, () => {
          nextCalled = true
        })
        if (!nextCalled) return res
      }
      await handler(req, res)
      return res
    },
  }
}

describe('registerAgencyDeletionRoutes', () => {
  it('returns deletion state', async () => {
    const { app, invoke } = makeApp()
    registerAgencyDeletionRoutes(app, { auth: (_req, _res, next) => next?.() })
    const res = await invoke('get', '/api/agencies/:id/deletion/state')
    expect(res.statusCode).toBe(200)
    expect(service.getAgencyDeletionState).toHaveBeenCalled()
  })

})
