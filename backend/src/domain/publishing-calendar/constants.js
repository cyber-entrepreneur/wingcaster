/**
 * Wave 2B — platform network-validation constants.
 * Caption ceilings are platform product limits (not Growth-OS schema).
 */

export { RESCHEDULABLE_STATUSES, isReschedulable } from '../../lib/growth-os/executions.js'

/** Max caption/post text length by platform key (lowercase). */
export const CAPTION_LIMITS = Object.freeze({
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  x: 280,
  twitter: 280,
  tiktok: 2200,
  telegram: 4096,
  whatsapp: 4096,
})

/**
 * Per-platform media expectations used by network validation.
 * `required` → blocker when no media; `maxImages` caps carousels.
 */
export const PLATFORM_MEDIA_RULES = Object.freeze({
  instagram: { required: true, maxImages: 10, formatsNeedingVideo: ['reel'] },
  facebook: { required: false, maxImages: 10 },
  linkedin: { required: false, maxImages: 9 },
  x: { required: false, maxImages: 4 },
  twitter: { required: false, maxImages: 4 },
  tiktok: { required: true, maxImages: 10 },
  telegram: { required: false, maxImages: 10 },
  whatsapp: { required: false, maxImages: 1 },
})
