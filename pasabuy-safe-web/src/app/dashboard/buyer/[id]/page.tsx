'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'next/navigation';
import { useWallet } from '@/lib/hooks/useWallet';
import { supabase } from '@/lib/supabase/client';
import { DepositForm } from '@/components/escrow/DepositForm';
import { ConfirmDelivery } from '@/components/escrow/ConfirmDelivery';
import { RefundButton } from '@/components/escrow/RefundButton';
import { STELLAR_EXPERT_URL, CONTRACT_ID } from '@/lib/utils/constants';

type OrderStatus = 'not_joined' | 'deposited' | 'delivered' | 'confirmed' | 'refunded';

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

export default function BuyerOrderPage() {
  const params = useParams();
  const { publicKey, isConnected } = useWallet();
  const [groupBuy, setGroupBuy] = useState<GroupBuy | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('not_joined');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('group_buys')
        .select('*')
        .eq('id', params.id)
        .single();

      if (data) {
        setGroupBuy(data);

        // Check if current wallet has a participant record
        if (publicKey) {
          const { data: participant } = await supabase
            .from('participants')
            .select('status')
            .eq('group_buy_id', params.id)
            .eq('buyer_address', publicKey)
            .single();

          if (participant) {
            setOrderStatus(participant.status as OrderStatus);
          }
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [params.id, publicKey]);

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
        <p className="text-slate-600 mt-2">This group buy may have been deleted or expired.</p>
      </div>
    );
  }

  const deadlinePassed = new Date(groupBuy.deadline) < new Date();

  const steps = [
    { label: 'Paid', status: 'deposited' },
    { label: 'Delivered', status: 'delivered' },
    { label: 'Confirmed', status: 'confirmed' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.status === orderStatus);
  const completedIndex = orderStatus === 'confirmed' ? 2 : orderStatus === 'delivered' ? 1 : orderStatus === 'deposited' ? 0 : -1;

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
        <h1 className="text-2xl font-bold text-slate-900 mt-3">{groupBuy.title}</h1>
        {groupBuy.description && (
          <p className="text-slate-600 mt-2">{groupBuy.description}</p>
        )}
        <p className="text-sm text-slate-500 mt-3">
          Organizer: <span className="font-mono">{groupBuy.organizer_address.slice(0, 6)}...{groupBuy.organizer_address.slice(-4)}</span>
        </p>
      </motion.div>

      {/* Status Timeline (only show when joined) */}
      {orderStatus !== 'not_joined' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl p-6 mb-6 border border-slate-100"
        >
          <h3 className="text-sm font-medium text-slate-700 mb-4">Order Status</h3>
          <div className="flex items-center">
            {steps.map((step, i) => {
              const isComplete = completedIndex >= i;
              const isCurrent = currentStepIndex === i;

              return (
                <div key={step.label} className="flex items-center flex-1 last:flex-initial">
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={isCurrent ? { scale: [1, 1.15, 1] } : {}}
                      transition={{ repeat: isCurrent ? Infinity : 0, duration: 2 }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        isComplete
                          ? 'bg-yellow-500 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isComplete ? '✓' : i + 1}
                    </motion.div>
                    <span className={`text-xs mt-2 ${isComplete ? 'text-yellow-700 font-medium' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 transition-colors ${
                      completedIndex > i ? 'bg-emerald-400' : 'bg-slate-200'
                    }`} />
                  )}
                </div>
              );
            })}
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
            <p className="font-medium text-amber-900">Connect your wallet to join this pasabuy</p>
            <p className="text-sm text-amber-700 mt-1">Use the Connect Wallet button in the header</p>
          </motion.div>
        )}

        {isConnected && orderStatus === 'not_joined' && (
          <motion.div key="deposit" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <DepositForm
              groupBuyTitle={groupBuy.title}
              pricePerSlot={groupBuy.price_per_slot}
              groupBuyId={groupBuy.id}
              onSuccess={() => setOrderStatus('deposited')}
            />
          </motion.div>
        )}

        {isConnected && orderStatus === 'deposited' && (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
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
                Your ₱{(groupBuy.price_per_slot / 10_000_000).toFixed(0)} is safely locked in escrow
              </p>
            </div>
            <RefundButton
              amount={groupBuy.price_per_slot}
              deadlinePassed={deadlinePassed}
              onSuccess={() => setOrderStatus('refunded')}
            />
          </motion.div>
        )}

        {isConnected && orderStatus === 'delivered' && (
          <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ConfirmDelivery
              groupBuyTitle={groupBuy.title}
              amount={groupBuy.price_per_slot}
              onSuccess={() => setOrderStatus('confirmed')}
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
            <h3 className="text-xl font-bold text-yellow-900">Order Complete!</h3>
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
            <h3 className="text-xl font-bold text-amber-900">Refund Processed</h3>
            <p className="text-amber-700 mt-2">Your funds have been returned to your wallet.</p>
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
    </div>
  );
}
