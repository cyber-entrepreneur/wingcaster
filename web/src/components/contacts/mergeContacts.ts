/** AGT-CTC-004 — client-side merge preview helpers. */

export type MergeFieldKey = 'name' | 'email' | 'phone' | 'status' | 'source'
export type MergeFieldSide = 'source' | 'target'

export type MergeContactShape = {
  id: string
  name?: string
  email?: string
  phone?: string
  status?: string
  source?: string
  tags?: string[]
}

export const MERGE_FIELDS: Array<{ key: MergeFieldKey; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'source', label: 'Source' },
]

export function defaultFieldSelections(
  source: MergeContactShape,
  target: MergeContactShape,
): Record<MergeFieldKey, MergeFieldSide> {
  const selections: Record<MergeFieldKey, MergeFieldSide> = {
    name: 'source',
    email: 'source',
    phone: 'source',
    status: 'source',
    source: 'source',
  }
  for (const { key } of MERGE_FIELDS) {
    const sVal = source[key]
    const tVal = target[key]
    if (!sVal && tVal) selections[key] = 'target'
  }
  if (source.status !== 'client' && target.status === 'client') selections.status = 'target'
  return selections
}

export function buildMergePreview(
  source: MergeContactShape,
  target: MergeContactShape,
  selections: Record<MergeFieldKey, MergeFieldSide>,
): MergeContactShape {
  const pick = (key: MergeFieldKey) => {
    const side = selections[key]
    const primary = side === 'target' ? target : source
    const fallback = side === 'target' ? source : target
    const value = primary[key]
    if (value != null && value !== '') return value
    const alt = fallback[key]
    return alt != null && alt !== '' ? alt : value
  }
  const status =
    source.status === 'client' || target.status === 'client'
      ? 'client'
      : (pick('status') || source.status || target.status)
  return {
    id: source.id,
    name: pick('name'),
    email: pick('email'),
    phone: pick('phone'),
    status,
    source: pick('source'),
    tags: Array.from(new Set([...(source.tags || []), ...(target.tags || [])])),
  }
}
