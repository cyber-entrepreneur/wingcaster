/**
 * AGT-HTX-003 — Closed-transaction CSV import route.
 */
import { z } from 'zod'
import { findOne } from '../../db.js'
import { importClosedTransactionsCsv } from '../../closed-transactions.js'

const importSchema = z
  .object({
    csv_text: z.string().min(1).max(500_000),
  })
  .strict()

export function registerRoutes(app, { authMiddleware, logActivity }) {
  app.post('/api/closed-transactions/import', authMiddleware, async (req, res) => {
    try {
      const parsed = importSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      }
      const agent = await findOne('agents', (a) => a.id === req.user.id)
      const agencyId = agent?.agency_id || null
      const result = await importClosedTransactionsCsv({
        csvText: parsed.data.csv_text,
        agentId: req.user.id,
        agencyId,
      })
      if (logActivity) {
        await logActivity({
          type: 'closed_transactions_csv_imported',
          agent_id: req.user.id,
          meta: { imported: result.imported, skipped: result.skipped },
        })
      }
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })
}
