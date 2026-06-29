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
