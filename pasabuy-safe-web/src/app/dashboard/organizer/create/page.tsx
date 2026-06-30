'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ShieldCheck,
  MapPin,
  Tag,
  Calendar,
  Hash,
  ShoppingBag,
  AlertCircle,
  Truck,
  Wallet,
  RefreshCw,
} from 'lucide-react';
import { useWallet } from '@/lib/hooks/useWallet';
import { supabase } from '@/lib/supabase/client';
import { XLM_TOKEN_ADDRESS } from '@/lib/utils/constants';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import { phpToXlm, xlmToPhp, formatPHP, formatXLM } from '@/lib/utils/currency';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { invokeContractWithStatus } from '@/lib/stellar/client';
import { mapSorobanError } from '@/lib/stellar/errors';
import { nativeToScVal, Address, scValToNative } from '@stellar/stellar-sdk';
import { Api } from '@stellar/stellar-sdk/rpc';

const CATEGORIES: Record<string, string[]> = {
  food: ['Korean Food', 'Japanese Food', 'Filipino Food', 'Snacks & Chips', 'Coffee & Beverages', 'Baked Goods', 'Frozen Items', 'Other Food'],
  skincare: ['Korean Skincare', 'Japanese Skincare', 'Western Skincare', 'Makeup', 'Hair Care', 'Body Care', 'Fragrances', 'Other'],
  electronics: ['Phones', 'Phone Accessories', 'Audio (Earphones/Speakers)', 'Wearables', 'Gaming', 'Computer Parts', 'Cables & Chargers', 'Other'],
  fashion: ['Clothing - Women', 'Clothing - Men', 'Shoes', 'Bags & Wallets', 'Jewelry', 'Accessories', 'Watches', 'Other'],
  general: ['Books', 'Toys', 'Home & Kitchen', 'Sports', 'Pet Supplies', 'Other'],
  other: ['Other'],
};

const SHIPPING_METHODS = [
  'Meet-up (in-person)',
  'Same-day delivery (Lalamove/Grab)',
  'Local courier (LBC, J&T, etc.)',
  'Customer pick-up',
  'Free shipping included',
];

type PriceMode = 'php' | 'xlm';

export default function CreateGroupBuy() {
  const router = useRouter();
  const { publicKey, isConnected } = useWallet();
  const { rate, loading: rateLoading } = useExchangeRate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceMode, setPriceMode] = useState<PriceMode>('php');
  const [pricePhp, setPricePhp] = useState('');
  const [priceXlm, setPriceXlm] = useState('');
  const [maxSlots, setMaxSlots] = useState('');
  const [deadline, setDeadline] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('18:00');
  const [category, setCategory] = useState('food');
  const [subcategory, setSubcategory] = useState('');
  const [location, setLocation] = useState('');
  const [shippingMethod, setShippingMethod] = useState('');
  const [meetupInfo, setMeetupInfo] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subcategoryOptions = CATEGORIES[category] || [];

  // Sync the two price inputs based on which one was edited
  function handlePhpChange(value: string) {
    setPricePhp(value);
    const numeric = parseFloat(value);
    if (!isNaN(numeric) && rate > 0) {
      setPriceXlm(phpToXlm(numeric, rate).toFixed(2));
    } else {
      setPriceXlm('');
    }
  }

  function handleXlmChange(value: string) {
    setPriceXlm(value);
    const numeric = parseFloat(value);
    if (!isNaN(numeric) && rate > 0) {
      setPricePhp(xlmToPhp(numeric, rate).toFixed(2));
    } else {
      setPricePhp('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) return;

    setLoading(true);
    setError('');

    try {
      const xlmAmount = parseFloat(priceXlm);
      if (isNaN(xlmAmount) || xlmAmount <= 0) {
        throw new Error('Enter a valid price');
      }
      if (!deadlineDate) {
        throw new Error('Please select a deadline date');
      }
      const priceStroops = Math.round(xlmAmount * 10_000_000);
      const fullDeadline = new Date(`${deadlineDate}T${deadlineTime || '18:00'}`);
      const deadlineUnixSeconds = Math.floor(fullDeadline.getTime() / 1000);

      // 1. Call create_pasabuy on-chain to get the pasabuy_id
      const organizerScVal = new Address(publicKey).toScVal();
      const deadlineScVal = nativeToScVal(BigInt(deadlineUnixSeconds), { type: 'u64' });
      const confirmWindowScVal = nativeToScVal(BigInt(604800), { type: 'u64' }); // 7 days

      const result = await invokeContractWithStatus(
        'create_pasabuy',
        [organizerScVal, deadlineScVal, confirmWindowScVal],
        publicKey
      );

      // 2. Extract the pasabuy_id (u64) from the return value
      let pasabuyId = '0';
      const successStatus = result.status as Api.GetSuccessfulTransactionResponse;
      if (successStatus.returnValue) {
        pasabuyId = String(scValToNative(successStatus.returnValue));
      }

      // 3. Insert the group_buy row into Supabase with the on-chain contract_id
      const { data, error: dbError } = await supabase
        .from('group_buys')
        .insert({
          contract_id: pasabuyId,
          organizer_address: publicKey,
          title,
          description,
          category,
          subcategory: subcategory || null,
          price_per_slot: priceStroops,
          max_slots: parseInt(maxSlots),
          token_address: XLM_TOKEN_ADDRESS,
          deadline: fullDeadline.toISOString(),
          status: 'active',
          location: location || null,
          shipping_method: shippingMethod || null,
          meetup_info: meetupInfo || null,
          image_url: imageUrl,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      router.push(`/dashboard/organizer/${data.id}`);
    } catch (err) {
      // Check if it's an InvokeError from the contract call
      if (err && typeof err === 'object' && 'kind' in err) {
        setError(mapSorobanError(err));
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create group buy');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border-2 border-yellow-200 rounded-3xl p-8 text-center"
        >
          <div className="inline-flex w-16 h-16 rounded-2xl bg-yellow-200 items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-yellow-900" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Connect Your Wallet</h2>
          <p className="text-slate-600 mt-2">Connect your Freighter wallet to create a pasabuy</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-yellow-200"
          >
            <Sparkles className="w-6 h-6 text-slate-900" strokeWidth={2.5} />
          </motion.div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Create a Pasabuy</h1>
        </div>
        <p className="text-slate-600 mb-8 ml-15">
          Start a new group buy. Funds will be locked in escrow until buyers confirm.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
          {/* Cover Image */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Cover Image</label>
            <ImageUpload
              bucket="group-buy-images"
              currentUrl={imageUrl}
              onUploaded={setImageUrl}
              label="Click to upload item photo"
              maxSizeMB={5}
            />
          </motion.div>

          {/* Title */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <ShoppingBag className="w-4 h-4 text-yellow-600" />
              Pasabuy Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Korean Skincare Bundle from Olive Young"
              required
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
            />
          </motion.div>

          {/* Description */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you buying? Where from? What's included?"
              rows={3}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400 resize-none"
            />
          </motion.div>

          {/* Category + Sub-category */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Tag className="w-4 h-4 text-yellow-600" />
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900"
                required
              >
                <option value="food">🍱 Food & Snacks</option>
                <option value="skincare">🧴 Skincare & Beauty</option>
                <option value="electronics">📱 Electronics</option>
                <option value="fashion">👗 Fashion</option>
                <option value="general">🛍️ General</option>
                <option value="other">📦 Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Sub-category</label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900"
              >
                <option value="">Choose sub-category</option>
                {subcategoryOptions.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </motion.div>

          {/* Location */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <MapPin className="w-4 h-4 text-yellow-600" />
              Pickup / Base Location *
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Cebu City, Cebu / Quezon City, Metro Manila"
              required
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
            />
          </motion.div>

          {/* Shipping */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Truck className="w-4 h-4 text-yellow-600" />
              Shipping / Delivery Method
            </label>
            <select
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-slate-900"
            >
              <option value="">How will you deliver?</option>
              {SHIPPING_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </motion.div>

          {shippingMethod === 'Meet-up (in-person)' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Meetup details</label>
              <input
                type="text"
                value={meetupInfo}
                onChange={(e) => setMeetupInfo(e.target.value)}
                placeholder="e.g., SM City Cebu, every Saturday 2-4pm"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900"
              />
            </motion.div>
          )}

          {/* PRICE — with PHP/XLM toggle */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Price per slot *</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  Rate: 1 XLM ≈ ₱{rate.toFixed(2)}
                  {rateLoading && <RefreshCw className="inline w-3 h-3 ml-1 animate-spin" />}
                </span>
              </div>
            </div>

            <div className="flex bg-slate-100 rounded-xl p-1 mb-3 max-w-xs">
              <button
                type="button"
                onClick={() => setPriceMode('php')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  priceMode === 'php' ? 'bg-yellow-400 text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                ₱ PHP
              </button>
              <button
                type="button"
                onClick={() => setPriceMode('xlm')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  priceMode === 'xlm' ? 'bg-yellow-400 text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                XLM
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                    {priceMode === 'php' ? '₱' : ''}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={priceMode === 'php' ? pricePhp : priceXlm}
                    onChange={(e) => priceMode === 'php' ? handlePhpChange(e.target.value) : handleXlmChange(e.target.value)}
                    placeholder={priceMode === 'php' ? '500' : '22.7'}
                    required
                    className={`w-full ${priceMode === 'php' ? 'pl-8' : 'pl-4'} pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900 placeholder:text-slate-400 font-medium`}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5 ml-1">{priceMode === 'php' ? 'In Philippine Pesos' : 'In Stellar XLM'}</p>
              </div>
              <div className="flex items-center">
                <div className="w-full bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-500">≈ Converts to</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {priceMode === 'php' && priceXlm ? formatXLM(parseFloat(priceXlm)) : ''}
                    {priceMode === 'xlm' && pricePhp ? formatPHP(parseFloat(pricePhp)) : ''}
                    {!pricePhp && !priceXlm && '—'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Slots */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Hash className="w-4 h-4 text-yellow-600" />
              Max slots *
            </label>
            <input
              type="number"
              value={maxSlots}
              onChange={(e) => setMaxSlots(e.target.value)}
              placeholder="12"
              required
              min={1}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900 placeholder:text-slate-400"
            />
          </motion.div>

          {/* Deadline — separate date and time */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Calendar className="w-4 h-4 text-yellow-600" />
              Deadline *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Date</label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Time</label>
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-slate-900"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 ml-1">
              After this date and time, buyers who haven&apos;t received their order can claim a full refund automatically. Choose a realistic delivery timeframe.
            </p>
          </motion.div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </motion.div>
          )}

          {/* Trust banner */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-yellow-700 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-900">
                <strong className="block mb-1">Protected by PasabuySafe escrow</strong>
                Buyers&apos; payments are locked in the smart contract until they confirm delivery. Math, not trust.
              </div>
            </div>
          </motion.div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-yellow-200 flex items-center justify-center gap-2"
          >
            {loading ? 'Creating...' : (
              <>
                <Sparkles className="w-5 h-5" />
                Launch Pasabuy
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
