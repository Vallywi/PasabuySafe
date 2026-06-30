'use client';

import { useCallback, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

/**
 * Organizer cancellation gate for a pasabuy.
 *
 * The shape is derived purely from the current set of participants and the
 * pasabuy's deadline. It encodes the four rows of the design's
 * "Cancellation Flow Decision Matrix" (rows 1–4):
 *
 *   - `allowed_simple`        — no `deposited` or `delivered` rows; clean cancel.
 *   - `allowed_with_refund`   — ≥1 `deposited` row and 0 `delivered` rows.
 *                               `deadlinePassed` distinguishes the
 *                               post-deadline branch (buyers can claim
 *                               on-chain refund immediately) from the
 *                               pre-deadline branch (requires explicit
 *                               organizer confirmation; buyers claim later).
 *   - `blocked_has_delivered` — ≥1 `delivered` row; cancellation is refused.
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.8.
 */
export type CancellationGate =
  | { kind: 'allowed_simple' }
  | {
      kind: 'allowed_with_refund';
      deadlinePassed: boolean;
      affectedBuyers: Array<{ address: string; amount: number }>;
    }
  | { kind: 'blocked_has_delivered' };

export interface UseCancelPasabuyParticipant {
  buyer_address: string;
  amount: number;
  status: string;
}

export interface UseCancelPasabuyOptions {
  onCancelled?: () => void;
}

export interface UseCancelPasabuyResult {
  gate: CancellationGate;
  cancel: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

function computeGate(
  participants: ReadonlyArray<UseCancelPasabuyParticipant>,
  deadline: string | Date,
): CancellationGate {
  // Defense in depth: the SECURITY DEFINER RPC also guards this branch.
  const hasDelivered = participants.some((p) => p.status === 'delivered');
  if (hasDelivered) {
    return { kind: 'blocked_has_delivered' };
  }

  const depositedRows = participants.filter((p) => p.status === 'deposited');
  if (depositedRows.length === 0) {
    return { kind: 'allowed_simple' };
  }

  const deadlineMs = deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime();
  const deadlinePassed = Date.now() >= deadlineMs;

  return {
    kind: 'allowed_with_refund',
    deadlinePassed,
    affectedBuyers: depositedRows.map((p) => ({
      address: p.buyer_address,
      amount: p.amount,
    })),
  };
}

/**
 * React hook that powers the `CancelPasabuyDialog`.
 *
 * The hook does NOT trigger any cancellation on its own. It computes the
 * `gate` from the supplied `participants` + `deadline` and returns a
 * `cancel` callback the consumer must invoke explicitly. On success the
 * optional `onCancelled` callback fires so the parent can refresh the
 * pasabuy + participants + transaction history.
 */
export function useCancelPasabuy(
  groupBuyId: string,
  participants: ReadonlyArray<UseCancelPasabuyParticipant>,
  deadline: string | Date,
  options: UseCancelPasabuyOptions = {},
): UseCancelPasabuyResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize the gate so it doesn't recompute on every render. The
  // participants array reference and the deadline value are the only
  // inputs that should trigger a recompute.
  const gate = useMemo(
    () => computeGate(participants, deadline),
    [participants, deadline],
  );

  const { onCancelled } = options;

  const cancel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('cancel_group_buy', {
        p_group_buy_id: groupBuyId,
      });
      if (rpcError) {
        throw new Error(rpcError.message);
      }
      onCancelled?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel pasabuy.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [groupBuyId, onCancelled]);

  return { gate, cancel, loading, error };
}
