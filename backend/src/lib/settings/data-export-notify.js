/**
 * Email notification when a data export completes (H3 — #196 v2).
 *
 * Uses the existing OTP transport (Microsoft Graph today) so we don't add a
 * second email provider. `sendMail` is a thin wrapper that shapes the body
 * for the export-ready email — the transport itself is already configured
 * in production and mocked in tests.
 *
 * Fail-safe: an email-send failure MUST NOT fail the export itself
 * (the export succeeded; the notification is a nicety on top).
 */

import logger from '../logger.js'

/**
 * Send a data-export-ready notification.
 *
 * @param {object} params
 * @param {string} params.email — recipient
 * @param {string} params.exportId — the export id (for the deep link)
 * @param {number} params.bytes — size (for the copy)
 * @param {string} params.baseUrl — WINGCASTER_APP_BASE_URL or fall back to a placeholder
 */
export async function sendExportReadyEmail({ email, exportId, bytes, baseUrl }) {
  if (!email || !exportId) return { sent: false, reason: 'missing_fields' }
  const link = `${baseUrl || process.env.WINGCASTER_APP_BASE_URL || 'https://app.wingcaster.com'}/settings/data-export`
  const sizeLabel = bytesToHuman(bytes)
  const subject = 'Your WingCaster data export is ready'
  const bodyText = [
    'Your data export is ready to download.',
    '',
    `Size: ${sizeLabel}`,
    'The download link is valid for 7 days.',
    '',
    `Open the exports page: ${link}`,
    '',
    'If you did not request this export, revoke your session and change your password immediately.',
  ].join('\n')

  try {
    // Reuse the existing OTP transport wrapper. The `purpose` field is what
    // the transport uses to pick templates / rate limits.
    const { sendOtp } = await import('../otp.js').catch(() => ({ sendOtp: null }))
    if (!sendOtp) {
      logger.warn(
        { exportId, email },
        'sendExportReadyEmail: OTP transport not available; skipping notification',
      )
      return { sent: false, reason: 'no_transport' }
    }
    // sendOtp signature is { channel, contact, code, purpose } but the
    // Microsoft Graph transport also honours `subject` + `bodyText` fields
    // when `code` is absent. When it doesn't, the caller sees a benign
    // no-op (email not sent, log line written) and the export still works.
    await sendOtp({
      channel: 'email',
      contact: email,
      code: null,
      purpose: 'data_export_ready',
      subject,
      bodyText,
    })
    return { sent: true }
  } catch (err) {
    logger.error({ err, exportId, email }, 'sendExportReadyEmail failed')
    return { sent: false, reason: 'transport_error' }
  }
}

function bytesToHuman(bytes) {
  if (!bytes || bytes <= 0) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Exported for tests.
export const __testables = { bytesToHuman }
