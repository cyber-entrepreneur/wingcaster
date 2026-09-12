/** BE-APR-EXEC-07 — double-entry ledger-impact preview. */

function money(n) {
  if (n == null || !Number.isFinite(Number(n))) return null
  return Number(n).toFixed(2)
}

function totals(rows) {
  let debit = 0
  let credit = 0
  for (const row of rows) {
    if (row.debit != null) debit += Number(row.debit)
    if (row.credit != null) credit += Number(row.credit)
  }
  const d = money(debit)
  const c = money(credit)
  const balanced = d === c
  return {
    debit: d,
    credit: c,
    balanced,
    delta: balanced ? '0.00' : money(Math.abs(debit - credit)),
  }
}

export async function buildLedgerImpact(client, {
  workflowCode, amountMinor, currency = 'AED',
}) {
  const financial = new Set(['WF-08', 'WF-09', 'WF-14', 'WF-20'])
  if (!financial.has(workflowCode)) return null

  const amount = Number(amountMinor || 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    if (workflowCode === 'WF-09') {
      return {
        currency,
        rows: [],
        totals: { debit: '0.00', credit: '0.00', balanced: true, delta: '0.00' },
        balanced: true,
      }
    }
    return null
  }

  const major = amount
  const { rows: accounts } = await client.query(
    `SELECT account_code, account_label, normal_side
       FROM fin.ledger_preview_accounts
      WHERE active = true
        AND $1 = ANY (workflow_codes)
      ORDER BY account_code`,
    [workflowCode],
  )

  let previewRows
  if (accounts.length >= 2) {
    const debitAcct = accounts.find((a) => a.normal_side === 'debit') || accounts[0]
    const creditAcct = accounts.find((a) => a.normal_side === 'credit') || accounts[1]
    previewRows = [
      {
        account_code: creditAcct.account_code,
        account_label: creditAcct.account_label,
        debit: null,
        credit: money(major),
      },
      {
        account_code: debitAcct.account_code,
        account_label: debitAcct.account_label,
        debit: money(major),
        credit: null,
      },
    ]
  } else if (workflowCode === 'WF-08') {
    previewRows = [
      {
        account_code: '2110',
        account_label: 'Credit reserve (liability)',
        debit: null,
        credit: money(major),
      },
      {
        account_code: '5310',
        account_label: 'Promotional credit expense',
        debit: money(major),
        credit: null,
      },
    ]
  } else {
    return null
  }

  const t = totals(previewRows)
  return {
    currency,
    rows: previewRows,
    totals: { debit: t.debit, credit: t.credit },
    balanced: t.balanced,
    delta: t.delta,
  }
}

export function assertLedgerBalanced(ledgerImpact) {
  if (!ledgerImpact) return
  if (ledgerImpact.balanced === false) {
    const err = new Error('LEDGER_PREVIEW_UNBALANCED')
    err.code = 'LEDGER_PREVIEW_UNBALANCED'
    err.delta = ledgerImpact.delta || '0.00'
    throw err
  }
}
