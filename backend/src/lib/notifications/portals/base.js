/**
 * Base class for real-estate portal publishers.
 *
 * Concrete adapters live under `./<code>.js` and are resolved from
 * `portal_registry.adapter_class_name` / code at boot. Production API
 * integrations are intentionally NOT implemented here — stubs throw
 * NOT_IMPLEMENTED so metering + wiring can ship without live partner APIs.
 */
export class PortalPublisher {
  /**
   * @param {object} [registryRow] row from public.portal_registry
   */
  constructor(registryRow = null) {
    this.registry = registryRow
    this.code = registryRow?.code || null
  }

  async publish(_listing, _agentContext) {
    const err = new Error('NOT_IMPLEMENTED')
    err.code = 'NOT_IMPLEMENTED'
    throw err
  }

  async fetchInboundLeads(_agentContext) {
    const err = new Error('NOT_IMPLEMENTED')
    err.code = 'NOT_IMPLEMENTED'
    throw err
  }

  async validateListing(_listing) {
    const err = new Error('NOT_IMPLEMENTED')
    err.code = 'NOT_IMPLEMENTED'
    throw err
  }
}

export default PortalPublisher
