# PasabuySafe — Website & Fullstack Plan

---

## 1. Purpose

Build a web application that serves as the frontend for the PasabuySafe Soroban escrow smart contract. The site allows organizers to create group buys and buyers to deposit, track, confirm delivery, or request refunds — all through a clean UI connected to the Stellar blockchain via Freighter Wallet.

---

## 2. Recommended Fullstack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend Framework** | Next.js 14 (App Router) | SSR/SSG for SEO, React ecosystem, file-based routing |
| **Language** | TypeScript | Type safety across the stack |
| **Styling** | Tailwind CSS + shadcn/ui | Fast prototyping, accessible components, consistent design |
| **State Management** | Zustand | Lightweight, minimal boilerplate for wallet/contract state |
| **Wallet Integration** | @stellar/freighter-api | Official Freighter SDK for signing transactions |
| **Stellar SDK** | @stellar/stellar-sdk + @stellar/stellar-base | Transaction building, XDR encoding, contract invocation |
| **Backend/API** | Next.js API Routes (or none) | Minimal backend needed — most logic is on-chain |
| **Database** | Supabase (PostgreSQL) | Optional — for user profiles, group buy metadata, notifications |
| **Auth** | Wallet-based (Freighter public key) | No passwords — authenticate by signing a challenge |
| **Hosting** | Vercel | Zero-config Next.js deployment, edge functions |
| **Indexer/Events** | Mercury (Stellar indexer) or custom Horizon polling | Track contract events for UI updates |

---

## 3. Site Architecture

```
pasabuy-safe-web/
├── app/
│   ├── page.tsx                   # Landing page
│   ├── layout.tsx                 # Root layout (wallet provider, theme)
│   ├── dashboard/
│   │   ├── page.tsx               # User dashboard (active group buys)
│   │   ├── organizer/
│   │   │   ├── create/page.tsx    # Create new group buy
│   │   │   └── [id]/page.tsx      # Manage a specific group buy
│   │   └── buyer/
│   │       └── [id]/page.tsx      # Buyer view of a group buy
│   ├── explore/page.tsx           # Browse open group buys
│   ├── pasabuy/
│   │   └── [id]/page.tsx          # Public pasabuy detail page (open to guests; CTA → Join Form)
│   └── tx/[hash]/page.tsx         # Transaction detail view
├── components/
│   ├── wallet/                    # Freighter connect button, status
│   ├── escrow/                    # Deposit, confirm, refund forms
│   ├── ui/                        # shadcn/ui components
│   └── layout/                    # Header, footer, nav
├── lib/
│   ├── stellar/                   # Contract client, tx builders
│   ├── hooks/                     # useWallet, useContract, useEscrow
│   └── utils/                     # Formatting, validation
├── public/                        # Static assets
└── styles/                        # Tailwind config, globals
```

---

## 4. Core Pages & Features

### 4.1 Landing Page
- Hero section explaining PasabuySafe (trust-free group buying)
- How it works (3-step visual: Deposit → Deliver → Release)
- Connect Wallet CTA
- Link to explore open group buys

### 4.2 Organizer Dashboard
- **Create Group Buy**: Form to initialize contract (token selection, deadline picker, description)
- **Manage Group Buy**: See all buyers, their deposit amounts, and statuses
- **Mark Delivered**: Button per buyer to trigger `mark_delivered`
- **View Funds**: Total escrowed, released, pending

### 4.3 Buyer Dashboard
- **Browse & Join**: See available group buys, deposit into one
- **My Orders**: Track status (Deposited → Delivered → Confirmed)
- **Confirm Delivery**: Button to release funds to organizer
- **Request Refund**: Available after deadline if status is still Deposited
- **Transaction History**: All past interactions with receipts

### 4.4 Explore Page
- List of active group buys (from indexed contract events)
- Filter by token, deadline, organizer
- Status indicators (open, in-progress, completed, expired)
- Navigation flow: **Explore → Pasabuy Detail (`/pasabuy/{id}`) → Join Form → Buyer Order Page (`/dashboard/buyer/{id}`)**. The Explore card links to the public detail page rather than jumping directly to the buyer order page; the detail page hosts the "Join this pasabuy" CTA which opens the Join Form, and only after a confirmed on-chain deposit does the user land on `/dashboard/buyer/{id}`.

### 4.5 Pasabuy Detail Page (`/pasabuy/{id}`)
- Public, guest-viewable page that shows the full pasabuy (title, description, image, price, slots, deadline, location, shipping, organizer info)
- Primary CTA: "Join this pasabuy" — gated by joinability rules (status, slots, deadline); prompts Freighter only on activation
- If the signed-in viewer already has an order for this pasabuy, the CTA is replaced by a "View my order" link to `/dashboard/buyer/{id}`
- Unavailability states render a single reason ("Cancelled by organizer", "Deadline passed", "Slots full", "No longer accepting joins")

### 4.6 Transaction Detail
- Show on-chain transaction data
- Link to Stellar Expert
- Event logs for the contract interaction

---

## 5. Wallet Integration Flow

```
1. User clicks "Connect Wallet"
2. Freighter popup → user approves connection
3. App reads public key from Freighter
4. For any contract call:
   a. App builds the Soroban transaction (unsigned)
   b. Sends to Freighter for signing
   c. Submits signed XDR to Stellar RPC
   d. Polls for confirmation
   e. Updates UI based on result
```

### Key Libraries
```bash
npm install @stellar/stellar-sdk @stellar/freighter-api
```

### Contract Client Pattern
```typescript
import { Contract, TransactionBuilder, Networks } from '@stellar/stellar-sdk';

const contract = new Contract('CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB');

// Build invoke transaction
const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
  .addOperation(contract.call('deposit', buyerAddress, amount))
  .setTimeout(30)
  .build();

// Sign with Freighter
const signedXDR = await freighterApi.signTransaction(tx.toXDR(), { networkPassphrase: Networks.TESTNET });
```

---

## 6. Optional Backend (Supabase)

If you want features beyond what's on-chain:

| Table | Purpose |
|-------|---------|
| `group_buys` | Metadata (title, description, image, organizer public key) |
| `participants` | Buyer join records, off-chain notes |
| `notifications` | Email/push alerts for status changes |
| `profiles` | User display names, avatars (linked to Stellar address) |

The backend is **optional** — the contract is fully functional without it. Supabase adds UX polish (human-readable names, push notifications, search/browse).

---

## 7. Event Indexing Strategy

To keep the UI in sync with on-chain state:

**Option A: Mercury Indexer (Recommended)**
- Subscribe to contract events
- Automatic webhook on ne  events
- No polling overhead

**Option B: Horizon + Polling**
- Poll `/effects` or `/operations` for the contract account
- Parse events from transaction metadata
- Simpler setup, slightly delayed

**Option C: Stellar RPC `getEvents`**
- Direct RPC call with filters
- Good for testnet development
- May hit rate limits on mainnet

---

## 8. Development Phases

| Phase | Scope | Timeline |
|-------|-------|----------|
| **Phase 1** | Landing page + Wallet connect + Basic deposit/confirm UI | 1-2 weeks |
| **Phase 2** | Organizer dashboard (create, manage, mark delivered) | 1-2 weeks |
| **Phase 3** | Buyer dashboard (my orders, refund, history) | 1 week |
| **Phase 4** | Explore page + event indexing | 1 week |
| **Phase 5** | Supabase integration (profiles, notifications) | 1 week |
| **Phase 6** | Mobile responsiveness, polish, testing | 1 week |
| **Phase 7** | Mainnet deployment + security review | 1-2 weeks |

**Total estimate: 6-10 weeks** for a production-ready MVP.

---

## 9. Design Recommendations

- **Color palette**: Trust-focused — blues/greens (safe, financial)
- **Typography**: Inter or Geist for clean readability
- **Illustrations**: Simple line art showing the escrow flow
- **Mobile-first**: Most pasabuy activity happens on phones (Filipino market)
- **Tagalog/English toggle**: Consider bilingual support for the target market
- **Dark mode**: Support both themes via Tailwind's `dark:` classes

---

## 10. Security Considerations (Frontend)

| Concern | Mitigation |
|---------|-----------|
| XSS in transaction display | Sanitize all on-chain data before rendering |
| Freighter spoofing | Validate signed transactions server-side before submission |
| Phishing | Clear domain verification, no seed phrase inputs ever |
| Session hijacking | Wallet-based auth (no stored sessions with secrets) |
| Amount manipulation | Validate amounts client-side AND rely on contract-side checks |

---

## 11. Quick Start Commands

```bash
# Scaffold the project
npx create-next-app@latest pasabuy-safe-web --typescript --tailwind --app --src-dir

# Install dependencies
cd pasabuy-safe-web
npm install @stellar/stellar-sdk @stellar/freighter-api zustand
npx shadcn-ui@latest init

# Development
npm run dev

# Deploy
vercel deploy
```

---

## 12. Summary

The website is a thin UI layer over the PasabuySafe smart contract. Most business logic lives on-chain — the frontend's job is to:

1. Connect to Freighter Wallet
2. Build and submit Soroban transactions
3. Display contract state and events in a human-friendly way
4. Optionally store metadata (titles, descriptions) off-chain via Supabase

The recommended stack (Next.js + TypeScript + Tailwind + Freighter + Stellar SDK) is the standard approach for Soroban dApps and gives you SSR, type safety, and rapid iteration.
