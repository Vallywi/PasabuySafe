# PasabuySafe — User Stories

---

## Organizer Stories

### US-1: Create a Group Buy
**As an** organizer,  
**I want to** create a new group buy with a title, price, deadline, and description,  
**So that** buyers can discover and join my pasabuy.

**Acceptance Criteria:**
- Organizer connects Freighter wallet
- Fills in title, description, price per slot, max slots, deadline
- Uploads a cover image
- Submits → contract is initialized on-chain
- Metadata is saved to Supabase
- Share link is generated (e.g., pasabuysafe.app/join/SKIN2026)

---

### US-2: Mark Orders as Delivered
**As an** organizer,  
**I want to** mark individual buyer orders as delivered,  
**So that** buyers can confirm receipt and I receive my payment.

**Acceptance Criteria:**
- Organizer sees list of all buyers with their deposit status
- Clicks "Mark Delivered" per buyer (or "Mark All")
- Signs transaction with Freighter
- Buyer's status updates to "Delivered" in real-time
- Buyer receives push notification

---

### US-3: View Earnings
**As an** organizer,  
**I want to** see how much money has been released to me,  
**So that** I can track my earnings.

**Acceptance Criteria:**
- Dashboard shows: Total escrowed, Released, Pending
- Transaction history with dates and amounts
- Links to Stellar Expert for each transaction

---

## Buyer Stories

### US-4: Browse and Join a Pasabuy
**As a** buyer,  
**I want to** browse available group buys and deposit payment,  
**So that** I can participate in a pasabuy.

**Acceptance Criteria:**
- Explore page shows active group buys as cards
- Filter by category, price range, deadline
- Click "Join" → see price and organizer trust score
- Click "Pay" → Freighter signs deposit transaction
- Success animation plays (coin into vault)
- Status shows "Paid — waiting for delivery"

---

### US-5: Track My Order
**As a** buyer,  
**I want to** see the current status of my order in a timeline,  
**So that** I know what's happening with my purchase.

**Acceptance Criteria:**
- Status timeline: Paid → Order Placed → Delivered → Confirmed
- Current step pulses/glows
- Timestamps for each completed step
- Push notification when status changes

---

### US-6: Confirm Delivery
**As a** buyer,  
**I want to** confirm I received my order,  
**So that** the organizer gets paid.

**Acceptance Criteria:**
- "Confirm Delivery" button appears when status = Delivered
- Swipe-to-confirm on mobile (gesture)
- Signs transaction with Freighter
- Funds released to organizer
- Success animation + "Funds released!" message
- Trust scores updated for both parties

---

### US-7: Request a Refund
**As a** buyer,  
**I want to** get my money back if the deadline passes without delivery,  
**So that** I don't lose my funds.

**Acceptance Criteria:**
- "Get Refund" button appears when deadline has passed AND status = Deposited
- Empathetic messaging ("Sorry this didn't work out")
- Shows refund amount and destination wallet
- Signs transaction with Freighter
- Funds returned instantly
- Organizer's trust score decreases

---

### US-8: View Transaction History
**As a** buyer,  
**I want to** see all my past group buy participations,  
**So that** I have receipts and can track spending.

**Acceptance Criteria:**
- List of all orders: active, completed, refunded
- Each shows: group buy title, amount, status, date
- Click to see full details + link to Stellar Expert

---

## Social Stories

### US-9: Share a Group Buy
**As a** user,  
**I want to** share a group buy link to my friends on Viber/FB/Telegram,  
**So that** more people can join.

**Acceptance Criteria:**
- Share button generates a link with Open Graph preview card
- Preview shows: title, image, price, slots remaining
- Short URL format: pasabuysafe.app/join/SKIN2026

---

### US-10: Follow an Organizer
**As a** buyer,  
**I want to** follow my favorite organizers,  
**So that** I get notified when they create new pasabuys.

**Acceptance Criteria:**
- "Follow" button on organizer profile
- Push notification when followed organizer creates a new group buy
- "Following" feed on dashboard

---

### US-11: View Organizer Profile & Trust Score
**As a** buyer,  
**I want to** see an organizer's track record before joining,  
**So that** I can decide if I trust them.

**Acceptance Criteria:**
- Profile shows: display name, avatar, trust score, completed deliveries
- Badge display (e.g., "100% delivery rate", "Top Organizer")
- List of past group buys with completion stats
- Number of followers

---

## Onboarding Stories

### US-12: Connect Wallet (First Time)
**As a** new user,  
**I want to** connect my Freighter wallet easily,  
**So that** I can start using PasabuySafe.

**Acceptance Criteria:**
- Prominent "Connect Wallet" button on landing page
- If Freighter not installed → link to Chrome Web Store
- On connect: confetti animation + address appears in nav
- Brief onboarding tooltip explaining next steps

---

### US-13: First-Time Walkthrough
**As a** new user,  
**I want to** understand how escrow protects my money,  
**So that** I feel confident depositing.

**Acceptance Criteria:**
- 3-step animated walkthrough on first visit
- "Your money is safe" messaging with vault illustration
- Skip option for experienced users
- Doesn't show again after completion

---

## Management Enhancements

These stories cover the organizer and customer management features added in the `pasabuy-management-enhancements` spec. Each story cross-references the requirement and acceptance criteria (AC) numbers in `.kiro/specs/pasabuy-management-enhancements/requirements.md`.

### US-14: Cancel a Pasabuy
**As an** organizer,
**I want to** cancel a pasabuy I created,
**So that** I can clean up listings I no longer want to run, with funds returned to buyers who have already deposited.

**Cross-reference:** Requirement 1 (AC 1.1–1.9)

**Acceptance Criteria:**
- "Cancel pasabuy" control is visible only to the pasabuy's organizer (AC 1.1, 1.2)
- Pasabuys with no deposits are cancelled immediately (AC 1.3)
- Pasabuys with deposits after the deadline are cancelled and affected buyers are marked eligible to claim a refund (AC 1.4)
- Pasabuys with deposits before the deadline require explicit confirmation; affected buyers are notified to claim refunds after the deadline (AC 1.5)
- Cancellation is blocked when any order is marked delivered (AC 1.6)
- Cancelled pasabuys are hidden from Explore and show "Cancelled" to non-organizers (AC 1.7)
- Cancellation timestamp and organizer address are recorded in `group_buys.cancelled_at` and `cancelled_by` (AC 1.8)
- Affected buyers see the cancellation in their order list with a link to the refund action once eligible (AC 1.9)

---

### US-15: View Transaction History of a Pasabuy
**As an** organizer,
**I want to** view the transaction history of a pasabuy I created,
**So that** I can audit deposits, deliveries, confirmations, refunds, and cancellations across all participants.

**Cross-reference:** Requirement 2 (AC 2.1–2.11)

**Acceptance Criteria:**
- Transaction history is shown only to the organizer; non-organizers cannot query it (AC 2.1, 2.2)
- History includes every `contract_events` row for the pasabuy's contract id (AC 2.3)
- History includes off-chain events: participant joined, order cancelled by buyer, pasabuy cancelled by organizer (AC 2.4)
- Each entry shows event type, truncated actor address (4…4), amount in XLM + PHP (rate ≤ 60 s old), truncated tx hash (6…6) or "—", and ISO 8601 local-time timestamp (AC 2.5)
- Entries are ordered by timestamp descending with a deterministic event-type tie-break order (AC 2.6)
- On-chain hashes link to Stellar Expert testnet in a new tab (AC 2.7)
- Loading state shows a spinner only; no list or error message (AC 2.8)
- On query failure the section renders with "Could not load transaction history" and a retry control (AC 2.9)
- Empty history shows "No transactions yet." (AC 2.10)
- Successful queries never show the error message (AC 2.11)

---

### US-16: View Participant Contact Details
**As an** organizer,
**I want to** see each participant's name, contact number, location, and order description,
**So that** I can fulfill and deliver their order.

**Cross-reference:** Requirement 3 (AC 3.1–3.8)

**Acceptance Criteria:**
- `buyer_name`, `buyer_contact`, `buyer_location`, and `buyer_note` are stored as nullable TEXT on `participants` (AC 3.1)
- Organizer sees these four fields alongside existing buyer info for each participant (AC 3.2)
- Row Level Security prevents non-organizers from reading these fields (AC 3.3)
- Null fields render as "—" rather than the literal "null" (AC 3.4)
- Rows where all four fields are null render the message "No contact information provided" in place of per-field values (AC 3.5)
- A copy control next to a non-null `buyer_contact` writes the value to the clipboard and shows a "Copied" toast for 2 seconds (AC 3.6)
- The copy control is hidden when `buyer_contact` is null (AC 3.7)
- Clipboard failures show an error toast for 3 seconds and never show the "Copied" toast (AC 3.8)

---

### US-17: Open Pasabuy Detail Page
**As a** customer,
**I want to** click a pasabuy on the Explore page and see its full details on a dedicated page,
**So that** I can decide whether to join before committing funds.

**Cross-reference:** Requirement 4 (AC 4.1–4.9)

**Acceptance Criteria:**
- Clicking a pasabuy listing navigates to `/pasabuy/{id}` within 2 seconds (AC 4.1)
- The page renders title, description, category, subcategory, image (with placeholder fallback), price in XLM + PHP, max slots, joined count, deadline in local time, location, shipping method, meetup info, and the organizer name + truncated address (4…4) (AC 4.2)
- A "Join this pasabuy" call to action appears only while the pasabuy is active, before the deadline, and has open slots (AC 4.3)
- When not joinable, exactly one unavailability reason is shown using the precedence: cancelled → deadline passed → slots full → no longer accepting joins (AC 4.4)
- Users who already have an order see "View my order" linking to `/dashboard/buyer/{id}` (AC 4.5)
- Unknown pasabuy ids show "Pasabuy not found" with a link back to Explore (AC 4.6)
- The page renders without requiring a wallet; Freighter is only prompted when the user activates Join (AC 4.7)
- Loading state shows a spinner only; the not-found message is not shown while loading (AC 4.8)
- On non-404 query failures, "Could not load pasabuy details. Try again." and a retry control are shown (AC 4.9)

---

### US-18: Join Pasabuy with Per-Order Delivery Details
**As a** customer,
**I want to** enter my name, contact number, delivery location, and order notes when joining a pasabuy,
**So that** the organizer has everything needed to fulfill my order even if it differs from other pasabuys I have joined.

**Cross-reference:** Requirement 5 (AC 5.1–5.9)

**Acceptance Criteria:**
- The Join Form collects `buyer_name` (required), `buyer_contact` (required), `buyer_location` (required), and `buyer_note` (optional) (AC 5.1)
- Fields are never pre-filled from the user's profile so each order can have distinct details (AC 5.2)
- Invalid `buyer_name` (empty, whitespace, or > 100 chars) blocks submission with "Enter a name between 1 and 100 characters." (AC 5.3)
- Invalid `buyer_contact` (empty or non-matching PH phone regex) blocks submission with "Enter a valid Philippine phone number." (AC 5.4)
- Invalid `buyer_location` (empty, whitespace, or > 250 chars) blocks submission with "Enter a delivery location between 1 and 250 characters." (AC 5.5)
- `buyer_note` longer than 500 characters blocks submission with "Notes must be 500 characters or fewer." (AC 5.6)
- On valid submission, the `participants` row is inserted only after the on-chain `deposit` is confirmed (AC 5.7)
- On-chain `deposit` failures show a contract-specific error and never insert a `participants` row (AC 5.8)
- Form input is retained in browser state after a failed submission so the user does not have to re-type to retry (AC 5.9)

---

### US-19: Cancel My Order
**As a** customer,
**I want to** cancel my order in a pasabuy,
**So that** I can get my money back when I change my mind, with clear rules about when cancellation is allowed.

**Cross-reference:** Requirement 6 (AC 6.1–6.9)

**Acceptance Criteria:**
- A "Cancel order" control appears only when the buyer's order status is `deposited` (AC 6.1)
- The control is hidden for `delivered`, `confirmed`, `refunded`, or already `cancelled` orders (AC 6.2)
- Cancelling after the deadline invokes the on-chain `refund` and sets the order to `refunded` with `refunded_at` (AC 6.3)
- Cancelling before the deadline requires explicit confirmation, sets the order to `cancelled` with `Refund_Required = true`, and shows a banner to return after the deadline (AC 6.4)
- A "Claim refund" control appears for cancelled orders once the deadline has passed and invokes the on-chain `refund` (AC 6.5)
- A successful on-chain `refund` transitions a cancelled order to `refunded` (AC 6.6)
- `refund` failing with `NotExpired` shows "Refund is not yet available. Try again after the deadline." (AC 6.7)
- `refund` failing with `NotDeposited` shows "No deposit found for this order. It may have already been refunded." (AC 6.8)
- Attempts to cancel another user's order are rejected by RLS and show "You can only cancel your own order." (AC 6.9)
