/**
 * WF-05 comparable-report API helpers (PA-PVA-008 / 008b).
 * Colocated wrappers over `@/api/client`.
 */
import { api } from '@/api/client'
import type {
  AffectedValuationRow,
  AuditTrailEvent,
  BulkDecisionResult,
  ComparableReportDetail,
  ComparableReportListQuery,
  ComparableReportListResponse,
  DecisionResponse,
  ReporterHistoryRow,
} from './types'

function toParams(query: ComparableReportListQuery = {}): Record<string, string> {
  const params: Record<string, string> = {}
  if (query.status) params.status = query.status
  if (query.category && query.category !== 'any') params.category = query.category
  if (query.severity && query.severity !== 'any') params.severity = query.severity
  if (query.impact && query.impact !== 'any') params.impact = query.impact
  if (query.within) params.within = query.within
  if (query.q) params.q = query.q
  if (query.page) params.page = String(query.page)
  if (query.pageSize) params.pageSize = String(query.pageSize)
  if (query.sort) params.sort = query.sort
  return params
}

export const comparableReportsApi = {
  list: (query: ComparableReportListQuery = {}): Promise<ComparableReportListResponse> =>
    api.listAdminComparableReports(toParams(query)),

  get: (reportId: string): Promise<ComparableReportDetail> =>
    api.getAdminComparableReport(reportId),

  reporterHistory: (reportId: string, limit = 10): Promise<{ reports: ReporterHistoryRow[] }> =>
    api.getAdminComparableReportReporterHistory(reportId, { limit: String(limit) }),

  auditTrail: (reportId: string): Promise<{ events: AuditTrailEvent[] }> =>
    api.getAdminComparableReportAuditTrail(reportId),

  affectedValuations: (
    reportId: string,
    page = 1,
    pageSize = 25,
  ): Promise<{ valuations: AffectedValuationRow[]; pagination?: { total: number } }> =>
    api.getAdminComparableReportAffectedValuations(reportId, {
      page: String(page),
      pageSize: String(pageSize),
    }),

  exportCsvPath: (query: ComparableReportListQuery = {}): string => {
    const params = new URLSearchParams(toParams(query))
    const s = params.toString()
    return `/admin/pricing/reports.csv${s ? `?${s}` : ''}`
  },

  confirmRemove: (reportId: string, body: { notes?: string }): Promise<DecisionResponse> =>
    api.confirmAdminComparableReportRemove(reportId, body),

  confirmQuarantine: (
    reportId: string,
    body: { notes?: string; quarantine_hours?: number },
  ): Promise<DecisionResponse> => api.confirmAdminComparableReportQuarantine(reportId, body),

  rejectAsInvalid: (
    reportId: string,
    body: { reason_code: string; notes: string },
  ): Promise<DecisionResponse> => api.rejectAdminComparableReportAsInvalid(reportId, body),

  requestInfo: (
    reportId: string,
    body: { reason_code: string; notes: string; requested_evidence?: string[] },
  ): Promise<DecisionResponse> => api.requestAdminComparableReportInfo(reportId, body),

  undoDecision: (reportId: string): Promise<DecisionResponse> =>
    api.undoAdminComparableReportDecision(reportId),

  bulkRejectAsInvalid: (body: {
    report_ids: string[]
    reason_code: string
    notes: string
  }): Promise<BulkDecisionResult> => api.bulkRejectAdminComparableReportsAsInvalid(body),

  bulkRequestInfo: (body: {
    report_ids: string[]
    reason_code: string
    notes: string
    requested_evidence?: string[]
  }): Promise<BulkDecisionResult> => api.bulkRequestAdminComparableReportsInfo(body),
}
