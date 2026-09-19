/**
 * AGT-HTX-003 — lightweight CSV parser (mirrors backend closed-transactions/csv.js).
 */

export function splitCsvRow(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && line[i + 1] === '"' && inQuotes) { cur += '"'; i++; continue }
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

export function parseSimpleCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!lines.length) return { headers: [], rows: [] }
  const headers = splitCsvRow(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i])
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] != null ? String(cells[idx]).trim() : ''
    })
    rows.push(obj)
  }
  return { headers, rows }
}

export async function readCsvFile(file: File): Promise<string> {
  return await file.text()
}
