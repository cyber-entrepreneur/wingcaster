import { PortalPublisher } from './base.js'

/** Stub Property Finder publisher — production API not wired (BE-DESIGN-01). */
export class PropertyFinderPortalPublisher extends PortalPublisher {
  async publish(listing, agentContext) {
    const err = new Error('property_finder publish is not implemented')
    err.code = 'NOT_IMPLEMENTED'
    throw err
  }

  async fetchInboundLeads(agentContext) {
    return super.fetchInboundLeads(agentContext)
  }

  async validateListing(listing) {
    return super.validateListing(listing)
  }
}

export default PropertyFinderPortalPublisher
