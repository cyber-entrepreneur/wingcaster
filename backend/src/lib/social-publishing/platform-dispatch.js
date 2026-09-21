/**
 * Dispatch a single platform publish through the real provider adapters (Path B).
 */

import { PLATFORM_INTEGRATION_MODEL, resolveConnectionCredentials } from '../credentials.js'
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
import { publishTikTokPhoto, publishTikTokVideo } from '../notifications/tiktok.js'
import { publishLinkedInPost } from '../notifications/linkedin.js'
import { publishTelegramChannelPost } from '../notifications/telegram.js'
import {
  isWhatsAppConfigured,
  getWhatsAppConfig,
  sendListingToWhatsApp,
} from '../../whatsapp.js'
import { resolveOAuthPublishAccessToken } from '../oauth/publish-token.js'

function pickMedia(mediaUrls = []) {
  const urls = Array.isArray(mediaUrls) ? mediaUrls : []
  const firstImage = urls.find((u) => typeof u === 'string' && !/\.(mp4|webm|mov)(\?|$)/i.test(u)) || urls[0]
  const firstVideo = urls.find((u) => typeof u === 'string' && /\.(mp4|webm|mov)(\?|$)/i.test(u))
  return { urls, firstImage, firstVideo }
}

/**
 * @returns {Promise<{ publishResult: object|null, publishError: Error|null }>}
 */
export async function dispatchPlatformPublish({
  platform,
  connection,
  property,
  serializedProperty,
  caption,
  format = null,
  linkUrl = null,
  mediaUrls = [],
  recipient = null,
  creditContext = null,
}) {
  const creds = resolveConnectionCredentials(connection)
  const model = PLATFORM_INTEGRATION_MODEL[platform] || 'enterprise'

  if (!tenantHasPublishToken(platform, creds) && platform !== 'whatsapp' && platform !== 'telegram') {
    try {
      assertPublishChannelConfigured(platform)
    } catch (error) {
      return { publishResult: null, publishError: error }
    }
  }

  const { urls, firstImage, firstVideo } = pickMedia(
    mediaUrls?.length ? mediaUrls : (property?.photos || serializedProperty?.photos || []),
  )
  const text = String(caption || '').trim()
    || `${property?.title || serializedProperty?.title || 'Listing'} — ${[property?.city, property?.neighborhood].filter(Boolean).join(', ')}`

  try {
    let publishResult
    switch (platform) {
      case 'instagram': {
        if (!creds.ig_business_account_id) {
          throw Object.assign(
            new Error('Instagram Business Account ID missing on this tenant\'s connection'),
            { code: 'MISSING_TENANT_TARGET' },
          )
        }
        const igArgs = {
          businessAccountId: creds.ig_business_account_id,
          accessToken: creds.ig_page_access_token_override || undefined,
          creditContext,
        }
        if (format === 'reel' && firstVideo) {
          publishResult = await publishInstagramReel({ videoUrl: firstVideo, caption: text, ...igArgs })
        } else if (format === 'story' && firstImage) {
          publishResult = await publishInstagramStory({ imageUrl: firstImage, ...igArgs })
        } else if (urls.length > 1) {
          publishResult = await publishInstagramCarousel({ imageUrls: urls.slice(0, 10), caption: text, ...igArgs })
        } else if (firstImage) {
          publishResult = await publishInstagramFeed({ imageUrl: firstImage, caption: text, ...igArgs })
        } else {
          throw Object.assign(new Error('Instagram publish requires at least one image or video'), { code: 'MISSING_MEDIA' })
        }
        break
      }
      case 'facebook': {
        if (!creds.fb_page_id) {
          throw Object.assign(
            new Error('Facebook Page ID missing on this tenant\'s connection'),
            { code: 'MISSING_TENANT_TARGET' },
          )
        }
        const fbArgs = {
          pageId: creds.fb_page_id,
          accessToken: creds.fb_page_access_token_override || undefined,
          creditContext,
        }
        if (firstImage) {
          publishResult = await publishFacebookPagePhoto({ imageUrl: firstImage, caption: text, ...fbArgs })
        } else {
          publishResult = await publishFacebookPagePost({ message: text, linkUrl: linkUrl || null, ...fbArgs })
        }
        break
      }
      case 'x': {
        if (!creds.oauth_access_token) {
          throw Object.assign(
            new Error('X is not connected for this tenant. Complete OAuth in Settings → Channels.'),
            { code: 'MISSING_OAUTH_TOKEN' },
          )
        }
        const bearerToken = await resolveOAuthPublishAccessToken(connection, 'x')
        publishResult = await publishXTweet({ text, bearerToken, creditContext })
        break
      }
      case 'tiktok': {
        if (!creds.oauth_access_token) {
          throw Object.assign(
            new Error('TikTok is not connected for this tenant. Complete OAuth in Settings → Channels.'),
            { code: 'MISSING_OAUTH_TOKEN' },
          )
        }
        const accessToken = await resolveOAuthPublishAccessToken(connection, 'tiktok')
        const ttArgs = { accessToken, creditContext }
        if (firstVideo) {
          publishResult = await publishTikTokVideo({ videoUrl: firstVideo, caption: text, ...ttArgs })
        } else if (urls.length > 0) {
          publishResult = await publishTikTokPhoto({ imageUrls: urls.slice(0, 10), caption: text, ...ttArgs })
        } else {
          throw Object.assign(new Error('TikTok publish requires at least one photo or video'), { code: 'MISSING_MEDIA' })
        }
        break
      }
      case 'linkedin': {
        if (!creds.li_author_urn) {
          throw Object.assign(
            new Error('LinkedIn Author URN missing on this tenant\'s connection'),
            { code: 'MISSING_TENANT_TARGET' },
          )
        }
        let accessToken = creds.li_access_token_override || undefined
        if (!accessToken && creds.oauth_access_token) {
          accessToken = await resolveOAuthPublishAccessToken(connection, 'linkedin')
        }
        publishResult = await publishLinkedInPost({
          commentary: text,
          authorUrn: creds.li_author_urn,
          accessToken,
          creditContext,
        })
        break
      }
      case 'telegram': {
        publishResult = await publishTelegramChannelPost({
          connection,
          caption: text,
          imageUrl: firstImage || null,
          creditContext,
        })
        break
      }
      case 'whatsapp': {
        if (!isWhatsAppConfigured()) {
          throw Object.assign(new Error('WhatsApp Cloud API credentials are not configured on the server'), {
            code: 'WHATSAPP_UNCONFIGURED',
          })
        }
        const to = recipient
          || connection?.settings?.notify_number
          || getWhatsAppConfig().defaultRecipient
        if (!to) {
          throw Object.assign(
            new Error('Add a WhatsApp recipient number in Channel Settings (or WHATSAPP_DEFAULT_RECIPIENT in .env)'),
            { code: 'MISSING_RECIPIENT' },
          )
        }
        const listing = serializedProperty || property
        publishResult = await sendListingToWhatsApp(listing, to, creditContext)
        break
      }
      default:
        throw Object.assign(new Error(`Direct publish for ${platform} is not supported`), {
          code: 'NOT_SUPPORTED',
        })
    }
    void model
    return { publishResult, publishError: null }
  } catch (error) {
    return { publishResult: null, publishError: error }
  }
}
