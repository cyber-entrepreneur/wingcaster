declare module 'msw' {
  export const http: {
    get: (path: string, resolver: (info: { request: Request }) => unknown) => unknown
    post: (path: string, resolver: (info: { request: Request }) => unknown) => unknown
    patch: (path: string, resolver: (info: { request: Request }) => unknown) => unknown
    delete: (path: string, resolver: (info: { request: Request }) => unknown) => unknown
  }
  export const HttpResponse: {
    json: (body: unknown) => Response
  }
}

declare module 'msw/node' {
  export function setupServer(...handlers: unknown[]): {
    listen: (opts?: { onUnhandledRequest?: string }) => void
    resetHandlers: () => void
    close: () => void
  }
}
