-- PasabuySafe Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- ===========================
-- PROFILES
-- ===========================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  stellar_address TEXT UNIQUE,
  wallet_linked_at TIMESTAMPTZ,
  trust_score INTEGER DEFAULT 0,
  badges TEXT[] DEFAULT '{}',
  total_buys INTEGER DEFAULT 0,
  total_organized INTEGER DEFAULT 0,
  bio TEXT,
  socials JSONB DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_stellar ON profiles(stellar_address);

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
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ===========================
-- GROUP_BUYS
-- ===========================
CREATE TABLE IF NOT EXISTS group_buys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id TEXT NOT NULL,
  organizer_address TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  price_per_slot BIGINT NOT NULL,
  max_slots INTEGER,
  token_address TEXT NOT NULL,
  token_symbol TEXT DEFAULT 'XLM',
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active',
  tags TEXT[] DEFAULT '{}',
  share_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_buys_status ON group_buys(status);
CREATE INDEX IF NOT EXISTS idx_group_buys_category ON group_buys(category);
CREATE INDEX IF NOT EXISTS idx_group_buys_organizer ON group_buys(organizer_address);

-- ===========================
-- PARTICIPANTS
-- ===========================
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id UUID NOT NULL REFERENCES group_buys(id) ON DELETE CASCADE,
  buyer_address TEXT NOT NULL,
  amount BIGINT NOT NULL,
  status TEXT DEFAULT 'deposited',
  tx_hash_deposit TEXT,
  tx_hash_confirm TEXT,
  note TEXT,
  deposited_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  UNIQUE(group_buy_id, buyer_address)
);

CREATE INDEX IF NOT EXISTS idx_participants_group ON participants(group_buy_id);
CREATE INDEX IF NOT EXISTS idx_participants_buyer ON participants(buyer_address);

-- ===========================
-- ROW LEVEL SECURITY
-- ===========================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buys ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, owner write
DROP POLICY IF EXISTS "Public read profiles" ON profiles;
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner updates profile" ON profiles;
CREATE POLICY "Owner updates profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- Group buys: public read, authenticated create, organizer update
DROP POLICY IF EXISTS "Public read group_buys" ON group_buys;
CREATE POLICY "Public read group_buys" ON group_buys FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone creates group_buy" ON group_buys;
CREATE POLICY "Anyone creates group_buy" ON group_buys FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Organizer updates own group_buy" ON group_buys;
CREATE POLICY "Organizer updates own group_buy" ON group_buys FOR UPDATE USING (true);

-- Participants: public read, anyone can insert
DROP POLICY IF EXISTS "Public read participants" ON participants;
CREATE POLICY "Public read participants" ON participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone joins as participant" ON participants;
CREATE POLICY "Anyone joins as participant" ON participants FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone updates participant" ON participants;
CREATE POLICY "Anyone updates participant" ON participants FOR UPDATE USING (true);

-- ===========================
-- DONE
-- ===========================
-- After running this, your Supabase backend is ready for PasabuySafe.
-- Note: Auth policies are permissive for MVP. Tighten them for production.
