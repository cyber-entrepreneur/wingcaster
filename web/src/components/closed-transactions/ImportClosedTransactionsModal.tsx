import { useMemo, useState } from 'react'
import { AlertTriangle, FileUp, Loader2, Upload } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import {
  applyColumnMapping,
  CANONICAL_IMPORT_FIELDS,
  guessColumnMapping,
  mappedRowsToCsv,
  parseCsvText,
  validateMapping,
  type ColumnMapping,
} from '@/lib/closed-transactions-csv'

type Step = 'upload' | 'mapping' | 'preview' | 'result'

interface ImportClosedTransactionsModalProps {
  onClose: () => void
  onDone: () => void
}

/**
 * AGT-HTX-003 — Import closed transactions from CSV.
 *
 * File picker → column mapping → preview → import. Pro-only surface
 * launched from Historical Transactions (AGT-HTX-001).
 */
export function ImportClosedTransactionsModal({ onClose, onDone }: ImportClosedTransactionsModalProps) {
  const { addToast } = useToast()
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [csvText, setCsvText] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.importClosedTransactionsCsv>> | null>(null)

  const parsedRows = useMemo(() => {
    if (!csvText) return []
    const parsed = parseCsvText(csvText)
    return applyColumnMapping(parsed, mapping)
  }, [csvText, mapping])

  const previewRows = parsedRows.slice(0, 5)
  const mappingError = step === 'mapping' || step === 'preview' ? validateMapping(mapping) : null

  async function readFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      addToast({ variant: 'error', title: 'Please choose a CSV file' })
      return
    }
    if (file.size > 500_000) {
      addToast({ variant: 'error', title: 'CSV too large (500KB max)' })
      return
    }
    const text = await file.text()
    const parsed = parseCsvText(text)
    if (!parsed.headers.length) {
      addToast({ variant: 'error', title: 'CSV has no header row' })
      return
    }
    setFileName(file.name)
    setCsvText(text)
    setHeaders(parsed.headers)
    setMapping(guessColumnMapping(parsed.headers))
    setStep('mapping')
  }

  async function runImport() {
    const err = validateMapping(mapping)
    if (err) {
      addToast({ variant: 'error', title: 'Fix column mapping', description: err })
      return
    }
    setBusy(true)
    try {
      const payload = mappedRowsToCsv(parsedRows)
      const r = await api.importClosedTransactionsCsv(payload)
      setResult(r)
      setStep('result')
      if (r.imported > 0) {
        addToast({
          variant: 'success',
          title: `Imported ${r.imported} transaction${r.imported === 1 ? '' : 's'}`,
        })
      }
    } catch (importErr) {
      addToast({
        variant: 'error',
        title: 'Import failed',
        description: importErr instanceof Error ? importErr.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center lc-overlay p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-lg bg-[var(--lc-surface)] shadow-xl">
        <div className="flex items-start justify-between border-b border-[var(--lc-border)] p-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--lc-text-heading)]">Import historical transactions</h2>
            <p className="mt-0.5 text-xs text-[var(--lc-text-muted)]">
              Upload a CSV, map columns, preview rows, then import. Required: closed date, sold price, and listing or reference.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ×
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {step === 'upload' && (
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-6 py-12 text-center"
            >
              <FileUp className="h-8 w-8 text-[var(--lc-text-muted)]" aria-hidden />
              <span className="mt-3 text-sm font-medium text-[var(--lc-text-heading)]">Choose a CSV file</span>
              <span className="mt-1 text-xs text-[var(--lc-text-muted)]">Max 500KB · UTF-8 CSV with a header row</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void readFile(file)
                }}
              />
            </label>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--lc-text-muted)]">
                File: <span className="font-medium text-[var(--lc-text-heading)]">{fileName}</span>
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {CANONICAL_IMPORT_FIELDS.map((field) => (
                  <div key={field.key}>
                    <Label htmlFor={`map-${field.key}`}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </Label>
                    <select
                      id={`map-${field.key}`}
                      className="mt-1 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                      value={mapping[field.key] ?? ''}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [field.key]: e.target.value || undefined,
                        }))
                      }
                    >
                      <option value="">— skip —</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {mappingError && (
                <p className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  {mappingError}
                </p>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--lc-text-muted)]">
                Previewing first <Numeric>{previewRows.length}</Numeric> of <Numeric>{parsedRows.length}</Numeric> rows.
              </p>
              <div className="overflow-x-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]">
                <table className="min-w-full text-xs">
                  <thead className="bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
                    <tr>
                      <th className="px-2 py-2 text-start">Listing / ref</th>
                      <th className="px-2 py-2 text-start">Closed</th>
                      <th className="px-2 py-2 text-start">Sold</th>
                      <th className="px-2 py-2 text-start">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="border-t border-[var(--lc-border)]">
                        <td className="px-2 py-2">{row.listing_id || row.external_reference || '—'}</td>
                        <td className="px-2 py-2">{row.closed_at || '—'}</td>
                        <td className="px-2 py-2">
                          {row.final_sold_price ? `${row.currency || ''} ${row.final_sold_price}` : '—'}
                        </td>
                        <td className="px-2 py-2 capitalize">{row.transaction_type || 'sale'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div
              className={`rounded-[var(--lc-radius-md)] border px-3 py-2 text-sm ${
                result.imported
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              Imported: <Numeric>{result.imported}</Numeric> · Skipped: <Numeric>{result.skipped}</Numeric>
              {result.errors.length > 0 && (
                <ul className="mt-2 list-disc ps-4 text-xs">
                  {result.errors.slice(0, 8).map((e, i) => (
                    <li key={i}>
                      Row <Numeric>{e.row}</Numeric>: {e.error}
                    </li>
                  ))}
                  {result.errors.length > 8 && (
                    <li>… and <Numeric>{result.errors.length - 8}</Numeric> more</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-[var(--lc-border)] p-3">
          <div>
            {step !== 'upload' && step !== 'result' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
                disabled={busy}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {step === 'result' ? 'Close' : 'Cancel'}
            </Button>
            {step === 'mapping' && (
              <Button type="button" disabled={Boolean(mappingError)} onClick={() => setStep('preview')}>
                Preview
              </Button>
            )}
            {step === 'preview' && (
              <Button type="button" disabled={busy || Boolean(mappingError)} className="gap-1.5" onClick={() => void runImport()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import <Numeric>{parsedRows.length}</Numeric> rows
              </Button>
            )}
            {step === 'result' && (
              <Button type="button" onClick={onDone}>
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
