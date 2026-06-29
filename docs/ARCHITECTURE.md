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

**Contract ID (Testnet):** `CCM2F2EHUAYPDW4FB2OUZOVD3ZOHPBFT5CTZ73GFA6OZCWDED6SFVRMW`

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
│  │  • profiles                     │ │
│  │  • group_buys                   │ │
│  │  • participants                 │ │
│  │  • messages                     │ │
│  │  • contract_events              │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ┌── Edge Functions ───────────────┐ │
│  │  • auth-wallet (JWT issuance)   │ │
│  │  • sync-events (cron: 30s)      │ │
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
│    └── CCM2F2EHUAYP...D6SFVRMW      │
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
