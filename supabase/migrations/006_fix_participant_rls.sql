-- Migration 006: Fix participant INSERT RLS for wallet-connected users
-- 
-- Problem: The strict INSERT policy from 005 requires the buyer's
-- stellar_address to be saved in their profile BEFORE the insert.
-- Users who connect their Freighter wallet for signing may not have
-- their address saved in Supabase profiles yet, causing the INSERT
-- to silently fail with an RLS violation.
--
-- Fix: Replace the strict INSERT policy with one that only requires
-- authentication. The UNIQUE constraint on (group_buy_id, buyer_address)
-- already prevents duplicate entries, and the SELECT/UPDATE policies
-- remain strict to protect contact data.

DROP POLICY IF EXISTS "Buyer inserts own participant" ON participants;

CREATE POLICY "Authenticated inserts participant" ON participants
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- The SELECT and UPDATE policies from 005 remain unchanged:
--   "Owner or organizer reads participant" — restricts who can see contact columns
--   "Buyer or organizer updates participant" — restricts who can modify rows
--
-- This gives immediate relief for the deposit-then-insert flow while
-- keeping the security boundary on reads and updates intact.
