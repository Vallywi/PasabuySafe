-- Migration 005: PasabuySafe Management Enhancements
-- Run this in Supabase SQL Editor AFTER running 004_storage_buckets.sql.
--
-- This migration is purely additive:
--   * New nullable columns on `participants` and `group_buys` to capture
--     per-order delivery details, cancellation timestamps, and the
--     `refund_required` claim flag.
--   * CHECK constraints aligned with Requirement 5 validation copy and the
--     new `cancelled` status value.
--   * Partial indexes for the new query patterns (claimable refunds,
--     cancelled pasabuys).
--   * Strict Row Level Security replacing the permissive MVP policies so
--     buyer contact columns are only readable by the buyer themself or the
--     parent pasabuy's organizer.
--   * A `participants_public` view exposing only non-contact columns to
--     anon/authenticated readers (Explore slot counts).
--   * A `group_buy_history` view that aggregates on-chain
--     `contract_events` with off-chain synthesized streams
--     (participant_joined, order_cancelled, pasabuy_cancelled) for the
--     organizer Transaction History section.
--   * A SECURITY DEFINER RPC `cancel_group_buy(p_group_buy_id uuid)` that
--     atomically transitions a pasabuy to `cancelled` and flags every
--     still-deposited participant with `refund_required = TRUE`.

-- ===========================
-- PARTICIPANTS: new columns
-- ===========================
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS buyer_name      TEXT,
  ADD COLUMN IF NOT EXISTS buyer_contact   TEXT,
  ADD COLUMN IF NOT EXISTS buyer_location  TEXT,
  ADD COLUMN IF NOT EXISTS buyer_note      TEXT,
  ADD COLUMN IF NOT EXISTS refund_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancelled_at    TIMESTAMPTZ;

-- ===========================
-- GROUP_BUYS: new columns
-- ===========================
ALTER TABLE group_buys
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- ===========================
-- CHECK CONSTRAINTS (idempotent)
-- ===========================
-- PostgreSQL does not support `ADD CONSTRAINT IF NOT EXISTS`, so each
-- constraint is wrapped in a DO block that checks pg_constraint first.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participants_buyer_name_len'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_buyer_name_len
      CHECK (buyer_name IS NULL OR char_length(buyer_name) BETWEEN 1 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participants_buyer_location_len'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_buyer_location_len
      CHECK (buyer_location IS NULL OR char_length(buyer_location) BETWEEN 1 AND 250);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participants_buyer_note_len'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_buyer_note_len
      CHECK (buyer_note IS NULL OR char_length(buyer_note) <= 500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participants_buyer_contact_format'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_buyer_contact_format
      CHECK (buyer_contact IS NULL OR buyer_contact ~ '^(\+63|0)[0-9 \-]{7,14}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participants_status_valid'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_status_valid
      CHECK (status IN ('deposited','delivered','confirmed','refunded','cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_buys_status_valid'
  ) THEN
    ALTER TABLE group_buys
      ADD CONSTRAINT group_buys_status_valid
      CHECK (status IN ('active','in_progress','completed','expired','cancelled'));
  END IF;
END$$;

-- ===========================
-- PARTIAL INDEXES
-- ===========================
-- Buyers whose claim entitlement (refund_required = TRUE) is awaiting a
-- post-deadline on-chain refund call. Scoped by group_buy_id so the
-- organizer cancellation flow can quickly enumerate affected rows.
CREATE INDEX IF NOT EXISTS idx_participants_refund_required
  ON participants(group_buy_id)
  WHERE refund_required = TRUE;

-- Cancelled pasabuys are filtered out of the default Explore listing.
CREATE INDEX IF NOT EXISTS idx_group_buys_cancelled
  ON group_buys(status)
  WHERE status = 'cancelled';

-- ===========================
-- ROW LEVEL SECURITY: replace permissive participant policies
-- ===========================
-- Drop the MVP permissive policies introduced in 001_initial_schema.sql.
-- The new policies key on the caller's linked stellar_address via the
-- profiles table so that:
--   (a) a buyer can only read/insert/update their own participants row;
--   (b) the parent pasabuy's organizer can read/update participants rows
--       for the pasabuy they own (for fulfillment + cancellation);
--   (c) no one else can see the buyer_* contact columns.
--
-- Column-level RLS is not natively supported in Postgres, so the
-- non-contact read path goes through the `participants_public` view
-- created below.

DROP POLICY IF EXISTS "Public read participants" ON participants;
DROP POLICY IF EXISTS "Anyone joins as participant" ON participants;
DROP POLICY IF EXISTS "Anyone updates participant" ON participants;

CREATE POLICY "Owner or organizer reads participant" ON participants
  FOR SELECT
  USING (
    buyer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    OR group_buy_id IN (
      SELECT id FROM group_buys
      WHERE organizer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Buyer inserts own participant" ON participants
  FOR INSERT
  WITH CHECK (
    buyer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Buyer or organizer updates participant" ON participants
  FOR UPDATE
  USING (
    buyer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    OR group_buy_id IN (
      SELECT id FROM group_buys
      WHERE organizer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    )
  );

-- ===========================
-- PUBLIC PARTICIPANT VIEW (no contact columns)
-- ===========================
-- Used by the Explore page and the new Pasabuy_Detail_Page to count
-- joined slots without exposing buyer_name / buyer_contact /
-- buyer_location / buyer_note. The view runs as the invoker, but the
-- column projection itself is the security boundary: even a manipulated
-- client cannot select the contact columns through this view because they
-- are not in its definition.

CREATE OR REPLACE VIEW participants_public AS
SELECT
  id,
  group_buy_id,
  buyer_address,
  amount,
  status,
  deposited_at,
  delivered_at,
  confirmed_at,
  refunded_at,
  cancelled_at,
  tx_hash_deposit
FROM participants;

GRANT SELECT ON participants_public TO anon, authenticated;

-- ===========================
-- CONTRACT_EVENTS (defensive create for view dependency)
-- ===========================
-- The `contract_events` table is documented in docs/DATABASE.md and
-- populated by the `sync-events` edge function plus client-side mirrors
-- (Req 7.11). It pre-dates the migration set but is not in any prior
-- migration file. To make this migration self-contained (so the
-- `group_buy_history` view below can be created cleanly on a fresh
-- Postgres instance) we create the table IF NOT EXISTS with the
-- documented schema. On environments where the table already exists this
-- is a no-op.

CREATE TABLE IF NOT EXISTS contract_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  buyer_address TEXT NOT NULL,
  amount BIGINT,
  tx_hash TEXT UNIQUE,
  ledger_sequence BIGINT,
  ledger_timestamp BIGINT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_contract ON contract_events(contract_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON contract_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_buyer ON contract_events(buyer_address);

-- ===========================
-- GROUP_BUY_HISTORY VIEW
-- ===========================
-- Uniform-shape UNION ALL of one on-chain stream and three off-chain
-- synthesized streams. The client filters by group_buy_id and sorts
-- client-side via `compareHistoryEntries` (see
-- src/lib/utils/history.ts) so the deterministic tie-break defined in
-- Req 2.6 is testable as pure code.

CREATE OR REPLACE VIEW group_buy_history AS
-- (1) On-chain events mirrored from the Soroban contract.
SELECT
  gb.id                              AS group_buy_id,
  ce.event_type                      AS event_type,
  ce.buyer_address                   AS actor_address,
  ce.amount                          AS amount_stroops,
  ce.tx_hash                         AS tx_hash,
  to_timestamp(ce.ledger_timestamp)  AS ts,
  1                                  AS event_kind  -- 1 = on-chain
FROM contract_events ce
JOIN group_buys gb ON gb.contract_id = ce.contract_id

UNION ALL

-- (2) Off-chain: a participant joined (== confirmed on-chain deposit
--     immediately followed by the participants row insert).
SELECT
  p.group_buy_id                       AS group_buy_id,
  'participant_joined'::text           AS event_type,
  p.buyer_address                      AS actor_address,
  p.amount                             AS amount_stroops,
  NULL::text                           AS tx_hash,
  p.deposited_at                       AS ts,
  0                                    AS event_kind  -- 0 = off-chain
FROM participants p

UNION ALL

-- (3) Off-chain: buyer cancelled their order (pre-deadline path, before
--     the on-chain refund is claimable).
SELECT
  p.group_buy_id,
  'order_cancelled'::text,
  p.buyer_address,
  NULL::bigint,
  NULL::text,
  p.cancelled_at,
  0
FROM participants p
WHERE p.cancelled_at IS NOT NULL

UNION ALL

-- (4) Off-chain: organizer cancelled the pasabuy.
SELECT
  gb.id,
  'pasabuy_cancelled'::text,
  gb.cancelled_by,
  NULL::bigint,
  NULL::text,
  gb.cancelled_at,
  0
FROM group_buys gb
WHERE gb.cancelled_at IS NOT NULL;

GRANT SELECT ON group_buy_history TO authenticated;

-- ===========================
-- CANCEL_GROUP_BUY RPC
-- ===========================
-- Atomic organizer cancellation. Runs as SECURITY DEFINER so the function
-- can update participants rows it would not normally be able to mutate
-- through RLS, while still gating on the caller's identity. The caller's
-- linked stellar_address must match the pasabuy's organizer_address.
--
-- On success:
--   * group_buys.status      -> 'cancelled'
--   * group_buys.cancelled_at -> now()
--   * group_buys.cancelled_by -> organizer's stellar_address
--   * For each participants row of the pasabuy with status='deposited',
--     refund_required is flipped to TRUE so the buyer can claim a refund
--     on or after the deadline.
--
-- Both writes happen inside the single function body, so PostgreSQL
-- treats them as one transaction. The caller must have already been
-- gated by the UI's CancellationGate decision matrix to ensure no row
-- with status='delivered' exists (Req 1.6); this function additionally
-- guards against the delivered-blocker so a manipulated client cannot
-- bypass the rule.

CREATE OR REPLACE FUNCTION cancel_group_buy(p_group_buy_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_address  TEXT;
  v_organizer       TEXT;
  v_has_delivered   BOOLEAN;
BEGIN
  -- Resolve the caller's linked stellar address from their profile.
  SELECT stellar_address INTO v_caller_address
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_address IS NULL THEN
    RAISE EXCEPTION 'Not authorized: caller has no linked stellar address'
      USING ERRCODE = '42501';
  END IF;

  -- Look up the pasabuy's organizer; row-not-found maps to a clear error.
  SELECT organizer_address INTO v_organizer
  FROM group_buys
  WHERE id = p_group_buy_id;

  IF v_organizer IS NULL THEN
    RAISE EXCEPTION 'Pasabuy % not found', p_group_buy_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_organizer <> v_caller_address THEN
    RAISE EXCEPTION 'Not authorized: only the organizer can cancel this pasabuy'
      USING ERRCODE = '42501';
  END IF;

  -- Guard the delivered-blocker (Req 1.6). Defense in depth on top of
  -- the UI's CancellationGate.
  SELECT EXISTS (
    SELECT 1 FROM participants
    WHERE group_buy_id = p_group_buy_id
      AND status = 'delivered'
  ) INTO v_has_delivered;

  IF v_has_delivered THEN
    RAISE EXCEPTION 'Cannot cancel: pasabuy has orders marked delivered'
      USING ERRCODE = 'P0001';
  END IF;

  -- (1) Transition the pasabuy itself.
  UPDATE group_buys
  SET status       = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_caller_address,
      updated_at   = now()
  WHERE id = p_group_buy_id;

  -- (2) Flag every deposited participant for refund. Buyers will see
  --     ClaimRefundButton on/after the deadline.
  UPDATE participants
  SET refund_required = TRUE
  WHERE group_buy_id = p_group_buy_id
    AND status = 'deposited';
END;
$$;

-- Allow signed-in users to invoke the RPC. The function body enforces
-- the organizer-only rule; non-organizers get an authorization error.
GRANT EXECUTE ON FUNCTION cancel_group_buy(uuid) TO authenticated;

-- ===========================
-- DONE
-- ===========================
-- After running this migration, the management-enhancements feature has
-- the schema, RLS, views, and RPC it needs. Application code can now be
-- updated to consume `participants_public` for public reads,
-- `group_buy_history` for the Transaction History section, and the
-- `cancel_group_buy` RPC for the organizer cancellation flow.
