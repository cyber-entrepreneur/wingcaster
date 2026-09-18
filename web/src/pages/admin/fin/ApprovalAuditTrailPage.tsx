import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ApprovalAuditPanel } from '@/components/approval'
import { FinAdminGate } from './shell'

export function ApprovalAuditTrailPage() {
  const { id = '' } = useParams()

  if (!id) {
    return (
      <FinAdminGate title="Approval audit trail">
        <p className="text-sm text-red-600" role="alert">Missing approval id.</p>
        <Link
          to="/admin/fin/approvals"
          className="mt-3 inline-block text-sm text-muted-foreground hover:underline"
        >
          Back to approvals
        </Link>
      </FinAdminGate>
    )
  }

  return (
    <FinAdminGate title="Approval audit trail">
      <Link
        to="/admin/fin/approvals"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to approvals
      </Link>
      <ApprovalAuditPanel requestId={id} />
    </FinAdminGate>
  )
}
