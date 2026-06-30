'use client';

import { useState } from 'react';
import { Address } from '@stellar/stellar-sdk';
import { useWallet } from '@/lib/hooks/useWallet';
import { invokeContractWithStatus } from '@/lib/stellar/client';
import { mapSorobanError } from '@/lib/stellar/errors';
import { supabase } from '@/lib/supabase/client';

/**
 * MarkDeliveredButton — bounded "mark as delivered" state machine for one
 * participant row in the organizer dashboard.
 *
 * This is the centerpiece of the Vercel "Mark as Delivered" fix
 * (Requirement 7 of `pasabuy-management-enhancements`). The legacy inline
 * handler in `dashboard/organizer/[id]/page.tsx`:
 *   - referenced `result.txHash` (which Soroban's `GetTransactionResponse`
 *     does not actually expose),
 *   - did not handle `sendTransaction` statuses other than ERROR
 *     (`DUPLICATE`, `TRY_AGAIN_LATER` would silently spin),
 *   - had no polling timeout (a wedged RPC stuck the UI forever).
 *
 * Those failure modes are now fully handled by `invokeContractWithStatus`,
 * which throws a typed `InvokeError` for every failure path and returns the
 * canonical `txHash` (sourced from `sendTransaction.hash`) only after the
 * transaction's status is observed as SUCCESS. This component wraps that
 * call with the DB-mirror writes required by the design:
 *
 *   1. Update `participants` row (status='delivered', delivered_at, tx hash).
 *   2. Upsert a `contract_events` row of type 'deliver' so the Transaction
 *      History reflects the action without waiting for the `sync-events`
 *      edge function. The `tx_hash UNIQUE` constraint makes the eventual
 *      reconciliation a no-op.
 *   3. Notify the parent via `onDone()` so it can re-query and re-render.
 *
 * On any error we surface `mapSorobanError(err, 'mark_delivered')` and do
 * NOT mutate the Database (Req 7.3). The button is disabled while in flight
 * (Req 7.9) and re-enabled in `finally` so the organizer can retry without
 * reloading the page (Req 7.10).
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11
 * Design: "Mark-Delivered handler", "MarkDeliveredButton",
 *         "Soroban Integration & 'Mark as Delivered' Fix"
 */
export interface MarkDeliveredButtonProps {
  /** UUID of the parent `group_buys` row (filters the participants update). */
  groupBuyId: string;
  /**
   * UUID of the parent `group_buys.contract_id` (NOT the on-chain contract
   * address). Used as the `contract_id` foreign key on the inserted
   * `contract_events` row so the Transaction_History view can JOIN it back.
   */
  contractId: string;
  /** Stellar address of the buyer being marked delivered. */
  buyerAddress: string;
  /**
   * External disable signal — typically set by the parent when another row
   * is mid-flight, so only one mark-delivered runs at a time across the
   * participant list. The button is also disabled while THIS row is in
   * flight (`loading`).
   */
  disabled?: boolean;
  /** Called after a successful confirmed mark-delivered + DB writes. */
  onDone: () => void;
}

export function MarkDeliveredButton({
  groupBuyId,
  contractId,
  buyerAddress,
  disabled,
  onDone,
}: MarkDeliveredButtonProps) {
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleMarkDelivered() {
    if (!publicKey) {
      // No connected wallet — the organizer page already gates this, but be
      // defensive so we never throw inside the on-chain call with a null key.
      setErrorMessage('Connect your wallet to mark this order delivered.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Build the buyer ScVal argument. The contract's `mark_delivered`
      //    method takes a single buyer Address.
      const buyerScVal = new Address(buyerAddress).toScVal();

      // 2. Invoke the contract. This call only resolves once
      //    getTransaction has returned SUCCESS, or it throws an InvokeError.
      const { txHash } = await invokeContractWithStatus(
        'mark_delivered',
        [buyerScVal],
        publicKey
      );

      // 3. Update the participants row — only AFTER on-chain confirmation
      //    (Req 7.2, 7.3). RLS allows this update only for the organizer or
      //    the buyer themself; the organizer dashboard already gates by
      //    organizer_address, so this should always succeed.
      await supabase
        .from('participants')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          tx_hash_confirm: txHash,
        })
        .eq('group_buy_id', groupBuyId)
        .eq('buyer_address', buyerAddress);

      // 4. Mirror the on-chain event into contract_events so the Transaction
      //    History reflects the action immediately, without waiting for the
      //    sync-events poller. `tx_hash` is UNIQUE on the table so the
      //    eventual reconciliation is idempotent (Req 7.11).
      await supabase.from('contract_events').upsert(
        {
          contract_id: contractId,
          event_type: 'deliver',
          buyer_address: buyerAddress,
          amount: null,
          tx_hash: txHash,
          ledger_sequence: null,
          ledger_timestamp: Math.floor(Date.now() / 1000),
        },
        { onConflict: 'tx_hash' }
      );

      // 5. Notify the parent so it can refresh the row within 2 seconds
      //    (Req 7.2). We intentionally do NOT optimistically mutate any UI
      //    state here — the parent owns the row list.
      onDone();
    } catch (err) {
      // 6. Any failure path: surface the mapped message and DO NOT touch
      //    the DB (Req 7.3).
      // eslint-disable-next-line no-console
      console.error('[PasabuySafe] mark_delivered failed:', err);
      setErrorMessage(mapSorobanError(err, 'mark_delivered'));
    } finally {
      // 7. Always re-enable the button so the organizer can retry without a
      //    page reload (Req 7.10).
      setLoading(false);
    }
  }

  const isDisabled = Boolean(disabled) || loading;

  return (
    <div className="inline-flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleMarkDelivered}
        disabled={isDisabled}
        aria-busy={loading}
        className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {loading ? 'Marking...' : '📦 Mark Delivered'}
      </button>

      {errorMessage && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-right max-w-xs"
        >
          <p className="text-xs text-red-700 font-medium">⚠️ {errorMessage}</p>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-red-600 hover:text-red-700 font-medium mt-1 underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
