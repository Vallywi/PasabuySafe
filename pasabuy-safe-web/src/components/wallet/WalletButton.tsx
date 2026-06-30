'use client';

import { motion } from 'framer-motion';
import { Wallet, LogOut } from 'lucide-react';
import { useWallet } from '@/lib/hooks/useWallet';
import { truncateAddress } from '@/lib/utils/format';

export function WalletButton() {
  const { publicKey, isConnected, isConnecting, connect, disconnect } = useWallet();

  if (isConnected && publicKey) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2"
      >
        <span className="text-sm bg-yellow-100 text-yellow-900 border border-yellow-200 px-3 py-1.5 rounded-full font-mono font-medium">
          {truncateAddress(publicKey)}
        </span>
        <button
          onClick={disconnect}
          title="Disconnect"
          className="text-slate-400 hover:text-red-500 transition-colors p-2"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.button
      onClick={connect}
      disabled={isConnecting}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 px-5 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-wait shadow-lg shadow-yellow-200/50"
    >
      <Wallet className="w-4 h-4" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </motion.button>
  );
}
