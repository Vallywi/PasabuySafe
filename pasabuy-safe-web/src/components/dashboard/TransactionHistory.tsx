'use client';

import { useTransactionHistory, type TransactionHistoryEntry } from '@/lib/hooks/useTransactionHistory';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import { truncateAddress } from '@/lib/utils/format';
import { STELLAR_EXPERT_URL } from '@/lib/utils/constants';

/**
 * Props for `TransactionHistory`.
 *
 * `contractId` is part of the design's component contract but is not
 * required for rendering deep-links — every Stellar Expert link is keyed
 * by `tx_hash`. It remains in the interface so callers can pass through
 * the parent `group_buys.contract_id` without inspecting which fields
 * the component actually consumes (matches Req 2.7).
 */
export interface TransactionHistoryProps {
  groupBuyId: string;
  contractId: string;
}

/**
 * Organizer-only Transaction History section.
 *
 * Renders the three render paths from the design's state machine
 * (Req 2.8, 2.9, 2.10, 2.11) by switching on the discriminated-union
 * `state` from `useTransactionHistory`:
 *
 *   - `loading` — skeleton rows; the empty + error messages are NOT
 *     rendered while a query is in flight.
 *   - `error`   — the literal copy "Could not load transaction history"
 *     plus a Retry button that calls `retry()` (which re-runs the query
 *     without a full page reload).
 *   - `ready`   — either the empty-state copy ("No transactions yet.")
 *     or the sorted list of entries.
 *
 * Each entry renders the columns required by Req 2.5: event type
 * (human-readable label), truncated actor address (4…4), XLM amount
 * rounded to 7 decimals + a PHP equivalent (rate cached for 60s via
 * `useExchangeRate`), the on-chain `tx_hash` truncated to 6…6 and
 * deep-linked to Stellar Expert in a new tab when present, and the
 * timestamp formatted as ISO 8601 in the viewer's local timezone.
 *
 * Validates: Requirements 2.1, 2.5, 2.7, 2.8, 2.9, 2.10, 2.11.
 */
export default function TransactionHistory({ groupBuyId }: TransactionHistoryProps) {
  const { state, retry } = useTransactionHistory(groupBuyId);
  const { rate } = useExchangeRate();

  return (
    <section className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Transaction history</h2>
        {state.kind === 'ready' && state.entries.length > 0 && (
          <span className="text-xs text-slate-500">
            {state.entries.length} {state.entries.length === 1 ? 'event' : 'events'}
          </span>
        )}
      </div>

      {state.kind === 'loading' && <SkeletonRows />}

      {state.kind === 'error' && (
        <div className="px-6 py-10 text-center">
          <div className="text-3xl mb-3" aria-hidden="true">⚠️</div>
          <p className="text-slate-700 font-medium">Could not load transaction history</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex items-center bg-slate-900 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-xl font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {state.kind === 'ready' && state.entries.length === 0 && (
        <div className="px-6 py-12 text-center">
          <div className="text-4xl mb-3" aria-hidden="true">📜</div>
          <p className="text-slate-500">No transactions yet.</p>
        </div>
      )}

      {state.kind === 'ready' && state.entries.length > 0 && (
        <ul className="divide-y divide-slate-50">
          {state.entries.map((entry, i) => (
            <HistoryRow key={historyRowKey(entry, i)} entry={entry} rate={rate} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Row + helpers
// ---------------------------------------------------------------------------

interface HistoryRowProps {
  entry: TransactionHistoryEntry;
  rate: number;
}

function HistoryRow({ entry, rate }: HistoryRowProps) {
  const date = new Date(entry.ts);
  const xlmAmount = entry.amount_stroops !== null
    ? Number(entry.amount_stroops) / 10_000_000
    : null;
  const phpAmount = xlmAmount !== null ? xlmAmount * rate : null;

  return (
    <li className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-medium uppercase tracking-wide">
            {formatEventType(entry.event_type)}
          </span>
          <span className="font-mono text-xs text-slate-600">
            {truncateAddress(entry.actor_address, 4, 4)}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-mono" title={date.toISOString()}>
          {formatLocalIso(date)}
        </p>
      </div>

      <div className="text-right sm:min-w-[160px]">
        {xlmAmount !== null ? (
          <>
            <p className="text-sm font-semibold text-slate-900 tabular-nums">
              {xlmAmount.toFixed(7)} XLM
            </p>
            {phpAmount !== null && (
              <p className="text-xs text-slate-500 tabular-nums">
                ≈ ₱{phpAmount.toLocaleString('en-PH', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}
      </div>

      <div className="text-right sm:min-w-[140px]">
        {entry.tx_hash ? (
          <a
            href={`${STELLAR_EXPERT_URL}/tx/${entry.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
            title={entry.tx_hash}
          >
            {truncateHash(entry.tx_hash)}
          </a>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </div>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="divide-y divide-slate-50" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="px-6 py-4 animate-pulse flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-slate-100 rounded" />
            <div className="h-3 w-48 bg-slate-100 rounded" />
          </div>
          <div className="h-4 w-24 bg-slate-100 rounded" />
          <div className="h-4 w-20 bg-slate-100 rounded" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Map an `event_type` enum value to the human-readable label specified
 * by the design's event vocabulary. The on-chain `deliver` and
 * `release` types map to the verbs the rest of the UI uses
 * ("Mark delivered" / "Confirm delivery") so that organizers see one
 * consistent name for each lifecycle step.
 */
function formatEventType(type: TransactionHistoryEntry['event_type']): string {
  switch (type) {
    case 'deposit':
      return 'Deposit';
    case 'deliver':
      return 'Mark delivered';
    case 'release':
      return 'Confirm delivery';
    case 'refund':
      return 'Refund';
    case 'participant_joined':
      return 'Participant joined';
    case 'order_cancelled':
      return 'Order cancelled';
    case 'pasabuy_cancelled':
      return 'Pasabuy cancelled';
    default:
      return type;
  }
}

/**
 * Truncate a 64-char Stellar transaction hash to its first and last
 * six characters with an ellipsis (Req 2.5). Falls back to the full
 * string when the hash is shorter than the truncation window so that
 * fixtures and tests don't collapse to gibberish.
 */
function truncateHash(hash: string): string {
  if (hash.length <= 15) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-6)}`;
}

/**
 * Render a Date as an ISO 8601 string anchored to the viewer's local
 * timezone (Req 2.5). `Date.prototype.toISOString` always returns UTC
 * with a trailing `Z`, which is the wrong timezone for this display, so
 * we compose the local-wall-clock components manually with the local UTC
 * offset.
 */
function formatLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  const tzOffsetMin = -date.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(tzOffsetMin);
  const tzH = pad(Math.floor(absMin / 60));
  const tzM = pad(absMin % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${tzH}:${tzM}`;
}

/**
 * Build a stable React key for a history row. On-chain entries are
 * uniquely identified by `tx_hash`; off-chain entries (where
 * `tx_hash === null`) fall back to `(event_type, actor, ts)` which is
 * unique by construction of the `group_buy_history` view. The list
 * index is mixed in as a final tiebreaker so the key remains stable
 * even when two synthesized events share the same timestamp during
 * test fixtures.
 */
function historyRowKey(entry: TransactionHistoryEntry, index: number): string {
  if (entry.tx_hash) return `tx:${entry.tx_hash}`;
  return `off:${entry.event_type}:${entry.actor_address}:${entry.ts}:${index}`;
}
