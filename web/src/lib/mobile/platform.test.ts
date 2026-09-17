import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * Platform-detect suite.
 *
 * `@capacitor/core` is a real dep in this repo but it inspects `window` and
 * a global at module load. To keep the tests deterministic we mock the
 * `Capacitor` export per test.
 */

const capacitorMock = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web' as string),
  isPluginAvailable: vi.fn(() => false),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: capacitorMock }))

beforeEach(() => {
  capacitorMock.isNativePlatform.mockReturnValue(false)
  capacitorMock.getPlatform.mockReturnValue('web')
  capacitorMock.isPluginAvailable.mockReturnValue(false)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('platform detection', () => {
  it('reports web when not on a native platform', async () => {
    const mod = await import('./platform')
    expect(mod.isNativePlatform()).toBe(false)
    expect(mod.isWebPlatform()).toBe(true)
    expect(mod.getPlatform()).toBe('web')
    expect(mod.isIOS()).toBe(false)
    expect(mod.isAndroid()).toBe(false)
  })

  it('reports ios inside the iOS shell', async () => {
    capacitorMock.isNativePlatform.mockReturnValue(true)
    capacitorMock.getPlatform.mockReturnValue('ios')
    const mod = await import('./platform')
    expect(mod.isNativePlatform()).toBe(true)
    expect(mod.getPlatform()).toBe('ios')
    expect(mod.isIOS()).toBe(true)
    expect(mod.isAndroid()).toBe(false)
  })

  it('reports android inside the Android shell', async () => {
    capacitorMock.isNativePlatform.mockReturnValue(true)
    capacitorMock.getPlatform.mockReturnValue('android')
    const mod = await import('./platform')
    expect(mod.isAndroid()).toBe(true)
    expect(mod.isIOS()).toBe(false)
  })

  it('normalises any unknown platform string back to web', async () => {
    capacitorMock.getPlatform.mockReturnValue('electron')
    const mod = await import('./platform')
    expect(mod.getPlatform()).toBe('web')
  })

  it('proxies isPluginAvailable', async () => {
    capacitorMock.isPluginAvailable.mockReturnValue(true)
    const mod = await import('./platform')
    expect(mod.isPluginAvailable('Camera')).toBe(true)
    expect(capacitorMock.isPluginAvailable).toHaveBeenCalledWith('Camera')
  })

  it('onPlatform routes to the native handler when native', async () => {
    capacitorMock.isNativePlatform.mockReturnValue(true)
    const mod = await import('./platform')
    const native = vi.fn(async () => 'native-result')
    const web = vi.fn(async () => 'web-result')
    const result = await mod.onPlatform({ native, web })
    expect(result).toBe('native-result')
    expect(native).toHaveBeenCalledTimes(1)
    expect(web).not.toHaveBeenCalled()
  })

  it('onPlatform routes to the web handler on the browser', async () => {
    const mod = await import('./platform')
    const native = vi.fn(async () => 'native-result')
    const web = vi.fn(async () => 'web-result')
    const result = await mod.onPlatform({ native, web })
    expect(result).toBe('web-result')
    expect(web).toHaveBeenCalledTimes(1)
    expect(native).not.toHaveBeenCalled()
  })

  it('onPlatform accepts sync handlers', async () => {
    const mod = await import('./platform')
    const result = await mod.onPlatform({
      native: () => 'n',
      web: () => 'w',
    })
    expect(result).toBe('w')
  })
})
