'use client';

import { useEffect, useState } from 'react';
import { truncateAddress } from '@/lib/utils/format';
import { MarkDeliveredButton } from '@/components/escrow/MarkDeliveredButton';

/**
 * ParticipantList — the organizer's view of every participant of a single
 * pasabuy, including the per-order contact fields collected by JoinForm
 * (Requirement 3).
 *
 * This component is the only place in the app that renders `buyer_name`,
 * `buyer_contact`, `buyer_location`, and `buyer_note`. The RLS policy on
 * `participants` (migration 005) is the actual defense for these columns —
 * non-organizers receive `NULL`s back from the query — so the UI logic here
 * just renders whatever the row contains. The four rules from the spec:
 *
 *   - Single null field → render the literal "—" (Req 3.4).
 *   - All four contact fields null → render the single summary message
 *     `"No contact information provided"` spanning the four columns
 *     (Req 3.5), instead of four "—" placeholders.
 *   - Non-null `buyer_contact` → render an adjacent copy-to-clipboard button
 *     (Req 3.6).
 *   - Null `buyer_contact` → hide the copy button (Req 3.7).
 *
 * The copy button writes `buyer_contact` to `navigator.clipboard` and shows
 * a "Copied" toast for 2 seconds on success (Req 3.6). If `writeText`
 * rejects, an error toast is shown for 3 seconds and the "Copied" toast is
 * NOT shown (Req 3.8).
 *
 * The "Mark Delivered" action delegates to {@link MarkDeliveredButton} so
 * that the full bounded on-chain → DB write state machine (Requirement 7)
 * runs there. ParticipantList keeps a single `actioningBuyer` interlock so
 * that while one row's mark-delivered is in flight, the other rows'
 * buttons are disabled (Req 7.9). Internally MarkDeliveredButton also
 * disables itself for the duration, so this interlock is a courtesy that
 * prevents the organizer from kicking off multiple confirmations in
 * parallel and signing them out of order.
 *
 * Requirements: 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 7.9, 7.10
 * Design: `ParticipantList`
 */
export interface Participant {
  id: string;
  buyer_address: string;
  /** Amount in stroops (1 XLM = 10^7 stroops). */
  amount: number;
  /** Number of slots/items this buyer ordered. */
  quantity: number;
  /** Buyer-selected delivery method, e.g. "Meet-up (in-person)". */
  delivery_method: string | null;
  status: 'deposited' | 'delivered' | 'confirmed' | 'refunded' | 'cancelled';
  buyer_name: string | null;
  buyer_contact: string | null;
  buyer_location: string | null;
  buyer_note: string | null;
  deposited_at: string;
}

export interface ParticipantListProps {
  /** UUID of the parent `group_buys` row. */
  groupBuyId: string;
  /**
   * `group_buys.contract_id` (the UUID foreign key on `contract_events`,
   * NOT the on-chain Soroban contract address). Forwarded to each
   * {@link MarkDeliveredButton} so the on-chain `deliver` event can be
   * mirrored into `contract_events` immediately on success.
   */
  contractId: string;
  /** Participant rows already filtered to this pasabuy. */
  participants: Participant[];
  /** Called after a successful mark-delivered + DB writes for any row. */
  onMarkedDelivered: () => void;
}

type Toast = { kind: 'success' | 'error'; message: string };

/**
 * Safety-net for the cross-row mark-delivered interlock. The on-chain call
 * inside {@link MarkDeliveredButton} is bounded by a 60 s timeout
 * (`invokeContractWithStatus`). If the call errors out, MarkDeliveredButton
 * re-enables itself but does not notify us — without a fallback, the other
 * rows would stay disabled forever. After this many ms with no
 * `onMarkedDelivered` callback, we forcibly clear the interlock.
 */
const ACTIONING_INTERLOCK_TIMEOUT_MS = 70_000;

export function ParticipantList({
  groupBuyId,
  contractId,
  participants,
  onMarkedDelivered,
}: ParticipantListProps) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [actioningBuyer, setActioningBuyer] = useState<string | null>(null);

  // Auto-dismiss the toast after its display window. The window differs by
  // kind so success / error feedback follows the spec timings exactly:
  // 2 s on success (Req 3.6), 3 s on failure (Req 3.8).
  useEffect(() => {
    if (toast === null) return;
    const ms = toast.kind === 'success' ? 2000 : 3000;
    const handle = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(handle);
  }, [toast]);

  // Safety-net: if a mark-delivered call errors and never resolves through
  // `onMarkedDelivered`, this clears the interlock so other rows are not
  // permanently locked out. See ACTIONING_INTERLOCK_TIMEOUT_MS.
  useEffect(() => {
    if (actioningBuyer === null) return;
    const handle = setTimeout(
      () => setActioningBuyer(null),
      ACTIONING_INTERLOCK_TIMEOUT_MS
    );
    return () => clearTimeout(handle);
  }, [actioningBuyer]);

  async function copyContact(contact: string) {
    // `navigator.clipboard` is available on every modern browser over
    // HTTPS; we are a 'use client' component so SSR cannot reach this code
    // path. We still defensively `try/catch` and surface the error toast
    // per Req 3.8 — and we deliberately do not log the contact value to
    // the console so it cannot leak into shared logs.
    try {
      await navigator.clipboard.writeText(contact);
      setToast({ kind: 'success', message: 'Copied' });
    } catch {
      setToast({
        kind: 'error',
        message: 'Could not copy contact. Please try again.',
      });
    }
  }

  function handleMarkDeliveredDone() {
    setActioningBuyer(null);
    onMarkedDelivered();
  }

  if (participants.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-500">No buyers yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Share the link to get participants
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <ul className="space-y-3">
        {participants.map((p) => {
          const allContactNull =
            p.buyer_name === null &&
            p.buyer_contact === null &&
            p.buyer_location === null &&
            p.buyer_note === null;

          return (
            <li
              key={p.id}
              className="bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-colors"
            >
              {/* Top row: truncated address + deposited metadata + status. */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p
                    className="font-mono text-sm text-slate-700"
                    title={p.buyer_address}
                  >
                    {truncateAddress(p.buyer_address)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(p.amount / 10_000_000).toFixed(2)} XLM &middot;{' '}
                    {p.quantity}× item{p.quantity === 1 ? '' : 's'} &middot;{' '}
                    {new Date(p.deposited_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>

              {/* Contact / delivery details. Either the four-up grid, or
                  the single summary line for all-null rows (Req 3.5). */}
              {allContactNull ? (
                <div className="text-sm text-slate-500 italic bg-slate-50 rounded-lg px-3 py-2">
                  No contact information provided
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <ContactField label="Name" value={p.buyer_name} />
                  <ContactField
                    label="Contact"
                    value={p.buyer_contact}
                    copyButton={
                      p.buyer_contact !== null ? (
                        <CopyButton
                          value={p.buyer_contact}
                          onCopy={copyContact}
                        />
                      ) : null
                    }
                  />
                  <ContactField label="Location" value={p.buyer_location} />
                  <ContactField label="Note" value={p.buyer_note} />
                  <ContactField
                    label="Quantity"
                    value={`${p.quantity} × item${p.quantity === 1 ? '' : 's'}`}
                  />
                  <ContactField label="Delivery Method" value={p.delivery_method} />
                </div>
              )}

              {/* Action row. Mark Delivered is the only interactive action
                  on a participant row, and only for the `deposited` state.
                  Other statuses render an inline state badge instead. */}
              <div className="mt-3 flex justify-end">
                {p.status === 'deposited' ? (
                  // The wrapper captures the click on the bubble path so
                  // we can flip `actioningBuyer` BEFORE MarkDeliveredButton
                  // enters its own loading state. This is what disables
                  // every other row's button (Req 7.9 across rows).
                  <div
                    onClickCapture={() => setActioningBuyer(p.buyer_address)}
                  >
                    <MarkDeliveredButton
                      groupBuyId={groupBuyId}
                      contractId={contractId}
                      buyerAddress={p.buyer_address}
                      disabled={
                        actioningBuyer !== null &&
                        actioningBuyer !== p.buyer_address
                      }
                      onDone={handleMarkDeliveredDone}
                    />
                  </div>
                ) : (
                  <StatusActionHint status={p.status} />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Toast region. Single toast at a time — the most recent copy
          attempt's result wins, matching the design's single-message
          guidance. Aria-live polite so screen readers announce it. */}
      {toast !== null && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg text-sm font-medium ${
            toast.kind === 'success'
              ? 'bg-slate-900 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Subcomponents                                                              */
/* -------------------------------------------------------------------------- */

interface ContactFieldProps {
  label: string;
  value: string | null;
  copyButton?: React.ReactNode;
}

function ContactField({ label, value, copyButton }: ContactFieldProps) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-0.5 flex items-center gap-2 min-w-0">
        <span className="text-slate-700 whitespace-pre-wrap break-words min-w-0">
          {/* Req 3.4: every null field renders the literal em-dash, never
              the JS string "null". */}
          {value ?? '—'}
        </span>
        {copyButton}
      </div>
    </div>
  );
}

interface CopyButtonProps {
  value: string;
  onCopy: (value: string) => void;
}

function CopyButton({ value, onCopy }: CopyButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      aria-label="Copy contact"
      title="Copy contact"
      className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100"
    >
      {/* Inline SVG keeps the bundle small and avoids a runtime icon dep. */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  );
}

function StatusBadge({ status }: { status: Participant['status'] }) {
  switch (status) {
    case 'deposited':
      return (
        <Badge tone="blue" label="Deposited" />
      );
    case 'delivered':
      return (
        <Badge tone="amber" label="Delivered" />
      );
    case 'confirmed':
      return (
        <Badge tone="emerald" label="Confirmed" />
      );
    case 'refunded':
      return (
        <Badge tone="slate" label="Refunded" />
      );
    case 'cancelled':
      return (
        <Badge tone="rose" label="Cancelled" />
      );
  }
}

function StatusActionHint({ status }: { status: Participant['status'] }) {
  switch (status) {
    case 'delivered':
      return (
        <span className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full font-medium">
          ⏳ Waiting for buyer to confirm
        </span>
      );
    case 'confirmed':
      return (
        <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">
          ✅ Funds released
        </span>
      );
    case 'refunded':
      return (
        <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
          💰 Refunded
        </span>
      );
    case 'cancelled':
      return (
        <span className="text-xs text-rose-700 bg-rose-50 px-3 py-1.5 rounded-full font-medium">
          ✖ Cancelled
        </span>
      );
    default:
      return null;
  }
}

type Tone = 'blue' | 'amber' | 'emerald' | 'slate' | 'rose';

function Badge({ tone, label }: { tone: Tone; label: string }) {
  const tones: Record<Tone, string> = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-600',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <span
      className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {label}
    </span>
  );
}
