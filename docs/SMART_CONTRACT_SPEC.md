# PasabuySafe — Smart Contract Specification

---

## 1. Overview

| Field | Value |
|-------|-------|
| **Contract Name** | PasabuySafe |
| **Language** | Rust |
| **SDK** | soroban-sdk v22.0.0 |
| **Target** | wasm32v1-none |
| **WASM Size** | 5,131 bytes (optimized) |
| **Testnet Contract ID** | `CCM2F2EHUAYPDW4FB2OUZOVD3ZOHPBFT5CTZ73GFA6OZCWDED6SFVRMW` |
| **WASM Hash** | `75e3d13b1da35012eb0b5f196cf5cfd6367bf3549d66da2c2dc6a02b53cb6850` |
| **Deployer** | `GATG3QX42YG72TJVE2GCO3ZLQJZ424XVF4LILEGIMA5RMNCFE6N4VVH6` |

---

## 2. State Machine

```
             ┌──────────────────────────────────────┐
             │                                      │
 [Start] ──▶ Deposited ──▶ Delivered ──▶ Confirmed  │
             │     │                                │
             │     └──▶ [Refunded]                  │
             │          (after deadline)            │
             └──────────────────────────────────────┘
```

Valid transitions:
- `(none) → Deposited` — via `deposit()`
- `Deposited → Delivered` — via `mark_delivered()`
- `Delivered → Confirmed` — via `confirm_delivery()`
- `Deposited → Removed` — via `refund()` (only after deadline)

---

## 3. Data Types

### OrderStatus
```rust
#[contracttype]
pub enum OrderStatus {
    Deposited,   // Buyer has deposited funds
    Delivered,   // Organizer has marked delivery
    Confirmed,   // Buyer confirmed, funds released
}
```

### DataKey (Storage Keys)
```rust
#[contracttype]
pub enum DataKey {
    Initialized,       // bool
    Organizer,         // Address
    Token,             // Address
    Deadline,          // u64
    Status(Address),   // OrderStatus per buyer
    Deposit(Address),  // i128 per buyer
}
```

### Error
```rust
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    AlreadyDeposited = 3,
    NotDeposited = 4,
    NotDelivered = 5,
    NotExpired = 6,
    InvalidStatus = 7,
    InvalidAmount = 8,
}
```

---

## 4. Functions

### `initialize(organizer, token, deadline)`

| Field | Detail |
|-------|--------|
| **Purpose** | Set up escrow parameters |
| **Auth** | `organizer.require_auth()` |
| **Preconditions** | Contract not already initialized |
| **Effects** | Stores organizer, token, deadline; sets Initialized=true |
| **Errors** | `AlreadyInitialized` if called twice |

### `deposit(buyer, amount)`

| Field | Detail |
|-------|--------|
| **Purpose** | Buyer locks funds in escrow |
| **Auth** | `buyer.require_auth()` |
| **Preconditions** | amount > 0, buyer has no existing deposit |
| **Effects** | Transfers tokens buyer→contract, stores status=Deposited + amount |
| **Events** | `("deposit", buyer) → amount` |
| **Errors** | `InvalidAmount`, `AlreadyDeposited` |

### `mark_delivered(buyer)`

| Field | Detail |
|-------|--------|
| **Purpose** | Organizer signals buyer's order is delivered |
| **Auth** | `organizer.require_auth()` |
| **Preconditions** | Buyer status = Deposited |
| **Effects** | Updates status to Delivered |
| **Events** | `("deliver", buyer) → ()` |
| **Errors** | `NotDeposited`, `InvalidStatus` |

### `confirm_delivery(buyer)`

| Field | Detail |
|-------|--------|
| **Purpose** | Buyer confirms receipt, releasing funds |
| **Auth** | `buyer.require_auth()` |
| **Preconditions** | Buyer status = Delivered |
| **Effects** | Transfers tokens contract→organizer, status=Confirmed |
| **Events** | `("release", buyer) → amount` |
| **Errors** | `NotDelivered` |

### `refund(buyer)`

| Field | Detail |
|-------|--------|
| **Purpose** | Buyer reclaims funds after deadline |
| **Auth** | `buyer.require_auth()` |
| **Preconditions** | ledger.timestamp >= deadline, buyer status = Deposited |
| **Effects** | Transfers tokens contract→buyer, removes buyer storage |
| **Events** | `("refund", buyer) → amount` |
| **Errors** | `NotExpired`, `NotDeposited` |

---

## 5. Correctness Properties

| # | Property | Description |
|---|----------|-------------|
| P1 | State Machine Integrity | Only valid transitions are allowed |
| P2 | Fund Conservation | No funds created or destroyed |
| P3 | Duplicate Prevention | Initialize and deposit are one-shot per entity |
| P4 | Deadline Enforcement | Refund only after expiry |
| P5 | Event Emission | Every state change emits correct event |
| P6 | Authorization | `require_auth` enforced on every function |

---

## 6. Unit Tests (5 total)

| Test | What it verifies |
|------|-----------------|
| `test_full_lifecycle` | Happy path: init → deposit → deliver → confirm |
| `test_refund_after_expiration` | Refund works after deadline |
| `test_duplicate_deposit_rejected` | Second deposit fails |
| `test_refund_before_expiration_rejected` | Early refund fails |
| `test_invalid_status_transitions` | Wrong-state operations fail |

---

## 7. Build & Deploy

```bash
# Build
stellar contract build

# Test
cargo test

# Deploy
stellar contract deploy \
  --wasm target/wasm32v1-none/release/pasabuy_safe.wasm \
  --source deployer --network testnet --alias pasabuy-safe

# Check alias
stellar contract alias ls
```

---

## 8. Security Considerations

### Anti-Scam Protection (Core Design)

The entire contract is designed around one principle: **the organizer never holds buyer money**.

| Scam Attempt | How Contract Blocks It |
|-------------|----------------------|
| Organizer collects money and blocks buyers | Money is in the contract, not the organizer's wallet. Buyer refunds after deadline. |
| Organizer marks "delivered" without shipping | `mark_delivered` alone does NOT release funds. Buyer must also `confirm_delivery`. |
| Organizer fakes buyer's confirmation | Impossible — `confirm_delivery` requires the buyer's private key signature via `require_auth` |
| Organizer tries to withdraw directly | No withdraw function exists. Only `confirm_delivery` (buyer-signed) moves money to organizer. |
| Organizer changes the deadline | Impossible — deadline is set once at initialization and stored immutably on-chain |
| Organizer deploys a modified contract | Each contract has a unique ID. Buyers verify the contract address before depositing. |

### Technical Security

- **Authorization**: Every function checks `require_auth` before any state change
- **Reentrancy**: Not applicable (Soroban doesn't support reentrancy)
- **Integer overflow**: Rust panics on overflow in debug; release profile has `overflow-checks = true`
- **Storage exhaustion**: Per-buyer storage bounded by number of unique depositors
- **Token trust**: Only works with SAC (Stellar Asset Contract) tokens verified at initialization
- **Fund conservation**: No function creates or destroys funds — money in = money out (to organizer OR back to buyer)

---

## 9. Off-Chain Cancellation vs On-Chain Refund

> Added by the `pasabuy-management-enhancements` spec (Requirement 8.6, design "Refund_Required Flow"). The on-chain contract is unchanged — this section clarifies how the off-chain layer interacts with the `refund` function documented in §4.

### 9.1 Two cancellation paths

The product layer exposes **two** ways for a buyer to back out of an order. Only one of them touches the contract:

| Path | Trigger | On-chain action | Off-chain effect |
|------|---------|-----------------|-------------------|
| **Pre-deadline cancellation** (off-chain only) | Buyer clicks "Cancel order" while `now() < deadline` | **None.** The deposit stays in the contract; `OrderStatus` for the buyer remains `Deposited`. | `participants.status = 'cancelled'`, `participants.cancelled_at = now()`, `participants.refund_required = TRUE` |
| **Post-deadline refund** (on-chain) | Buyer clicks "Cancel order" while `now() >= deadline`, OR a previously-cancelled buyer clicks "Claim refund" via `ClaimRefundButton` | `refund(buyer)` is invoked — see §4. The contract returns the deposit and removes the buyer's storage. | After the tx is confirmed: `participants.status = 'refunded'`, `participants.refunded_at = now()`, `participants.refund_required = FALSE`, `participants.tx_hash_confirm = <hash>`. All four updates are written in the same DB write. |

The same dual logic applies to **organizer-initiated pasabuy cancellation**: pre-deadline cancellation of a pasabuy that has deposited buyers does not pull funds out of the contract. It only flags each affected `participants` row with `refund_required = TRUE` so the buyer can claim their refund after the deadline.

### 9.2 The on-chain `refund` is the only fund-return mechanism

Re-stating §4 with the off-chain context made explicit:

- The on-chain `refund` function (§4) is the **only** path by which a buyer's deposit leaves the contract back to the buyer. There is no off-chain bookkeeping that can substitute for it.
- `refund` is callable **only after the deadline**. The contract enforces this with `Error::NotExpired` (error code `#6` in §3) when `ledger.timestamp < deadline`.
- Therefore an off-chain `cancelled` status with `refund_required = TRUE` is **a promise of a future refund, not a refund itself**. The funds remain locked in the contract until the buyer (or the buyer's own wallet) signs the `refund` call post-deadline.

### 9.3 State-machine note

The on-chain state machine in §2 has **no `cancelled` state**. From the contract's perspective, a buyer who has cancelled off-chain pre-deadline is still in `OrderStatus::Deposited` until they claim their refund.

```
Off-chain status     :  deposited → cancelled ─────────────────▶ refunded
                                       │                              ▲
                                       │ (no on-chain action yet)     │
                                       ▼                              │
On-chain OrderStatus :  Deposited ───────────────────────────────▶ (removed)
                                              after deadline,
                                              via refund(buyer)
```

Implications:

- The contract's invariants (`P1 State Machine Integrity`, `P2 Fund Conservation`, `P4 Deadline Enforcement` in §5) are preserved unchanged. Off-chain cancellation cannot violate them because it does not call into the contract.
- A "Claim refund" button is shown by the web app only when all three of `status === 'cancelled'`, `refund_required === true`, and `now() >= deadline` hold. Clicking it invokes `refund` exactly as §4 describes; the off-chain row is reconciled in the same DB write that records `tx_hash_confirm`.
- If the buyer never claims, the funds remain in the contract indefinitely. The spec does not introduce any automatic claim — the `refund_required` flag is the durable signal that a claim is owed.

### 9.4 Cross-references

- `docs/DATABASE.md` §11 (`participants.refund_required` column) — full column definition, default, and the partial index `idx_participants_refund_required` used to enumerate pending claims.
- `docs/DATABASE.md` §11.6 (`cancel_group_buy(uuid)` RPC) — the SECURITY DEFINER Postgres function the organizer calls to perform an atomic pasabuy cancellation, including the bulk update that flips `refund_required` on every affected `deposited` participant.
- `docs/DATABASE.md` §11 — the `participants.status` enum (now including `cancelled`) and the `group_buys.status` enum (now including `cancelled`).
