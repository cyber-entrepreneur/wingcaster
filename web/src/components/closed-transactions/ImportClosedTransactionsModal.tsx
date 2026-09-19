import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, FileUp, Loader2, Upload, X } from 'lucide-react'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { readCsvFile } from '@/lib/csv/parseCsv'
import {
  IMPORT_FIELD_KEYS,
  IMPORT_FIELD_LABELS,
  REQUIRED_IMPORT_FIELDS,
  guessColumnMap,
  type ImportFieldKey,
} from './importFields'

type Step = 'upload' | 'mapping' | 'preview' | 'result'

type PreviewRow = {
  row: number
  listing_id: string | null
  external_reference: string | null
  transaction_type: string
  final_sold_price: string | null
  closed_at: string | null
  currency: string
  valid: boolean
}

interface Props {
  onClose: () => void
  onDone: () => void
}

/**
 * AGT-HTX-003 — Import closed transactions (CSV backfill).
 * Pro-only modal: file picker → column mapping → preview → import.
 */
export function ImportClosedTransactionsModal({ onClose, onDone }: Props) {
  const { addToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [csvText, setCsvText] = useState('')
  const [filename, setFilename] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMap, setColumnMap] = useState<Partial<Record<ImportFieldKey, string>>>({})
  const [preview, setPreview] = useState<{ row_count: number; preview: PreviewRow[]; valid_count: number } | null>(null)
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.importClosedTransactionsCsv>> | null>(null)
  const [busy, setBusy] = useState(false)

  const hasRequiredMapping = useMemo(() => {
    const hasId = Boolean(columnMap.listing_id || columnMap.external_reference)
    const hasPrice = Boolean(columnMap.final_sold_price)
    const hasClosed = Boolean(columnMap.closed_at)
    return hasId && hasPrice && hasClosed
  }, [columnMap])

  const loadPreview = useCallback(async () => {
    if (!csvText.trim()) return
    setBusy(true)
    try {
      const r = await api.importClosedTransactionsCsv(csvText, {
        column_map: columnMap,
        preview_only: true,
      })
      setPreview({
        row_count: r.row_count ?? 0,
        preview: (r.preview ?? []) as PreviewRow[],
        valid_count: r.valid_count ?? 0,
      })
      setStep('preview')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Preview failed'
      addToast({ title: 'Preview failed', description: message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }, [addToast, columnMap, csvText])

  async function handleFile(file: File | null) {
    if (!file) return
    try {
      const text = await readCsvFile(file)
      setCsvText(text)
      setFilename(file.name)
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      const hdrs = lines[0]?.split(',').map((h) => h.trim().replace(/^"|"$/g, '')) ?? []
      setHeaders(hdrs)
      setColumnMap(guessColumnMap(hdrs))
      setStep('mapping')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not read file'
      addToast({ title: 'File read failed', description: message, variant: 'error' })
    }
  }

  async function runImport() {
    if (busy || !csvText.trim()) return
    setBusy(true)
    try {
      const r = await api.importClosedTransactionsCsv(csvText, {
        column_map: columnMap,
        filename,
      })
      setResult(r)
      setStep('result')
      const imported = r.imported ?? 0
      if (imported > 0) {
        addToast({
          title: `Imported ${imported} transaction${imported === 1 ? '' : 's'}`,
          variant: 'success',
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed'
      addToast({ title: 'Import failed', description: message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center lc-overlay p-4" data-screen="AGT-HTX-003">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-lg bg-[var(--lc-surface)] shadow-xl">
        <header className="flex items-start justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-semibold">Import historical transactions</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bulk backfill deals closed before Wingcaster. Map your CSV columns, preview, then import.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center"
              >
                <FileUp className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Choose a CSV file</p>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  Or paste CSV content below. Required: final sold price, closed date, and listing ID or external reference.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Select file
                </Button>
              </div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={10}
                placeholder="listing_id,final_sold_price,closed_at&#10;..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              />
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Detected <Numeric>{headers.length}</Numeric> columns in{' '}
                <span className="font-medium text-foreground">{filename || 'pasted CSV'}</span>.
                Map each Wingcaster field to a source column.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {IMPORT_FIELD_KEYS.map((field) => (
                  <label key={field} className="block text-xs">
                    <span className="mb-1 flex items-center gap-1 font-medium text-foreground">
                      {IMPORT_FIELD_LABELS[field]}
                      {REQUIRED_IMPORT_FIELDS.includes(field) || field === 'listing_id' || field === 'external_reference'
                        ? <Badge variant="outline" className="text-[10px]">required</Badge>
                        : null}
                    </span>
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                      value={columnMap[field] ?? ''}
                      onChange={(e) =>
                        setColumnMap((prev) => ({
                          ...prev,
                          [field]: e.target.value || undefined,
                        }))
                      }
                    >
                      <option value="">— skip —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {!hasRequiredMapping && (
                <p className="text-xs text-amber-700">
                  Map listing ID or external reference, final sold price, and closed date to continue.
                </p>
              )}
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <Numeric>{preview.valid_count}</Numeric> of <Numeric>{preview.row_count}</Numeric> rows look valid in the first preview batch.
              </p>
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-start uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Listing / ref</th>
                      <th className="px-3 py-2">Sold</th>
                      <th className="px-3 py-2">Closed</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.preview.map((row) => (
                      <tr key={row.row}>
                        <td className="px-3 py-2"><Numeric>{row.row}</Numeric></td>
                        <td className="px-3 py-2">{row.listing_id || row.external_reference || '—'}</td>
                        <td className="px-3 py-2">
                          {row.final_sold_price
                            ? <><Numeric>{row.final_sold_price}</Numeric> {row.currency}</>
                            : '—'}
                        </td>
                        <td className="px-3 py-2">{row.closed_at || '—'}</td>
                        <td className="px-3 py-2">
                          {row.valid
                            ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3 w-3" /> OK</span>
                            : <span className="text-amber-700">Missing fields</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className={`rounded-md border px-4 py-3 text-sm ${(result.imported ?? 0) > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <p data-testid="import-result-summary">
                Imported <Numeric>{result.imported ?? 0}</Numeric> · Skipped <Numeric>{result.skipped ?? 0}</Numeric>
              </p>
              {(result.errors?.length ?? 0) > 0 && (
                <ul className="mt-2 list-disc ps-4 text-xs">
                  {result.errors!.slice(0, 8).map((e, i) => (
                    <li key={i}>Row <Numeric>{e.row}</Numeric>: {e.error}</li>
                  ))}
                  {(result.errors?.length ?? 0) > 8 && <li>… and {(result.errors?.length ?? 0) - 8} more</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t p-3">
          <div className="flex gap-2">
            {step === 'mapping' && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setStep('upload')}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {step === 'preview' && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setStep('mapping')}>
                <ArrowLeft className="h-4 w-4" /> Mapping
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            {step === 'upload' && (
              <Button
                disabled={busy || !csvText.trim()}
                className="gap-1.5"
                onClick={() => {
                  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
                  const hdrs = lines[0]?.split(',').map((h) => h.trim().replace(/^"|"$/g, '')) ?? []
                  setHeaders(hdrs)
                  setColumnMap(guessColumnMap(hdrs))
                  setStep('mapping')
                }}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === 'mapping' && (
              <Button disabled={busy || !hasRequiredMapping} className="gap-1.5" onClick={() => void loadPreview()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Preview
              </Button>
            )}
            {step === 'preview' && (
              <Button disabled={busy} className="gap-1.5" onClick={() => void runImport()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import
              </Button>
            )}
            {step === 'result' && (
              <Button onClick={onDone}>Done</Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
