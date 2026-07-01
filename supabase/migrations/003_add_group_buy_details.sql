-- Migration 003: Add location, subcategory, and meetup info to group_buys
-- Run this in Supabase SQL Editor AFTER running 002_add_profile_fields.sql

ALTER TABLE group_buys
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS meetup_info TEXT,
  ADD COLUMN IF NOT EXISTS shipping_method TEXT;

CREATE INDEX IF NOT EXISTS idx_group_buys_location ON group_buys(location);
CREATE INDEX IF NOT EXISTS idx_group_buys_subcategory ON group_buys(subcategory);
    