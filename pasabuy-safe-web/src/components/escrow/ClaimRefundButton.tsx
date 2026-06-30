'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { useWallet } from '@/lib/hooks/useWallet';
import { invokeContractWithStatus } from '@/lib/stellar/client';
import { mapSorobanError } from '@/lib/stellar/errors';
import { supabase } from '@/lib/supabase/client';

/**
 * ClaimRefundButton — post-cancellation, post-deadline refund claim.
 *
 * This component is distinct from the existing `RefundButton`. It is rendered
 * on the buyer's order page after the buyer has already cancelled their order
 * pre-deadline (which sets `participants.status = 'cancelled'` and
 * `refund_required = true`). Once the pasabuy's deadline has passed, the
 * buyer returns and uses this button to invoke the on-chain `refund` so the
 * row can transition from `cancelled` to `refunded`.
 *
 * Visibility (Req 6.5):
 *   visible := participant.status === 'cancelled'
 *           && participant.refund_required === true
 *           && now() >= group_buy.deadline
 *
 * Behavior:
 *   1. On click, build `buyerScVal` from the connected wallet's public key
 *      and call `invokeContractWithStatus('refund', [buyerScVal], publicKey)`.
 *   2. On confirmed on-chain SUCCESS, update the `participants` row to
 *      `status='refunded'`, `refunded_at=now()`, `refund_required=false`,
 *      `tx_hash_confirm=<txHash>` (Req 6.6).
 *   3. Upsert a `contract_events` row of type `refund` (idempotent on
 *      `tx_hash`) so the Transaction_History reflects the refund without
 *      waiting for the `sync-events` poller.
 *   4. Call `onClaimed()` so the parent page can re-fetch.
 *   5. On any failure, surface `mapSorobanError(err, 'refund')`, do NOT
 *      mutate the DB, and re-enable the button so the buyer can retry
 *      (Req 6.7, 6.8, 7.10).
 *
 * Design: `ClaimRefundButton`, `Refund_Required` Flow
 * Requirements: 6.5, 6.6, 6.7, 6.8
 */
export interface ClaimRefundButtonProps {
  participant: {
    id: string;
    group_buy_id: string;
    buyer_address: string;
    /** Amount in stroops (1 XLM = 10^7 stroops). */
    amount: number;
    status: string;
    refund_required: boolean;
  };
  groupBuy: {
    /** `group_buys.id` — used as the `contract_id` on the mirrored event row. */
    id: string;
    /** ISO 8601 timestamp. */
    deadline: string;
    /** The on-chain pasabuy_id (numeric string). */
    contractId: string;
  };
  onClaimed: () => void;
}

export function ClaimRefundButton({
  participant,
  groupBuy,
  onClaimed,
}: ClaimRefundButtonProps) {
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Visibility predicate (Req 6.5). An Invalid Date from a malformed
  // `groupBuy.deadline` will fail every comparison, so the button stays
  // hidden — the safer default since we cannot know whether the deadline
  // has actually passed.
  const deadline = new Date(groupBuy.deadline);
  const deadlinePassed =
    !Number.isNaN(deadline.getTime()) && new Date() >= deadline;
  const visible =
    participant.status === 'cancelled' &&
    participant.refund_required === true &&
    deadlinePassed;

  if (!visible) {
    return null;
  }

  const amountXlm = (participant.amount / 10_000_000).toFixed(0);

  async function handleClaim() {
    if (!publicKey) {
      setErrorMessage('Connect your wallet to claim your refund.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const pasabuyIdScVal = nativeToScVal(BigInt(groupBuy.contractId), { type: 'u64' });
      const buyerScVal = new Address(publicKey).toScVal();

      const { txHash } = await invokeContractWithStatus(
        'refund',
        [pasabuyIdScVal, buyerScVal],
        publicKey
      );

      // 1. Update the participants row — only AFTER on-chain confirmation
      //    (Req 6.6). We clear `refund_required` in the same write so the
      //    button cannot re-render after a successful claim.
      await supabase
        .from('participants')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString(),
          refund_required: false,
          tx_hash_confirm: txHash,
        })
        .eq('id', participant.id);

      // 2. Mirror the on-chain event into contract_events so the
      //    Transaction_History reflects the refund immediately. The UNIQUE
      //    constraint on tx_hash makes the eventual reconciliation from
      //    `sync-events` idempotent.
      await supabase.from('contract_events').upsert(
        {
          contract_id: groupBuy.id,
          event_type: 'refund',
          buyer_address: publicKey,
          amount: participant.amount,
          tx_hash: txHash,
          ledger_timestamp: Math.floor(Date.now() / 1000),
        },
        { onConflict: 'tx_hash' }
      );

      onClaimed();
    } catch (err) {
      // Per Req 6.7 (#6 → "Refund is not yet available…") and Req 6.8 (#4 →
      // "No deposit found for this order. It may have already been
      // refunded.") the `'refund'` context drives the context-sensitive copy.
      // No DB mutation runs on any error path.
      setErrorMessage(mapSorobanError(err, 'refund'));
    } finally {
      // Always re-enable the button so the buyer can retry without
      // reloading the page (Req 7.10 parity for refund flow).
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border-2 border-amber-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-3xl" aria-hidden>
          💰
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Claim your refund</h3>
          <p className="text-sm text-slate-600 mt-0.5">
            You cancelled this order. The deadline has passed, so you can now
            refund {amountXlm} XLM on-chain.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleClaim}
        disabled={loading}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white py-3.5 rounded-xl font-medium transition-colors shadow-lg shadow-amber-200"
      >
        {loading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Claiming refund…
          </span>
        ) : (
          `Claim refund (${amountXlm} XLM)`
        )}
      </button>

      <AnimatePresence>
        {errorMessage && (
          <motion.div
            key="claim-refund-error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-3 mt-4"
            role="alert"
          >
            <p className="text-sm text-red-700 font-medium">
              ⚠️ {errorMessage}
            </p>
            <button
              type="button"
              onClick={handleClaim}
              disabled={loading}
              className="text-sm text-red-600 hover:text-red-700 disabled:text-red-300 font-medium mt-2 underline"
            >
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
