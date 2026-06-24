
-- Run this in your Supabase SQL editor to create the boosts table
CREATE TABLE IF NOT EXISTS ogdex_boosts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mint text NOT NULL,
  symbol text,
  name text,
  icon text,
  chain text NOT NULL DEFAULT 'solana',
  tier text NOT NULL CHECK (tier IN ('6h', '24h')),
  usd_paid numeric NOT NULL,
  payment_tx text UNIQUE NOT NULL,
  payer_wallet text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'rejected')),
  expires_at timestamptz NOT NULL,
  featured_rank integer NOT NULL DEFAULT 999,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ogdex_boosts_status_expires ON ogdex_boosts(status, expires_at);
CREATE INDEX IF NOT EXISTS ogdex_boosts_mint ON ogdex_boosts(mint);

-- RLS: public reads active boosts only
ALTER TABLE ogdex_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active boosts" ON ogdex_boosts
  FOR SELECT USING (status = 'active');
