# PasabuySafe — Database Specification (Supabase)

---

## 1. Overview

PasabuySafe uses **Supabase (PostgreSQL)** as the off-chain data layer. The smart contract is the source of truth for funds and order status, while Supabase stores human-readable metadata, user profiles, chat, and search indexes.

**Supabase Project URL:** (configure after setup)  
**Region:** Southeast Asia (closest to Filipino users)

---

## 2. Database Schema

### 2.1 `profiles` — User Accounts (Email + Wallet Hybrid)

Users can sign up with **email/password** (Supabase Auth) OR **wallet-only**. They link a Stellar wallet later for transactions.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  -- Links to Supabase Auth
  email TEXT,                               -- From auth.users (nullable for wallet-only)
  full_name TEXT,                           -- User's real name
  display_name TEXT,                        -- Public display name
  phone TEXT,                               -- Optional phone number
  avatar_url TEXT,                          -- Profile picture (Supabase Storage)
  stellar_address TEXT UNIQUE,              -- Stellar public key (nullable until linked)
  wallet_linked_at TIMESTAMPTZ,            -- When wallet was connected
  trust_score INTEGER DEFAULT 0,            -- Earned from successful deliveries
  badges TEXT[] DEFAULT '{}',               -- Array of earned badge slugs
  total_buys INTEGER DEFAULT 0,             -- Completed purchases
  total_organized INTEGER DEFAULT 0,        -- Completed group buys as organizer
  bio TEXT,                                 -- Short description
  socials JSONB DEFAULT '{}',              -- { "telegram": "@user", "facebook": "url" }
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_stellar ON profiles(stellar_address);
CREATE INDEX idx_profiles_trust ON profiles(trust_score DESC);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

**Auth Modes:**

| Mode | How it works | When wallet needed |
|------|-------------|-------------------|
| **Email/Password** | Standard signup → browse, chat, follow | Only when depositing/confirming |
| **Wallet-Only** | Connect Freighter → auto-create profile | Immediately |
| **Email + Wallet** | Signup with email, link wallet later | When ready to transact |
| **OAuth (Google/Facebook)** | Social login → same as email mode | When ready to transact |
```

### 2.2 `group_buys` — Pasabuy Listings

```sql
CREATE TABLE group_buys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id TEXT NOT NULL,                -- Soroban contract address (C...)
  organizer_address TEXT NOT NULL,          -- Organizer's Stellar public key
  title TEXT NOT NULL,                      -- "Korean Skincare Bundle"
  description TEXT,                         -- Detailed description (markdown)
  image_url TEXT,                           -- Cover image (Supabase Storage)
  category TEXT NOT NULL DEFAULT 'general', -- 'skincare', 'food', 'electronics', 'fashion'
  price_per_slot BIGINT NOT NULL,           -- Amount per buyer in stroops (1 XLM = 10^7 stroops)
  max_slots INTEGER,                        -- NULL = unlimited buyers
  token_address TEXT NOT NULL,              -- SAC token contract address
  token_symbol TEXT DEFAULT 'XLM',          -- Display symbol
  deadline TIMESTAMPTZ NOT NULL,            -- Expiration deadline
  status TEXT DEFAULT 'active',             -- 'active', 'in_progress', 'completed', 'expired', 'cancelled'
  tags TEXT[] DEFAULT '{}',                 -- Searchable tags
  share_code TEXT UNIQUE,                   -- Short code for sharing (e.g., "SKIN2026")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_group_buys_status ON group_buys(status);
CREATE INDEX idx_group_buys_category ON group_buys(category);
CREATE INDEX idx_group_buys_organizer ON group_buys(organizer_address);
CREATE INDEX idx_group_buys_deadline ON group_buys(deadline);
CREATE INDEX idx_group_buys_share ON group_buys(share_code);

-- Full-text search
CREATE INDEX idx_group_buys_search ON group_buys 
  USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

### 2.3 `participants` — Buyer Participation Records

```sql
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id UUID NOT NULL REFERENCES group_buys(id) ON DELETE CASCADE,
  buyer_address TEXT NOT NULL,              -- Buyer's Stellar public key
  amount BIGINT NOT NULL,                   -- Deposited amount (stroops)
  status TEXT DEFAULT 'deposited',          -- 'deposited', 'delivered', 'confirmed', 'refunded'
  tx_hash_deposit TEXT,                     -- Deposit transaction hash
  tx_hash_confirm TEXT,                     -- Confirm/refund transaction hash
  note TEXT,                                -- Buyer's note to organizer
  deposited_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  UNIQUE(group_buy_id, buyer_address)
);

-- Indexes
CREATE INDEX idx_participants_group ON participants(group_buy_id);
CREATE INDEX idx_participants_buyer ON participants(buyer_address);
CREATE INDEX idx_participants_status ON participants(status);
```

### 2.4 `messages` — Group Buy Chat

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id UUID NOT NULL REFERENCES group_buys(id) ON DELETE CASCADE,
  sender_address TEXT NOT NULL,             -- Sender's Stellar public key
  content TEXT NOT NULL,                    -- Message text
  message_type TEXT DEFAULT 'text',         -- 'text', 'image', 'system'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_group ON messages(group_buy_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
```

### 2.5 `notifications` — Push/Email Preferences

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,               -- User's Stellar public key
  type TEXT NOT NULL,                       -- 'push', 'email', 'telegram'
  endpoint TEXT,                            -- Push subscription JSON or email address
  enabled BOOLEAN DEFAULT TRUE,
  categories TEXT[] DEFAULT '{all}',        -- Which events to notify: 'deposit', 'delivery', 'deadline'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user ON notifications(user_address);
```

### 2.6 `contract_events` — On-Chain Event Mirror

```sql
CREATE TABLE contract_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id TEXT NOT NULL,                -- Soroban contract address
  event_type TEXT NOT NULL,                 -- 'deposit', 'deliver', 'release', 'refund'
  buyer_address TEXT NOT NULL,              -- Affected buyer
  amount BIGINT,                            -- Token amount (NULL for deliver events)
  tx_hash TEXT UNIQUE,                      -- Transaction hash (prevents duplicates)
  ledger_sequence BIGINT,                   -- Ledger number
  ledger_timestamp BIGINT,                  -- Ledger close time
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_contract ON contract_events(contract_id);
CREATE INDEX idx_events_type ON contract_events(event_type);
CREATE INDEX idx_events_buyer ON contract_events(buyer_address);
CREATE INDEX idx_events_ledger ON contract_events(ledger_sequence DESC);
```

### 2.7 `follows` — User Following Organizers

```sql
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_address TEXT NOT NULL,           -- Who is following
  organizer_address TEXT NOT NULL,          -- Who they follow
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_address, organizer_address)
);

-- Indexes
CREATE INDEX idx_follows_follower ON follows(follower_address);
CREATE INDEX idx_follows_organizer ON follows(organizer_address);
```

---

## 3. Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buys ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- PROFILES: Anyone can read, only owner can update (uses auth.uid())
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Owner updates profile" ON profiles FOR UPDATE 
  USING (id = auth.uid());
CREATE POLICY "Owner reads own private data" ON profiles FOR SELECT 
  USING (id = auth.uid() OR email IS NULL);  -- Others can't see email

-- GROUP_BUYS: Anyone can read, authenticated users can create
CREATE POLICY "Public read group_buys" ON group_buys FOR SELECT USING (true);
CREATE POLICY "Authenticated creates group_buy" ON group_buys FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Organizer updates group_buy" ON group_buys FOR UPDATE 
  USING (organizer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid()));

-- PARTICIPANTS: Organizer and buyer can read, authenticated can insert
CREATE POLICY "Participant reads own" ON participants FOR SELECT 
  USING (
    buyer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    OR group_buy_id IN (
      SELECT id FROM group_buys 
      WHERE organizer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    )
  );
CREATE POLICY "Buyer joins" ON participants FOR INSERT 
  WITH CHECK (buyer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid()));

-- MESSAGES: Only participants of the group buy can read/write
CREATE POLICY "Participants read messages" ON messages FOR SELECT 
  USING (
    group_buy_id IN (
      SELECT group_buy_id FROM participants 
      WHERE buyer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    )
    OR group_buy_id IN (
      SELECT id FROM group_buys 
      WHERE organizer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    )
  );
CREATE POLICY "Authenticated sends messages" ON messages FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- NOTIFICATIONS: Only owner can manage
CREATE POLICY "Owner manages notifications" ON notifications 
  FOR ALL USING (user_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    OR user_address = (SELECT email FROM profiles WHERE id = auth.uid()));

-- FOLLOWS: Anyone can read follow counts, owner manages own
CREATE POLICY "Public read follows" ON follows FOR SELECT USING (true);
CREATE POLICY "User manages follows" ON follows FOR ALL 
  USING (follower_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid()));
```

---

## 4. Authentication System (Supabase Auth)

### Supported Auth Methods

| Method | Provider | Use Case |
|--------|----------|----------|
| **Email + Password** | Supabase Auth (built-in) | Primary signup — no crypto knowledge needed |
| **Google OAuth** | Supabase Auth (Google) | One-tap social login |
| **Facebook OAuth** | Supabase Auth (Facebook) | Filipino users are heavy FB users |
| **Wallet (Freighter)** | Custom Edge Function | Crypto-native users, link to account |

### Signup Flow (Email/Password)

```
1. User clicks "Sign Up"
2. Enters: full_name, email, password
3. Supabase creates auth.users row
4. Trigger creates profiles row (auto)
5. Confirmation email sent
6. User verifies email → account active
7. Can browse, chat, follow — no wallet needed yet
```

### Link Wallet Flow (After Signup)

```
1. User goes to Settings → "Connect Wallet"
2. Clicks "Connect Freighter"
3. Freighter popup → user approves
4. Frontend gets public key
5. Frontend calls Edge Function: link-wallet
6. Edge Function verifies signature + updates profiles.stellar_address
7. User can now deposit/confirm/refund
```

### Frontend Auth Code (Supabase Client)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// SIGN UP
const { data, error } = await supabase.auth.signUp({
  email: 'maria@gmail.com',
  password: 'securepassword123',
  options: {
    data: {
      full_name: 'Maria Santos',
      display_name: 'maria_pasabuy'
    }
  }
});

// LOG IN
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'maria@gmail.com',
  password: 'securepassword123'
});

// GOOGLE OAUTH
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: 'https://pasabuysafe.app/dashboard' }
});

// LOG OUT
await supabase.auth.signOut();

// GET CURRENT USER
const { data: { user } } = await supabase.auth.getUser();

// LINK WALLET (after signing a challenge)
const { data, error } = await supabase.functions.invoke('link-wallet', {
  body: { publicKey, signature, nonce }
});
```

### Edge Function: `link-wallet`

```typescript
// supabase/functions/link-wallet/index.ts
import { Keypair } from '@stellar/stellar-sdk';
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  // Get the authenticated user from the JWT
  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  const { data: { user } } = await supabase.auth.getUser(
    authHeader?.replace('Bearer ', '')
  );
  
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { publicKey, signature, nonce } = await req.json();

  // Verify the wallet signature
  const keypair = Keypair.fromPublicKey(publicKey);
  const isValid = keypair.verify(
    Buffer.from(nonce), 
    Buffer.from(signature, 'base64')
  );

  if (!isValid) return new Response('Invalid signature', { status: 400 });

  // Check wallet isn't already linked to another account
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('stellar_address', publicKey)
    .neq('id', user.id)
    .single();

  if (existing) {
    return new Response(JSON.stringify({ error: 'Wallet already linked to another account' }), { 
      status: 409 
    });
  }

  // Link wallet to user's profile
  const { error } = await supabase
    .from('profiles')
    .update({ 
      stellar_address: publicKey, 
      wallet_linked_at: new Date().toISOString() 
    })
    .eq('id', user.id);

  if (error) return new Response(JSON.stringify({ error }), { status: 500 });

  return new Response(JSON.stringify({ success: true, stellar_address: publicKey }));
});
```

### Password Reset Flow

```typescript
// Request password reset
await supabase.auth.resetPasswordForEmail('maria@gmail.com', {
  redirectTo: 'https://pasabuysafe.app/reset-password'
});

// Update password (on the reset page)
await supabase.auth.updateUser({ password: 'new_secure_password' });
```

### Session Management

```typescript
// Listen for auth state changes (login, logout, token refresh)
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // Redirect to dashboard
  }
  if (event === 'SIGNED_OUT') {
    // Clear local state, redirect to home
  }
  if (event === 'TOKEN_REFRESHED') {
    // Session auto-renewed
  }
});
```

---

## 5. User Access Levels

| Level | Can Do | Requires |
|-------|--------|----------|
| **Guest** | Browse group buys, view landing page | Nothing |
| **Authenticated (no wallet)** | Browse, chat, follow organizers, receive notifications | Email signup |
| **Authenticated (wallet linked)** | All above + deposit, confirm, refund, create group buys | Email + Freighter |
| **Wallet-only** | All blockchain actions, limited off-chain features | Freighter only |

This layered approach means:
- Non-crypto users can explore and engage socially
- They link a wallet ONLY when ready to put money in
- Crypto-native users can skip email and go wallet-only

---

## 6. Database Functions (Stored Procedures)

```sql
-- Update trust score after successful delivery
CREATE OR REPLACE FUNCTION update_trust_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'delivered' THEN
    UPDATE profiles 
    SET trust_score = trust_score + 10,
        total_buys = total_buys + 1,
        updated_at = NOW()
    WHERE stellar_address = NEW.buyer_address;

    -- Also increment organizer's score
    UPDATE profiles 
    SET trust_score = trust_score + 5,
        total_organized = total_organized + 1,
        updated_at = NOW()
    WHERE stellar_address = (
      SELECT organizer_address FROM group_buys 
      WHERE id = NEW.group_buy_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_participant_confirmed
  AFTER UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION update_trust_score();

-- Auto-update group_buy status based on participants
CREATE OR REPLACE FUNCTION update_group_buy_status()
RETURNS TRIGGER AS $$
DECLARE
  total_count INTEGER;
  confirmed_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'confirmed')
  INTO total_count, confirmed_count
  FROM participants WHERE group_buy_id = NEW.group_buy_id;

  IF confirmed_count = total_count AND total_count > 0 THEN
    UPDATE group_buys SET status = 'completed', updated_at = NOW()
    WHERE id = NEW.group_buy_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_all_confirmed
  AFTER UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION update_group_buy_status();

-- Auto-expire past-deadline group buys (called via cron)
CREATE OR REPLACE FUNCTION expire_past_deadline()
RETURNS void AS $$
BEGIN
  UPDATE group_buys 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' AND deadline < NOW();
END;
$$ LANGUAGE plpgsql;
```

---

## 7. Supabase Edge Functions

### 5.1 `auth-wallet` — Wallet-Based Authentication

Issues a Supabase JWT after verifying a Freighter signature.

### 5.2 `sync-events` — On-Chain Event Syncer

Polls Stellar RPC every 30 seconds, mirrors contract events to `contract_events` table, updates `participants` status.

### 5.3 `send-notification` — Push Notification Dispatcher

Triggered by database webhook when `participants.status` changes. Sends push/email to affected users.

### 5.4 `expire-groups` — Cron: Expire Past Deadline

Runs every 5 minutes. Calls `expire_past_deadline()` to mark expired group buys.

---

## 8. Storage Buckets

| Bucket | Access | File Types | Max Size |
|--------|--------|-----------|----------|
| `group-buy-images` | Public read, auth write | jpg, png, webp | 5MB |
| `avatar-images` | Public read, auth write | jpg, png, webp | 2MB |
| `chat-attachments` | Authenticated read/write | jpg, png, pdf | 10MB |

---

## 9. Supabase Setup Commands

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize project
supabase init

# Start local development
supabase start

# Run migrations
supabase db push

# Deploy edge functions
supabase functions deploy auth-wallet
supabase functions deploy sync-events
supabase functions deploy send-notification

# Link to remote project
supabase link --project-ref <YOUR_PROJECT_REF>
```

---

## 10. Environment Variables

```env
# Frontend (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# Edge Functions (Supabase secrets)
SUPABASE_SERVICE_KEY=eyJhbG...
STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
CONTRACT_ID=CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB
```


---

## 11. Migration 005 — Management Enhancements

Migration `supabase/migrations/005_pasabuy_management_enhancements.sql` is purely additive and ships the schema, Row Level Security, views, and RPC required by the *pasabuy-management-enhancements* spec (organizer cancel, organizer transaction history, participant contact details, customer cancel order, customer pasabuy detail page, mark-as-delivered reliability).

### 11.1 New Columns

**`participants` — per-order delivery + cancellation state**

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `buyer_name` | TEXT | yes | NULL | Per-order recipient name (Req 5.1, 5.3). Length 1–100 when set. |
| `buyer_contact` | TEXT | yes | NULL | PH phone number (Req 5.1, 5.4). Validated against `^(\+63\|0)[0-9 \-]{7,14}$`. |
| `buyer_location` | TEXT | yes | NULL | Per-order delivery address (Req 5.1, 5.5). Length 1–250 when set. |
| `buyer_note` | TEXT | yes | NULL | Optional buyer notes (Req 5.1, 5.6). Length ≤ 500 when set. |
| `refund_required` | BOOLEAN | no | `FALSE` | Off-chain claim flag set when a refund is owed but the on-chain `refund` is not yet eligible (Req 1.4, 1.5, 6.4). Cleared when `status` transitions to `refunded`. |
| `cancelled_at` | TIMESTAMPTZ | yes | NULL | Set when the buyer cancels their order pre-deadline (Req 6.4). |

**`group_buys` — organizer cancellation audit**

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `cancelled_at` | TIMESTAMPTZ | yes | NULL | Set when organizer cancels (Req 1.8). |
| `cancelled_by` | TEXT | yes | NULL | Cancelling organizer's `stellar_address` (Req 1.8). |

### 11.2 Updated Status Enumerations

Both status columns now carry an explicit `cancelled` value. The full enumeration:

**`participants.status` (Order_Status)**

| Value | Meaning | Set by |
|-------|---------|--------|
| `deposited` | Buyer deposited on-chain; awaiting organizer fulfillment. | `JoinForm` after confirmed `deposit` |
| `delivered` | Organizer called `mark_delivered`; awaiting buyer confirmation. | `MarkDeliveredButton` |
| `confirmed` | Buyer called `confirm_delivery`; funds released to organizer. | `ConfirmDelivery` |
| `refunded` | On-chain `refund` succeeded; funds returned to buyer. | `RefundButton`, `ClaimRefundButton`, `CancelOrderDialog` (post-deadline) |
| `cancelled` *(new)* | Buyer cancelled pre-deadline. Funds still in escrow; `refund_required = TRUE` until claimed post-deadline. | `CancelOrderDialog` (pre-deadline) |

**`group_buys.status` (Pasabuy_Status)**

| Value | Meaning | Set by |
|-------|---------|--------|
| `active` | Open for joins. | Default on insert |
| `in_progress` | At least one participant delivered/confirmed. | (reserved, computed by triggers) |
| `completed` | All participants confirmed. | `update_group_buy_status` trigger |
| `expired` | Deadline passed without completion. | `expire_past_deadline()` cron |
| `cancelled` *(new)* | Organizer invoked `cancel_group_buy` RPC. Hidden from Explore. | `cancel_group_buy(uuid)` RPC |

The constraints below are added by migration 005:

```sql
ALTER TABLE participants
  ADD CONSTRAINT participants_status_valid
  CHECK (status IN ('deposited','delivered','confirmed','refunded','cancelled'));

ALTER TABLE group_buys
  ADD CONSTRAINT group_buys_status_valid
  CHECK (status IN ('active','in_progress','completed','expired','cancelled'));
```

### 11.3 Migration DDL

```sql
-- ===========================
-- PARTICIPANTS: new columns
-- ===========================
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS buyer_name      TEXT,
  ADD COLUMN IF NOT EXISTS buyer_contact   TEXT,
  ADD COLUMN IF NOT EXISTS buyer_location  TEXT,
  ADD COLUMN IF NOT EXISTS buyer_note      TEXT,
  ADD COLUMN IF NOT EXISTS refund_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancelled_at    TIMESTAMPTZ;

-- ===========================
-- GROUP_BUYS: new columns
-- ===========================
ALTER TABLE group_buys
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- ===========================
-- CHECK CONSTRAINTS (idempotent — wrapped in DO blocks that probe
-- pg_constraint, since Postgres does not support ADD CONSTRAINT IF NOT EXISTS)
-- ===========================
ALTER TABLE participants
  ADD CONSTRAINT participants_buyer_name_len
  CHECK (buyer_name IS NULL OR char_length(buyer_name) BETWEEN 1 AND 100);

ALTER TABLE participants
  ADD CONSTRAINT participants_buyer_location_len
  CHECK (buyer_location IS NULL OR char_length(buyer_location) BETWEEN 1 AND 250);

ALTER TABLE participants
  ADD CONSTRAINT participants_buyer_note_len
  CHECK (buyer_note IS NULL OR char_length(buyer_note) <= 500);

ALTER TABLE participants
  ADD CONSTRAINT participants_buyer_contact_format
  CHECK (buyer_contact IS NULL OR buyer_contact ~ '^(\+63|0)[0-9 \-]{7,14}$');

ALTER TABLE participants
  ADD CONSTRAINT participants_status_valid
  CHECK (status IN ('deposited','delivered','confirmed','refunded','cancelled'));

ALTER TABLE group_buys
  ADD CONSTRAINT group_buys_status_valid
  CHECK (status IN ('active','in_progress','completed','expired','cancelled'));

-- ===========================
-- PARTIAL INDEXES
-- ===========================
-- Claimable refund enumeration (organizer cancel post-deadline; buyer claim flow).
CREATE INDEX IF NOT EXISTS idx_participants_refund_required
  ON participants(group_buy_id)
  WHERE refund_required = TRUE;

-- Filter cancelled pasabuys out of Explore quickly.
CREATE INDEX IF NOT EXISTS idx_group_buys_cancelled
  ON group_buys(status)
  WHERE status = 'cancelled';
```

### 11.4 Row Level Security — Strict Participant Policies

Migration 005 replaces the permissive MVP policies on `participants` with strict ones that key on the caller's linked `stellar_address` (via `profiles`). The result:

- A buyer can read, insert, and update only their own `participants` row.
- The parent pasabuy's organizer can read and update `participants` rows for the pasabuy they own (needed for fulfillment + cancellation).
- No one else can read the `buyer_*` contact columns (Req 3.3).

```sql
-- Drop permissive MVP policies introduced in 001_initial_schema.sql.
DROP POLICY IF EXISTS "Public read participants"     ON participants;
DROP POLICY IF EXISTS "Anyone joins as participant"  ON participants;
DROP POLICY IF EXISTS "Anyone updates participant"   ON participants;

-- New strict policies (key on profiles.stellar_address via auth.uid()).
CREATE POLICY "Owner or organizer reads participant" ON participants
  FOR SELECT
  USING (
    buyer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    OR group_buy_id IN (
      SELECT id FROM group_buys
      WHERE organizer_address =
            (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Buyer inserts own participant" ON participants
  FOR INSERT
  WITH CHECK (
    buyer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Buyer or organizer updates participant" ON participants
  FOR UPDATE
  USING (
    buyer_address = (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    OR group_buy_id IN (
      SELECT id FROM group_buys
      WHERE organizer_address =
            (SELECT stellar_address FROM profiles WHERE id = auth.uid())
    )
  );
```

**Column-level protection via `participants_public`.** PostgreSQL does not natively support column-level RLS, so the non-contact read path (Explore slot counts, public pasabuy detail) goes through the `participants_public` view. The view projects only the non-contact columns. Even a manipulated client cannot select `buyer_name`, `buyer_contact`, `buyer_location`, or `buyer_note` through `participants_public` because those columns are not in the view definition.

The strict RLS on the underlying `participants` table and the column projection of the view together form a defence-in-depth boundary: direct table reads are gated by the row-level policy; public reads are gated by the view's column set.

### 11.5 New Views

**`participants_public` — column-level access control.** Used by `/explore` and `/pasabuy/[id]` to count joined slots without exposing contact data. Granted `SELECT` to both `anon` and `authenticated`.

```sql
CREATE OR REPLACE VIEW participants_public AS
SELECT
  id,
  group_buy_id,
  buyer_address,
  amount,
  status,
  deposited_at,
  delivered_at,
  confirmed_at,
  refunded_at,
  cancelled_at,
  tx_hash_deposit
FROM participants;

GRANT SELECT ON participants_public TO anon, authenticated;
```

**`group_buy_history` — UNION ALL aggregation for the Transaction History section.** Combines one on-chain stream (`contract_events`) with three off-chain synthesized streams (`participant_joined`, `order_cancelled`, `pasabuy_cancelled`). All four legs project a uniform shape `(group_buy_id, event_type, actor_address, amount_stroops, tx_hash, ts, event_kind)`. The client filters by `group_buy_id` and applies the deterministic tie-break ordering of Req 2.6 in `src/lib/utils/history.ts`.

```sql
CREATE OR REPLACE VIEW group_buy_history AS
-- (1) On-chain events mirrored from the Soroban contract.
SELECT
  gb.id                              AS group_buy_id,
  ce.event_type                      AS event_type,
  ce.buyer_address                   AS actor_address,
  ce.amount                          AS amount_stroops,
  ce.tx_hash                         AS tx_hash,
  to_timestamp(ce.ledger_timestamp)  AS ts,
  1                                  AS event_kind  -- 1 = on-chain
FROM contract_events ce
JOIN group_buys gb ON gb.contract_id = ce.contract_id

UNION ALL

-- (2) Off-chain: participant joined (post-confirmed-deposit row insert).
SELECT
  p.group_buy_id,
  'participant_joined'::text,
  p.buyer_address,
  p.amount,
  NULL::text,
  p.deposited_at,
  0  -- 0 = off-chain
FROM participants p

UNION ALL

-- (3) Off-chain: buyer cancelled their order (pre-deadline path).
SELECT
  p.group_buy_id,
  'order_cancelled'::text,
  p.buyer_address,
  NULL::bigint,
  NULL::text,
  p.cancelled_at,
  0
FROM participants p
WHERE p.cancelled_at IS NOT NULL

UNION ALL

-- (4) Off-chain: organizer cancelled the pasabuy.
SELECT
  gb.id,
  'pasabuy_cancelled'::text,
  gb.cancelled_by,
  NULL::bigint,
  NULL::text,
  gb.cancelled_at,
  0
FROM group_buys gb
WHERE gb.cancelled_at IS NOT NULL;

GRANT SELECT ON group_buy_history TO authenticated;
```

### 11.6 New RPC — `cancel_group_buy`

A SECURITY DEFINER function that performs the organizer cancellation as a single atomic Postgres transaction. The function:

1. Resolves the caller's linked `stellar_address` from `profiles`.
2. Loads the target pasabuy's `organizer_address`; not-found → error.
3. Rejects when the caller is not the organizer.
4. Rejects when any participant has `status = 'delivered'` (defence in depth on top of the UI's `CancellationGate`; Req 1.6).
5. Sets `group_buys.status = 'cancelled'`, `cancelled_at = now()`, `cancelled_by = caller`.
6. Flags every `status = 'deposited'` participant with `refund_required = TRUE` so the buyer can claim on or after the deadline.

Both writes happen inside the same function body, which PostgreSQL treats as a single transaction.

```sql
CREATE OR REPLACE FUNCTION cancel_group_buy(p_group_buy_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_address  TEXT;
  v_organizer       TEXT;
  v_has_delivered   BOOLEAN;
BEGIN
  SELECT stellar_address INTO v_caller_address
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_address IS NULL THEN
    RAISE EXCEPTION 'Not authorized: caller has no linked stellar address'
      USING ERRCODE = '42501';
  END IF;

  SELECT organizer_address INTO v_organizer
  FROM group_buys
  WHERE id = p_group_buy_id;

  IF v_organizer IS NULL THEN
    RAISE EXCEPTION 'Pasabuy % not found', p_group_buy_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_organizer <> v_caller_address THEN
    RAISE EXCEPTION 'Not authorized: only the organizer can cancel this pasabuy'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM participants
    WHERE group_buy_id = p_group_buy_id
      AND status = 'delivered'
  ) INTO v_has_delivered;

  IF v_has_delivered THEN
    RAISE EXCEPTION 'Cannot cancel: pasabuy has orders marked delivered'
      USING ERRCODE = 'P0001';
  END IF;

  -- (1) Transition the pasabuy.
  UPDATE group_buys
  SET status       = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_caller_address,
      updated_at   = now()
  WHERE id = p_group_buy_id;

  -- (2) Flag every deposited participant for refund.
  UPDATE participants
  SET refund_required = TRUE
  WHERE group_buy_id = p_group_buy_id
    AND status = 'deposited';
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_group_buy(uuid) TO authenticated;
```

**Error codes raised:**

| SQLSTATE | Condition | UI mapping |
|----------|-----------|-----------|
| `42501` | Caller has no linked `stellar_address`, or is not the organizer | "Only the organizer can cancel this pasabuy." |
| `P0002` | Pasabuy id not found | "Pasabuy not found." |
| `P0001` | At least one participant has `status = 'delivered'` | "This pasabuy has orders marked delivered. Wait for buyers to confirm or refund before cancelling." |

### 11.7 Application Consumption Summary

After migration 005, application code reads and writes through these surfaces:

| Surface | Used by | Purpose |
|---------|---------|---------|
| `participants_public` view | `/explore`, `/pasabuy/[id]` | Public slot counts without contact data |
| `participants` table | Organizer dashboard, buyer dashboard | Contact-aware reads gated by strict RLS |
| `group_buy_history` view | `useTransactionHistory` hook | Unified history feed for organizer Transaction History |
| `cancel_group_buy(uuid)` RPC | `useCancelPasabuy` hook | Atomic organizer cancellation |
