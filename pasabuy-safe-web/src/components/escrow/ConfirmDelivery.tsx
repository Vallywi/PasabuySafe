'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useWallet } from '@/lib/hooks/useWallet';
import { invokeContractWithStatus } from '@/lib/stellar/client';
import { mapSorobanError } from '@/lib/stellar/errors';
import { supabase } from '@/lib/supabase/client';
import { ensureProfileWalletLinked } from '@/lib/supabase/ensureProfileWallet';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';

interface ConfirmDeliveryProps {
  groupBuyTitle: string;
  amount: number;
  groupBuyId?: string;
  contractId: string;
  onSuccess?: () => void;
}

type Status = 'idle' | 'confirming' | 'signing' | 'submitting' | 'success' | 'error';

export function ConfirmDelivery({ groupBuyTitle, amount, groupBuyId, contractId, onSuccess }: ConfirmDeliveryProps) {
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [showOffchainFallback, setShowOffchainFallback] = useState(false);

  async function handleConfirm() {
    if (!publicKey) return;

    setStatus('signing');
    setError('');

    try {
      const pasabuyIdScVal = nativeToScVal(BigInt(contractId), { type: 'u64' });
      const buyerScVal = new Address(publicKey).toScVal();

      setStatus('submitting');
      const { txHash } = await invokeContractWithStatus(
        'confirm_delivery',
        [pasabuyIdScVal, buyerScVal],
        publicKey
      );

      // Update Supabase
      if (groupBuyId) {
        // Ensure wallet is linked so the UPDATE RLS policy passes
        await ensureProfileWalletLinked(publicKey);

        await supabase
          .from('participants')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            tx_hash_confirm: txHash,
          })
          .eq('group_buy_id', groupBuyId)
          .eq('buyer_address', publicKey);
      }

      // Big celebration
      confetti({
        particleCount: 300,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#10B981', '#22C55E', '#3B82F6', '#F59E0B'],
      });

      setStatus('success');
      setTimeout(() => onSuccess?.(), 2000);
    } catch (err) {
      const mapped = mapSorobanError(err, 'confirm');
      setError(mapped);

      // If error is NotDelivered (#5), show the off-chain fallback option
      const isNotDelivered =
        err &&
        typeof err === 'object' &&
        'kind' in err &&
        (err as any).kind === 'contract_error' &&
        (err as any).code === 5;
      if (isNotDelivered) {
        setShowOffchainFallback(true);
      }

      setStatus('error');
    }
  }

  async function handleOffchainConfirm() {
    if (!publicKey || !groupBuyId) return;
    setStatus('submitting');
    setShowOffchainFallback(false);

    try {
      await ensureProfileWalletLinked(publicKey);
      await supabase
        .from('participants')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('group_buy_id', groupBuyId)
        .eq('buyer_address', publicKey);

      confetti({
        particleCount: 300,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#10B981', '#22C55E', '#3B82F6', '#F59E0B'],
      });

      setStatus('success');
      setTimeout(() => onSuccess?.(), 2000);
    } catch {
      setError('Failed to confirm off-chain. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="bg-white border-2 border-emerald-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-3xl"
        >
          📦
        </motion.div>
        <div>
          <h3 className="font-semibold text-slate-900">Order Delivered!</h3>
          <p className="text-sm text-slate-600 mt-0.5">
            Did you receive your {groupBuyTitle}?
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4">
              <p className="text-sm text-emerald-800">
                Confirming will release <strong>{(amount / 10_000_000).toFixed(0)} XLM</strong> to the organizer.
              </p>
            </div>
            <button
              onClick={() => setStatus('confirming')}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 py-3.5 rounded-xl font-medium transition-colors shadow-lg shadow-yellow-200"
            >
              ✅ Yes, I Received My Order
            </button>
            <p className="text-xs text-slate-400 mt-3 text-center">
              ⚠️ Permanent action — only confirm if you actually received the item
            </p>
          </motion.div>
        )}

        {status === 'confirming' && (
          <motion.div key="confirming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-amber-900">Are you sure?</p>
              <p className="text-xs text-amber-700 mt-1">
                This releases {(amount / 10_000_000).toFixed(0)} XLM to the organizer and cannot be undone.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStatus('idle')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 py-3 rounded-xl font-medium transition-colors"
              >
                Yes, Release Payment
              </button>
            </div>
          </motion.div>
        )}

        {status === 'signing' && (
          <motion.div key="signing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-3xl mb-2">
              ✍️
            </motion.div>
            <p className="font-medium text-emerald-600">Sign with Freighter</p>
          </motion.div>
        )}

        {status === 'submitting' && (
          <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
            <div className="inline-flex gap-1.5 mb-3">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                  className="w-2.5 h-2.5 bg-yellow-500 rounded-full"
                />
              ))}
            </div>
            <p className="text-sm text-slate-600">Releasing funds to organizer...</p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6 bg-emerald-50 rounded-xl"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-5xl mb-3"
            >
              🎉
            </motion.div>
            <p className="text-lg font-bold text-emerald-800">Funds Released!</p>
            <p className="text-sm text-emerald-600 mt-1">
              {(amount / 10_000_000).toFixed(0)} XLM sent to organizer. Thank you!
            </p>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700 font-medium">⚠️ {error}</p>
              <button onClick={() => { setStatus('idle'); setShowOffchainFallback(false); }} className="text-sm text-red-600 hover:text-red-700 font-medium mt-2 underline">
                Try again
              </button>
            </div>
            {showOffchainFallback && groupBuyId && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800 mb-3">
                  The delivery hasn&apos;t been confirmed on-chain yet. If you&apos;re sure you received your item, you can confirm receipt below. The organizer can claim funds after the confirmation window.
                </p>
                <button
                  onClick={handleOffchainConfirm}
                  className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 py-3 rounded-xl font-medium transition-colors"
                >
                  ✅ Confirm I received my item
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
