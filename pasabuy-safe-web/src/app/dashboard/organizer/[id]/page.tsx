'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'next/navigation';
import { useWallet } from '@/lib/hooks/useWallet';
import { supabase } from '@/lib/supabase/client';
import { invokeContract } from '@/lib/stellar/client';
import { Address } from '@stellar/stellar-sdk';
import { truncateAddress } from '@/lib/utils/format';

interface GroupBuy {
  id: string;
  title: string;
  description: string | null;
  organizer_address: string;
  price_per_slot: number;
  max_slots: number;
  deadline: string;
  status: string;
}

interface Participant {
  id: string;
  buyer_address: string;
  amount: number;
  status: string;
  deposited_at: string;
}

export default function ManageGroupBuyPage() {
  const params = useParams();
  const { publicKey, isConnected } = useWallet();
  const [groupBuy, setGroupBuy] = useState<GroupBuy | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningBuyer, setActioningBuyer] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data: gb } = await supabase
        .from('group_buys')
        .select('*')
        .eq('id', params.id)
        .single();

      if (gb) setGroupBuy(gb);

      const { data: p } = await supabase
        .from('participants')
        .select('*')
        .eq('group_buy_id', params.id)
        .order('deposited_at', { ascending: false });

      if (p) setParticipants(p);

      setLoading(false);
    }
    fetchData();
  }, [params.id]);

  async function markDelivered(buyerAddress: string) {
    if (!publicKey) return;
    setActioningBuyer(buyerAddress);
    setActionError('');

    try {
      const buyerScVal = new Address(buyerAddress).toScVal();
      await invokeContract('mark_delivered', [buyerScVal], publicKey);

      await supabase
        .from('participants')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('group_buy_id', params.id)
        .eq('buyer_address', buyerAddress);

      // Refresh
      setParticipants((prev) =>
        prev.map((p) =>
          p.buyer_address === buyerAddress ? { ...p, status: 'delivered' } : p
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark delivered';
      if (message.includes('Error(Contract, #4)')) {
        setActionError(`Buyer ${truncateAddress(buyerAddress)} has not deposited yet`);
      } else if (message.includes('Error(Contract, #7)')) {
        setActionError(`Order already marked as delivered`);
      } else {
        setActionError(message);
      }
    } finally {
      setActioningBuyer(null);
    }
  }

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
            {!isConnected ? 'Connect your wallet to manage this pasabuy' : 'You are not the organizer of this pasabuy'}
          </p>
        </div>
      </div>
    );
  }

  const totalEscrowed = participants
    .filter((p) => p.status === 'deposited' || p.status === 'delivered')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalReleased = participants
    .filter((p) => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <span className="inline-block text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium uppercase tracking-wide">
          Organizer View
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mt-3">{groupBuy.title}</h1>
        <p className="text-slate-600 mt-1">{groupBuy.description}</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-100 rounded-2xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Buyers</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{participants.length}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs text-blue-600 uppercase tracking-wide">In Escrow</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{(totalEscrowed / 10_000_000).toFixed(0)} XLM</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-yellow-50 border border-emerald-100 rounded-2xl p-4">
          <p className="text-xs text-yellow-700 uppercase tracking-wide">Released</p>
          <p className="text-2xl font-bold text-yellow-900 mt-1">{(totalReleased / 10_000_000).toFixed(0)} XLM</p>
        </motion.div>
      </div>

      {actionError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      {/* Participants */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Buyers</h2>
        </div>

        {participants.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-slate-500">No buyers yet</p>
            <p className="text-xs text-slate-400 mt-1">Share the link to get participants</p>
          </div>
        ) : (
          <AnimatePresence>
            {participants.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="px-6 py-4 border-b border-slate-50 last:border-0 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-slate-700">{truncateAddress(p.buyer_address)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(p.amount / 10_000_000).toFixed(0)} XLM • {new Date(p.deposited_at).toLocaleDateString()}
                  </p>
                </div>

                {p.status === 'deposited' && (
                  <button
                    onClick={() => markDelivered(p.buyer_address)}
                    disabled={actioningBuyer === p.buyer_address}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {actioningBuyer === p.buyer_address ? 'Marking...' : '📦 Mark Delivered'}
                  </button>
                )}

                {p.status === 'delivered' && (
                  <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full font-medium">
                    ⏳ Waiting for buyer to confirm
                  </span>
                )}

                {p.status === 'confirmed' && (
                  <span className="text-sm text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-full font-medium">
                    ✅ Confirmed
                  </span>
                )}

                {p.status === 'refunded' && (
                  <span className="text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full font-medium">
                    💰 Refunded
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Share */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
        <p className="text-xs font-medium text-yellow-700 mb-2">📤 Share this pasabuy:</p>
        <code className="text-xs bg-white px-3 py-2 rounded-lg block break-all border border-emerald-100">
          {typeof window !== 'undefined' ? `${window.location.origin}/dashboard/buyer/${groupBuy.id}` : ''}
        </code>
      </div>
    </div>
  );
}
