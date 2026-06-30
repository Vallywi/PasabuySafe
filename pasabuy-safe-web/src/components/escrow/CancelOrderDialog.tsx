'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { useWallet } from '@/lib/hooks/useWallet';
import { invokeContractWithStatus } from '@/lib/stellar/client';
import { mapSorobanError } from '@/lib/stellar/errors';
import { supabase } from '@/lib/supabase/client';

/**
 * CancelOrderDialog — buyer "Cancel order" confirmation modal.
 *
 * This component renders the buyer-side cancellation flow defined by
 * Requirement 6 of `pasabuy-management-enhancements`. The decision is made
 * entirely on the pasabuy's `deadline`:
 *
 *   Pre-deadline (deadline > now)
 *     -> Off-chain only. Mark `participants.status='cancelled'`,
 *        `cancelled_at=now()`, `refund_required=true`. The buyer comes back
 *        after the deadline and uses ClaimRefundButton to call `refund`.
 *        (Req 6.4, design "Cancellation Flow Decision Matrix" row 5)
 *
 *   Post-deadline (deadline <= now)
 *     -> On-chain refund. Invoke `invokeContractWithStatus('refund', ...)`,
 *        then on confirmation update `participants.status='refunded'`,
 *        `refunded_at=now()`, `refund_required=false`,
 *        `tx_hash_confirm=<hash>`, and upsert a `contract_events` row of
 *        type `refund` (idempotent on `tx_hash`).
 *        (Req 6.3, 6.6, design "Cancellation Flow Decision Matrix" row 6)
 *
 * On any error we surface `mapSorobanError(err, 'refund')` and do NOT
 * mutate the DB. The confirm button is disabled while the call is in
 * flight (so the buyer can't double-submit) and re-enabled on error so
 * they can retry without a page reload.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 6.9
 * Design: "CancelOrderDialog", "Cancellation Flow Decision Matrix" rows 5-6
 */
export interface CancelOrderDialogProps {
  participant: {
    id: string;
    group_buy_id: string;
    buyer_address: string;
    /** Amount in stroops (1 XLM = 10^7 stroops). */
    amount: number;
    status: string;
  };
  groupBuy: {
    id: string;
    title: string;
    /** ISO 8601 timestamp. */
    deadline: string;
    /** The on-chain pasabuy_id (numeric string). */
    contractId: string;
  };
  onClose: () => void;
  onCancelled: () => void;
}

type Phase = 'idle' | 'submitting' | 'error';

export function CancelOrderDialog({
  participant,
  groupBuy,
  onClose,
  onCancelled,
}: CancelOrderDialogProps) {
  const { publicKey } = useWallet();
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute the deadline branch once per render. `new Date(undefined-ish)`
  // would produce an Invalid Date whose `>` comparison is always false, so
  // a bad deadline string falls through to the post-deadline (refund)
  // branch — which is the safer of the two (it cannot silently mark a row
  // cancelled without an on-chain action).
  const deadlinePassed = new Date(groupBuy.deadline) <= new Date();
  const amountXlm = (participant.amount / 10_000_000).toFixed(0);

  /**
   * Pre-deadline path: off-chain status flip only. No Soroban call,
   * no wallet required, no contract_events row.
   *
   * The strict RLS policy from migration 005 allows this update only when
   * the caller is the buyer themself (or the organizer). An attempt to
   * cancel another user's order is rejected at the DB layer; we surface
   * the spec-defined message in that case (Req 6.9).
   */
  async function handlePreDeadlineCancel() {
    setPhase('submitting');
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from('participants')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          refund_required: true,
        })
        .eq('id', participant.id);

      if (error) {
        // RLS denial surfaces as a Postgres permission error. We map it to
        // the exact copy from Req 6.9 ("You can only cancel your own
        // order.") so the buyer sees a useful message rather than a
        // raw Supabase error string.
        const denied = /row.+level.+security|permission/i.test(error.message);
        setErrorMessage(
          denied
            ? 'You can only cancel your own order.'
            : 'Could not cancel your order. Please try again.'
        );
        setPhase('error');
        return;
      }

      onCancelled();
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not cancel your order. Please try again.'
      );
      setPhase('error');
    }
  }

  /**
   * Post-deadline path: on-chain refund. The DB write and the
   * contract_events upsert run only after `invokeContractWithStatus`
   * resolves with a confirmed SUCCESS status (Req 6.3, 6.6). Any failure
   * mode produced by the client (signing_rejected, contract_error,
   * network_unreachable, timeout, etc.) is routed through mapSorobanError
   * with the `'refund'` context so #4 renders the refund-specific copy
   * "No deposit found for this order. It may have already been refunded."
   * (Req 6.8) and #6 renders "Refund is not yet available. Try again
   * after the deadline." (Req 6.7).
   */
  async function handlePostDeadlineRefund() {
    if (!publicKey) {
      setErrorMessage('Connect your wallet to claim your refund.');
      setPhase('error');
      return;
    }

    setPhase('submitting');
    setErrorMessage(null);

    try {
      const pasabuyIdScVal = nativeToScVal(BigInt(groupBuy.contractId), { type: 'u64' });
      const buyerScVal = new Address(publicKey).toScVal();

      const { txHash } = await invokeContractWithStatus(
        'refund',
        [pasabuyIdScVal, buyerScVal],
        publicKey
      );

      // 1. Update the participants row — only AFTER on-chain confirmation.
      //    We clear refund_required in the same write so a previously
      //    pre-deadline-cancelled row also lands in the correct terminal
      //    state via this dialog (Req 6.6).
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
      //    Transaction_History reflects it without waiting for the
      //    sync-events poller. The UNIQUE constraint on tx_hash makes the
      //    eventual reconciliation idempotent.
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

      onCancelled();
      onClose();
    } catch (err) {
      setErrorMessage(mapSorobanError(err, 'refund'));
      setPhase('error');
    }
  }

  async function handleConfirm() {
    if (deadlinePassed) {
      await handlePostDeadlineRefund();
    } else {
      await handlePreDeadlineCancel();
    }
  }

  const isSubmitting = phase === 'submitting';
  const confirmDisabled = isSubmitting;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-order-dialog-title"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="text-3xl" aria-hidden>
            {deadlinePassed ? '💰' : '⏸️'}
          </div>
          <div className="flex-1">
            <h2
              id="cancel-order-dialog-title"
              className="text-lg font-semibold text-slate-900"
            >
              Cancel order
            </h2>
            <p className="text-sm text-slate-500 mt-0.5 truncate">
              {groupBuy.title}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-slate-700 leading-relaxed">
            {deadlinePassed
              ? `This will refund your ${amountXlm} XLM on-chain. Continue?`
              : 'Funds will not be released until the deadline. You can return after the deadline to claim your refund.'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'error' && errorMessage && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4"
            >
              <p className="text-sm text-red-700 font-medium">
                ⚠️ {errorMessage}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 disabled:opacity-60 text-slate-700 py-3 rounded-xl font-medium transition-colors"
          >
            Keep order
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className={`py-3 rounded-xl font-medium transition-colors text-white ${
              deadlinePassed
                ? 'bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300'
                : 'bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300'
            }`}
          >
            {isSubmitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {deadlinePassed ? 'Refunding…' : 'Cancelling…'}
              </span>
            ) : (
              'Confirm cancellation'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
