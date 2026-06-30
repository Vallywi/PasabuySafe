/**
 * mapSorobanError — translates any error produced by an on-chain interaction
 * (Soroban RPC, Freighter signing, the Escrow_Contract itself, or a generic
 * network failure) into a single user-facing message.
 *
 * Design references:
 *   .kiro/specs/pasabuy-management-enhancements/design.md
 *     - "mapSorobanError" component description
 *     - "Soroban contract errors" table (Error Handling)
 *
 * Requirements covered: 5.8, 6.7, 6.8, 7.4, 7.5, 7.6, 7.7, 7.8
 *
 * The function accepts both the typed `InvokeError` discriminated union
 * produced by `invokeContractWithStatus` (preferred, task 2.1) and any raw
 * `Error` / unknown value (best-effort fallback). Because task 2.1 may not be
 * landed yet when this module is consumed, we structurally detect the
 * `InvokeError` shape rather than importing the type directly. Once `./client`
 * exports `InvokeError`, callers can pass typed values without any change
 * here.
 */

/**
 * Optional context tag used to disambiguate user copy for the same Soroban
 * error code across flows. For example, contract error #4 (NotDeposited)
 * renders different copy in the refund flow vs. the mark-delivered flow
 * (Req 6.8 vs. 7.4).
 */
export type ErrorContext = 'refund' | 'mark_delivered' | 'deposit' | 'confirm';

/**
 * Structural shape of `InvokeError` from `./client`. Kept local so this
 * module compiles even if the strict client has not yet been written.
 */
type InvokeErrorLike = {
  kind:
    | 'simulation_failed'
    | 'signing_rejected'
    | 'submit_failed'
    | 'network_unreachable'
    | 'timeout'
    | 'contract_error'
    | 'on_chain_failed';
  code?: number;
  message?: string;
  raw?: string;
  cause?: string;
  sendStatus?: string;
  txHash?: string;
};

function isInvokeErrorLike(err: unknown): err is InvokeErrorLike {
  if (typeof err !== 'object' || err === null) return false;
  const k = (err as { kind?: unknown }).kind;
  return (
    k === 'simulation_failed' ||
    k === 'signing_rejected' ||
    k === 'submit_failed' ||
    k === 'network_unreachable' ||
    k === 'timeout' ||
    k === 'contract_error' ||
    k === 'on_chain_failed'
  );
}

/** Extract `#N` from any `Error(Contract, #N)` substring. */
function pickContractCode(haystack: string): number | null {
  const m = haystack.match(/Error\(Contract,\s*#(\d+)\)/);
  return m ? Number(m[1]) : null;
}

function looksLikeFreighterCancel(m: string): boolean {
  return /user declined|cancelled by user|user rejected|user cancelled|user denied/i.test(
    m
  );
}

function looksLikeNetworkFailure(m: string): boolean {
  return /fetch|network|ECONNREFUSED|ENOTFOUND|TimeoutError|timeout|getaddrinfo|ETIMEDOUT|ECONNRESET|5\d{2}\b/i.test(
    m
  );
}

/**
 * Per-code message lookup. Returns `null` for codes this spec does not enumerate
 * so the caller can fall through to the unmapped-code path.
 */
function messageForContractCode(
  code: number,
  context?: ErrorContext
): string | null {
  switch (code) {
    case 3: // AlreadyDeposited
      return 'You already deposited into this pasabuy';
    case 4: // NotDeposited
      return context === 'refund'
        ? 'No deposit found for this order. It may have already been refunded.'
        : 'This buyer has not deposited yet.';
    case 5: // NotDelivered
      return 'You can only confirm after the organizer marks delivery.';
    case 6: // NotExpired
      return 'Refund is not yet available. Try again after the deadline.';
    case 7: // InvalidStatus
      return 'This order is already marked delivered or has been refunded.';
    case 8: // InvalidAmount
      return 'Amount must be greater than zero.';
    default:
      return null;
  }
}

function unmappedContractMessage(code: number, err: unknown): string {
  // Side-effect: log the full error for support, as the Error Handling table
  // specifies for any unenumerated contract code.
  // eslint-disable-next-line no-console
  console.error('[PasabuySafe] Unmapped contract error', err);
  return `Mark as delivered failed. Error code: ${code}. Try again or contact support.`;
}

/**
 * Translate any error from an on-chain interaction into a user-facing message.
 *
 * @param err     The thrown / rejected value. Preferred shape is `InvokeError`
 *                from `./client`; raw `Error` instances are also handled.
 * @param context Optional flow tag for context-sensitive copy (e.g. refund
 *                vs. mark_delivered for code #4).
 */
export function mapSorobanError(
  err: unknown,
  context?: ErrorContext
): string {
  // ---------------------------------------------------------------------------
  // Preferred path: typed InvokeError from invokeContractWithStatus.
  // ---------------------------------------------------------------------------
  if (isInvokeErrorLike(err)) {
    switch (err.kind) {
      case 'signing_rejected':
        return 'Transaction cancelled';

      case 'network_unreachable':
      case 'timeout':
        return 'Could not reach the Stellar network. Check your connection and try again.';

      case 'contract_error': {
        const code = typeof err.code === 'number' ? err.code : NaN;
        const mapped = Number.isFinite(code)
          ? messageForContractCode(code, context)
          : null;
        if (mapped) return mapped;
        return unmappedContractMessage(code, err);
      }

      case 'simulation_failed':
      case 'submit_failed':
      case 'on_chain_failed': {
        // These variants may still carry a Soroban `Error(Contract, #N)` in
        // their raw message (e.g. a simulation that surfaced a contract
        // assertion). Try to recover a contract code first.
        const raw = err.raw ?? err.message ?? '';
        const code = pickContractCode(raw);
        if (code !== null) {
          const mapped = messageForContractCode(code, context);
          if (mapped) return mapped;
          return unmappedContractMessage(code, err);
        }
        if (looksLikeNetworkFailure(raw)) {
          return 'Could not reach the Stellar network. Check your connection and try again.';
        }
        // For on_chain_failed with no contract code, it's almost always an
        // authorization mismatch (require_auth failed).
        if (err.kind === 'on_chain_failed') {
          return 'Transaction rejected by the contract. Make sure you are the organizer who initialized this contract instance.';
        }
        // If the simulation provided a specific message, surface it
        if (err.message && err.message.length > 0 && err.message.length < 200) {
          return err.message;
        }
        // eslint-disable-next-line no-console
        console.error('[PasabuySafe] Unhandled error in', err.kind, ':', raw);
        return 'Something went wrong. Please try again.';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Best-effort path: raw Error or unknown shape (pre-task-2.1 callers).
  // ---------------------------------------------------------------------------
  if (err instanceof Error) {
    const m = err.message ?? '';

    if (looksLikeFreighterCancel(m)) {
      return 'Transaction cancelled';
    }

    const code = pickContractCode(m);
    if (code !== null) {
      const mapped = messageForContractCode(code, context);
      if (mapped) return mapped;
      return unmappedContractMessage(code, err);
    }

    if (looksLikeNetworkFailure(m)) {
      return 'Could not reach the Stellar network. Check your connection and try again.';
    }
  }

  return 'Something went wrong. Please try again.';
}
