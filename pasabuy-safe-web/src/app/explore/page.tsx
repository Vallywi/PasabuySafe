'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Sparkles,
  Flame,
  Clock,
  ArrowRight,
  Settings,
  ShoppingBag,
  Plus,
  MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { timeUntil } from '@/lib/utils/format';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import { xlmToPhp, formatPHP, stroopsToXlm } from '@/lib/utils/currency';

interface GroupBuy {
  id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  price_per_slot: number;
  max_slots: number;
  deadline: string;
  organizer_address: string;
  image_url: string | null;
  location: string | null;
  status: string;
}

// Category emojis are okay — they represent product categories, not UI
const categoryEmoji: Record<string, string> = {
  skincare: '🧴',
  food: '🍱',
  electronics: '📱',
  fashion: '👗',
  general: '🛍️',
  other: '📦',
};

const categoryColor: Record<string, string> = {
  skincare: 'from-pink-100 to-rose-200',
  food: 'from-orange-100 to-amber-200',
  electronics: 'from-blue-100 to-indigo-200',
  fashion: 'from-purple-100 to-pink-200',
  general: 'from-yellow-100 to-teal-200',
  other: 'from-slate-100 to-slate-200',
};

const filters = ['All', 'Skincare', 'Food', 'Electronics', 'Fashion'];

export default function ExplorePage() {
  const { rate } = useExchangeRate();
  const [groupBuys, setGroupBuys] = useState<GroupBuy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from('group_buys')
        .select('*')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) setError('Could not load group buys. Database may not be set up yet.');
      else setGroupBuys(data || []);
      setLoading(false);
    }
    fetch();
  }, []);

  const filtered = activeFilter === 'All'
    ? groupBuys
    : groupBuys.filter((g) => g.category.toLowerCase() === activeFilter.toLowerCase());

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Discover Pasabuys</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            Browse safely — your money is protected by smart contracts
          </p>
        </div>
        <Link
          href="/dashboard/organizer/create"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-yellow-200 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Create New Pasabuy
        </Link>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide"
      >
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeFilter === f
                ? 'bg-emerald-600 text-white shadow-md shadow-yellow-200'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-yellow-300'
            }`}
          >
            {f}
          </button>
        ))}
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-3xl overflow-hidden border border-slate-100">
              <div className="h-48 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-5 w-3/4 bg-slate-100 animate-pulse rounded" />
                <div className="h-4 w-1/2 bg-slate-100 animate-pulse rounded" />
                <div className="h-10 w-full bg-slate-100 animate-pulse rounded-xl mt-4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center">
          <Settings className="w-12 h-12 text-amber-600 mx-auto mb-3" />
          <p className="text-amber-800 font-semibold">Setup needed</p>
          <p className="text-sm text-amber-600 mt-2">{error}</p>
          <p className="text-xs text-amber-500 mt-3">
            Run the SQL migration in <code className="bg-amber-100 px-2 py-0.5 rounded">supabase/migrations/001_initial_schema.sql</code>
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-slate-50 to-emerald-50 border border-slate-200 rounded-3xl p-12 text-center"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 items-center justify-center mb-4"
          >
            <ShoppingBag className="w-8 h-8 text-white" strokeWidth={2.5} />
          </motion.div>
          <h3 className="text-xl font-bold text-slate-900">
            {activeFilter === 'All' ? 'No pasabuys yet' : `No ${activeFilter.toLowerCase()} pasabuys`}
          </h3>
          <p className="text-slate-600 mt-2 max-w-md mx-auto">
            {activeFilter === 'All'
              ? 'Be the first to create a safe group buy!'
              : 'Try a different category or create one yourself.'}
          </p>
          <Link
            href="/dashboard/organizer/create"
            className="inline-flex items-center gap-2 mt-6 bg-yellow-400 hover:bg-yellow-500 text-white px-6 py-3 rounded-xl text-sm font-medium shadow-lg shadow-yellow-200"
          >
            <Sparkles className="w-4 h-4" />
            Create First Pasabuy
          </Link>
        </motion.div>
      )}

      {/* Cards Grid */}
      {!loading && filtered.length > 0 && (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filtered.map((buy) => {
            const deadline = new Date(buy.deadline);
            const isUrgent = (deadline.getTime() - Date.now()) < 1000 * 60 * 60 * 24;

            return (
              <motion.div
                key={buy.id}
                variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }}
                whileHover={{ y: -8 }}
                className="bg-white rounded-3xl overflow-hidden border border-slate-100 hover:border-yellow-200 hover:shadow-2xl hover:shadow-yellow-100/50 transition-all group"
              >
                {/* Image */}
                <div className={`h-48 ${buy.image_url ? '' : `bg-gradient-to-br ${categoryColor[buy.category] || categoryColor.general}`} flex items-center justify-center relative overflow-hidden`}>
                  {buy.image_url ? (
                    <motion.img
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.4 }}
                      src={buy.image_url}
                      alt={buy.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <motion.div whileHover={{ scale: 1.2, rotate: 5 }} className="text-7xl drop-shadow-lg">
                      {categoryEmoji[buy.category] || '🛍️'}
                    </motion.div>
                  )}
                  <span className="absolute top-3 left-3 text-xs px-2.5 py-1 bg-white/90 backdrop-blur rounded-full font-medium text-slate-700 uppercase tracking-wide">
                    {buy.subcategory || buy.category}
                  </span>
                  {isUrgent && (
                    <motion.span
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-red-500 text-white rounded-full font-bold shadow-lg"
                    >
                      <Flame className="w-3 h-3" />
                      URGENT
                    </motion.span>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-bold text-slate-900 text-lg group-hover:text-yellow-700 transition-colors line-clamp-1">
                    {buy.title}
                  </h3>
                  {buy.location && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {buy.location}
                    </p>
                  )}
                  {buy.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{buy.description}</p>
                  )}

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Per slot</p>
                      <p className="text-2xl font-bold text-yellow-700">
                        {formatPHP(xlmToPhp(stroopsToXlm(buy.price_per_slot), rate))}
                      </p>
                      <p className="text-xs text-slate-400">
                        {stroopsToXlm(buy.price_per_slot).toFixed(2)} XLM
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        Deadline
                      </p>
                      <p className={`text-sm font-semibold ${isUrgent ? 'text-red-600' : 'text-slate-700'}`}>
                        {timeUntil(deadline)}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/pasabuy/${buy.id}`}
                    className="mt-5 flex items-center justify-center gap-1.5 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-slate-900 py-3 rounded-xl text-sm font-medium transition-all shadow-md shadow-yellow-100 group-hover:shadow-lg"
                  >
                    Join Safely
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
