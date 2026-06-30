'use client';

/**
 * Organizer dashboard page — wires together the four management
 * enhancements that share this file:
 *
 *   - Task  8.3: `CancelPasabuyDialog` for the four-case cancellation
 *                flow (organizer-only "Cancel pasabuy" button + modal).
 *   - Task  9.2: `ParticipantList` replaces the inline participants
 *                table. The query now selects the per-order contact
 *                columns (`buyer_name`, `buyer_contact`, `buyer_location`,
 *                `buyer_note`, `refund_required`) so the component can
 *                render them per Req 3.2.
 *   - Task 10.4: `TransactionHistory` is mounted as an organizer-only
 *                section (Req 2.1, 2.2). RLS on the underlying view is
 *                still the ultimate enforcement.
 *   - Task 11.2: The inline `markDelivered` handler and its legacy
 *                `invokeContract`/`mapSorobanError` plumbing have been
 *                removed; `ParticipantList` renders `MarkDeliveredButton`
 *                internally, and that button owns the full bounded
 *                state machine (`invokeContractWithStatus`, error mapping,
 *                contract-events mirror, retry on failure).
 *
 * `runtime = 'nodejs'` is required so the Freighter dynamic import used
 * by `invokeContractWithStatus` resolves on Vercel — the Edge runtime
 * does not provide the `crypto` and dynamic-import surface Freighter
 * needs at build time. This matches the Vercel-failure hypothesis in
 * the design.
 */

export const runtime = 'nodejs';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@/lib/hooks/useWallet';
import { supabase } from '@/lib/supabase/client';
import { CancelPasabuyDialog } from '@/components/escrow/CancelPasabuyDialog';
import {
  ParticipantList,
  type Participant,
} from '@/components/dashboard/ParticipantList';
import TransactionHistory from '@/components/dashboard/TransactionHistory';

interface GroupBuy {
  id: string;
  contract_id: string;
  title: string;
  description: string | null;
  organizer_address: string;
  price_per_slot: number;
  max_slots: number;
  deadline: string;
  status: string;
}

export default function ManageGroupBuyPage() {
  const params = useParams();
  const router = useRouter();
  const groupBuyId = params.id as string;
  const { publicKey, isConnected } = useWallet();
  const [groupBuy, setGroupBuy] = useState<GroupBuy | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !window.confirm(
        'Permanently delete this cancelled pasabuy? This cannot be undone.',
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase
      .from('group_buys')
      .delete()
      .eq('id', groupBuyId);
    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
      return;
    }
    router.push('/dashboard');
  }

  // Single source of truth for fetching the page state. Memoized via
  // `useCallback` so child components (CancelPasabuyDialog,
  // ParticipantList) can invoke it via the `onCancelled` /
  // `onMarkedDelivered` callbacks without re-triggering effects.
  const fetchData = useCallback(async () => {
    const { data: gb } = await supabase
      .from('group_buys')
      .select('*')
      .eq('id', groupBuyId)
      .single();

    if (gb) setGroupBuy(gb as GroupBuy);

    // Select the per-order delivery columns added by migration 005. RLS
    // on `participants` restricts these contact columns to the organizer
    // and the buyer themself, so it is safe to request them from the
    // base table here (the organizer is gated below).
    const { data: p } = await supabase
      .from('participants')
      .select(
        'id, buyer_address, amount, quantity, delivery_method, status, deposited_at, buyer_name, buyer_contact, buyer_location, buyer_note, refund_required',
      )
      .eq('group_buy_id', groupBuyId)
      .order('deposited_at', { ascending: false });

    if (p) setParticipants(p as Participant[]);

    setLoading(false);
  }, [groupBuyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-3/4 bg-slate-100 rounded" />
          <div className="h-64 bg-slate-100 rounded-2xl mt-8" />
        </div>
      </div>
    );
  }

  if (!groupBuy) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-slate-900">Group buy not found</h2>
      </div>
    );
  }

  const isOrganizer = publicKey === groupBuy.organizer_address;

  if (!isConnected || !isOrganizer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-amber-800 font-medium">
            {!isConnected
              ? 'Connect your wallet to manage this pasabuy'
              : 'You are not the organizer of this pasabuy'}
          </p>
        </div>
      </div>
    );
  }

  const isCancelled = groupBuy.status === 'cancelled';

  const totalEscrowed = participants
    .filter((p) => p.status === 'deposited' || p.status === 'delivered')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalReleased = participants
    .filter((p) => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount, 0);

  // `contract_id` on `group_buys` is the FK that `contract_events` and
  // the `group_buy_history` view JOIN against. Fall back to `groupBuy.id`
  // when the column is unexpectedly absent so the page still renders
  // rather than crashing in dev fixtures.
  const contractId = groupBuy.contract_id || groupBuy.id;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-block text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium uppercase tracking-wide">
            Organizer View
          </span>
          {isCancelled && (
            <motion.span
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-rose-100 text-rose-700 rounded-full font-semibold uppercase tracking-wide"
              aria-label="This pasabuy has been cancelled"
            >
              <span aria-hidden>✖</span> Cancelled
            </motion.span>
          )}
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">{groupBuy.title}</h1>
            {groupBuy.description && (
              <p className="text-slate-600 mt-1">{groupBuy.description}</p>
            )}
          </div>

          {/* Req 1.1, 1.2: the "Cancel pasabuy" control is rendered only
              for the signed-in organizer and only while the pasabuy is
              not already cancelled. The dialog itself enforces the
              decision-matrix branches; this button merely opens it.

              Once the pasabuy is cancelled, the Cancel button is replaced
              by a destructive "Delete pasabuy" button that hard-removes
              the row from `group_buys` (the two are mutually exclusive). */}
          {!isCancelled ? (
            <button
              type="button"
              onClick={() => setCancelDialogOpen(true)}
              className="shrink-0 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2 rounded-xl font-medium text-sm transition-colors"
            >
              Cancel pasabuy
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="shrink-0 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-xl font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting…' : 'Delete pasabuy'}
            </button>
          )}
        </div>
        {deleteError && (
          <p className="mt-2 text-xs text-red-600">
            Couldn&apos;t delete: {deleteError}
          </p>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-100 rounded-2xl p-4"
        >
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Total Buyers
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {participants.length}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-blue-50 border border-blue-100 rounded-2xl p-4"
        >
          <p className="text-xs text-blue-600 uppercase tracking-wide">
            In Escrow
          </p>
          <p className="text-2xl font-bold text-blue-900 mt-1">
            {(totalEscrowed / 10_000_000).toFixed(0)} XLM
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-yellow-50 border border-emerald-100 rounded-2xl p-4"
        >
          <p className="text-xs text-yellow-700 uppercase tracking-wide">
            Released
          </p>
          <p className="text-2xl font-bold text-yellow-900 mt-1">
            {(totalReleased / 10_000_000).toFixed(0)} XLM
          </p>
        </motion.div>
      </div>

      {/* Participants — ParticipantList owns the row layout, the
          contact-detail rendering (Req 3.x), and the MarkDeliveredButton
          for each `deposited` row. */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Buyers</h2>
        </div>
        <ParticipantList
          groupBuyId={groupBuyId}
          contractId={contractId}
          participants={participants}
          onMarkedDelivered={fetchData}
        />
      </section>

      {/* Transaction History — organizer-only (Req 2.1, 2.2). The
          underlying `group_buy_history` view's RLS already restricts
          access to the organizer, so this UI-level guard is a courtesy
          that matches the page's overall organizer gating. */}
      <section className="mb-8">
        <TransactionHistory groupBuyId={groupBuyId} contractId={contractId} />
      </section>

      {/* Share — hidden once the pasabuy is cancelled (no point sharing
          a link to a cancelled pasabuy). */}
      {!isCancelled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-yellow-700 mb-2">
            📤 Share this pasabuy:
          </p>
          <code className="text-xs bg-white px-3 py-2 rounded-lg block break-all border border-emerald-100">
            {typeof window !== 'undefined'
              ? `${window.location.origin}/pasabuy/${groupBuy.id}`
              : ''}
          </code>
        </div>
      )}

      {/* Cancel pasabuy modal. Mounted inside an AnimatePresence so the
          modal animates in/out without leaving the participants list
          jumpy. The dialog's `onCancelled` triggers a re-fetch so the
          Cancelled badge, the participant statuses, and the transaction
          history all refresh in one round-trip. */}
      <AnimatePresence>
        {cancelDialogOpen && (
          <CancelPasabuyDialog
            groupBuy={{
              id: groupBuy.id,
              title: groupBuy.title,
              deadline: groupBuy.deadline,
            }}
            participants={participants.map((p) => ({
              buyer_address: p.buyer_address,
              amount: p.amount,
              status: p.status,
            }))}
            onClose={() => setCancelDialogOpen(false)}
            onCancelled={fetchData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
