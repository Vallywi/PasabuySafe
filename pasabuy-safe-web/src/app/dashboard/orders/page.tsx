'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useWallet } from '@/lib/hooks/useWallet';
import { supabase } from '@/lib/supabase/client';

interface OrderRow {
  id: string;
  status: string;
  amount: number;
  deposited_at: string;
  group_buy_id: string;
  group_buys: {
    id: string;
    title: string;
    category: string;
    deadline: string;
    image_url: string | null;
  } | null;
}

const categoryEmoji: Record<string, string> = {
  skincare: '🧴',
  food: '🍱',
  electronics: '📱',
  fashion: '👗',
  general: '🛍️',
  other: '📦',
};

const statusConfig: Record<string, { label: string; color: string; emoji: string }> = {
  deposited: { label: 'Paid — Waiting for delivery', color: 'bg-blue-50 text-blue-700 border-blue-200', emoji: '⏳' },
  delivered: { label: 'Ready to confirm', color: 'bg-amber-50 text-amber-700 border-amber-200', emoji: '📦' },
  confirmed: { label: 'Completed', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', emoji: '✅' },
  refunded: { label: 'Refunded', color: 'bg-slate-50 text-slate-700 border-slate-200', emoji: '💰' },
};

export default function MyOrdersPage() {
  const { publicKey, isConnected } = useWallet();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey) {
      setLoading(false);
      return;
    }

    async function fetchOrders() {
      const { data } = await supabase
        .from('participants')
        .select('*, group_buys(*)')
        .eq('buyer_address', publicKey)
        .order('deposited_at', { ascending: false });

      setOrders((data as unknown as OrderRow[]) || []);
      setLoading(false);
    }
    fetchOrders();
  }, [publicKey]);

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🔗</div>
          <p className="text-amber-800 font-medium">Connect your wallet to see your orders</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">My Orders</h1>
      <p className="text-slate-600 mb-8">All your pasabuy participations in one place</p>

      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
              <div className="h-4 w-1/2 bg-slate-100 rounded mb-3" />
              <div className="h-3 w-1/3 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="font-semibold text-slate-900">No orders yet</h3>
          <p className="text-slate-600 mt-2">Browse pasabuys to find something to buy</p>
          <Link
            href="/explore"
            className="inline-block mt-4 bg-yellow-400 hover:bg-yellow-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium"
          >
            Browse Pasabuys
          </Link>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order, i) => {
            const config = statusConfig[order.status] || statusConfig.deposited;
            const gb = order.group_buys;
            if (!gb) return null;

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/dashboard/buyer/${gb.id}`}
                  className="block bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md hover:border-yellow-200 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-yellow-100 to-blue-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {categoryEmoji[gb.category] || '🛍️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-slate-900">{gb.title}</h3>
                        <span className={`text-xs px-3 py-1 rounded-full border font-medium ${config.color}`}>
                          {config.emoji} {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <span>{(order.amount / 10_000_000).toFixed(0)} XLM</span>
                        <span>•</span>
                        <span>{new Date(order.deposited_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
