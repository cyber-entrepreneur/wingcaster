/**
 * GDPR / MENA erasure helpers for credit history.
 * Financial rows are retained (FINANCIAL_7Y). Actor ids and user_id in
 * consumption data are pseudonymized to deleted:<hash>.
 */
import { createHash } from 'node:crypto'

export function deletedActorLabel(actorId) {
  const hex = createHash('sha256').update(String(actorId || '')).digest('hex').slice(0, 16)
  return `deleted:${hex}`
}

export async function pseudonymizeCreditHistory(client, { actorId }) {
  const label = deletedActorLabel(actorId)
  await client.query(
    `UPDATE public.credit_grants
        SET granted_by_actor_id = NULL,
            data = jsonb_set(COALESCE(data, '{}'::jsonb), '{granted_by_actor_id}', to_jsonb($2::text), true)
      WHERE granted_by_actor_id = $1::uuid`,
    [actorId, label],
  )
  await client.query(
    `UPDATE public.credit_consumptions
        SET data = CASE
              WHEN data ? 'user_id' THEN jsonb_set(data, '{user_id}', to_jsonb($2::text), true)
              ELSE data
            END
      WHERE data->>'user_id' = $1::text`,
    [String(actorId), label],
  )
  return { label }
}
