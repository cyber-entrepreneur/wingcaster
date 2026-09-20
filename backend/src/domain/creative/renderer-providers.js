/**
 * Creative Asset Service — renderer provider interface.
 *
 * Bannerbear and the built-in local renderer are interchangeable backends.
 * Feature code must only call through createRendererProvider().
 */

import { renderSocialCard } from '../../modules/social-cards/renderer.js'
import { renderBannerbearCard } from '../../modules/social-cards/bannerbear-adapter.js'
import { PLATFORM_DIMENSIONS } from '../../modules/social-cards/dimensions.js'

/**
 * @typedef {object} RenderRenditionInput
 * @property {object} template
 * @property {object} listing
 * @property {object} agent
 * @property {object|null} brand
 * @property {string} platform
 * @property {string} storageRoot
 * @property {string} publicBaseUrl
 * @property {object} [creditContext]
 * @property {string} [tenantId]
 */

/**
 * @typedef {object} RenderRenditionResult
 * @property {string} asset_url
 * @property {number} width
 * @property {number} height
 * @property {string} provider
 * @property {object} [meta]
 */

export function createRendererProvider(providerName = 'local') {
  if (providerName === 'bannerbear') return new BannerbearRendererProvider()
  return new LocalRendererProvider()
}

export class LocalRendererProvider {
  get name() {
    return 'local'
  }

  async renderRendition(input) {
    const asset = await renderSocialCard({
      template: input.template,
      listing: input.listing,
      agent: input.agent,
      brand: input.brand,
      platform: input.platform,
      storageRoot: input.storageRoot,
      publicBaseUrl: input.publicBaseUrl,
      creditContext: input.creditContext,
      tenantId: input.tenantId,
      __charged: true,
    })
    const dims = PLATFORM_DIMENSIONS[input.platform]
    return {
      asset_url: asset.url,
      width: asset.dimensions?.width || dims?.width || 1080,
      height: asset.dimensions?.height || dims?.height || 1080,
      provider: 'local',
      meta: { filename: asset.filename, path: asset.path },
    }
  }
}

export class BannerbearRendererProvider {
  get name() {
    return 'bannerbear'
  }

  async renderRendition(input) {
    const asset = await renderBannerbearCard({
      template: input.template,
      listing: input.listing,
      agent: input.agent,
      brand: input.brand,
      platform: input.platform,
      storageRoot: input.storageRoot,
      publicBaseUrl: input.publicBaseUrl,
    })
    const dims = PLATFORM_DIMENSIONS[input.platform]
    return {
      asset_url: asset.url,
      width: asset.dimensions?.width || dims?.width || 1080,
      height: asset.dimensions?.height || dims?.height || 1080,
      provider: 'bannerbear',
      meta: { bannerbear_uid: asset.bannerbear_uid },
    }
  }
}
