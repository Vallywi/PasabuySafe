# PasabuySafe — API Specification

---

## 1. Overview

PasabuySafe has two "APIs":
1. **Smart Contract API** — On-chain function calls via Soroban RPC (the source of truth)
2. **Supabase API** — Off-chain REST/Realtime for metadata, search, and notifications

Most interactions go directly to the smart contract. Supabase is used for enrichment.

---

## 2. Smart Contract API (Soroban)

### Endpoint
```
RPC: https://soroban-testnet.stellar.org:443
Contract: CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB
```

### Functions

#### `initialize`
```
Params:  organizer (Address), token (Address), deadline (u64)
Returns: Result<(), Error>
Auth:    organizer.require_auth()
Events:  None
```

#### `deposit`
```
Params:  buyer (Address), amount (i128)
Returns: Result<(), Error>
Auth:    buyer.require_auth()
Events:  ("deposit", buyer) → amount
Errors:  InvalidAmount, AlreadyDeposited
```

#### `mark_delivered`
```
Params:  buyer (Address)
Returns: Result<(), Error>
Auth:    organizer.require_auth()
Events:  ("deliver", buyer) → ()
Errors:  NotDeposited, InvalidStatus
```

#### `confirm_delivery`
```
Params:  buyer (Address)
Returns: Result<(), Error>
Auth:    buyer.require_auth()
Events:  ("release", buyer) → amount
Errors:  NotDelivered
```

#### `refund`
```
Params:  buyer (Address)
Returns: Result<(), Error>
Auth:    buyer.require_auth()
Events:  ("refund", buyer) → amount
Errors:  NotExpired, NotDeposited
```

### Invoking from Frontend (TypeScript)

```typescript
import { Contract, TransactionBuilder, Networks, xdr } from '@stellar/stellar-sdk';
import freighterApi from '@stellar/freighter-api';

const CONTRACT_ID = 'CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB';
const RPC_URL = 'https://soroban-testnet.stellar.org:443';
const NETWORK = Networks.TESTNET;

// Generic contract invoke helper
async function invokeContract(
  method: string, 
  args: xdr.ScVal[], 
  publicKey: string
) {
  const server = new SorobanRpc.Server(RPC_URL);
  const account = await server.getAccount(publicKey);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: NETWORK })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Simulate
  const simulated = await server.simulateTransaction(tx);
  const prepared = SorobanRpc.assembleTransaction(tx, simulated);

  // Sign with Freighter
  const signedXDR = await freighterApi.signTransaction(
    prepared.toXDR(), 
    { networkPassphrase: NETWORK }
  );

  // Submit
  const result = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXDR, NETWORK)
  );

  // Poll for confirmation
  let status = await server.getTransaction(result.hash);
  while (status.status === 'NOT_FOUND') {
    await new Promise(r => setTimeout(r, 1000));
    status = await server.getTransaction(result.hash);
  }

  return status;
}
```

---

## 3. Supabase REST API

Base URL: `https://<project>.supabase.co/rest/v1`

All requests require:
```
Headers:
  apikey: <SUPABASE_ANON_KEY>
  Authorization: Bearer <USER_JWT>  (for authenticated routes)
```

### 3.1 Group Buys

#### List Active Group Buys
```
GET /group_buys?status=eq.active&order=created_at.desc&limit=20

Response: [
  {
    "id": "uuid",
    "contract_id": "C...",
    "title": "Korean Skincare Bundle",
    "category": "skincare",
    "price_per_slot": 8500000000,
    "max_slots": 12,
    "deadline": "2026-07-15T00:00:00Z",
    "status": "active",
    "organizer_address": "G..."
  }
]
```

#### Get Group Buy Detail
```
GET /group_buys?id=eq.<uuid>&select=*,participants(*)

Response: { ... group buy with nested participants array }
```

#### Create Group Buy (after contract initialize)
```
POST /group_buys
Body: {
  "contract_id": "C...",
  "organizer_address": "G...",
  "title": "Korean Skincare Bundle",
  "description": "...",
  "category": "skincare",
  "price_per_slot": 8500000000,
  "max_slots": 12,
  "token_address": "C...",
  "deadline": "2026-07-15T00:00:00Z"
}
```

#### Search Group Buys (Full-Text)
```
GET /group_buys?or=(title.ilike.*skincare*,description.ilike.*skincare*)&status=eq.active
```

### 3.2 Participants

#### Join Group Buy (after deposit TX)
```
POST /participants
Body: {
  "group_buy_id": "uuid",
  "buyer_address": "G...",
  "amount": 8500000000,
  "tx_hash_deposit": "abc123..."
}
```

#### Get My Orders
```
GET /participants?buyer_address=eq.<my_address>&select=*,group_buys(title,image_url,status)
```

### 3.3 Messages

#### Send Message
```
POST /messages
Body: {
  "group_buy_id": "uuid",
  "sender_address": "G...",
  "content": "Hey, when will you ship?"
}
```

#### Get Messages
```
GET /messages?group_buy_id=eq.<uuid>&order=created_at.asc&limit=50
```

### 3.4 Profiles

#### Get/Update Profile
```
GET /profiles?stellar_address=eq.<address>
PATCH /profiles?stellar_address=eq.<address>
Body: { "display_name": "Maria", "bio": "Pasabuy enthusiast" }
```

### 3.5 Follows

#### Follow Organizer
```
POST /follows
Body: { "follower_address": "G...", "organizer_address": "G..." }
```

#### Get Followed Organizers
```
GET /follows?follower_address=eq.<my_address>&select=organizer_address,profiles!follows_organizer_address_fkey(display_name,avatar_url)
```

---

## 4. Supabase Edge Functions API

### 4.1 `POST /functions/v1/auth-wallet`

Wallet-based authentication.

```
Request:
{
  "publicKey": "G...",
  "signature": "base64...",
  "nonce": "random-challenge-string"
}

Response (200):
{
  "token": "eyJhbG...",
  "user": { "stellar_address": "G...", "display_name": "..." }
}

Response (401):
{ "error": "Invalid signature" }
```

### 4.2 `POST /functions/v1/auth-nonce`

Get a challenge nonce for signing.

```
Request:
{ "publicKey": "G..." }

Response (200):
{ "nonce": "pasabuy-auth-1719648000-randomhex" }
```

---

## 5. Supabase Realtime Subscriptions

### Subscribe to Participant Updates
```typescript
supabase
  .channel('group-buy-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'participants',
    filter: `group_buy_id=eq.${groupBuyId}`
  }, (payload) => {
    // payload.new = updated participant row
  })
  .subscribe();
```

### Subscribe to New Messages
```typescript
supabase
  .channel('chat')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `group_buy_id=eq.${groupBuyId}`
  }, (payload) => {
    // payload.new = new message
  })
  .subscribe();
```

---

## 6. Event Indexing API (Internal)

The `sync-events` edge function is triggered via Supabase cron (pg_cron) every 30 seconds. It calls:

```
POST https://soroban-testnet.stellar.org:443
Body: {
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getEvents",
  "params": {
    "startLedger": <last_synced_ledger>,
    "filters": [{
      "type": "contract",
      "contractIds": ["CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB"]
    }],
    "pagination": { "limit": 100 }
  }
}
```

Results are decoded and upserted into `contract_events` and `participants` tables.

---

## 7. Error Codes

### Smart Contract Errors

| Code | Name | Meaning |
|------|------|---------|
| 1 | AlreadyInitialized | Contract already set up |
| 2 | NotInitialized | Contract not yet initialized |
| 3 | AlreadyDeposited | Buyer already deposited |
| 4 | NotDeposited | Buyer has no deposit |
| 5 | NotDelivered | Order not marked delivered |
| 6 | NotExpired | Deadline hasn't passed |
| 7 | InvalidStatus | Wrong status for this operation |
| 8 | InvalidAmount | Amount must be > 0 |

### Supabase HTTP Errors

| Status | Meaning |
|--------|---------|
| 401 | Not authenticated (need wallet auth) |
| 403 | RLS policy denied access |
| 409 | Conflict (duplicate entry) |
| 422 | Validation error |

---

## 8. Management Enhancements (Migration 005)

Migration `supabase/migrations/005_pasabuy_management_enhancements.sql` is purely additive. It introduces per-order delivery fields, cancellation timestamps, the `refund_required` claim flag, two views, one RPC, and a strict RLS policy set. This section documents every surface the migration adds.

> **Scope of REST changes.** Migration 005 does **not** add new HTTP endpoints. All new surfaces are reachable via the existing Supabase REST and RPC URLs (`/rest/v1/<table_or_view>`, `/rest/v1/rpc/<name>`) once a client has authenticated. The new behavior is enforced through schema, RLS, views, and one SECURITY DEFINER function rather than new edge functions.

### 8.1 New Columns

#### `participants`

| Column | Type | Nullable | Constraint | Purpose |
|---|---|---|---|---|
| `buyer_name` | `TEXT` | Yes | `char_length BETWEEN 1 AND 100` when not null | Name supplied per order (Req 5.1, 5.3). Not pre-filled from profile (Req 5.2). |
| `buyer_contact` | `TEXT` | Yes | Regex `^(\+63\|0)[0-9 \-]{7,14}$` when not null | Philippine phone number per order (Req 5.4). Only readable by the buyer themself or the parent pasabuy's organizer (Req 3.3). |
| `buyer_location` | `TEXT` | Yes | `char_length BETWEEN 1 AND 250` when not null | Delivery location per order (Req 5.5). |
| `buyer_note` | `TEXT` | Yes | `char_length <= 500` when not null | Optional fulfillment notes (Req 5.6). |
| `refund_required` | `BOOLEAN NOT NULL DEFAULT FALSE` | No | — | True when the buyer is entitled to a refund but the on-chain `refund` call is not yet eligible (e.g., organizer cancelled pre-deadline, or buyer cancelled pre-deadline). Drives the `ClaimRefundButton` after the deadline (Req 1.5, 6.4, 6.5). |
| `cancelled_at` | `TIMESTAMPTZ` | Yes | — | Set when the buyer cancels their own order via `CancelOrderDialog` (Req 6.4). |

Indexes:

- `idx_participants_refund_required` — partial index on `(group_buy_id) WHERE refund_required = TRUE` for fast enumeration during organizer cancellation and post-deadline claim flows.

#### `group_buys`

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `cancelled_at` | `TIMESTAMPTZ` | Yes | Set when the organizer cancels the pasabuy via `cancel_group_buy` (Req 1.8). |
| `cancelled_by` | `TEXT` | Yes | The organizer's `stellar_address` at the moment of cancellation (Req 1.8). |

Indexes:

- `idx_group_buys_cancelled` — partial index on `(status) WHERE status = 'cancelled'` so the Explore page can cheaply exclude cancelled rows (Req 1.7).

### 8.2 New Enum Values

The `status` columns are TEXT with CHECK constraints rather than Postgres `ENUM` types, so adding new values is a CHECK rewrite, not an `ALTER TYPE`.

| Column | Allowed values after migration 005 |
|---|---|
| `participants.status` | `deposited`, `delivered`, `confirmed`, `refunded`, **`cancelled`** |
| `group_buys.status` | `active`, `in_progress`, `completed`, `expired`, **`cancelled`** |

Semantics of the new `cancelled` values:

- `participants.status = 'cancelled'` — the buyer cancelled their own order. If `refund_required = TRUE`, they are entitled to a refund but the on-chain `refund` call may not yet be eligible. After the deadline, the `ClaimRefundButton` invokes the on-chain `refund` and transitions `status` to `refunded` (Req 6.4, 6.5, 6.6).
- `group_buys.status = 'cancelled'` — the organizer cancelled the pasabuy. `cancelled_at` and `cancelled_by` are populated. The pasabuy is hidden from the default Explore listing (Req 1.7) and surfaces a "Cancelled" badge in place of the Join CTA.

### 8.3 New Views

#### `participants_public`

A column-projected, read-only view exposing only **non-contact** participant columns:

```sql
SELECT id, group_buy_id, buyer_address, amount, status,
       deposited_at, delivered_at, confirmed_at, refunded_at, cancelled_at,
       tx_hash_deposit
FROM participants;
```

`GRANT SELECT ON participants_public TO anon, authenticated`.

Use this view for any read that does not need contact information — for example, the Explore slot-count query and the Pasabuy_Detail_Page joined-slots count (Req 4.2). The contact columns (`buyer_name`, `buyer_contact`, `buyer_location`, `buyer_note`) are **not in the view definition**, so they cannot be selected through `participants_public` regardless of the caller's identity.

Example:

```
GET /rest/v1/participants_public
    ?group_buy_id=eq.<uuid>
    &status=in.(deposited,delivered,confirmed)
    &select=id,buyer_address,status
```

#### `group_buy_history`

A uniform-shape `UNION ALL` aggregating on-chain and off-chain state changes for the organizer Transaction History section (Req 2.3, 2.4):

| Column | Type | Notes |
|---|---|---|
| `group_buy_id` | `UUID` | Filter target for the client. |
| `event_type` | `TEXT` | On-chain: `deposit`, `deliver`, `release`, `refund` (mirrored from `contract_events.event_type`). Off-chain: `participant_joined`, `order_cancelled`, `pasabuy_cancelled`. |
| `actor_address` | `TEXT` | The buyer (`participants.buyer_address`) for on-chain rows and joined/cancelled rows; the organizer (`group_buys.cancelled_by`) for `pasabuy_cancelled`. |
| `amount_stroops` | `BIGINT` | Stroop amount for monetary events; `NULL` for `participant_joined` (event-only), `order_cancelled`, `pasabuy_cancelled`. |
| `tx_hash` | `TEXT` | Soroban tx hash for on-chain rows; `NULL` for off-chain rows. |
| `ts` | `TIMESTAMPTZ` | `to_timestamp(ledger_timestamp)` for on-chain; `participants.deposited_at` / `cancelled_at` / `group_buys.cancelled_at` for off-chain. |
| `event_kind` | `INT` | `1` for on-chain rows, `0` for off-chain rows. Available as a hint; the deterministic tie-break in Req 2.6 lives in `src/lib/utils/history.ts` (`compareHistoryEntries`). |

`GRANT SELECT ON group_buy_history TO authenticated`. RLS on the underlying tables means only the organizer and the relevant buyers see rows for a given pasabuy.

Example:

```
GET /rest/v1/group_buy_history
    ?group_buy_id=eq.<uuid>
    &select=event_type,actor_address,amount_stroops,tx_hash,ts
```

The client sorts results by `ts DESC` and breaks ties via `compareHistoryEntries` in the order: `deposit`, `participant_joined`, `mark_delivered` (`deliver`), `confirm_delivery` (`release`), `refund`, `order_cancelled`, `pasabuy_cancelled` (Req 2.6).

### 8.4 New RPC: `cancel_group_buy`

```
POST /rest/v1/rpc/cancel_group_buy
Body: { "p_group_buy_id": "<uuid>" }

Returns: void (HTTP 204 on success)
```

Signature:

```sql
cancel_group_buy(p_group_buy_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
```

Semantics (single transaction):

1. Resolves the caller's linked `stellar_address` from `profiles WHERE id = auth.uid()`.
2. Looks up the pasabuy by id; raises `P0002` ("Pasabuy not found") if it does not exist.
3. Raises `42501` ("Not authorized: only the organizer can cancel this pasabuy") if the caller is not the organizer.
4. Raises `P0001` ("Cannot cancel: pasabuy has orders marked delivered") if any `participants.status = 'delivered'` row exists for the pasabuy (Req 1.6 defense in depth).
5. Otherwise, atomically:
   - `UPDATE group_buys SET status='cancelled', cancelled_at=now(), cancelled_by=<organizer>, updated_at=now() WHERE id = p_group_buy_id`
   - `UPDATE participants SET refund_required = TRUE WHERE group_buy_id = p_group_buy_id AND status = 'deposited'`

`GRANT EXECUTE ON FUNCTION cancel_group_buy(uuid) TO authenticated`.

Error codes returned by the RPC and their HTTP/PostgREST mapping:

| `SQLSTATE` | Cause | Suggested user-facing copy |
|---|---|---|
| `42501` | Caller has no linked Stellar address, or is not the organizer. | "You are not authorized to cancel this pasabuy." |
| `P0002` | Pasabuy id does not exist. | "Pasabuy not found." |
| `P0001` | At least one participant has `status = 'delivered'`. | "This pasabuy has orders marked delivered. Wait for buyers to confirm or refund before cancelling." (Req 1.6) |

### 8.5 Updated Row Level Security Policies

Migration 005 drops the permissive MVP policies and replaces them with strict policies that key on the caller's linked `stellar_address` via the `profiles` table.

**Dropped (permissive):**

- `Public read participants`
- `Anyone joins as participant`
- `Anyone updates participant`

**Created (strict):**

| Policy | Command | Predicate |
|---|---|---|
| `Owner or organizer reads participant` | `SELECT` | `buyer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())` **OR** `group_buy_id IN (SELECT id FROM group_buys WHERE organizer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid()))` |
| `Buyer inserts own participant` | `INSERT` | `WITH CHECK (buyer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid()))` |
| `Buyer or organizer updates participant` | `UPDATE` | `USING (buyer_address = <caller> OR group_buy_id IN (<pasabuys organized by caller>))` |

Practical effects:

- Reading `buyer_name`, `buyer_contact`, `buyer_location`, `buyer_note` directly from `participants` is restricted to the buyer themself and the parent pasabuy's organizer (Req 3.3). Anyone else must read via `participants_public`, which omits those columns by definition.
- Buyers can only insert their own `participants` row (Req 5.7).
- Buyers can update their own row (e.g., self-cancel — Req 6.4); the organizer can update any row in their pasabuys (e.g., mark delivered — Req 7.2). Attempts by anyone else are rejected by RLS, which the UI surfaces as "You can only cancel your own order." (Req 6.9).

### 8.6 `Refund_Required` Semantics

`participants.refund_required BOOLEAN NOT NULL DEFAULT FALSE` is the off-chain claim flag bridging the gap between "the buyer is entitled to a refund" and "the on-chain `refund` call is eligible" (the deadline has passed).

State transitions:

| From → To | Trigger | DB write |
|---|---|---|
| `FALSE` → `TRUE` | Organizer cancels a pasabuy with deposited participants (`cancel_group_buy` RPC, both pre- and post-deadline branches — Req 1.4, 1.5). | RPC updates every `status='deposited'` row to `refund_required = TRUE`. |
| `FALSE` → `TRUE` | Buyer cancels their own order pre-deadline (`CancelOrderDialog`, pre-deadline branch — Req 6.4). | Client updates the buyer's own row to `status='cancelled'`, `cancelled_at=now()`, `refund_required=TRUE`. No on-chain call. |
| `TRUE` → `FALSE` | Confirmed on-chain `refund` succeeds (`ClaimRefundButton` or post-deadline `CancelOrderDialog` — Req 6.5, 6.6). | Client updates the buyer's row to `status='refunded'`, `refunded_at=now()`, `refund_required=FALSE`, `tx_hash_confirm=<hash>`. The same write also inserts a `contract_events` row of type `refund` (upsert on `tx_hash`). |

Read side:

- Buyer order list surfaces a banner whenever `status='cancelled' AND refund_required=TRUE`, telling the buyer to return after the deadline to claim the refund (Req 6.4, 1.9).
- `ClaimRefundButton` renders iff `status='cancelled' AND refund_required=TRUE AND now() >= group_buys.deadline` (Req 6.5).

---

## 9. Soroban Error-Code → User-Facing Message Mapping

All on-chain calls in the web app funnel through `invokeContractWithStatus` and surface user copy through `mapSorobanError` (`pasabuy-safe-web/src/lib/stellar/errors.ts`). The mapping below is the single source of truth for end-user copy on contract-asserted errors. Where the same code maps to different copy in different flows, the call site passes an `ErrorContext` (`'deposit' | 'mark_delivered' | 'confirm' | 'refund'`) to disambiguate.

| Code | Name | Context | User-facing message | Requirement |
|---|---|---|---|---|
| #3 | `AlreadyDeposited` | any | `You already deposited into this pasabuy` | 5.8 |
| #4 | `NotDeposited` | `refund` | `No deposit found for this order. It may have already been refunded.` | 6.8 |
| #4 | `NotDeposited` | other (e.g., `mark_delivered`) | `This buyer has not deposited yet.` | 7.4 |
| #5 | `NotDelivered` | any | `You can only confirm after the organizer marks delivery.` | (see SMART_CONTRACT_SPEC §7) |
| #6 | `NotExpired` | any | `Refund is not yet available. Try again after the deadline.` | 6.7 |
| #7 | `InvalidStatus` | any | `This order is already marked delivered or has been refunded.` | 7.5 |
| #8 | `InvalidAmount` | any | `Amount must be greater than zero.` | 5.8 |

Non-contract error variants emitted by `invokeContractWithStatus` (the `InvokeError` discriminated union) map as follows:

| `InvokeError.kind` | User-facing message | Requirement |
|---|---|---|
| `signing_rejected` (Freighter user-rejection) | `Transaction cancelled` | 7.8 |
| `network_unreachable` | `Could not reach the Stellar network. Check your connection and try again.` | 7.7 |
| `timeout` | `Could not reach the Stellar network. Check your connection and try again.` | 7.7 |
| `contract_error` with code **not** in the table above | `Mark as delivered failed. Error code: {code}. Try again or contact support.` (full error also logged via `console.error('[PasabuySafe] Unmapped contract error', err)`) | 7.6 |
| `simulation_failed`, `submit_failed`, `on_chain_failed` (no recoverable contract code, no network signature) | `Something went wrong. Please try again.` | (fallthrough) |
