import { Contract, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { Server, Api, assembleTransaction } from '@stellar/stellar-sdk/rpc';
import { CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE } from '../utils/constants';

/**
 * Soroban RPC server instance for submitting and simulating transactions.
 */
export const server = new Server(RPC_URL);

/**
 * PasabuySafe contract instance for building invocation operations.
 */
export const contract = new Contract(CONTRACT_ID);

/**
 * Successful outcome of `invokeContractWithStatus`: the on-chain transaction
 * hash (canonically sourced from `sendTransaction.hash`) and the confirmed
 * `getTransaction` status response.
 */
export interface InvokeResult {
  /** Transaction hash from `sendTransaction.hash`. Never read from `status`. */
  txHash: string;
  /** Confirmed `getTransaction` response (always `status === SUCCESS`). */
  status: Api.GetTransactionResponse;
}

/**
 * Typed discriminated union for all failure modes of `invokeContractWithStatus`.
 *
 * Consumers route these into user-facing copy via `mapSorobanError`
 * (`src/lib/stellar/errors.ts`). The shape is structural so it can be safely
 * thrown across module boundaries.
 *
 * Variants:
 *   - simulation_failed   : Soroban RPC `simulateTransaction` returned an
 *                           error response that did not contain a recognizable
 *                           `Error(Contract, #N)` diagnostic.
 *   - signing_rejected    : Freighter user rejected (or threw on) the signing
 *                           prompt.
 *   - submit_failed       : `sendTransaction` returned `ERROR` (or the
 *                           re-submitted TRY_AGAIN_LATER attempt did).
 *   - network_unreachable : An RPC `fetch` call threw (DNS, connection,
 *                           5xx surfaced as throw, etc.).
 *   - timeout             : Polling loop exceeded `opts.timeoutMs` while
 *                           `getTransaction` still returned NOT_FOUND.
 *   - contract_error      : A Soroban contract error code (`Error(Contract,
 *                           #N)`) was recovered from simulation diagnostics
 *                           or a FAILED `getTransaction` result.
 *   - on_chain_failed     : `getTransaction` returned FAILED but no contract
 *                           code could be recovered.
 */
export type InvokeError =
  | { kind: 'simulation_failed'; message: string }
  | { kind: 'signing_rejected' }
  | { kind: 'submit_failed'; sendStatus: string; raw?: string }
  | { kind: 'network_unreachable'; cause: string }
  | { kind: 'timeout'; txHash: string }
  | { kind: 'contract_error'; code: number; raw: string }
  | { kind: 'on_chain_failed'; raw: string };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1_500;
const RETRY_BACKOFF_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeUnknown(e: unknown): string {
  if (e === undefined || e === null) return '';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message ?? String(e);
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function pickContractCode(haystack: string): number | null {
  const m = haystack.match(/Error\(Contract,\s*#(\d+)\)/);
  return m ? Number(m[1]) : null;
}

/**
 * Wrap any RPC call so a thrown `fetch` (network) error is translated into the
 * `network_unreachable` variant of `InvokeError`. This is the single funnel
 * for Requirement 7.7 — every RPC entrypoint must be guarded so callers can
 * render "Could not reach the Stellar network…".
 */
async function withNetworkGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    const err: InvokeError = {
      kind: 'network_unreachable',
      cause: describeUnknown(cause),
    };
    throw err;
  }
}

/**
 * Detect Freighter user-rejection from a thrown value or a `signTransaction`
 * `{ error }` payload. The Freighter SDK is inconsistent about which it does,
 * so we accept either.
 */
function isFreighterRejection(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  const message = describeUnknown(value);
  return /user\s*(declined|rejected|cancelled|denied)|cancelled\s*by\s*user|denied\s*by\s*user/i.test(
    message
  );
}

/**
 * Best-effort raw extraction from a FAILED transaction response so we can
 * scan for an `Error(Contract, #N)` substring. XDR types do not stringify to
 * a textual error form, but the SDK occasionally surfaces the contract code
 * via diagnostic event helpers (`toString`) or a parsed text field.
 */
function rawFromFailedStatus(status: Api.GetFailedTransactionResponse): string {
  const parts: string[] = [];
  try {
    // Some SDK versions expose a stringified diagnostic form. The standard
    // toString() falls back to "[object Object]" but a few wrappers (e.g.
    // ContractError) return the readable form.
    if (status.resultXdr) {
      const s = (status.resultXdr as { toString?: () => string }).toString?.();
      if (s) parts.push(s);
    }
  } catch {
    /* ignore */
  }
  try {
    const diag = status.diagnosticEventsXdr;
    if (Array.isArray(diag)) {
      for (const ev of diag) {
        try {
          const s = (ev as { toString?: () => string }).toString?.();
          if (s) parts.push(s);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
  // Final fallback — JSON-stringify with an XDR-aware replacer so we at least
  // capture any plain string fields the SDK adds.
  try {
    parts.push(
      JSON.stringify(status, (_key, value) => {
        if (
          value &&
          typeof value === 'object' &&
          typeof (value as { toXDR?: unknown }).toXDR === 'function'
        ) {
          return undefined;
        }
        return value;
      })
    );
  } catch {
    /* ignore */
  }
  return parts.filter(Boolean).join(' | ');
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Build, simulate, sign (via Freighter), submit, and confirm a Soroban
 * contract invocation. Returns the canonical transaction hash and the
 * confirmed `getTransaction` status; throws an `InvokeError` for every
 * failure mode the design enumerates.
 *
 * Behavior contract (design § "Fix design — invokeContractWithStatus"):
 *   1. Network-only errors (fetch throw) at any RPC entrypoint surface as
 *      `network_unreachable` (Req 7.7).
 *   2. Simulation errors surface as `contract_error` when an `Error(Contract,
 *      #N)` diagnostic is present, otherwise `simulation_failed`.
 *   3. Freighter rejection (thrown OR `{ error }` payload) surfaces as
 *      `signing_rejected` (Req 7.8).
 *   4. `sendTransaction` status handling:
 *        PENDING         → poll
 *        DUPLICATE       → poll (tx already in flight)
 *        TRY_AGAIN_LATER → sleep 2s, re-submit once, then poll
 *        ERROR           → throw `submit_failed`
 *   5. Polling loop is bounded by `opts.timeoutMs ?? 60_000` (Req 7.7).
 *      NOT_FOUND continues; SUCCESS returns; FAILED throws either
 *      `contract_error` or `on_chain_failed`; elapsed time throws `timeout`
 *      carrying the txHash.
 *   6. The returned `txHash` is sourced from `sendResult.hash` — never from
 *      `status.txHash` (which is not part of the design contract).
 */
export async function invokeContractWithStatus(
  method: string,
  args: xdr.ScVal[],
  publicKey: string,
  opts: { timeoutMs?: number } = {}
): Promise<InvokeResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // 1. Load account sequence number.
  const account = await withNetworkGuard(() => server.getAccount(publicKey));

  // 2. Build the transaction.
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // 3. Simulate to get the prepared transaction.
  const simulated = await withNetworkGuard(() =>
    server.simulateTransaction(tx)
  );

  if (Api.isSimulationError(simulated)) {
    const raw = simulated.error ?? '';
    const code = pickContractCode(raw);
    if (code !== null) {
      const contractErr: InvokeError = { kind: 'contract_error', code, raw };
      throw contractErr;
    }
    const simErr: InvokeError = { kind: 'simulation_failed', message: raw };
    throw simErr;
  }

  const prepared = assembleTransaction(tx, simulated).build();

  // 4. Sign with Freighter. The SDK can either throw on rejection or return a
  //    payload with `error` set; we treat both as `signing_rejected`.
  let signedXdr: string;
  try {
    const freighterApi = await import('@stellar/freighter-api');
    const signResult = await freighterApi.signTransaction(prepared.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    if (signResult.error) {
      const rejected: InvokeError = { kind: 'signing_rejected' };
      throw rejected;
    }
    signedXdr = signResult.signedTxXdr;
  } catch (e) {
    // If we already mapped this to a signing_rejected above, re-throw as-is.
    if (
      e &&
      typeof e === 'object' &&
      (e as { kind?: unknown }).kind === 'signing_rejected'
    ) {
      throw e;
    }
    if (isFreighterRejection(e)) {
      const rejected: InvokeError = { kind: 'signing_rejected' };
      throw rejected;
    }
    // Otherwise surface as a network problem — Freighter's request travels
    // through the extension messaging layer, which can fail for non-user
    // reasons (locked wallet, extension disabled, etc.).
    const netErr: InvokeError = {
      kind: 'network_unreachable',
      cause: describeUnknown(e),
    };
    throw netErr;
  }

  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  // 5. Submit. Handle every `sendTransaction` status.
  let sendResult = await withNetworkGuard(() =>
    server.sendTransaction(signedTx)
  );

  if (sendResult.status === 'TRY_AGAIN_LATER') {
    // Design: sleep 2s and re-submit ONCE, then poll the result.
    await sleep(RETRY_BACKOFF_MS);
    sendResult = await withNetworkGuard(() => server.sendTransaction(signedTx));
  }

  if (sendResult.status === 'ERROR') {
    const submitErr: InvokeError = {
      kind: 'submit_failed',
      sendStatus: sendResult.status,
      raw: describeUnknown(sendResult.errorResult),
    };
    throw submitErr;
  }

  // PENDING, DUPLICATE, or TRY_AGAIN_LATER-after-retry all enter the polling
  // loop. The hash is always present on a non-ERROR response.
  const txHash = sendResult.hash;
  const deadline = Date.now() + timeoutMs;

  // 6. Poll until SUCCESS, FAILED, or timeoutMs elapses.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() >= deadline) {
      const timeoutErr: InvokeError = { kind: 'timeout', txHash };
      throw timeoutErr;
    }

    await sleep(POLL_INTERVAL_MS);

    const status = await withNetworkGuard(() => server.getTransaction(txHash));

    if (status.status === Api.GetTransactionStatus.SUCCESS) {
      return { txHash, status };
    }

    if (status.status === Api.GetTransactionStatus.FAILED) {
      const raw = rawFromFailedStatus(status);
      const code = pickContractCode(raw);
      if (code !== null) {
        const contractErr: InvokeError = { kind: 'contract_error', code, raw };
        throw contractErr;
      }
      const failedErr: InvokeError = { kind: 'on_chain_failed', raw };
      throw failedErr;
    }

    // NOT_FOUND → continue polling.
  }
}
