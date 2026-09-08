import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { ERROR_CLASSES, ERROR_CLASS } from './error-classifier.js'
import { recordDistributionAttempt } from './record-attempt.js'
import { backfillDistributionAttemptErrorClasses } from './backfill-error-class.js'
import { insert } from '../../persistence/index.js'

async function seedJob(pool) {
  const jobId = randomUUID()
  // Minimal parent row — FK requires distribution_jobs.id.
  await pool.query(
    `INSERT INTO public.distribution_jobs (id, platform, status, data)
     VALUES ($1, 'instagram', 'failed', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [jobId],
  )
  return jobId
}

finPostgresSuite('distribution_attempts.error_class', { seed: false }, ({ pool }) => {
  it('migration 317 adds error_class column, CHECK, and partial index', async () => {
    const col = await pool().query(`
      SELECT data_type
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'distribution_attempts'
         AND column_name = 'error_class'
    `)
    expect(col.rows[0]?.data_type).toBe('text')

    const check = await pool().query(`
      SELECT pg_get_constraintdef(oid) AS def
        FROM pg_constraint
       WHERE conrelid = 'public.distribution_attempts'::regclass
         AND conname = 'distribution_attempts_error_class_check'
    `)
    expect(check.rows[0]?.def).toMatch(/auth_expired/)
    expect(check.rows[0]?.def).toMatch(/unknown_error/)

    const idx = await pool().query(`
      SELECT indexname FROM pg_indexes
       WHERE tablename = 'distribution_attempts'
         AND indexname = 'idx_distribution_attempts_error_class'
    `)
    expect(idx.rows[0]?.indexname).toBe('idx_distribution_attempts_error_class')
  })

  it('rejects an invalid error_class via CHECK', async () => {
    const jobId = await seedJob(pool())
    await expect(pool().query(
      `INSERT INTO public.distribution_attempts (id, distribution_job_id, status, error_class)
       VALUES ($1, $2, 'failed', 'not_a_real_class')`,
      [randomUUID(), jobId],
    )).rejects.toThrow(/error_class|check/i)
  })

  it('INSERT via recordDistributionAttempt stores each error class', async () => {
    const samples = [
      { cls: ERROR_CLASS.AUTH_EXPIRED, err: { code: 190, message: 'Error validating access token' } },
      { cls: ERROR_CLASS.PORTAL_RULES_VIOLATION, err: { message: 'violates Community Standards' } },
      { cls: ERROR_CLASS.PORTAL_DOWN, err: { status: 503, message: 'Service Unavailable' } },
      { cls: ERROR_CLASS.QUOTA_EXCEEDED, err: { status: 429, message: 'rate limit exceeded' } },
      { cls: ERROR_CLASS.INVALID_CONTENT, err: { code: 'MISSING_MEDIA', message: 'missing image' } },
      { cls: ERROR_CLASS.UNKNOWN_ERROR, err: { message: 'unexpected provider glitch xyz' } },
    ]

    for (const sample of samples) {
      const jobId = await seedJob(pool())
      const row = await recordDistributionAttempt({
        distributionJobId: jobId,
        status: 'failed',
        error: sample.err,
      })
      expect(row.error_class).toBe(sample.cls)

      const { rows } = await pool().query(
        `SELECT error_class, error_message FROM public.distribution_attempts WHERE id = $1`,
        [row.id],
      )
      expect(rows[0].error_class).toBe(sample.cls)
      expect(rows[0].error_message).toBeTruthy()
    }

    expect(ERROR_CLASSES).toHaveLength(6)
  })

  it('backfill classifies legacy error_message rows and logs unclassified', async () => {
    const jobId = await seedJob(pool())
    const knownId = randomUUID()
    const opaqueId = randomUUID()
    await pool().query(
      `INSERT INTO public.distribution_attempts (id, distribution_job_id, status, error_message, error_class)
       VALUES
         ($1, $3, 'failed', 'Error validating access token: Session has expired', NULL),
         ($2, $3, 'failed', 'weird vendor failure code ZZZ-999', NULL)`,
      [knownId, opaqueId, jobId],
    )

    const logs = []
    const result = await backfillDistributionAttemptErrorClasses({
      pool: pool(),
      logger: { info: (payload) => logs.push(payload) },
    })

    expect(result.scanned).toBeGreaterThanOrEqual(2)
    expect(result.updated).toBeGreaterThanOrEqual(2)
    expect(result.unclassified).toBeGreaterThanOrEqual(1)
    expect(logs[0]?.unclassified).toBe(result.unclassified)

    const { rows } = await pool().query(
      `SELECT id, error_class FROM public.distribution_attempts WHERE id = ANY($1::text[])`,
      [[knownId, opaqueId]],
    )
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.error_class]))
    expect(byId[knownId]).toBe(ERROR_CLASS.AUTH_EXPIRED)
    expect(byId[opaqueId]).toBe(ERROR_CLASS.UNKNOWN_ERROR)
  })

  it('DAL insert accepts error_class on distribution_attempts', async () => {
    const jobId = await seedJob(pool())
    const stored = await insert('distribution_attempts', {
      id: randomUUID(),
      distribution_job_id: jobId,
      status: 'failed',
      error_message: 'rate limit exceeded',
      error_class: ERROR_CLASS.QUOTA_EXCEEDED,
      attempted_at: new Date().toISOString(),
    })
    expect(stored.error_class).toBe(ERROR_CLASS.QUOTA_EXCEEDED)
  })
})
