# PasabuySafe

**Stop pasabuy scams. Your money is safe until you confirm delivery.**

An escrow smart contract for group buying (pasabuy) on the Stellar Soroban platform. Buyers' payments are locked on the blockchain — organizers can't touch the money until the buyer confirms they received their order. If the organizer disappears or doesn't deliver, buyers get an automatic refund.

## How It Protects You

```
❌ Without PasabuySafe:
   You send ₱850 → Organizer blocks you → Money gone forever

✅ With PasabuySafe:
   You pay ₱850 → Money locked in smart contract (not the organizer)
   → You receive your item → You click "Confirm" → Organizer gets paid
   → OR deadline passes → You click "Refund" → Money returns to you
```

**The organizer NEVER holds your money. The blockchain does.**

## Prerequisites

- Rust (stable toolchain)
- Soroban CLI
- `wasm32-unknown-unknown` target

## Setup

```bash
rustup target add wasm32-unknown-unknown
```

## Build

```bash
soroban contract build
```

Or directly with Cargo:

```bash
cargo build --target wasm32-unknown-unknown --release
```

## Test

```bash
cargo test
```

## Contract Functions

| Function | Who Calls It | What Happens |
|----------|-------------|--------------|
| `initialize` | Organizer | Sets up the group buy (token, deadline, confirm window) |
| `deposit` | Buyer | Locks buyer's payment in the contract (NOT the organizer) |
| `mark_delivered` | Organizer | Organizer says "I shipped it" (money still locked, starts timer) |
| `confirm_delivery` | **Buyer** | **Buyer confirms receipt → money released to organizer** |
| `refund` | Buyer | Deadline passed, no delivery → money returns to buyer |
| `release_expired` | Organizer | Buyer got item but won't confirm? After confirm window expires → auto-release |

**Key anti-scam design:** `mark_delivered` alone does NOT release money. The **buyer** must also call `confirm_delivery`. Two signatures from two different people are required.

**Key anti-abuse design:** If the buyer receives the item but refuses to confirm (trying to keep both the item AND the money), the organizer can call `release_expired` after the confirmation window (e.g., 3 days) to auto-release funds. This protects honest organizers from dishonest buyers.

## Architecture

The contract implements a per-buyer state machine with the following lifecycle:

```
Deposited → Delivered → Confirmed
    ↓
 [Refunded] (only after deadline)
```

### Why This Design Stops Scams

- **Deposited**: Buyer has placed funds in escrow. Organizer CANNOT access them.
- **Delivered**: Organizer claims they shipped. Money is STILL LOCKED. This step alone releases nothing.
- **Confirmed**: Buyer verifies receipt and releases payment. This is the ONLY way organizer gets paid.
- **Refunded**: Deadline expired without buyer confirming. Buyer gets full refund automatically.

The organizer can mark "Delivered" all they want — **funds don't move until the buyer signs `confirm_delivery`**. If the organizer blocks the buyer after marking delivered, the buyer simply waits for the deadline and refunds.

Refund is only available from the `Deposited` state and only after the contract's expiration deadline. Once an order is marked `Delivered`, refund is no longer possible — the buyer must confirm or wait for a future dispute mechanism (v2).

All state is stored in Soroban persistent storage. Token transfers use the standard `soroban_sdk::token::Client`. Authorization is enforced via `require_auth` on every public function.

## License

MIT
