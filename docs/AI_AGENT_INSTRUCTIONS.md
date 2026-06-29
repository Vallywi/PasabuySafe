# PasabuySafe — AI Agent Instructions

---

## 1. Project Context

You are working on **PasabuySafe**, a Soroban smart contract escrow system for group buying (pasabuy) on the Stellar blockchain. The project has two parts:

1. **Smart Contract** (Rust/Soroban) — Already built and deployed
2. **Web Frontend** (Next.js/TypeScript) — Planned

---

## 2. Repository Structure

```
pasabuy_safe/
├── Cargo.toml                    # Rust dependencies (soroban-sdk 22.0.0)
├── README.md                     # Project overview and CLI commands
├── src/
│   ├── lib.rs                    # Smart contract implementation
│   └── test.rs                   # 5 unit tests
├── docs/
│   ├── PRD.md                    # Product Requirements Document
│   ├── ARCHITECTURE.md           # System architecture
│   ├── DATABASE.md               # Supabase schema & setup
│   ├── API_SPEC.md               # Contract & REST API spec
│   ├── SMART_CONTRACT_SPEC.md    # Contract technical spec
│   ├── UX_UI_SPEC.md             # UI/UX design + animations
│   ├── WEBSITE_PLAN.md           # Fullstack plan
│   └── AI_AGENT_INSTRUCTIONS.md  # This file
└── .kiro/specs/                  # Kiro spec workflow files
```

---

## 3. Smart Contract Details

- **Contract ID (Testnet):** `CCM2F2EHUAYPDW4FB2OUZOVD3ZOHPBFT5CTZ73GFA6OZCWDED6SFVRMW`
- **Deployer:** `GATG3QX42YG72TJVE2GCO3ZLQJZ424XVF4LILEGIMA5RMNCFE6N4VVH6`
- **Network:** Stellar Testnet
- **SDK:** soroban-sdk 22.0.0
- **Functions:** initialize, deposit, mark_delivered, confirm_delivery, refund

---

## 4. Key Rules for AI Agents

### When modifying the smart contract:
- Always run `cargo test` after changes (must pass all 5 tests)
- Always run `stellar contract build` to verify WASM compilation
- Never remove `require_auth` calls
- Never break the state machine (Deposited → Delivered → Confirmed)
- Keep the contract `#![no_std]` — no standard library

### When building the frontend:
- Use Next.js 14 App Router with TypeScript
- Use Tailwind CSS + shadcn/ui for components
- Use Framer Motion for animations (see UX_UI_SPEC.md for details)
- Connect to Freighter Wallet via `@stellar/freighter-api`
- Connect to Supabase for off-chain data (see DATABASE.md)
- Never store private keys or seed phrases in code
- Always validate on-chain before trusting off-chain data

### When working with Supabase:
- Follow the schema in DATABASE.md exactly
- Enable RLS on all tables
- Use Edge Functions for auth and event syncing
- Never expose the service key to the frontend

### When deploying:
- Frontend → Vercel
- Contract → `stellar contract deploy --alias pasabuy-safe`
- Supabase → `supabase db push` for migrations

---

## 5. Common Commands

```bash
# Smart Contract
cargo test                           # Run 5 unit tests
stellar contract build               # Build WASM
stellar contract alias ls            # Show deployed contract ID

# Frontend (when created)
npm run dev                          # Start dev server
npm run build                        # Production build
vercel deploy                        # Deploy to Vercel

# Supabase
supabase start                       # Local development
supabase db push                     # Push migrations
supabase functions deploy <name>     # Deploy edge function
```

---

## 6. Design Decisions (Do Not Change)

1. **Single-organizer model** — One address per contract instance
2. **Persistent storage** — All data in `env.storage().persistent()`
3. **SAC tokens only** — Uses Stellar Asset Contract for payments
4. **Wallet-based auth** — No passwords, sign with Freighter
5. **On-chain = truth** — Supabase is enrichment, not authority
6. **Mobile-first** — Filipino market, most users on phones
7. **Animations are key** — See UX_UI_SPEC.md Section 5 for the full motion system
