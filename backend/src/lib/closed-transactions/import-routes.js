/**
 * AGT-HTX-003 — Import closed transactions (CSV backfill).
 *
 *   POST /api/closed-transactions/import   bulk-import historical closings
 */
import { z } from 'zod'
import { findOne } from '../../db.js'
import { importClosedTransactionsCsv } from '../../closed-transactions.js'
import { previewClosedTransactionsCsv } from './csv.js'

const columnMapSchema = z.record(z.string().min(1).max(64), z.string().min(1).max(128))

const importSchema = z
  .object({
    csv_text: z.string().min(1).max(500_000),
    column_map: columnMapSchema.optional(),
    filename: z.string().max(255).nullish(),
    preview_only: z.boolean().optional(),
  })
  .strict()

export function registerRoutes(app, { authMiddleware, logActivity }) {
  app.post('/api/closed-transactions/import', authMiddleware, async (req, res) => {
    const parsed = importSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid import payload', details: parsed.error.flatten() })
    }
    const { csv_text: csvText, column_map: columnMap, filename, preview_only: previewOnly } = parsed.data

    if (previewOnly) {
      return res.json(previewClosedTransactionsCsv({ csvText, columnMap }))
    }

    try {
      const agent = await findOne('agents', (a) => a.id === req.user.id)
      const agencyId = agent?.agency_id || null
      const result = await importClosedTransactionsCsv({
        csvText,
        agentId: req.user.id,
        agencyId,
        columnMap,
        filename,
      })
      if (logActivity) {
        await logActivity({
          type: 'closed_transactions_csv_imported',
          agent_id: req.user.id,
          meta: {
            imported: result.imported,
            skipped: result.skipped,
            import_id: result.import_id,
            filename: filename || null,
          },
        })
      }
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })
}
