'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'next/navigation';
import { useWallet } from '@/lib/hooks/useWallet';
import { supabase } from '@/lib/supabase/client';
import { DepositForm } from '@/components/escrow/DepositForm';
import { ConfirmDelivery } from '@/components/escrow/ConfirmDelivery';
import { CancelOrderDialog } from '@/components/escrow/CancelOrderDialog';
import { ClaimRefundButton } from '@/components/escrow/ClaimRefundButton';
import { STELLAR_EXPERT_URL, CONTRACT_ID } from '@/lib/utils/constants';

type OrderStatus =
  | 'not_joined'
  | 'deposited'
  | 'delivered'
  | 'confirmed'
  | 'refunded'
  | 'cancelled';

interface GroupBuy {
  id: string;
  title: string;
  description: string | null;
  organizer_address: string;
  price_per_slot: number;
  deadline: string;
  category: string;
  status: string;
}

interface Participant {
  id: string;
  group_buy_id: string;
  buyer_address: string;
  amount: number;
  status: OrderStatus;
  refund_required: boolean;
  buyer_name: string | null;
  buyer_contact: string | null;
  buyer_location: string | null;
  buyer_note: string | null;
  tx_hash_deposit: string | null;
  tx_hash_confirm: string | null;
  deposited_at: string | null;
}

export default function BuyerOrderPage() {
  const params = useParams();
  const { publicKey, isConnected } = useWallet();
  const [groupBuy, setGroupBuy] = useState<GroupBuy | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);

  // `fetchData` is memoized so we can re-run it after any successful mutation
  // (cancel, claim-refund, etc.) without reloading the page. Requirements 6.4,
  // 6.6 and the task brief both require the UI to refresh after the action
  // resolves so banners/controls reflect the new state.
  const fetchData = useCallback(async () => {
    const { data: gb } = await supabase
      .from('group_buys')
      .select('*')
      .eq('id', params.id)
      .single();

    if (gb) {
      setGroupBuy(gb);

      if (publicKey) {
        const { data: row } = await supabase
          .from('participants')
          .select(
            'id, group_buy_id, buyer_address, amount, status, refund_required, buyer_name, buyer_contact, buyer_location, buyer_note, tx_hash_deposit, tx_hash_confirm, deposited_at'
          )
          .eq('group_buy_id', params.id)
          .eq('buyer_address', publicKey)
          .maybeSingle();

        setParticipant((row as Participant | null) ?? null);
      } else {
        setParticipant(null);
      }
    }
    setLoading(false);
  }, [params.id, publicKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-3/4 bg-slate-100 rounded" />
          <div className="h-4 w-1/2 bg-slate-100 rounded" />
          <div className="h-64 bg-slate-100 rounded-2xl mt-8" />
        </div>
      </div>
    );
  }

  if (!groupBuy) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-slate-900">Pasabuy not found</h2>
        <p className="text-slate-600 mt-2">
          This group buy may have been deleted or expired.
        </p>
      </div>
    );
  }

  const orderStatus: OrderStatus = participant?.status ?? 'not_joined';
  const deadline = new Date(groupBuy.deadline);
  const deadlineValid = !Number.isNaN(deadline.getTime());
  const deadlinePassed = deadlineValid && deadline <= new Date();
  const pasabuyCancelledByOrganizer = groupBuy.status === 'cancelled';
  // Pre-deadline buyer cancellations leave the row in `cancelled` with
  // `refund_required = true`; the banner tells the buyer to come back after
  // the deadline (Req 6.4). The ClaimRefundButton itself enforces the
  // post-deadline visibility predicate from Req 6.5.
  const showAwaitingDeadlineBanner =
    orderStatus === 'cancelled' &&
    participant?.refund_required === true &&
    !deadlinePassed;
  const deadlineDisplay = deadlineValid
    ? deadline.toLocaleString()
    : 'the deadline';

  const steps = [
    { label: 'Paid', status: 'deposited' },
    { label: 'Delivered', status: 'delivered' },
    { label: 'Confirmed', status: 'confirmed' },
  ];

  const completedIndex =
    orderStatus === 'confirmed'
      ? 2
      : orderStatus === 'delivered'
        ? 1
        : orderStatus === 'deposited'
          ? 0
          : -1;
  const currentStepIndex = steps.findIndex((s) => s.status === orderStatus);
  // Hide the happy-path timeline once the order has left the deposit→deliver→
  // confirm flow (cancelled or refunded). Showing "Paid ✓" for a cancelled
  // order would be misleading.
  const showTimeline =
    orderStatus === 'deposited' ||
    orderStatus === 'delivered' ||
    orderStatus === 'confirmed';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <span className="inline-block text-xs px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium uppercase tracking-wide">
          {groupBuy.category}
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mt-3">
          {groupBuy.title}
        </h1>
        {groupBuy.description && (
          <p className="text-slate-600 mt-2">{groupBuy.description}</p>
        )}
        <p className="text-sm text-slate-500 mt-3">
          Organizer:{' '}
          <span className="font-mono">
            {groupBuy.organizer_address.slice(0, 6)}...
            {groupBuy.organizer_address.slice(-4)}
          </span>
        </p>
      </motion.div>

      {/* Pasabuy-cancelled-by-organizer notice (Req 1.9). Always shown when
          the parent group_buy is cancelled, regardless of order status — the
          buyer needs to know the listing is closed even before they look at
          their own row. */}
      {pasabuyCancelledByOrganizer && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6"
          role="status"
        >
          <p className="text-sm font-medium text-rose-800">
            🚫 This pasabuy was cancelled by the organizer.
          </p>
          {participant?.refund_required && (
            <p className="text-xs text-rose-700 mt-1">
              {deadlinePassed
                ? 'You can claim your refund below.'
                : `You can claim your refund on or after ${deadlineDisplay}.`}
            </p>
          )}
        </motion.div>
      )}

      {/* Status Timeline (only show on the happy path) */}
      {showTimeline && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl p-6 mb-6 border border-slate-100"
        >
          <h3 className="text-sm font-medium text-slate-700 mb-4">
            Order Status
          </h3>
          <div className="flex items-center">
            {steps.map((step, i) => {
              const isComplete = completedIndex >= i;
              const isCurrent = currentStepIndex === i;

              return (
                <div
                  key={step.label}
                  className="flex items-center flex-1 last:flex-initial"
                >
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={isCurrent ? { scale: [1, 1.15, 1] } : {}}
                      transition={{
                        repeat: isCurrent ? Infinity : 0,
                        duration: 2,
                      }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        isComplete
                          ? 'bg-yellow-500 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isComplete ? '✓' : i + 1}
                    </motion.div>
                    <span
                      className={`text-xs mt-2 ${isComplete ? 'text-yellow-700 font-medium' : 'text-slate-400'}`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 transition-colors ${
                        completedIndex > i ? 'bg-emerald-400' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Awaiting-deadline banner — buyer cancelled pre-deadline and the
          contract refund is not yet callable. Surfaces the spec copy from
          Req 6.4 so the buyer knows when to come back. */}
      {showAwaitingDeadlineBanner && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6"
          role="status"
        >
          <p className="text-sm font-medium text-amber-900">
            ⏳ Your order is cancelled. You can claim your refund on or after{' '}
            {deadlineDisplay}.
          </p>
        </motion.div>
      )}

      {/* Order Details — shows the buyer their submitted delivery info and
          deposit amount so they can verify what was recorded on-chain. */}
      {participant && orderStatus !== 'not_joined' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl p-6 mb-6 border border-slate-100"
        >
          <h3 className="text-sm font-medium text-slate-700 mb-4">
            📋 Order Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Name
              </p>
              <p className="text-slate-700 mt-0.5">
                {participant.buyer_name ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Contact
              </p>
              <p className="text-slate-700 mt-0.5">
                {participant.buyer_contact ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Location
              </p>
              <p className="text-slate-700 mt-0.5">
                {participant.buyer_location ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Notes
              </p>
              <p className="text-slate-700 mt-0.5">
                {participant.buyer_note ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Amount Deposited
              </p>
              <p className="text-slate-700 mt-0.5">
                {(participant.amount / 10_000_000).toFixed(2)} XLM
                <span className="text-slate-400 ml-1">
                  (₱{(participant.amount / 10_000_000).toFixed(0)})
                </span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Deposit Date
              </p>
              <p className="text-slate-700 mt-0.5">
                {participant.deposited_at
                  ? new Date(participant.deposited_at).toLocaleString()
                  : '—'}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Transaction Receipt — shows on-chain tx hashes as clickable links
          to Stellar Expert so the buyer can verify their transactions. */}
      {participant && (participant.tx_hash_deposit || participant.tx_hash_confirm) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl p-6 mb-6 border border-slate-100"
        >
          <h3 className="text-sm font-medium text-slate-700 mb-4">
            🧾 Transaction Receipt
          </h3>
          <div className="space-y-3 text-sm">
            {participant.tx_hash_deposit && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Deposit Transaction
                </p>
                <a
                  href={`${STELLAR_EXPERT_URL}/tx/${participant.tx_hash_deposit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-yellow-700 hover:text-yellow-900 hover:underline transition-colors mt-0.5 inline-block"
                >
                  {participant.tx_hash_deposit.slice(0, 6)}...
                  {participant.tx_hash_deposit.slice(-6)}
                </a>
              </div>
            )}
            {participant.tx_hash_confirm && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Confirm / Refund Transaction
                </p>
                <a
                  href={`${STELLAR_EXPERT_URL}/tx/${participant.tx_hash_confirm}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-yellow-700 hover:text-yellow-900 hover:underline transition-colors mt-0.5 inline-block"
                >
                  {participant.tx_hash_confirm.slice(0, 6)}...
                  {participant.tx_hash_confirm.slice(-6)}
                </a>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Action Area */}
      <AnimatePresence mode="wait">
        {!isConnected && (
          <motion.div
            key="connect"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center"
          >
            <div className="text-4xl mb-3">🔗</div>
            <p className="font-medium text-amber-900">
              Connect your wallet to join this pasabuy
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Use the Connect Wallet button in the header
            </p>
          </motion.div>
        )}

        {isConnected && orderStatus === 'not_joined' && !pasabuyCancelledByOrganizer && (
          <motion.div key="deposit" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <DepositForm
              groupBuyTitle={groupBuy.title}
              pricePerSlot={groupBuy.price_per_slot}
              groupBuyId={groupBuy.id}
              onSuccess={fetchData}
            />
          </motion.div>
        )}

        {isConnected && orderStatus === 'deposited' && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="text-4xl mb-3"
              >
                📦
              </motion.div>
              <p className="font-medium text-blue-900">Waiting for delivery</p>
              <p className="text-sm text-blue-700 mt-1">
                Your ₱{(groupBuy.price_per_slot / 10_000_000).toFixed(0)} is
                safely locked in escrow
              </p>
            </div>

            {/* Cancel order control — visible only while status === 'deposited'
                (Req 6.1, 6.2). The dialog handles both pre-deadline (off-chain
                cancel + refund_required) and post-deadline (on-chain refund)
                branches internally. */}
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="w-full bg-white hover:bg-rose-50 text-rose-600 border-2 border-rose-200 hover:border-rose-300 py-3 rounded-2xl font-medium transition-colors"
            >
              Cancel order
            </button>
            <p className="text-xs text-slate-400 text-center -mt-2">
              {deadlinePassed
                ? 'You can refund your deposit on-chain.'
                : 'Pre-deadline cancellations can claim a refund after the deadline.'}
            </p>
          </motion.div>
        )}

        {isConnected && orderStatus === 'delivered' && (
          <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ConfirmDelivery
              groupBuyTitle={groupBuy.title}
              amount={groupBuy.price_per_slot}
              onSuccess={fetchData}
            />
          </motion.div>
        )}

        {isConnected && orderStatus === 'confirmed' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="text-5xl mb-4"
            >
              🎉
            </motion.div>
            <h3 className="text-xl font-bold text-yellow-900">
              Order Complete!
            </h3>
            <p className="text-yellow-700 mt-2">
              Payment has been released to the organizer.
              <br />
              Thank you for using PasabuySafe!
            </p>
          </motion.div>
        )}

        {isConnected && orderStatus === 'refunded' && (
          <motion.div
            key="refunded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center"
          >
            <div className="text-5xl mb-4">💰</div>
            <h3 className="text-xl font-bold text-amber-900">
              Refund Processed
            </h3>
            <p className="text-amber-700 mt-2">
              Your funds have been returned to your wallet.
            </p>
          </motion.div>
        )}

        {/* Cancelled-order panel + post-deadline claim. ClaimRefundButton
            self-gates on `status === 'cancelled' && refund_required && now() >=
            deadline` (Req 6.5), so it only renders the button portion of this
            block when the contract refund is actually callable. */}
        {isConnected && orderStatus === 'cancelled' && participant && (
          <motion.div
            key="cancelled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">🛑</div>
              <h3 className="text-lg font-semibold text-slate-900">
                Order cancelled
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {participant.refund_required
                  ? deadlinePassed
                    ? 'You can claim your refund below.'
                    : `Return on or after ${deadlineDisplay} to claim your refund.`
                  : 'Your order has been cancelled.'}
              </p>
            </div>
            <ClaimRefundButton
              participant={participant}
              groupBuy={{ id: groupBuy.id, deadline: groupBuy.deadline }}
              onClaimed={fetchData}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <a
          href={`${STELLAR_EXPERT_URL}/contract/${CONTRACT_ID}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-yellow-700 transition-colors"
        >
          🔗 View on Stellar Expert
        </a>
        <span>Protected by PasabuySafe Escrow</span>
      </div>

      {/* CancelOrderDialog is rendered as a modal only when the user opens it
          from the deposited-state action button. The dialog runs the strict
          RLS-aware update, so cross-user cancel attempts surface
          "You can only cancel your own order." (Req 6.9) from inside the
          dialog itself. */}
      <AnimatePresence>
        {cancelOpen && participant && (
          <CancelOrderDialog
            participant={{
              id: participant.id,
              group_buy_id: participant.group_buy_id,
              buyer_address: participant.buyer_address,
              amount: participant.amount,
              status: participant.status,
            }}
            groupBuy={{
              id: groupBuy.id,
              title: groupBuy.title,
              deadline: groupBuy.deadline,
            }}
            onClose={() => setCancelOpen(false)}
            onCancelled={fetchData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
