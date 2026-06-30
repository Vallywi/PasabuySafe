'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/lib/hooks/useWallet';
import { invokeContract } from '@/lib/stellar/client';
import { supabase } from '@/lib/supabase/client';
import { Address } from '@stellar/stellar-sdk';

interface RefundButtonProps {
  amount: number;
  deadlinePassed: boolean;
  groupBuyId?: string;
  onSuccess?: () => void;
}

type Status = 'idle' | 'confirming' | 'signing' | 'submitting' | 'success' | 'error';

export function RefundButton({ amount, deadlinePassed, groupBuyId, onSuccess }: RefundButtonProps) {
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function handleRefund() {
    if (!publicKey) return;

    setStatus('signing');
    setError('');

    try {
      const buyerScVal = new Address(publicKey).toScVal();

      setStatus('submitting');
      const result = await invokeContract('refund', [buyerScVal], publicKey);

      if (groupBuyId) {
        await supabase
          .from('participants')
          .update({
            status: 'refunded',
            refunded_at: new Date().toISOString(),
            tx_hash_confirm: result.txHash || null,
          })
          .eq('group_buy_id', groupBuyId)
          .eq('buyer_address', publicKey);
      }

      setStatus('success');
      setTimeout(() => onSuccess?.(), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refund failed';
      if (message.includes('Error(Contract, #6)')) {
        setError('Deadline has not passed yet. Wait until the deadline expires.');
      } else if (message.includes('Error(Contract, #4)')) {
        setError('No deposit found, or order has already been delivered.');
      } else {
        setError(message);
      }
      setStatus('error');
    }
  }

  if (!deadlinePassed) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
        <p className="text-sm text-slate-600">
          ⏰ Refund will be available after the deadline passes
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-amber-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-3xl">😔</div>
        <div>
          <h3 className="font-semibold text-slate-900">Get Your Refund</h3>
          <p className="text-sm text-slate-600 mt-0.5">
            The deadline has passed and your order wasn&apos;t delivered.
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button
              onClick={() => setStatus('confirming')}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-xl font-medium transition-colors shadow-lg shadow-amber-200"
            >
              💰 Refund My {(amount / 10_000_000).toFixed(0)} XLM
            </button>
            <p className="text-xs text-slate-400 mt-3 text-center">
              ℹ️ Instant on-chain. No approval from anyone needed.
            </p>
          </motion.div>
        )}

        {status === 'confirming' && (
          <motion.div key="confirming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <p className="text-sm text-slate-700 text-center">
              Confirm refund of <strong>{(amount / 10_000_000).toFixed(0)} XLM</strong>?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setStatus('idle')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-medium">
                Cancel
              </button>
              <button onClick={handleRefund} className="bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-medium">
                Yes, Refund
              </button>
            </div>
          </motion.div>
        )}

        {status === 'signing' && (
          <motion.div key="signing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-3xl mb-2">
              ✍️
            </motion.div>
            <p className="font-medium text-amber-600">Sign with Freighter</p>
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
                  className="w-2.5 h-2.5 bg-amber-500 rounded-full"
                />
              ))}
            </div>
            <p className="text-sm text-slate-600">Processing your refund...</p>
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
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-5xl mb-3"
            >
              💰
            </motion.div>
            <p className="text-lg font-bold text-emerald-800">Refund Successful!</p>
            <p className="text-sm text-emerald-600 mt-1">
              {(amount / 10_000_000).toFixed(0)} XLM returned to your wallet
            </p>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700 font-medium">⚠️ {error}</p>
            <button onClick={() => setStatus('idle')} className="text-sm text-red-600 hover:text-red-700 font-medium mt-2 underline">
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
