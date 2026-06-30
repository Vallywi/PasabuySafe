// Pure helper for ordering Transaction_History entries deterministically.
//
// The ordering rule is fixed by Requirement 2.6 of the
// pasabuy-management-enhancements spec and is exercised by Property 7
// (Transaction history is sorted by timestamp DESC with deterministic
// tie-breaker):
//
//   1. Primary key: `ts` DESC, with NULL/invalid timestamps sorted to the
//      end (treated as older than any non-null timestamp).
//   2. Secondary key (tie-break): event type in the canonical order
//      `deposit`, `participant_joined`, `mark_delivered`, `confirm_delivery`,
//      `refund`, `order_cancelled`, `pasabuy_cancelled`.
//   3. The on-chain mirror uses `deliver` and `release` as the event types
//      for the same semantic events as `mark_delivered` and
//      `confirm_delivery`. They are mapped to their UI canonical names
//      before the tie-break lookup so the on-chain and off-chain streams
//      interleave under a single rule.

export type HistoryEventType =
  | 'deposit'
  | 'mark_delivered'
  | 'confirm_delivery'
  | 'refund'
  | 'participant_joined'
  | 'order_cancelled'
  | 'pasabuy_cancelled'
  // The on-chain mirror uses these aliases for the same semantic events:
  | 'deliver'   // alias for mark_delivered (on-chain mirror)
  | 'release';  // alias for confirm_delivery (on-chain mirror)

export interface HistoryEntry {
  event_type: HistoryEventType;
  ts: string | Date | null;
  // ...other fields are passthrough; only `ts` and `event_type` matter
  // for sorting.
}

// Canonical UI tie-break order, in the exact sequence given by Req 2.6.
const TIE_ORDER: ReadonlyArray<
  Exclude<HistoryEventType, 'deliver' | 'release'>
> = [
  'deposit',
  'participant_joined',
  'mark_delivered',
  'confirm_delivery',
  'refund',
  'order_cancelled',
  'pasabuy_cancelled',
];

// Map the on-chain aliases to their UI canonical names for the tie-break.
function uiType(
  t: HistoryEventType
): Exclude<HistoryEventType, 'deliver' | 'release'> {
  if (t === 'deliver') return 'mark_delivered';
  if (t === 'release') return 'confirm_delivery';
  return t;
}

// Convert a `ts` field into a numeric timestamp. NULL, undefined, and
// unparseable strings collapse to -Infinity so they always sort to the end
// under DESC ordering (any real timestamp is greater than -Infinity).
function toMs(ts: string | Date | null | undefined): number {
  if (ts === null || ts === undefined) return Number.NEGATIVE_INFINITY;
  const d = ts instanceof Date ? ts : new Date(ts);
  const n = d.getTime();
  return Number.isNaN(n) ? Number.NEGATIVE_INFINITY : n;
}

/**
 * Standard `Array.prototype.sort` comparator for Transaction_History entries.
 *
 * Returns:
 *   - negative when `a` should appear before `b` (i.e., `a` is more recent
 *     or, on equal timestamps, earlier in the canonical tie-break order);
 *   - positive when `a` should appear after `b`;
 *   - 0 when both entries are equal under both ordering rules.
 *
 * Pure: depends only on its arguments, performs no I/O, and does not
 * mutate either input.
 */
export function compareHistoryEntries(a: HistoryEntry, b: HistoryEntry): number {
  // (1) Primary key: ts DESC, NULLs/invalid last.
  //     Using NEGATIVE_INFINITY for null/invalid means any real timestamp
  //     compares strictly greater, so the non-null entry sorts first.
  const am = toMs(a.ts);
  const bm = toMs(b.ts);
  if (am !== bm) {
    // Both values are finite or -Infinity (never NaN), so direct comparison
    // is safe and avoids the `-Infinity - -Infinity = NaN` pitfall.
    return bm > am ? 1 : -1;
  }

  // (2) Secondary key: canonical tie-break order, after mapping the
  //     on-chain aliases (`deliver`, `release`) to their UI names.
  const ai = TIE_ORDER.indexOf(uiType(a.event_type));
  const bi = TIE_ORDER.indexOf(uiType(b.event_type));
  return ai - bi;
}
