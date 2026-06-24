-- Run this in your Supabase SQL editor to create the launches table.
-- Stores tokens launched directly through OG DEX (pump.fun launcher).
-- Launched tokens are UNVERIFIED and get NO boosts — they only appear
-- in the "Newly Listed" section until they earn a listing/boost separately.
CREATE TABLE IF NOT EXISTS ogdex_launches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mint text NOT NULL,
  symbol text,
  name text,
  icon text,
  description text,
  creator_wallet text,
  pay_currency text NOT NULL DEFAULT 'sol' CHECK (pay_currency IN ('sol', 'usdc', 'usdt')),
  fee_usd numeric NOT NULL DEFAULT 5,
  payment_tx text UNIQUE NOT NULL,      -- the $5 fee payment, verified on-chain
  launch_tx text,                        -- the pump.fun create signature
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'listed' CHECK (status IN ('listed', 'hidden')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ogdex_launches_status_created ON ogdex_launches(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ogdex_launches_mint ON ogdex_launches(mint);
CREATE UNIQUE INDEX IF NOT EXISTS ogdex_launches_mint_uniq ON ogdex_launches(mint);

-- RLS: public reads listed launches only.
ALTER TABLE ogdex_launches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read listed launches" ON ogdex_launches;
CREATE POLICY "Public read listed launches" ON ogdex_launches
  FOR SELECT USING (status = 'listed');
