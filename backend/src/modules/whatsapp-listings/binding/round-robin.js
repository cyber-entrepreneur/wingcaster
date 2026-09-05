/**
 * Deterministic shared-number assignment (H3).
 *
 * shared_number_index = fnv1a_hash(user_id) % pool_size
 * Same agent always lands on the same pool number.
 *
 * FUTURE OPS WORK (do not scope in this PR): if the pool size changes after
 * production traffic, existing user_whatsapp_bindings.shared_number_index
 * rows will be stale relative to hash(user_id) % new_pool_size. An ops-only
 * migration must rewrite those rows (and tell agents if their number shifted).
 */

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

export function fnv1aHash(input) {
  let hash = FNV_OFFSET
  const str = String(input || '')
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash >>> 0
}

export function sharedNumberIndex(userId, poolSize) {
  const size = Number(poolSize)
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('poolSize must be a positive integer')
  }
  return fnv1aHash(userId) % size
}
