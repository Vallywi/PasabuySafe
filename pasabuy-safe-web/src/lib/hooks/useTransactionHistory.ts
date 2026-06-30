'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { compareHistoryEntries } from '@/lib/utils/history';

/**
 * One row of the organizer's Transaction_History, shaped to match the
 * `group_buy_history` view created in migration 005:
 *
 *   - On-chain stream:  event_type ∈ {deposit, deliver, release, refund}
 *                       event_kind = 1
 *                       tx_hash, amount_stroops typically non-null
 *   - Off-chain stream: event_type ∈ {participant_joined, order_cancelled,
 *                                     pasabuy_cancelled}
 *                       event_kind = 0
 *                       tx_hash always null; amount_stroops non-null only
 *                       for `participant_joined`
 *
 * `ts` arrives as an ISO 8601 string from the view's `to_timestamp(...)`
 * or `TIMESTAMPTZ` columns. It is sorted by `compareHistoryEntries`
 * (timestamp DESC, then canonical event_type tie-break) — see
 * `src/lib/utils/history.ts` for the rule.
 *
 * Validates: Requirements 2.2, 2.3, 2.4, 2.6, 2.8, 2.9, 2.11.
 */
export interface TransactionHistoryEntry {
  group_buy_id: string;
  event_type:
    | 'deposit'
    | 'deliver'
    | 'release'
    | 'refund'
    | 'participant_joined'
    | 'order_cancelled'
    | 'pasabuy_cancelled';
  actor_address: string;
  amount_stroops: number | null;
  tx_hash: string | null;
  ts: string;
  event_kind: 0 | 1;
}

/**
 * Discriminated union covering the three render paths the
 * `TransactionHistory` component must distinguish (Req 2.8, 2.9, 2.11):
 *
 *   - `loading` — query in flight; render skeleton rows only.
 *   - `ready`   — query resolved; render `entries` (may be empty).
 *   - `error`   — query rejected; render the error message + Retry.
 *
 * The three kinds are mutually exclusive so the component can switch on
 * `state.kind` and never accidentally render two paths at once.
 */
export type TransactionHistoryState =
  | { kind: 'loading' }
  | { kind: 'ready'; entries: TransactionHistoryEntry[] }
  | { kind: 'error'; message: string };

export interface UseTransactionHistoryResult {
  state: TransactionHistoryState;
  /**
   * Re-runs the `group_buy_history` query without a full page reload
   * (Req 2.9). The hook flips back to `{ kind: 'loading' }` while the
   * retry is in flight; subsequent calls during an in-flight query are
   * harmless — only the most recent result will be applied.
   */
  retry: () => void;
}

/**
 * React hook that powers the organizer's `TransactionHistory` section.
 *
 * On mount (and on every `retry()` invocation) it queries the
 * `group_buy_history` Postgres view filtered by `group_buy_id`, sorts
 * the result client-side via the pure `compareHistoryEntries` helper,
 * and exposes the result as a discriminated-union `state`.
 *
 * The hook does NOT enforce organizer-only access on its own; the
 * underlying tables (`contract_events`, `participants`, `group_buys`)
 * carry their own RLS policies, and the calling component should
 * additionally gate the section by comparing the signed-in wallet's
 * `stellar_address` to `group_buys.organizer_address` (Req 2.1, 2.2).
 */
export function useTransactionHistory(
  groupBuyId: string,
): UseTransactionHistoryResult {
  const [state, setState] = useState<TransactionHistoryState>({ kind: 'loading' });

  // Monotonically increasing query id. Each `run()` invocation grabs a
  // fresh id and only applies its result if no newer run has started
  // since — protects against (a) the component unmounting mid-query and
  // (b) the user clicking Retry while a previous query is still in
  // flight.
  const queryIdRef = useRef(0);
  const mountedRef = useRef(true);

  const run = useCallback(async () => {
    const myId = ++queryIdRef.current;
    setState({ kind: 'loading' });

    try {
      const { data, error } = await supabase
        .from('group_buy_history')
        .select('*')
        .eq('group_buy_id', groupBuyId);

      // Stale response (a newer run took over, or we unmounted): drop it.
      if (!mountedRef.current || myId !== queryIdRef.current) return;

      if (error) {
        setState({ kind: 'error', message: error.message });
        return;
      }

      const rows = (data ?? []) as TransactionHistoryEntry[];
      // `compareHistoryEntries` is pure; sort a fresh copy so we never
      // mutate Supabase's internal cache representation.
      const entries = [...rows].sort(compareHistoryEntries);
      setState({ kind: 'ready', entries });
    } catch (err) {
      if (!mountedRef.current || myId !== queryIdRef.current) return;
      const message =
        err instanceof Error ? err.message : 'Failed to load transaction history.';
      setState({ kind: 'error', message });
    }
  }, [groupBuyId]);

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => {
      // Bump the query id so any in-flight response is treated as stale.
      mountedRef.current = false;
      queryIdRef.current++;
    };
  }, [run]);

  const retry = useCallback(() => {
    // Re-run regardless of current state; the queryId guard handles any
    // overlap with a still-pending previous query.
    run();
  }, [run]);

  return { state, retry };
}
