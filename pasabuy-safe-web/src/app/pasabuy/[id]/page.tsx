'use client';

// Pasabuy_Detail_Page — public read-only detail view for a single pasabuy.
//
// Implements Requirement 4 of the pasabuy-management-enhancements spec:
//   4.1  Reachable at /pasabuy/{id}.
//   4.2  Renders the full pasabuy details enumerated in the AC.
//   4.3  Shows a "Join this pasabuy" CTA when joinable.
//   4.4  Shows a single unavailability reason via the precedence ladder
//        encoded in `computeJoinability`.
//   4.5  Replaces the join CTA with "View my order" when the viewer already
//        has a participants row.
//   4.6  Renders "Pasabuy not found" + back-to-Explore link for unknown ids.
//   4.7  Renders without a wallet; Freighter is prompted only when the user
//        activates the "Join this pasabuy" CTA — at click time we trigger
//        `connect()` before opening the JoinForm.
//   4.8  Loading state never shows "Pasabuy not found".
//   4.9  Generic-error state shows "Could not load pasabuy details. Try again."
//        with a retry button that re-runs both queries without a full reload.
//
// Task 5.2 wires `JoinForm` into this page: clicking "Join this pasabuy" opens
// the form inline below the CTA, prompting Freighter first if disconnected.
// On a successful join, `onSuccess` routes the buyer to /dashboard/buyer/{id}
// via next/navigation.

export const runtime = 'nodejs';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Package,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useWallet } from '@/lib/hooks/useWallet';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import { formatPHP, stroopsToXlm, xlmToPhp } from '@/lib/utils/currency';
import { truncateAddress } from '@/lib/utils/format';
import { computeJoinability } from '@/lib/utils/joinability';
import { JoinForm } from '@/components/escrow/JoinForm';

interface GroupBuy {
  id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  image_url: string | null;
  price_per_slot: number;
  max_slots: number;
  deadline: string;
  location: string | null;
  shipping_method: string | null;
  meetup_info: string | null;
  organizer_address: string;
  status: 'active' | 'in_progress' | 'completed' | 'expired' | 'cancelled';
}

interface OrganizerProfile {
  display_name: string | null;
  full_name: string | null;
}

interface ViewerParticipant {
  id: string;
  status: 'deposited' | 'delivered' | 'confirmed' | 'refunded' | 'cancelled';
}

type DetailState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      gb: GroupBuy;
      organizer: OrganizerProfile | null;
      joinedCount: number;
      viewerParticipant: ViewerParticipant | null;
    };

// Statuses that count toward "slots taken" per Req 4.2 and 4.4.
const ACTIVE_PARTICIPANT_STATUSES = ['deposited', 'delivered', 'confirmed'] as const;

// Emoji + gradient placeholders mirror the Explore page so the detail view
// stays visually consistent when image_url is null or fails to load.
const categoryEmoji: Record<string, string> = {
  skincare: '🧴',
  food: '🍱',
  electronics: '📱',
  fashion: '👗',
  general: '🛍️',
  other: '📦',
};

const categoryGradient: Record<string, string> = {
  skincare: 'from-pink-100 to-rose-200',
  food: 'from-orange-100 to-amber-200',
  electronics: 'from-blue-100 to-indigo-200',
  fashion: 'from-purple-100 to-pink-200',
  general: 'from-yellow-100 to-teal-200',
  other: 'from-slate-100 to-slate-200',
};

function formatDeadlineLocal(iso: string): string {
  // Requirement 4.2: deadline rendered in user's local timezone.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function PasabuyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const router = useRouter();
  const { publicKey, isConnected, connect } = useWallet();
  const { rate } = useExchangeRate();

  const [state, setState] = useState<DetailState>({ kind: 'loading' });
  // Controls inline JoinForm visibility once the user activates the CTA
  // (Req 4.7 + Task 5.2). The form is rendered below the CTA card; closing it
  // returns the user to the joinable CTA state without leaving the page.
  const [joinOpen, setJoinOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: 'not_found' });
      return;
    }
    setState({ kind: 'loading' });

    try {
      // Run the pasabuy fetch and the joined-count fetch in parallel.
      // The viewer's participants row is only fetched when a wallet is
      // connected (Req 4.7: do not require a wallet to render).
      const groupBuyPromise = supabase
        .from('group_buys')
        .select(
          'id, title, description, category, subcategory, image_url, ' +
            'price_per_slot, max_slots, deadline, location, shipping_method, ' +
            'meetup_info, organizer_address, status',
        )
        .eq('id', id)
        .maybeSingle();

      const joinedCountPromise = supabase
        .from('participants_public')
        .select('id', { count: 'exact', head: true })
        .eq('group_buy_id', id)
        .in('status', ACTIVE_PARTICIPANT_STATUSES as unknown as string[]);

      const viewerPromise = publicKey
        ? supabase
            .from('participants')
            .select('id, status')
            .eq('group_buy_id', id)
            .eq('buyer_address', publicKey)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const);

      const [gbRes, countRes, viewerRes] = await Promise.all([
        groupBuyPromise,
        joinedCountPromise,
        viewerPromise,
      ]);

      if (gbRes.error) {
        // Distinguish "row missing" (PostgREST PGRST116) from a generic
        // failure. maybeSingle() returns data=null without an error when
        // the row is missing, so any error here is treated as transient.
        setState({ kind: 'error' });
        return;
      }
      if (!gbRes.data) {
        setState({ kind: 'not_found' });
        return;
      }
      if (countRes.error) {
        setState({ kind: 'error' });
        return;
      }

      const gb = gbRes.data as unknown as GroupBuy;

      // Organizer display name lookup. Failure here is non-fatal — fall
      // back to rendering only the truncated stellar_address.
      const { data: organizer } = await supabase
        .from('profiles')
        .select('display_name, full_name')
        .eq('stellar_address', gb.organizer_address)
        .maybeSingle();

      setState({
        kind: 'ready',
        gb,
        organizer: organizer ?? null,
        joinedCount: countRes.count ?? 0,
        viewerParticipant:
          (viewerRes.data as ViewerParticipant | null | undefined) ?? null,
      });
    } catch {
      setState({ kind: 'error' });
    }
  }, [id, publicKey]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Loading state (Req 4.8): skeleton only; no not-found / error copy.
  if (state.kind === 'loading') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-5">
          <div className="h-4 w-32 bg-slate-100 rounded" />
          <div className="h-64 bg-slate-100 rounded-3xl" />
          <div className="h-7 w-3/4 bg-slate-100 rounded" />
          <div className="h-4 w-1/2 bg-slate-100 rounded" />
          <div className="h-24 bg-slate-100 rounded-2xl" />
          <div className="h-12 w-full bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  // ---- Not found (Req 4.6): literal message + back-to-Explore link.
  if (state.kind === 'not_found') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-2xl font-bold text-slate-900">Pasabuy not found</h1>
        <p className="text-slate-600 mt-2">
          We could not find that pasabuy. It may have been removed.
        </p>
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-medium shadow-md shadow-yellow-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Explore
        </Link>
      </div>
    );
  }

  // ---- Generic error (Req 4.9): message + retry button that re-runs the
  // queries without a full page reload.
  if (state.kind === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-slate-900">
          Could not load pasabuy details. Try again.
        </h1>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={load}
            className="px-5 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-medium shadow-md shadow-yellow-100"
          >
            Retry
          </button>
          <Link
            href="/explore"
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:border-slate-300"
          >
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  // ---- Ready state.
  const { gb, organizer, joinedCount, viewerParticipant } = state;
  const xlm = stroopsToXlm(gb.price_per_slot);
  const php = xlmToPhp(xlm, rate);
  const organizerName =
    organizer?.display_name?.trim() ||
    organizer?.full_name?.trim() ||
    'Organizer';
  const deadlineLabel = formatDeadlineLocal(gb.deadline);
  const joinability = computeJoinability(
    {
      status: gb.status,
      max_slots: gb.max_slots,
      deadline: gb.deadline,
    },
    joinedCount,
    new Date(),
  );

  const emoji = categoryEmoji[gb.category] ?? categoryEmoji.general;
  const gradient = categoryGradient[gb.category] ?? categoryGradient.general;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/explore"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Explore
      </Link>

      {/* Hero image with placeholder fallback (Req 4.2). */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative w-full h-64 sm:h-80 rounded-3xl overflow-hidden border border-slate-100 ${
          gb.image_url ? 'bg-slate-100' : `bg-gradient-to-br ${gradient}`
        } flex items-center justify-center`}
      >
        <PasabuyImage src={gb.image_url} alt={gb.title} fallbackEmoji={emoji} />
        <span className="absolute top-3 left-3 text-xs px-2.5 py-1 bg-white/90 backdrop-blur rounded-full font-medium text-slate-700 uppercase tracking-wide">
          {gb.subcategory || gb.category}
        </span>
        {gb.status === 'cancelled' && (
          <span className="absolute top-3 right-3 text-xs px-2.5 py-1 bg-red-500 text-white rounded-full font-bold shadow-lg uppercase tracking-wide">
            Cancelled
          </span>
        )}
      </motion.div>

      {/* Title + description */}
      <div className="mt-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          {gb.title}
        </h1>
        {gb.description && (
          <p className="text-slate-600 mt-3 whitespace-pre-line">
            {gb.description}
          </p>
        )}
      </div>

      {/* Pricing + slots block */}
      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            Per slot
          </p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">
            {formatPHP(php)}
          </p>
          <p className="text-xs text-slate-500 mt-1">{xlm.toFixed(2)} XLM</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Slots
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {joinedCount} <span className="text-slate-400">/ {gb.max_slots}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {Math.max(gb.max_slots - joinedCount, 0)} remaining
          </p>
        </div>
      </div>

      {/* Logistics block: deadline, location, shipping, meetup */}
      <div className="mt-4 bg-white border border-slate-100 rounded-2xl p-5 space-y-3 text-sm text-slate-700">
        <DetailRow
          icon={<Clock className="w-4 h-4 text-slate-400" />}
          label="Deadline"
          value={deadlineLabel}
        />
        {gb.location && (
          <DetailRow
            icon={<MapPin className="w-4 h-4 text-slate-400" />}
            label="Location"
            value={gb.location}
          />
        )}
        {gb.shipping_method && (
          <DetailRow
            icon={<Truck className="w-4 h-4 text-slate-400" />}
            label="Shipping"
            value={gb.shipping_method}
          />
        )}
        {gb.meetup_info && (
          <DetailRow
            icon={<Package className="w-4 h-4 text-slate-400" />}
            label="Meetup"
            value={gb.meetup_info}
          />
        )}
        <DetailRow
          icon={<User className="w-4 h-4 text-slate-400" />}
          label="Organizer"
          value={
            <span>
              {organizerName}{' '}
              <span className="font-mono text-slate-500">
                ({truncateAddress(gb.organizer_address, 4, 4)})
              </span>
            </span>
          }
        />
      </div>

      {/* CTA area (Req 4.3–4.5, 4.7). */}
      <div className="mt-6">
        {viewerParticipant ? (
          <Link
            href={`/dashboard/buyer/${gb.id}`}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-slate-900 text-sm font-semibold shadow-md shadow-yellow-100 transition-all"
          >
            View my order
          </Link>
        ) : joinability.joinable ? (
          joinOpen ? (
            // Inline JoinForm (Task 5.2). The form encapsulates the
            // deposit-then-insert flow (Req 5.7) and the not-connected
            // fallback. On a successful insert it calls `onSuccess` which
            // routes the buyer to their order page (Req 4.7 + 5.1).
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Joining
                </p>
                <button
                  type="button"
                  onClick={() => setJoinOpen(false)}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                >
                  <X className="w-3.5 h-3.5" />
                  Close
                </button>
              </div>
              <JoinForm
                groupBuyId={gb.id}
                groupBuyTitle={gb.title}
                pricePerSlot={gb.price_per_slot}
                onSuccess={() => {
                  // Req 4.7 / 5.1: route the buyer to their order page
                  // once the participants row is inserted.
                  router.push(`/dashboard/buyer/${gb.id}`);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={async () => {
                // Req 4.7: Freighter is only prompted when the user
                // activates the Join CTA. If a wallet is already connected
                // we skip the prompt and open the form directly.
                if (!isConnected) {
                  await connect();
                }
                setJoinOpen(true);
              }}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-slate-900 text-sm font-semibold shadow-md shadow-yellow-100 transition-all"
            >
              Join this pasabuy
            </button>
          )
        ) : (
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-medium text-slate-600">
            {joinability.reason}
          </div>
        )}
      </div>
    </div>
  );
}

/** A single label/value row inside the logistics card. */
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        <div className="text-sm text-slate-800 mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

/**
 * Hero image renderer. Uses a native <img> with an onError handler so a
 * broken or null `image_url` falls back to the category emoji placeholder
 * without breaking the layout. Next/Image is intentionally avoided here:
 * uploads land in Supabase Storage and the domain set isn't part of the
 * Next.js image config, so a plain <img> keeps this page self-contained.
 */
function PasabuyImage({
  src,
  alt,
  fallbackEmoji,
}: {
  src: string | null;
  alt: string;
  fallbackEmoji: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <span className="text-7xl drop-shadow-lg" aria-hidden="true">
        {fallbackEmoji}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      className="w-full h-full object-cover"
    />
  );
}
