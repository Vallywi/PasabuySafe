'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useWallet } from '@/lib/hooks/useWallet';
import { invokeContract } from '@/lib/stellar/client';
import { supabase } from '@/lib/supabase/client';
import { nativeToScVal, Address } from '@stellar/stellar-sdk';

interface DepositFormProps {
  groupBuyTitle: string;
  pricePerSlot: number;
  groupBuyId: string;
  onSuccess?: () => void;
}

type Status = 'idle' | 'signing' | 'submitting' | 'success' | 'error';

export function DepositForm({ groupBuyTitle, pricePerSlot, groupBuyId, onSuccess }: DepositFormProps) {
  const { publicKey, isConnected } = useWallet();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function handleDeposit() {
    if (!publicKey) return;

    setStatus('signing');
    setError('');

    try {
      const buyerScVal = new Address(publicKey).toScVal();
      const amountScVal = nativeToScVal(BigInt(pricePerSlot), { type: 'i128' });

      setStatus('submitting');

      const result = await invokeContract('deposit', [buyerScVal, amountScVal], publicKey);

      // Record participant in Supabase (best-effort, contract is source of truth)
      await supabase.from('participants').upsert({
        group_buy_id: groupBuyId,
        buyer_address: publicKey,
        amount: pricePerSlot,
        status: 'deposited',
        tx_hash_deposit: result.txHash || null,
      });

      // Celebration animation
      confetti({
        particleCount: 200,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10B981', '#3B82F6', '#F59E0B'],
      });

      setStatus('success');
      setTimeout(() => onSuccess?.(), 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      // Make blockchain errors friendlier
      if (message.includes('Error(Contract, #3)')) {
        setError('You already deposited into this pasabuy');
      } else if (message.includes('Error(Contract, #2)') || message.includes('NotInitialized')) {
        setError('This pasabuy is not yet active. Ask the organizer to initialize it.');
      } else {
        setError(message);
      }
      setStatus('error');
    }
  }

  if (!isConnected) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
        <p className="text-sm text-amber-800">🔗 Connect your wallet to join this pasabuy</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">Join: {groupBuyTitle}</h3>
          <p className="text-sm text-slate-500 mt-1">
            Your {(pricePerSlot / 10_000_000).toFixed(0)} XLM will be locked in escrow
          </p>
        </div>
        <div className="text-2xl">🛡️</div>
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.button
            key="deposit-btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDeposit}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 py-3.5 rounded-xl font-medium transition-colors shadow-lg shadow-yellow-200"
          >
            💳 Pay {(pricePerSlot / 10_000_000).toFixed(0)} XLM into Escrow
          </motion.button>
        )}

        {status === 'signing' && (
          <motion.div key="signing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-3xl mb-2"
            >
              ✍️
            </motion.div>
            <p className="font-medium text-emerald-600">Sign with Freighter</p>
            <p className="text-xs text-slate-500 mt-1">Approve the transaction in your wallet popup</p>
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
            <p className="text-sm text-slate-600">Sending to Stellar network...</p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="text-center py-4 bg-emerald-50 rounded-xl"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
              className="text-4xl mb-2"
            >
              ✅
            </motion.div>
            <p className="font-bold text-emerald-800">Payment Locked in Escrow!</p>
            <p className="text-xs text-emerald-600 mt-1">
              Funds will only be released when you confirm delivery
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

      <p className="text-xs text-slate-400 mt-4 text-center flex items-center justify-center gap-1">
        🔒 Protected by PasabuySafe smart contract
      </p>
    </div>
  );
}
