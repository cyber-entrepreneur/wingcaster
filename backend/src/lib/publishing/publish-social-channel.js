/**
 * Single-platform social publish — shared by publish-social and creative publish.
 */

import { findOne } from '../../persistence/index.js'
import {
  assertPublishChannelConfigured,
  tenantHasPublishToken,
} from '../publish-readiness.js'
import {
  publishInstagramFeed,
  publishInstagramCarousel,
  publishInstagramReel,
  publishInstagramStory,
} from '../notifications/instagram.js'
import {
  publishFacebookPagePost,
  publishFacebookPagePhoto,
} from '../notifications/facebook.js'
import { publishXTweet } from '../notifications/x.js'
import { publishTikTokVideo, publishTikTokPhoto } from '../notifications/tiktok.js'
import { publishLinkedInPost } from '../notifications/linkedin.js'
import { resolveConnectionCredentials, PLATFORM_INTEGRATION_MODEL } from '../credentials.js'
import { resolveOAuthPublishAccessToken } from '../oauth/publish-token.js'

export async function publishSocialChannel({
  agentId,
  platform,
  format = null,
  caption,
  mediaUrls = [],
  linkUrl = null,
  creditContext = null,
}) {
  const conn = await findOne(
    'marketplace_connections',
    (c) => c.agent_id === agentId && c.platform === platform && c.status === 'connected',
  )
  if (!conn) {
    throw Object.assign(
      new Error(`${platform} is not connected. Connect it in Settings → Integrations.`),
      { code: 'NOT_CONNECTED' },
    )
  }

  const creds = resolveConnectionCredentials(conn)
  const model = PLATFORM_INTEGRATION_MODEL[platform] || 'enterprise'
  if (!tenantHasPublishToken(platform, creds)) {
    assertPublishChannelConfigured(platform)
  }

  const text = String(caption || '').trim()
  const firstImage = mediaUrls.find((u) => typeof u === 'string' && !/\.(mp4|webm|mov)(\?|$)/i.test(u)) || mediaUrls[0]
  const firstVideo = mediaUrls.find((u) => typeof u === 'string' && /\.(mp4|webm|mov)(\?|$)/i.test(u))

  let publishResult = null
  switch (platform) {
    case 'instagram': {
      if (!creds.ig_business_account_id) {
        throw Object.assign(new Error('Instagram Business Account ID missing'), { code: 'MISSING_TENANT_TARGET' })
      }
      const igArgs = {
        businessAccountId: creds.ig_business_account_id,
        accessToken: creds.ig_page_access_token_override || undefined,
      }
      if (format === 'reel' && firstVideo) {
        publishResult = await publishInstagramReel({ videoUrl: firstVideo, caption: text, ...igArgs, creditContext })
      } else if (format === 'story' && firstImage) {
        publishResult = await publishInstagramStory({ imageUrl: firstImage, ...igArgs, creditContext })
      } else if (mediaUrls.length > 1) {
        publishResult = await publishInstagramCarousel({ imageUrls: mediaUrls.slice(0, 10), caption: text, ...igArgs, creditContext })
      } else if (firstImage) {
        publishResult = await publishInstagramFeed({ imageUrl: firstImage, caption: text, ...igArgs, creditContext })
      } else {
        throw Object.assign(new Error('Instagram publish requires at least one image or video'), { code: 'MISSING_MEDIA' })
      }
      break
    }
    case 'facebook': {
      if (!creds.fb_page_id) {
        throw Object.assign(new Error('Facebook Page ID missing'), { code: 'MISSING_TENANT_TARGET' })
      }
      const fbArgs = {
        pageId: creds.fb_page_id,
        accessToken: creds.fb_page_access_token_override || undefined,
      }
      if (firstImage) {
        publishResult = await publishFacebookPagePhoto({ imageUrl: firstImage, caption: text, ...fbArgs, creditContext })
      } else {
        publishResult = await publishFacebookPagePost({ message: text, linkUrl, ...fbArgs, creditContext })
      }
      break
    }
    case 'x': {
      if (!creds.oauth_access_token) {
        throw Object.assign(new Error('X is not connected for this tenant'), { code: 'MISSING_OAUTH_TOKEN' })
      }
      const bearerToken = await resolveOAuthPublishAccessToken(conn, 'x')
      publishResult = await publishXTweet({ text, bearerToken, creditContext })
      break
    }
    case 'tiktok': {
      if (!creds.oauth_access_token) {
        throw Object.assign(new Error('TikTok is not connected for this tenant'), { code: 'MISSING_OAUTH_TOKEN' })
      }
      const accessToken = await resolveOAuthPublishAccessToken(conn, 'tiktok')
      const ttArgs = { accessToken }
      if (firstVideo) {
        publishResult = await publishTikTokVideo({ videoUrl: firstVideo, caption: text, ...ttArgs, creditContext })
      } else if (mediaUrls.length > 0) {
        publishResult = await publishTikTokPhoto({ imageUrls: mediaUrls.slice(0, 10), caption: text, ...ttArgs, creditContext })
      } else {
        throw Object.assign(new Error('TikTok publish requires at least one photo or video'), { code: 'MISSING_MEDIA' })
      }
      break
    }
    case 'linkedin': {
      if (!creds.li_author_urn) {
        throw Object.assign(new Error('LinkedIn Author URN missing'), { code: 'MISSING_TENANT_TARGET' })
      }
      publishResult = await publishLinkedInPost({
        commentary: text,
        authorUrn: creds.li_author_urn,
        accessToken: creds.li_access_token_override || undefined,
        creditContext,
      })
      break
    }
    default:
      throw Object.assign(new Error(`Direct publish for ${platform} is not yet implemented`), { code: 'NOT_SUPPORTED' })
  }

  void model
  const externalId = publishResult?.publish_id || publishResult?.post_id || publishResult?.tweet_id || publishResult?.post_urn || null
  return {
    external_id: externalId,
    external_url: publishResult?.external_url || null,
    provider: publishResult?.provider || null,
    simulated: publishResult?.simulated || false,
  }
}
