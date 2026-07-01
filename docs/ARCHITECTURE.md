# PasabuySafe — Architecture Document

---

## 1. System Overview

PasabuySafe is a hybrid dApp with two layers:
- **On-chain (Stellar Soroban)**: Smart contract handling funds, state, authorization
- **Off-chain (Next.js + Supabase)**: Frontend UI, metadata storage, event indexing, notifications

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER (Browser/Mobile)                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND — Next.js 14 (Vercel)                                 │
│  • App Router (SSR/SSG)                                         │
│  • TypeScript                                                   │
│  • Tailwind CSS + shadcn/ui                                     │
│  • Framer Motion + GSAP + Rive + Lottie                         │
│  • Zustand (state management)                                   │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
           ▼                                  ▼
┌────────────────────┐             ┌─────────────────────────┐
│  STELLAR NETWORK   │             │  SUPABASE (Off-chain)   │
│                    │             │                         │
│  • Soroban RPC     │             │  • PostgreSQL DB        │
│  • Smart Contract  │             │  • Edge Functions       │
│  • Horizon API     │             │  • Realtime             │
│  • Freighter Wallet│             │  • Storage (images)     │
│  • SAC Tokens      │             │  • Auth (wallet-based)  │
└────────────────────┘             └─────────────────────────┘
```

---

## 2. Smart Contract Architecture

### Contract: PasabuySafe (Soroban)

**Contract ID (Testnet):** `CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB`

### State Machine

```
[Initialized] → Deposited → Delivered → Confirmed → [Funds Released]
                    ↓
               [Refunded] (after deadline expires)
```

### Storage Layout

| Key | Type | Persistence | Description |
|-----|------|-------------|-------------|
| `DataKey::Initialized` | bool | Persistent | Guards re-initialization |
| `DataKey::Organizer` | Address | Persistent | Group buy coordinator |
| `DataKey::Token` | Address | Persistent | SAC token contract |
| `DataKey::Deadline` | u64 | Persistent | Refund eligibility timestamp |
| `DataKey::Status(buyer)` | OrderStatus | Persistent | Per-buyer state |
| `DataKey::Deposit(buyer)` | i128 | Persistent | Per-buyer amount |

### Contract Interface

```rust
pub fn initialize(env: Env, organizer: Address, token: Address, deadline: u64) -> Result<(), Error>;
pub fn deposit(env: Env, buyer: Address, amount: i128) -> Result<(), Error>;
pub fn mark_delivered(env: Env, buyer: Address) -> Result<(), Error>;
pub fn confirm_delivery(env: Env, buyer: Address) -> Result<(), Error>;
pub fn refund(env: Env, buyer: Address) -> Result<(), Error>;
```

### Event Schema

| Event Topic | Data | Trigger |
|-------------|------|---------|
| `("deposit", buyer)` | amount (i128) | Buyer deposits |
| `("deliver", buyer)` | () | Organizer marks delivered |
| `("release", buyer)` | amount (i128) | Buyer confirms delivery |
| `("refund", buyer)` | amount (i128) | Buyer claims refund |

---

## 3. Frontend Architecture

### Project Structure

```
pasabuy-safe-web/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout (providers, theme)
│   ├── dashboard/
│   │   ├── page.tsx                # User dashboard
│   │   ├── organizer/
│   │   │   ├── create/page.tsx     # Create group buy
│   │   │   └── [id]/page.tsx       # Manage group buy
│   │   └── buyer/
│   │       └── [id]/page.tsx       # Buyer order view
│   ├── explore/page.tsx            # Browse group buys
│   └── tx/[hash]/page.tsx          # Transaction detail
├── components/
│   ├── wallet/                     # WalletButton, WalletProvider
│   ├── escrow/                     # DepositForm, ConfirmButton, RefundButton
│   ├── animations/                 # EscrowVault, CoinDrop, Confetti
│   ├── ui/                         # shadcn/ui base components
│   └── layout/                     # Header, Footer, BottomNav
├── lib/
│   ├── stellar/
│   │   ├── client.ts              # Contract client wrapper
│   │   ├── transaction.ts         # TX builder helpers
│   │   └── events.ts             # Event decoder
│   ├── supabase/
│   │   ├── client.ts             # Supabase client init
│   │   ├── auth.ts               # Wallet-based auth
│   │   └── realtime.ts           # Subscription helpers
│   ├── hooks/
│   │   ├── useWallet.ts          # Freighter connection state
│   │   ├── useContract.ts        # Contract interaction hook
│   │   └── useEscrow.ts          # Group buy state hook
│   └── utils/
│       ├── format.ts             # Address truncation, amount formatting
│       └── constants.ts          # Contract ID, network config
├── public/
│   └── animations/               # Lottie JSONs, Rive files
└── styles/
    └── globals.css               # Tailwind imports, custom animations
```

### Data Flow (Contract Interaction)

```
User Action (e.g., "Pay ₱850")
       │
       ▼
[1] Build Soroban TX (unsigned)
       │  — stellar-sdk TransactionBuilder
       ▼
[2] Sign with Freighter
       │  — freighterApi.signTransaction(xdr)
       ▼
[3] Submit to Stellar RPC
       │  — server.sendTransaction(signedTx)
       ▼
[4] Poll for confirmation
       │  — server.getTransaction(hash)
       ▼
[5] On success:
       ├── Update Supabase (metadata)
       ├── Trigger UI animation
       └── Emit toast notification
```

---

## 4. Deployment Architecture

### Vercel (Frontend)

```
┌──────────────────────────────────────┐
│  Vercel                              │
│                                      │
│  ┌── Edge Network ─────────────────┐ │
│  │  • SSR pages (dashboard)        │ │
│  │  • Static pages (landing)       │ │
│  │  • API routes (if needed)       │ │
│  │  • Edge middleware (redirects)  │ │
│  └─────────────────────────────────┘ │
│                                      │
│  Environment Variables:              │
│  • NEXT_PUBLIC_CONTRACT_ID           │
│  • NEXT_PUBLIC_NETWORK               │
│  • NEXT_PUBLIC_RPC_URL               │
│  • NEXT_PUBLIC_SUPABASE_URL          │
│  • NEXT_PUBLIC_SUPABASE_ANON_KEY     │
└──────────────────────────────────────┘
```

### Supabase (Backend)

```
┌──────────────────────────────────────┐
│  Supabase Project                    │
│                                      │
│  ┌── PostgreSQL ───────────────────┐ │
│  │  Tables:                        │ │
│  │  • profiles                     │ │
│  │  • group_buys                   │ │
│  │  • participants                 │ │
│  │  • messages                     │ │
│  │  • contract_events              │ │
│  │  Views (migration 005):         │ │
│  │  • participants_public          │ │
│  │  • group_buy_history            │ │
│  │  RPCs (migration 005):          │ │
│  │  • cancel_group_buy(uuid)       │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌── Edge Functions ───────────────┐ │
│  │  • auth-wallet (JWT issuance)   │ │
│  │  • sync-events (cron: 30s)      │ │
│  │    └── unchanged by migration   │ │
│  │        005                      │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌── Realtime ─────────────────────┐ │
│  │  • participants channel         │ │
│  │  • messages channel             │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌── Storage ──────────────────────┐ │
│  │  • group-buy-images bucket      │ │
│  │  • avatar-images bucket         │ │
│  └─────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Stellar Network

```
┌──────────────────────────────────────┐
│  Stellar Testnet / Mainnet           │
│                                      │
│  • Soroban RPC                       │
│    └── soroban-testnet.stellar.org   │
│  • Horizon API                       │
│    └── horizon-testnet.stellar.org   │
│  • PasabuySafe Contract              │
│    └── CBSPN43EXN...JRV4Y7OKB       │
│  • SAC Token(s)                      │
│    └── XLM or custom tokens          │
└──────────────────────────────────────┘
```

---

## 5. Security Architecture

| Layer | Threat | Mitigation |
|-------|--------|-----------|
| Smart Contract | Unauthorized calls | `require_auth` on every function |
| Smart Contract | Double spend | Duplicate deposit check |
| Smart Contract | Fund theft | Fund conservation invariant (no create/destroy) |
| Frontend | XSS | Sanitize on-chain data, CSP headers |
| Frontend | Phishing | Domain verification, no seed phrase inputs |
| Supabase | Unauthorized data access | Row Level Security (RLS) policies |
| Supabase | Participant contact leak | Strict RLS on `participants` (contact columns readable only to the buyer or organizer); public reads go through `participants_public` view |
| Supabase | Token theft | Short-lived JWTs, wallet-based auth |
| Network | Man-in-middle | HTTPS only, signed transactions |

---

## 6. Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Smart Contract | Rust + soroban-sdk | 22.0.0 |
| Blockchain | Stellar Soroban | Testnet |
| CLI | Stellar CLI | 27.0.0 |
| Frontend | Next.js (App Router) | 14.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Components | shadcn/ui | latest |
| Animations | Framer Motion + GSAP + Rive + Lottie | mixed |
| State | Zustand | 4.x |
| Wallet | @stellar/freighter-api | latest |
| Stellar SDK | @stellar/stellar-sdk | latest |
| Database | Supabase (PostgreSQL) | latest |
| Hosting | Vercel | — |
| Domain | Custom (TBD) | — |

---

## 7. Pasabuy Management Enhancements (Migration 005)

Migration `supabase/migrations/005_pasabuy_management_enhancements.sql` introduces new schema surfaces, strict RLS policies on `participants` contact columns, and an organizer cancellation RPC. The on-chain contract and the `sync-events` edge function are unchanged.

### 7.1 New Schema Surfaces

| Surface | Type | Grants | Purpose |
|---------|------|--------|---------|
| `participants_public` | View | `SELECT` to `anon, authenticated` | Non-contact columns of `participants` (id, group_buy_id, buyer_address, slot_count, amount_deposited, status, timestamps, tx hashes). Used by Explore and any unauthenticated slot-count reads. Postgres lacks column-level RLS, so the contact-free read path goes through this view. |
| `group_buy_history` | View | `SELECT` to `authenticated` | Uniform-shape `UNION ALL` of (a) on-chain `contract_events JOIN group_buys ON contract_id` and (b) three off-chain synthesized streams: `participant_joined`, `order_cancelled`, `pasabuy_cancelled`. Powers the organizer Transaction History section. |
| `cancel_group_buy(p_group_buy_id uuid)` | RPC (`SECURITY DEFINER`) | `EXECUTE` to `authenticated` | Atomic organizer cancellation. Validates the caller is the pasabuy's organizer, sets `group_buys.status='cancelled'`, `cancelled_at=now()`, `cancelled_by=organizer_address`, and flags every still-`deposited` participant with `refund_required=TRUE` in one transaction. Non-organizers receive an authorization error. |

### 7.2 Strict RLS on `participants`

Migration 005 drops the older permissive policies and replaces them with three strict policies. All four contact columns (`buyer_name`, `buyer_contact`, `buyer_location`, `buyer_note`) live on `participants` itself, so RLS protects them at the row level.

| Policy | Action | Authorized actor |
|--------|--------|-------------------|
| `Owner or organizer reads participant` | `SELECT` | The buyer themself, or the organizer of the parent pasabuy. |
| `Buyer inserts own participant` | `INSERT` | The wallet-authenticated buyer for their own `buyer_address` row. |
| `Buyer or organizer updates participant` | `UPDATE` | The buyer (for cancellation / claim flows) or the organizer (for `mark_delivered`). |

Non-authorized readers cannot see contact columns. Any public-facing surface that needs slot counts or non-contact data queries `participants_public` instead.

### 7.3 Deposit-Then-Insert Ordering (Canonical Pattern)

The canonical join flow is **deposit-first, insert-second**. A `participants` row MUST NOT exist without a confirmed on-chain deposit. This is enforced at the client layer; there is no on-chain check that mirrors the off-chain row.

```
[1] User submits JoinForm
       │
       ▼
[2] invokeContractWithStatus('deposit', ...)
       │  — wait for Soroban GetTransactionResponse.status === SUCCESS
       ▼
[3] On confirmed success:
       │  — supabase.from('participants').insert({
       │      group_buy_id, buyer_address, status: 'deposited',
       │      tx_hash_deposit: <hash>, buyer_name, buyer_contact,
       │      buyer_location, buyer_note
       │    })
       ▼
[4] Navigate to /dashboard/buyer/{group_buy_id}

If [2] fails (simulation_failed, signing_rejected, submit_failed,
network_unreachable, timeout, contract_error, on_chain_failed):
       └── DO NOT insert a participants row.
           Surface mapSorobanError(err, 'deposit'); keep form values
           in state so the user can retry without re-typing.
```

This ordering matters because the on-chain deposit is the source of truth for funds. Inserting a `participants` row before the deposit confirms would create off-chain records that don't reflect any escrowed funds — breaking the Transaction History view and the refund-claim flow.

### 7.4 Edge Functions

`sync-events` is **unchanged** by migration 005. It continues to mirror Soroban contract events into the `contract_events` table on its existing 30 s cron, and `group_buy_history` consumes that table read-only.

