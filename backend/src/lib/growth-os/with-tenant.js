/**
 * Growth-OS tenant context — mirrors credits/engine transaction + GUC pattern.
 *
 * Opens a transaction, SET LOCAL ROLE growth_os_app_role, sets app.agency_id /
 * app.agent_id (transaction-local), then runs fn. All DAL calls inside fn reuse
 * the same client via persistence transaction propagation.
 */

import { transaction } from '../../persistence/index.js'

const GROWTH_OS_ROLE = 'growth_os_app_role'

export async function withTenant(agencyId, agentId, fn) {
  return transaction(async (client) => {
    await client.query(`SET LOCAL ROLE ${GROWTH_OS_ROLE}`)
    if (agencyId != null && agencyId !== '') {
      await client.query('SELECT set_config($1, $2, true)', ['app.agency_id', String(agencyId)])
    }
    if (agentId != null && agentId !== '') {
      await client.query('SELECT set_config($1, $2, true)', ['app.agent_id', String(agentId)])
    }
    return await fn(client)
  })
}
