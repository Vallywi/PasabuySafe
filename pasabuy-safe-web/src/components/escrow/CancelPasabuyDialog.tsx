'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCancelPasabuy } from '@/lib/hooks/useCancelPasabuy';
import { truncateAddress } from '@/lib/utils/format';

/**
 * CancelPasabuyDialog — organizer "Cancel pasabuy" confirmation modal.
 *
 * The dialog computes a `CancellationGate` from the supplied participants
 * via `useCancelPasabuy` and renders one of four branches that map 1:1 to
 * the rows of the design's **Cancellation Flow Decision Matrix**:
 *
 *   1. `allowed_simple` (matrix row 1)
 *        — no deposits, no deliveries; single confirmation. On confirm we
 *          call `cancel()` which runs the `cancel_group_buy` RPC and the
 *          group_buy is flipped to `cancelled` atomically.
 *
 *   2. `allowed_with_refund` + `deadlinePassed=true` (matrix row 2)
 *        — deposits exist, deadline already passed. Buyers can claim
 *          on-chain refunds immediately after the cancellation lands.
 *          We enumerate the affected buyers + their stroop amounts so the
 *          organizer sees who needs to be notified.
 *
 *   3. `allowed_with_refund` + `deadlinePassed=false` (matrix row 3)
 *        — deposits exist, deadline not yet reached. Funds cannot be
 *          returned on-chain until the deadline; we surface the
 *          spec-mandated explanatory copy (Req 1.5) and require an
 *          explicit confirmation. Each affected `participants` row is
 *          marked `refund_required=TRUE` by the RPC so buyers see the
 *          claim button after the deadline.
 *
 *   4. `blocked_has_delivered` (matrix row 4)
 *        — at least one order is `delivered`. We render ONLY the
 *          spec-mandated message and a Close button; no mutation runs
 *          (Req 1.6).
 *
 * Errors returned by the hook after a `cancel()` attempt are surfaced
 * inline. Buttons are disabled while the call is in flight.
 *
 * Requirements: 1.3, 1.4, 1.5, 1.6, 1.8
 * Design: "CancelPasabuyDialog", "Cancellation Flow Decision Matrix" rows 1–4
 */
export interface CancelPasabuyDialogProps {
  groupBuy: {
    id: string;
    title: string;
    /** ISO 8601 timestamp. */
    deadline: string;
  };
  participants: Array<{
    buyer_address: string;
    /** Amount in stroops (1 XLM = 10^7 stroops). */
    amount: number;
    status: string;
  }>;
  onClose: () => void;
  onCancelled: () => void;
}

const BLOCKED_MESSAGE =
  'This pasabuy has orders marked delivered. Wait for buyers to confirm or refund before cancelling.';

const PRE_DEADLINE_COPY =
  'Funds cannot be returned on-chain until the deadline. Affected buyers will be marked so they can claim a refund after the deadline.';

const POST_DEADLINE_COPY =
  'This pasabuy will be cancelled. The following buyers can claim a refund on-chain immediately.';

const SIMPLE_COPY = 'Cancel this pasabuy? No one has deposited yet.';

function stroopsToXlm(stroops: number): string {
  return (stroops / 10_000_000).toFixed(7).replace(/\.?0+$/, '');
}

export function CancelPasabuyDialog({
  groupBuy,
  participants,
  onClose,
  onCancelled,
}: CancelPasabuyDialogProps) {
  // The hook is the single source of truth for both the gate and the
  // cancellation mutation. We forward `onCancelled` so the parent's
  // refresh handler fires from inside the hook the moment the RPC
  // succeeds, then we call `onClose()` to dismiss the modal.
  const { gate, cancel, loading, error } = useCancelPasabuy(
    groupBuy.id,
    participants,
    groupBuy.deadline,
    { onCancelled },
  );

  async function handleConfirm() {
    try {
      await cancel();
      onClose();
    } catch {
      // The hook has already populated `error`; the user can read the
      // message and retry without re-opening the dialog.
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-pasabuy-dialog-title"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="text-3xl" aria-hidden>
            {gate.kind === 'blocked_has_delivered' ? '🚫' : '⚠️'}
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="cancel-pasabuy-dialog-title"
              className="text-lg font-semibold text-slate-900"
            >
              {gate.kind === 'blocked_has_delivered'
                ? 'Cannot cancel pasabuy'
                : 'Cancel pasabuy'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5 truncate">
              {groupBuy.title}
            </p>
          </div>
        </div>

        {gate.kind === 'blocked_has_delivered' ? (
          <BlockedBranch message={BLOCKED_MESSAGE} onClose={onClose} />
        ) : gate.kind === 'allowed_simple' ? (
          <AllowedBranch
            bodyCopy={SIMPLE_COPY}
            affectedBuyers={null}
            confirmLabel="Cancel pasabuy"
            loading={loading}
            errorMessage={error}
            onConfirm={handleConfirm}
            onClose={onClose}
          />
        ) : gate.deadlinePassed ? (
          <AllowedBranch
            bodyCopy={POST_DEADLINE_COPY}
            affectedBuyers={gate.affectedBuyers}
            confirmLabel="Cancel pasabuy"
            loading={loading}
            errorMessage={error}
            onConfirm={handleConfirm}
            onClose={onClose}
          />
        ) : (
          <AllowedBranch
            bodyCopy={PRE_DEADLINE_COPY}
            affectedBuyers={gate.affectedBuyers}
            // Per Req 1.5: the pre-deadline branch requires an "explicit
            // confirmation". A distinct button label tells the organizer
            // they are agreeing to mark buyers for a later claim, not
            // refunding them now.
            confirmLabel="Confirm cancellation"
            loading={loading}
            errorMessage={error}
            onConfirm={handleConfirm}
            onClose={onClose}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

interface BlockedBranchProps {
  message: string;
  onClose: () => void;
}

function BlockedBranch({ message, onClose }: BlockedBranchProps) {
  return (
    <>
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
        <p className="text-sm text-red-700 leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </>
  );
}

interface AllowedBranchProps {
  bodyCopy: string;
  affectedBuyers: Array<{ address: string; amount: number }> | null;
  confirmLabel: string;
  loading: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

function AllowedBranch({
  bodyCopy,
  affectedBuyers,
  confirmLabel,
  loading,
  errorMessage,
  onConfirm,
  onClose,
}: AllowedBranchProps) {
  return (
    <>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
        <p className="text-sm text-slate-700 leading-relaxed">{bodyCopy}</p>
      </div>

      {affectedBuyers && affectedBuyers.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Affected buyers ({affectedBuyers.length})
          </p>
          <ul className="max-h-48 overflow-y-auto divide-y divide-slate-200 rounded-xl border border-slate-200">
            {affectedBuyers.map((buyer) => (
              <li
                key={buyer.address}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="font-mono text-slate-700">
                  {truncateAddress(buyer.address)}
                </span>
                <span className="text-slate-600 tabular-nums">
                  {stroopsToXlm(buyer.amount)} XLM
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AnimatePresence mode="wait">
        {errorMessage && (
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
          disabled={loading}
          className="bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 disabled:opacity-60 text-slate-700 py-3 rounded-xl font-medium transition-colors"
        >
          Keep
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white py-3 rounded-xl font-medium transition-colors"
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Cancelling…
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </>
  );
}
