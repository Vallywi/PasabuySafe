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
