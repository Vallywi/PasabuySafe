'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { useWallet } from '@/lib/hooks/useWallet';
import { invokeContractWithStatus } from '@/lib/stellar/client';
import { mapSorobanError } from '@/lib/stellar/errors';
import { supabase } from '@/lib/supabase/client';
import {
  validatePhonePH,
  validateBuyerName,
  validateBuyerLocation,
  validateBuyerNote,
  BUYER_NAME_MESSAGE,
  PH_PHONE_MESSAGE,
  BUYER_LOCATION_MESSAGE,
  BUYER_NOTE_MESSAGE,
} from '@/lib/utils/validation';

/**
 * JoinForm — collects per-order delivery details and performs the
 * deposit-then-insert flow defined in Requirement 5.
 *
 * Sequence (Req 5.7):
 *   1. Validate all four fields (Req 5.3-5.6) using shared validators from
 *      `validation.ts`. Block submission on any failure.
 *   2. Invoke `deposit` on the Escrow_Contract via `invokeContractWithStatus`.
 *      If the on-chain call fails, NO participants row is inserted (Req 5.8)
 *      and the user's input remains in state so they can retry without
 *      re-typing (Req 5.9).
 *   3. Only after the deposit transaction is confirmed do we insert the
 *      `participants` row with the four buyer detail columns + `tx_hash_deposit`.
 *   4. On insert success, route the user to their order page via `onSuccess`.
 *
 * The form never pre-fills from the user's profile (Req 5.2) so each order can
 * carry independent delivery details.
 */
export interface JoinFormProps {
  groupBuyId: string;
  groupBuyTitle: string;
  /** Price per slot in stroops. Will be passed as i128 to the contract. */
  pricePerSlot: number;
  /** Called after the participants row is successfully inserted. */
  onSuccess: () => void;
}

type Phase = 'idle' | 'validating' | 'depositing' | 'recording' | 'success' | 'error';

interface FieldErrors {
  name?: string;
  contact?: string;
  location?: string;
  note?: string;
}

interface TouchedFields {
  name: boolean;
  contact: boolean;
  location: boolean;
  note: boolean;
}

function computeErrors(values: {
  name: string;
  contact: string;
  location: string;
  note: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!validateBuyerName(values.name)) errors.name = BUYER_NAME_MESSAGE;
  if (!validatePhonePH(values.contact)) errors.contact = PH_PHONE_MESSAGE;
  if (!validateBuyerLocation(values.location)) errors.location = BUYER_LOCATION_MESSAGE;
  if (!validateBuyerNote(values.note)) errors.note = BUYER_NOTE_MESSAGE;
  return errors;
}

export function JoinForm({ groupBuyId, groupBuyTitle, pricePerSlot, onSuccess }: JoinFormProps) {
  const { publicKey, isConnected, connect, isConnecting } = useWallet();

  // All four fields start empty — no profile pre-fill (Req 5.2).
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');

  const [touched, setTouched] = useState<TouchedFields>({
    name: false,
    contact: false,
    location: false,
    note: false,
  });

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const xlmAmount = pricePerSlot / 10_000_000;
  const inFlight = phase === 'depositing' || phase === 'recording' || phase === 'validating';

  // Compute errors reactively so touched fields show inline messages without
  // requiring a submit attempt.
  const liveErrors = computeErrors({ name, contact, location, note });
  const visibleErrors: FieldErrors = {
    name: touched.name ? liveErrors.name : undefined,
    contact: touched.contact ? liveErrors.contact : undefined,
    location: touched.location ? liveErrors.location : undefined,
    note: touched.note ? liveErrors.note : undefined,
  };

  function markTouched(field: keyof TouchedFields) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) return;

    // Force all fields visible if user submitted without touching them first.
    setTouched({ name: true, contact: true, location: true, note: true });

    setPhase('validating');
    setErrorMessage(null);

    const errors = computeErrors({ name, contact, location, note });
    if (Object.keys(errors).length > 0) {
      // Block submission per Req 5.3-5.6. Inline messages render via visibleErrors.
      setPhase('idle');
      return;
    }

    setPhase('depositing');

    let txHash: string;
    try {
      const buyerScVal = new Address(publicKey).toScVal();
      const amountScVal = nativeToScVal(BigInt(pricePerSlot), { type: 'i128' });

      const result = await invokeContractWithStatus(
        'deposit',
        [buyerScVal, amountScVal],
        publicKey,
      );
      txHash = result.txHash;
    } catch (err) {
      // On-chain failure (Req 5.8): do NOT insert a participants row; keep
      // form state intact so the buyer can retry (Req 5.9).
      setErrorMessage(mapSorobanError(err, 'deposit'));
      setPhase('error');
      return;
    }

    setPhase('recording');

    const trimmedNote = note.trim();
    const { error: insertError } = await supabase.from('participants').insert({
      group_buy_id: groupBuyId,
      buyer_address: publicKey,
      amount: pricePerSlot,
      status: 'deposited',
      tx_hash_deposit: txHash,
      buyer_name: name.trim(),
      buyer_contact: contact.trim(),
      buyer_location: location.trim(),
      buyer_note: trimmedNote.length > 0 ? trimmedNote : null,
    });

    if (insertError) {
      // The on-chain deposit succeeded but we could not record the buyer
      // details. The funds are safe in escrow; surface the txHash so support
      // can reconcile.
      // eslint-disable-next-line no-console
      console.error('[PasabuySafe] participants insert failed after deposit', insertError);
      setErrorMessage(
        `Deposit confirmed but failed to record your details. Your tx hash: ${txHash}. Contact support.`,
      );
      setPhase('error');
      return;
    }

    setPhase('success');
    onSuccess();
  }

  // Wallet not connected — prompt to connect before attempting deposit.
  if (!isConnected) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">🔗</div>
        <p className="font-medium text-amber-900">Connect your wallet to join {groupBuyTitle}</p>
        <p className="text-sm text-amber-700 mt-1">
          Your {xlmAmount.toFixed(0)} XLM will be locked in the PasabuySafe escrow contract.
        </p>
        <button
          type="button"
          onClick={() => {
            void connect();
          }}
          disabled={isConnecting}
          className="mt-4 inline-flex items-center justify-center bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-200 disabled:text-slate-500 text-slate-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          {isConnecting ? 'Connecting…' : 'Connect Freighter'}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Join: {groupBuyTitle}</h3>
          <p className="text-sm text-slate-500 mt-1">
            Provide your delivery details. Your {xlmAmount.toFixed(0)} XLM will be locked in escrow.
          </p>
        </div>
        <div className="text-2xl" aria-hidden>
          🛡️
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="join-name" className="block text-sm font-medium text-slate-700">
            Name
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            id="join-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => markTouched('name')}
            disabled={inFlight}
            autoComplete="off"
            maxLength={200}
            aria-invalid={Boolean(visibleErrors.name)}
            aria-describedby={visibleErrors.name ? 'join-name-error' : undefined}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:bg-slate-50"
          />
          {visibleErrors.name && (
            <p id="join-name-error" className="text-xs text-red-600 mt-1">
              {visibleErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="join-contact" className="block text-sm font-medium text-slate-700">
            Phone number
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            id="join-contact"
            type="tel"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            onBlur={() => markTouched('contact')}
            disabled={inFlight}
            autoComplete="off"
            placeholder="+639XXXXXXXXX or 09XXXXXXXXX"
            maxLength={20}
            aria-invalid={Boolean(visibleErrors.contact)}
            aria-describedby={visibleErrors.contact ? 'join-contact-error' : undefined}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:bg-slate-50"
          />
          {visibleErrors.contact && (
            <p id="join-contact-error" className="text-xs text-red-600 mt-1">
              {visibleErrors.contact}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="join-location" className="block text-sm font-medium text-slate-700">
            Delivery location
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            id="join-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={() => markTouched('location')}
            disabled={inFlight}
            autoComplete="off"
            maxLength={300}
            aria-invalid={Boolean(visibleErrors.location)}
            aria-describedby={visibleErrors.location ? 'join-location-error' : undefined}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:bg-slate-50"
          />
          {visibleErrors.location && (
            <p id="join-location-error" className="text-xs text-red-600 mt-1">
              {visibleErrors.location}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="join-note" className="block text-sm font-medium text-slate-700">
            Order notes
            <span className="text-slate-400 font-normal ml-1">(optional)</span>
          </label>
          <textarea
            id="join-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => markTouched('note')}
            disabled={inFlight}
            rows={3}
            maxLength={600}
            aria-invalid={Boolean(visibleErrors.note)}
            aria-describedby={visibleErrors.note ? 'join-note-error' : undefined}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:bg-slate-50 resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            {visibleErrors.note ? (
              <p id="join-note-error" className="text-xs text-red-600">
                {visibleErrors.note}
              </p>
            ) : (
              <span />
            )}
            <p className="text-xs text-slate-400">{note.length} / 500</p>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'idle' || phase === 'validating' ? (
          <motion.button
            key="submit"
            type="submit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={inFlight}
            className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-200 disabled:text-slate-500 text-slate-900 py-3.5 rounded-xl font-medium transition-colors shadow-lg shadow-yellow-200"
          >
            💳 Pay {xlmAmount.toFixed(0)} XLM and join
          </motion.button>
        ) : null}

        {phase === 'depositing' && (
          <motion.div
            key="depositing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-4"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-3xl mb-2"
            >
              ✍️
            </motion.div>
            <p className="font-medium text-emerald-600">Sign with Freighter</p>
            <p className="text-xs text-slate-500 mt-1">
              Approve the deposit in your wallet, then we&apos;ll wait for confirmation.
            </p>
          </motion.div>
        )}

        {phase === 'recording' && (
          <motion.div
            key="recording"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-4"
          >
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
            <p className="text-sm text-slate-600">Recording your order details…</p>
          </motion.div>
        )}

        {phase === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="text-center py-4 bg-emerald-50 rounded-xl"
          >
            <div className="text-4xl mb-2">✅</div>
            <p className="font-bold text-emerald-800">You&apos;re in!</p>
            <p className="text-xs text-emerald-600 mt-1">Taking you to your order…</p>
          </motion.div>
        )}

        {phase === 'error' && errorMessage && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4"
          >
            <p className="text-sm text-red-700 font-medium">⚠️ {errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setPhase('idle');
              }}
              className="text-sm text-red-600 hover:text-red-700 font-medium mt-2 underline"
            >
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
        🔒 Protected by PasabuySafe smart contract
      </p>
    </form>
  );
}
