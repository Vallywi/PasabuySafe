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
CONTRACT_ID=CCM2F2EHUAYPDW4FB2OUZOVD3ZOHPBFT5CTZ73GFA6OZCWDED6SFVRMW
```
