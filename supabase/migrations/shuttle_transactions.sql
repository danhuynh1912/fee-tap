-- ── shuttle_transactions ─────────────────────────────────────────────────────
-- Event-sourced inventory ledger for shuttlecocks.
-- Each row is either a restock (delta > 0) or a deduction (delta < 0).
-- currentStock = SUM(delta) for a club.

CREATE TABLE IF NOT EXISTS shuttle_transactions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id         uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  delta           integer NOT NULL,
  source          text NOT NULL CHECK (source IN ('restock', 'session_log', 'estimated', 'adjustment', 'opening')),
  session_log_id  uuid REFERENCES session_logs(id) ON DELETE SET NULL,
  session_date    date,     -- date of the session (for estimated / session_log deductions)
  rate_used       numeric,  -- estimated_shuttlecocks at time of write
  note            text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shuttle_txns_club_idx          ON shuttle_transactions(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shuttle_txns_session_date_idx  ON shuttle_transactions(club_id, session_date);
CREATE INDEX IF NOT EXISTS shuttle_txns_session_log_idx   ON shuttle_transactions(session_log_id) WHERE session_log_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE shuttle_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shuttle_txns_select" ON shuttle_transactions
  FOR SELECT TO authenticated
  USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM clubs WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "shuttle_txns_insert" ON shuttle_transactions
  FOR INSERT TO authenticated
  WITH CHECK (club_id IN (SELECT id FROM clubs WHERE owner_id = auth.uid()));

CREATE POLICY "shuttle_txns_update" ON shuttle_transactions
  FOR UPDATE TO authenticated
  USING (club_id IN (SELECT id FROM clubs WHERE owner_id = auth.uid()));

CREATE POLICY "shuttle_txns_delete" ON shuttle_transactions
  FOR DELETE TO authenticated
  USING (club_id IN (SELECT id FROM clubs WHERE owner_id = auth.uid()));

-- ── Migrate existing inventory clubs ─────────────────────────────────────────
-- Convert shuttle_stock (boxes) → opening balance transaction (balls).
INSERT INTO shuttle_transactions (club_id, delta, source, note, created_at)
SELECT
  club_id,
  COALESCE(shuttle_stock, 0) * 12,
  'opening',
  'Migrated from shuttle_stock',
  COALESCE(updated_at, now())
FROM club_settings
WHERE shuttle_mode = 'inventory' AND COALESCE(shuttle_stock, 0) > 0
ON CONFLICT DO NOTHING;
