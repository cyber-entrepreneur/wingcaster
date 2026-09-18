import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { FinAdminGate } from './shell'

export function ApprovalsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])

  function reload() {
    void api.finGet('/approvals').then((body) => setRows((body.approvals || []) as Array<Record<string, unknown>>))
  }

  useEffect(() => { reload() }, [])

  return (
    <FinAdminGate title="Approvals">
      <p className="mb-3 text-sm text-muted-foreground">
        Maker-checker queue. Open a row to view the immutable audit trail for that request.
      </p>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">No approval requests.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--lc-surface-sunken)] text-left">
              <tr>
                {['action_kind', 'status', 'created_at', 'audit'].map((col) => (
                  <th key={col} className="px-3 py-2 font-medium">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const id = String(row.id || '')
                return (
                  <tr
                    key={id || idx}
                    className="cursor-pointer border-t hover:bg-[var(--lc-surface-sunken)]"
                    onClick={() => {
                      if (id) navigate(`/admin/fin/approvals/${encodeURIComponent(id)}/audit`)
                    }}
                  >
                    <td className="px-3 py-2">{String(row.action_kind ?? '')}</td>
                    <td className="px-3 py-2">{String(row.status ?? '')}</td>
                    <td className="px-3 py-2">{String(row.created_at ?? '')}</td>
                    <td className="px-3 py-2">
                      {id ? (
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Link to={`/admin/fin/approvals/${encodeURIComponent(id)}/audit`}>
                            View audit
                          </Link>
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </FinAdminGate>
  )
}
