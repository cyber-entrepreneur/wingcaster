#!/usr/bin/env node
/**
 * Bootstrap / manage WingCaster platform admins.
 *
 * A platform admin is a `users` row with platform_role = 'platform_admin'.
 * By design there is NO self-serve path to become one — this script is the
 * out-of-band bootstrap for the FIRST admin, and the CLI for granting or
 * revoking admin later. The account must already exist (have the person
 * register at /register first), then run this to promote it.
 *
 * Promotion goes through the canonical updatePlatformRole(), which bumps the
 * user's token_version and revokes existing sessions — so the promoted user
 * must sign in again to pick up admin access.
 *
 * Requires DATABASE_URL. In production run it against the live DB via Railway:
 *   railway run --service wingcaster node backend/scripts/bootstrap-admin.mjs <email>
 *
 * Usage:
 *   node backend/scripts/bootstrap-admin.mjs <email>            # grant platform_admin
 *   node backend/scripts/bootstrap-admin.mjs <email> --demote   # revoke platform_admin
 *   node backend/scripts/bootstrap-admin.mjs --list             # list current admins
 */
import { findUserByEmail, updatePlatformRole } from '../src/identity.js'
import { query } from '../src/persistence/index.js'

const args = process.argv.slice(2)
const demote = args.includes('--demote')
const list = args.includes('--list')
const email = args.find((a) => !a.startsWith('--'))

function fail(msg) {
  console.error(`✖ ${msg}`)
  process.exit(1)
}

async function listAdmins() {
  // persistence query() resolves to the rows array directly (not a {rows} wrapper).
  const rows = await query(
    `SELECT id, email, name FROM users WHERE platform_role = 'platform_admin' ORDER BY email`,
  )
  if (!rows.length) {
    console.log('No platform admins exist yet.')
  } else {
    console.log(`Platform admins (${rows.length}):`)
    for (const u of rows) console.log(`  • ${u.email}  (${u.name || 'no name'})  [${u.id}]`)
  }
  return rows
}

async function main() {
  if (!process.env.DATABASE_URL) {
    fail(
      'DATABASE_URL is not set. In production run:\n' +
        '  railway run --service wingcaster node backend/scripts/bootstrap-admin.mjs <email>',
    )
  }

  if (list) {
    await listAdmins()
    return
  }

  if (!email) {
    fail('Usage: node backend/scripts/bootstrap-admin.mjs <email> [--demote] | --list')
  }

  const user = await findUserByEmail(email)
  if (!user) {
    fail(`No account found for "${email}". Register it first at /register, then re-run.`)
  }

  const target = demote ? null : 'platform_admin'
  if ((user.platform_role || null) === target) {
    console.log(`No change: ${email} is already ${demote ? 'not a platform admin' : 'a platform admin'}.`)
    return
  }

  const countBefore = await query(
    `SELECT COUNT(*)::int AS n FROM users WHERE platform_role = 'platform_admin'`,
  )
  const existing = countBefore[0].n

  await updatePlatformRole(user.id, target)

  if (demote) {
    console.log(`✔ Revoked platform_admin from ${email}. Their sessions were ended.`)
  } else {
    const first = existing === 0 ? ' (first platform admin — bootstrap complete)' : ''
    console.log(`✔ Granted platform_admin to ${email}${first}.`)
    console.log('  Existing sessions were revoked — they must sign in again to get admin access.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
