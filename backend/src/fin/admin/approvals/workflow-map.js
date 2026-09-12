/** BE-BLOCKER-34 — workflow_code map for WF-20 execute. */
export const VALUE_TIERS = Object.freeze({ STANDARD: 'standard', ELEVATED: 'elevated', HIGH_VALUE: 'high_value' })
export const ACTION_KIND_TO_WORKFLOW = Object.freeze({
  LARGE_GRANT: 'WF-08', PACKAGE_PUBLISH: 'WF-07', VENDOR_RATE_CHANGE: 'WF-09',
  NEGATIVE_ADJUSTMENT: 'WF-14', LARGE_REFUND: 'WF-14', INVOICE_VOID: 'WF-14', WRITE_OFF: 'WF-14',
  FACILITY_OPS: 'WF-15', BACKDATED_AMENDMENT: 'WF-15', RECONCILIATION_OVERRIDE: 'WF-20',
  VENDOR_VARIANCE_OVERRIDE: 'WF-20', MASS_OPERATION: 'WF-20', PLATFORM_ADMIN_RECOVERY: 'WF-04',
  AUDIT_RETENTION: 'WF-20', COMPARABLE_REMOVE: 'WF-05', PRICE_REPORT_INCORPORATE: 'WF-06',
})
export const WORKFLOW_LABELS = Object.freeze({
  'WF-04': 'Account recovery', 'WF-05': 'Comparable remove', 'WF-06': 'Price report incorporate',
  'WF-07': 'Package publish', 'WF-08': 'Credit grant', 'WF-09': 'Rate-card change',
  'WF-14': 'Invoice adjustment', 'WF-15': 'Facility ops', 'WF-20': 'Two-person admin action',
})
export function resolveWorkflowCode(row) {
  if (row?.workflow_code) return String(row.workflow_code).toUpperCase()
  const fromPayload = row?.payload?.workflow || row?.payload?.workflow_code || row?.payload?.workflowCode
  if (fromPayload) return String(fromPayload).toUpperCase()
  return ACTION_KIND_TO_WORKFLOW[row?.action_kind] || 'WF-20'
}
export function workflowLabel(code) { return WORKFLOW_LABELS[code] || 'Admin approval' }
export function last6(id) { return String(id || '').replace(/-/g, '').slice(-6).toUpperCase() }
export function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
}
