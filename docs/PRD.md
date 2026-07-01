# Product Requirements Document (PRD)

## PasabuySafe — Escrow Smart Contract for Group Buying

---

## 1. Overview

**Product Name:** PasabuySafe  
**Platform:** Stellar Soroban (Blockchain Smart Contract)  
**Version:** 1.0.0  
**Status:** Deployed on Stellar Testnet  
**Contract ID:** `CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB`

---

## 2. Problem Statement

### The Pasabuy Scam Epidemic

In Filipino online communities (Facebook groups, Viber GCs, Telegram), **pasabuy scams** are rampant. The pattern is always the same:

1. A "trusted" organizer posts a group buy deal (Korean skincare, gadgets, food)
2. Buyers send money via GCash, Maya, or bank transfer — **directly to the organizer**
3. Once money is collected, the organizer **blocks all buyers** and disappears
4. Victims have no recourse — the money is gone

**Real impact:**
- Thousands of Filipinos are scammed monthly through pasabuy schemes
- Amounts range from ₱500 to ₱50,000+ per victim
- Police reports rarely lead to recovery
- Victims lose trust in legitimate group buying

### Why Existing Solutions Fail

| Solution | Why It Fails |
|----------|-------------|
| "Trusted" organizer reputation | Scammers build fake reputation then do one big scam |
| GCash/bank transfer | Money goes directly to scammer — no protection |
| COD (Cash on Delivery) | Not available for group buys / international orders |
| PayPal buyer protection | Not used in PH pasabuy communities |
| Facebook/Viber reporting | Platform bans don't return money |

### How PasabuySafe Eliminates Scams

**Core principle: The organizer NEVER touches the money until the buyer confirms they received their order.**

```
❌ Traditional (scam-prone):
   Buyer → sends money → Organizer → blocks buyer → SCAMMED

✅ PasabuySafe:
   Buyer → pays into ESCROW CONTRACT → money locked on blockchain
   Organizer marks "shipped" → buyer receives item → buyer clicks "Confirm"
   ONLY THEN → money released to organizer

   If scammed? → deadline passes → buyer clicks "Refund" → money returns automatically
```

**Why scammers can't beat this:**
- Money is locked in code, not a person's wallet
- Only the BUYER can release funds (by confirming delivery)
- The organizer marking "delivered" is NOT enough — buyer must also confirm
- If deadline passes with no delivery, buyer gets automatic refund
- No one (not even us) can override the smart contract
- Blockchain is permanent — scammers can't delete evidence

---

## 3. Target Users

| Role | Description |
|------|-------------|
| **Organizer** | A person who coordinates group buys — collects orders, purchases in bulk, and distributes to buyers |
| **Buyer** | A participant in a group buy who deposits payment into escrow and receives goods from the organizer |
| **Developer/Integrator** | Developers building frontends, bots, or dApps on top of PasabuySafe |

---

## 4. Goals & Success Metrics

### Goals
- Eliminate trust dependency in group buying transactions
- Provide automated, transparent fund management via smart contract
- Enable refund protection for buyers when orders are not fulfilled
- Create an auditable on-chain record of all escrow activity

### Success Metrics
- Contract deployed and operational on Stellar Testnet/Mainnet
- Zero fund loss incidents (fund conservation property holds)
- All state transitions follow the defined state machine (no invalid transitions)
- Events emitted for all operations enabling off-chain tracking

---

## 5. Product Scope

### In Scope (v1.0)
- Single-organizer escrow contract
- Multiple buyers depositing into one escrow instance
- Organizer-initiated delivery marking
- Buyer-initiated delivery confirmation with fund release
- Time-based refund mechanism after deadline expiration
- On-chain event emission for all state changes
- Authorization enforcement via Soroban's `require_auth`

### Out of Scope (Future Versions)
- Multi-organizer support
- Partial refunds or partial delivery
- Dispute resolution mechanism (arbitration)
- Frontend/UI application
- Multi-token support per escrow instance
- Automatic deadline extension
- Buyer ratings or reputation system

---

## 6. Functional Requirements

### 6.1 Contract Initialization

| ID | Requirement |
|----|-------------|
| FR-1.1 | Organizer initializes the contract with a token address and expiration deadline |
| FR-1.2 | Contract stores organizer address, token, and deadline in persistent storage |
| FR-1.3 | Re-initialization is rejected with an error |
| FR-1.4 | Organizer must authorize the initialization |

### 6.2 Buyer Deposit

| ID | Requirement |
|----|-------------|
| FR-2.1 | Buyer deposits a specified token amount into escrow |
| FR-2.2 | Duplicate deposits from the same buyer are rejected |
| FR-2.3 | Deposit amount must be greater than zero |
| FR-2.4 | Buyer must authorize the deposit |
| FR-2.5 | A deposit event is emitted with buyer address and amount |
| FR-2.6 | Buyer's order status is set to "Deposited" |

### 6.3 Mark Delivery

| ID | Requirement |
|----|-------------|
| FR-3.1 | Organizer marks a specific buyer's order as delivered |
| FR-3.2 | Only orders in "Deposited" status can be marked as delivered |
| FR-3.3 | Organizer must authorize the operation |
| FR-3.4 | A delivery event is emitted with the buyer address |
| FR-3.5 | Buyer's order status transitions to "Delivered" |

### 6.4 Confirm Delivery & Release Funds

| ID | Requirement |
|----|-------------|
| FR-4.1 | Buyer confirms delivery of their order |
| FR-4.2 | Only orders in "Delivered" status can be confirmed |
| FR-4.3 | Escrowed funds are transferred to the organizer |
| FR-4.4 | Buyer must authorize the confirmation |
| FR-4.5 | A release event is emitted with buyer address and amount |
| FR-4.6 | Buyer's order status transitions to "Confirmed" |

### 6.5 Refund After Expiration

| ID | Requirement |
|----|-------------|
| FR-5.1 | Buyer requests a refund after the expiration deadline |
| FR-5.2 | Refund is only allowed when current time >= deadline |
| FR-5.3 | Only orders in "Deposited" status are eligible for refund |
| FR-5.4 | Escrowed funds are returned to the buyer |
| FR-5.5 | Buyer must authorize the refund request |
| FR-5.6 | A refund event is emitted with buyer address and amount |
| FR-5.7 | Buyer's storage entries are cleaned up after refund |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | Security | All functions enforce authorization via `require_auth` |
| NFR-2 | Security | No funds can be created or destroyed (fund conservation) |
| NFR-3 | Security | State transitions follow a strict state machine |
| NFR-4 | Performance | Contract WASM size optimized (< 6KB) |
| NFR-5 | Reliability | All state stored in persistent storage (survives ledger archival) |
| NFR-6 | Observability | Events emitted for every state-changing operation |
| NFR-7 | Compatibility | Compiles with `stellar contract build` and latest Soroban SDK |
| NFR-8 | Testability | 5 unit tests covering all correctness properties |

---

## 8. Architecture Overview

### State Machine

```
[Start] → Deposited → Delivered → Confirmed → [End]
               ↓
          [Refunded] (after deadline) → [End]
```

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Smart Contract Language | Rust |
| Blockchain Platform | Stellar Soroban |
| SDK | soroban-sdk v22.0.0 |
| Token Standard | Stellar Asset Contract (SAC) |
| Wallet Integration | Freighter Wallet |
| CLI Tooling | Stellar CLI v27 |
| Compilation Target | wasm32v1-none |

### Storage Model

| Key | Type | Purpose |
|-----|------|---------|
| Initialized | bool | Prevents re-initialization |
| Organizer | Address | The group buy coordinator |
| Token | Address | Payment token contract |
| Deadline | u64 | Ledger timestamp for refund eligibility |
| Status(buyer) | OrderStatus | Per-buyer order state |
| Deposit(buyer) | i128 | Per-buyer deposit amount |

---

## 9. User Flows

### Happy Path (Successful Group Buy)
1. Organizer deploys and initializes the contract with token + deadline
2. Buyers deposit their payment amounts
3. Organizer procures items and marks each buyer's order as delivered
4. Each buyer confirms receipt → funds released to organizer

### Refund Path (Unfulfilled Order)
1. Organizer initializes contract
2. Buyers deposit payments
3. Deadline passes without organizer marking delivery
4. Buyers call refund → funds returned automatically

### Error Paths
- Buyer attempts duplicate deposit → rejected
- Buyer attempts refund before deadline → rejected
- Buyer attempts confirm before organizer marks delivered → rejected
- Anyone without authorization attempts an action → rejected

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Organizer marks delivery without actually delivering | Buyer funds locked in "Delivered" state | Future: add dispute/arbitration mechanism |
| Buyer refuses to confirm despite receiving goods | Organizer doesn't receive funds | Deadline-based auto-release (future version) |
| Token contract vulnerability | Fund loss | Use only audited SAC tokens |
| Ledger archival removes contract state | State loss | Use persistent storage (implemented) |

---

## 11. Release Plan

| Phase | Milestone | Status |
|-------|-----------|--------|
| Phase 1 | Smart contract implementation | ✅ Complete |
| Phase 2 | Unit test suite (5 tests) | ✅ Complete |
| Phase 3 | Testnet deployment | ✅ Complete |
| Phase 4 | Frontend dApp integration | 🔲 Planned |
| Phase 5 | Security audit | 🔲 Planned |
| Phase 6 | Mainnet deployment | 🔲 Planned |

---

## 12. Contract Reference

**Testnet Contract ID:** `CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB`  
**Stellar Expert:** https://stellar.expert/explorer/testnet/contract/CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB  
**Deployer:** `GATG3QX42YG72TJVE2GCO3ZLQJZ424XVF4LILEGIMA5RMNCFE6N4VVH6`  
**WASM Hash:** `75e3d13b1da35012eb0b5f196cf5cfd6367bf3549d66da2c2dc6a02b53cb6850`  
**WASM Size:** 5,131 bytes (optimized)

---

## 13. Appendix

### CLI Quick Reference

```bash
# Build
stellar contract build

# Test
cargo test

# Deploy
stellar contract deploy \
  --wasm target/wasm32v1-none/release/pasabuy_safe.wasm \
  --source deployer --network testnet --alias pasabuy-safe

# Invoke
stellar contract invoke --id pasabuy-safe --source deployer --network testnet -- \
  initialize --organizer <ADDR> --token <TOKEN_ID> --deadline <TIMESTAMP>

# Check alias
stellar contract alias ls
```

---

## 14. Management Enhancements

The PasabuySafe platform extends the v1.0 escrow contract with a set of organizer and customer management features delivered by the `pasabuy-management-enhancements` spec. The Soroban contract itself remains immutable; these enhancements live entirely in the web app and Supabase layer.

- **Organizer cancel pasabuy** (Requirement 1) — Organizers can cancel a pasabuy they own. Cancellation is blocked when any order has been marked delivered; otherwise the pasabuy is marked `cancelled` and any deposited participants are flagged for refund via the existing on-chain `refund` primitive after the deadline.
- **Organizer transaction history** (Requirement 2) — Each pasabuy's organizer management page surfaces a unified, deterministically ordered transaction history that interleaves on-chain `contract_events` (deposit, mark_delivered, confirm_delivery, refund) with off-chain state changes (participant joined, order cancelled, pasabuy cancelled).
- **Participant contact details collected on join** (Requirement 3) — The `participants` table stores `buyer_name`, `buyer_contact`, `buyer_location`, and `buyer_note`. Row Level Security restricts those fields to the buyer themself and the pasabuy's organizer; a `participants_public` view exposes only non-contact columns to everyone else.
- **Pasabuy detail page route `/pasabuy/{id}`** (Requirement 4) — Customers navigate from the Explore page to a dedicated detail page that shows the full pasabuy listing (image, price in XLM and PHP, slots, deadline, organizer, shipping/meetup info) and either a "Join this pasabuy" CTA or a "View my order" link, without requiring a wallet connection to render.
- **Customer joins with per-order delivery details** (Requirement 5) — The join flow collects per-order delivery fields (with PH phone validation), invokes `deposit` on-chain first, and only inserts the `participants` row after the deposit transaction is confirmed, so an off-chain order can never exist without a matching on-chain deposit.
- **Customer cancel order + refund_required flow** (Requirement 6) — Buyers can cancel a deposited order. After the deadline, cancellation directly invokes `refund` on-chain; before the deadline the order is marked `cancelled` with `refund_required = true`, and a "Claim refund" control appears after the deadline so the buyer can complete the on-chain refund themselves.
- **Mark-as-Delivered reliability** (Requirement 7) — The Mark-as-Delivered flow awaits transaction confirmation through a hardened Stellar client (`invokeContractWithStatus`), updates the database only on confirmed success, maps every Soroban error code to a user-facing message, and re-enables the button on failure so the organizer can retry without a page reload.
