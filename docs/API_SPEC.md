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
Contract: CCM2F2EHUAYPDW4FB2OUZOVD3ZOHPBFT5CTZ73GFA6OZCWDED6SFVRMW
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

const CONTRACT_ID = 'CCM2F2EHUAYPDW4FB2OUZOVD3ZOHPBFT5CTZ73GFA6OZCWDED6SFVRMW';
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
      "contractIds": ["CCM2F2EHUAYPDW4FB2OUZOVD3ZOHPBFT5CTZ73GFA6OZCWDED6SFVRMW"]
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
