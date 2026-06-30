// Shared validation regex and helpers for the JoinForm and other buyer-detail
// inputs. The PH phone regex is the single source of truth referenced by the
// database CHECK constraint, the JoinForm validator, and the docs.
//
// Design: PH Phone Validation
// Requirements: 5.3, 5.4, 5.5, 5.6

/**
 * Philippine mobile/landline number pattern.
 * Mirrors the CHECK constraint applied to `participants.buyer_contact`.
 */
export const PH_PHONE_RE = /^(\+63|0)[0-9 \-]{7,14}$/;

/** Error copy shown when `buyer_contact` fails {@link PH_PHONE_RE}. */
export const PH_PHONE_MESSAGE = 'Enter a valid Philippine phone number.';

/** Error copy shown when `buyer_name` is empty, whitespace-only, or > 100 chars. */
export const BUYER_NAME_MESSAGE = 'Enter a name between 1 and 100 characters.';

/** Error copy shown when `buyer_location` is empty, whitespace-only, or > 250 chars. */
export const BUYER_LOCATION_MESSAGE = 'Enter a delivery location between 1 and 250 characters.';

/** Error copy shown when `buyer_note` exceeds 500 characters. */
export const BUYER_NOTE_MESSAGE = 'Notes must be 500 characters or fewer.';

/**
 * Returns `true` iff `s` matches the Philippine phone number pattern.
 * The caller is responsible for trimming if leading/trailing whitespace
 * should be tolerated; the regex itself requires the leading `+63` or `0`.
 */
export function validatePhonePH(s: string): boolean {
  return PH_PHONE_RE.test(s);
}

/**
 * Returns `true` iff `s`, after trimming, has length between 1 and 100
 * characters inclusive.
 */
export function validateBuyerName(s: string): boolean {
  const t = s.trim();
  return t.length >= 1 && t.length <= 100;
}

/**
 * Returns `true` iff `s`, after trimming, has length between 1 and 250
 * characters inclusive.
 */
export function validateBuyerLocation(s: string): boolean {
  const t = s.trim();
  return t.length >= 1 && t.length <= 250;
}

/**
 * Returns `true` iff `s` is 500 characters or fewer (notes are optional, so
 * an empty string is allowed).
 */
export function validateBuyerNote(s: string): boolean {
  return s.length <= 500;
}
