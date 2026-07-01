'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Plus, Search, ClipboardList, Wallet, ArrowRight, ExternalLink, Trash2 } from 'lucide-react';
import { useWallet } from '@/lib/hooks/useWallet';
import { supabase } from '@/lib/supabase/client';
import { truncateAddress } from '@/lib/utils/format';

interface MyGroupBuy {
  id: string;
  title: string;
  category: string;
  price_per_slot: number;
  status: string;
  created_at: string;
  image_url: string | null;
}

const categoryEmoji: Record<string, string> = {
  skincare: '🧴',
  food: '🍱',
  electronics: '📱',
  fashion: '👗',
  general: '🛍️',
  other: '📦',
};

export default function DashboardPage() {
  const { isConnected, publicKey } = useWallet();
  const [myOrganized, setMyOrganized] = useState<MyGroupBuy[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchOrganized = useCallback(async () => {
    if (!publicKey) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('group_buys')
      .select('id, title, category, price_per_slot, status, created_at, image_url')
      .eq('organizer_address', publicKey)
      .order('created_at', { ascending: false });

    setMyOrganized((data as MyGroupBuy[] | null) ?? []);
    setLoading(false);
  }, [publicKey]);

  useEffect(() => {
    fetchOrganized();
  }, [fetchOrganized]);

  /**
   * Delete a cancelled pasabuy directly from the list. Only allowed when
   * `status === 'cancelled'` — the organizer detail page enforces the same
   * rule, this just brings the shortcut to the dashboard so the user
   * doesn't have to open each one.
   *
   * `e.preventDefault()` + `e.stopPropagation()` are required because the
   * whole row is wrapped in a <Link> that would otherwise steal the click.
   */
  async function handleDelete(
    e: React.MouseEvent<HTMLButtonElement>,
    groupBuy: MyGroupBuy
  ) {
    e.preventDefault();
    e.stopPropagation();
    if (groupBuy.status !== 'cancelled') return;
    if (
      !window.confirm(
        `Delete "${groupBuy.title}"? This removes it from your list. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(groupBuy.id);
    const { error } = await supabase
      .from('group_buys')
      .delete()
      .eq('id', groupBuy.id);
    setDeletingId(null);
    if (error) {
      window.alert(`Could not delete: ${error.message}`);
      return;
    }
    setMyOrganized((rows) => rows.filter((r) => r.id !== groupBuy.id));
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center"
        >
          <div className="inline-flex w-16 h-16 rounded-2xl bg-amber-100 items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-amber-900">Connect Your Wallet</h2>
          <p className="text-amber-700 mt-2">
            Connect your Freighter wallet to access your dashboard
          </p>
          <p className="text-sm text-amber-600 mt-4">
            Don&apos;t have one?{' '}
            <a href="https://www.freighter.app/" target="_blank" rel="noopener noreferrer" className="underline font-medium inline-flex items-center gap-1">
              Install Freighter <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="text-slate-500 mt-1 font-mono text-sm">{truncateAddress(publicKey || '', 6, 6)}</p>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Link href="/dashboard/organizer/create">
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white rounded-2xl p-6 cursor-pointer h-full shadow-lg shadow-yellow-200/50"
            >
              <Plus className="w-7 h-7" strokeWidth={2.5} />
              <h3 className="font-semibold mt-3 text-lg">Create Pasabuy</h3>
              <p className="text-sm text-emerald-100 mt-1">Start a new group buy</p>
            </motion.div>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Link href="/explore">
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-6 cursor-pointer h-full shadow-lg shadow-blue-200/50"
            >
              <Search className="w-7 h-7" strokeWidth={2.5} />
              <h3 className="font-semibold mt-3 text-lg">Join Pasabuy</h3>
              <p className="text-sm text-blue-100 mt-1">Browse active group buys</p>
            </motion.div>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Link href="/dashboard/orders">
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl p-6 cursor-pointer h-full shadow-lg shadow-purple-200/50"
            >
              <ClipboardList className="w-7 h-7" strokeWidth={2.5} />
              <h3 className="font-semibold mt-3 text-lg">My Orders</h3>
              <p className="text-sm text-purple-100 mt-1">Track your purchases</p>
            </motion.div>
          </Link>
        </motion.div>
      </div>

      {/* My Organized Pasabuys */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Pasabuys I Organize</h2>
          {myOrganized.length > 0 && (
            <Link href="/dashboard/organizer/create" className="inline-flex items-center gap-1 text-sm text-yellow-700 hover:text-yellow-800 font-medium">
              <Plus className="w-4 h-4" /> New
            </Link>
          )}
        </div>

        {loading && (
          <div className="bg-slate-50 rounded-2xl h-32 animate-pulse" />
        )}

        {!loading && myOrganized.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-slate-500">You haven&apos;t organized any pasabuys yet</p>
            <Link
              href="/dashboard/organizer/create"
              className="inline-flex items-center gap-1 mt-3 text-yellow-700 hover:text-yellow-800 font-medium"
            >
              Create your first one
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {!loading && myOrganized.length > 0 && (
          <div className="space-y-3">
            {myOrganized.map((gb) => {
              const isCancelled = gb.status === 'cancelled';
              const isDeleting = deletingId === gb.id;
              return (
                <Link
                  key={gb.id}
                  href={`/dashboard/organizer/${gb.id}`}
                  className="block bg-white border border-slate-100 hover:border-yellow-200 hover:shadow-md transition-all rounded-2xl p-4 group"
                >
                  <div className="flex items-center gap-4">
                    {/* Thumbnail — prefer the uploaded image; fall back to the
                        category emoji tile if none was uploaded. */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-100 to-blue-100 flex items-center justify-center text-2xl overflow-hidden shrink-0">
                      {gb.image_url ? (
                        <Image
                          src={gb.image_url}
                          alt={gb.title}
                          width={48}
                          height={48}
                          className="w-12 h-12 object-cover"
                          unoptimized
                        />
                      ) : (
                        <span>{categoryEmoji[gb.category] || '🛍️'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{gb.title}</h3>
                      <p className="text-sm text-slate-500">
                        {(gb.price_per_slot / 10_000_000).toFixed(0)} XLM per slot •{' '}
                        <span
                          className={
                            isCancelled
                              ? 'text-rose-600 font-medium'
                              : gb.status === 'active'
                                ? 'text-emerald-600 font-medium'
                                : ''
                          }
                        >
                          {gb.status}
                        </span>
                      </p>
                    </div>
                    {isCancelled ? (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, gb)}
                        disabled={isDeleting}
                        aria-label={`Delete ${gb.title}`}
                        className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700 disabled:text-rose-300 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        {isDeleting ? 'Deleting…' : 'Delete'}
                      </button>
                    ) : (
                      <span className="text-yellow-700 text-sm inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        Manage
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
