-- BE-BLOCKER-34 ledger preview accounts
CREATE TABLE IF NOT EXISTS fin.ledger_preview_accounts (
  account_code TEXT PRIMARY KEY,
  account_label TEXT NOT NULL,
  normal_side TEXT NOT NULL CHECK (normal_side IN ('debit', 'credit')),
  workflow_codes TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO fin.ledger_preview_accounts (account_code, account_label, normal_side, workflow_codes) VALUES
  ('2110', 'Credit reserve (liability)', 'credit', ARRAY['WF-08']),
  ('5310', 'Promotional credit expense', 'debit', ARRAY['WF-08']),
  ('1100', 'Accounts receivable', 'debit', ARRAY['WF-09', 'WF-14']),
  ('4100', 'Revenue adjustment', 'credit', ARRAY['WF-09', 'WF-14']),
  ('2100', 'Vendor payable', 'credit', ARRAY['WF-20']),
  ('5200', 'Vendor cost of services', 'debit', ARRAY['WF-20'])
ON CONFLICT (account_code) DO NOTHING;
GRANT SELECT ON fin.ledger_preview_accounts TO fin_app_role, fin_finance_role, fin_auditor_role;
