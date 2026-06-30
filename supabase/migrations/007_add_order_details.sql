-- Migration 007: Add quantity and delivery_method to participants

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT;

-- Add check constraint for quantity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'participants_quantity_positive'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_quantity_positive
      CHECK (quantity > 0 AND quantity <= 1000);
  END IF;
END$$;
