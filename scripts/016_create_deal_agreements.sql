-- Migration 016: Create deal_agreements table and saved_signature column on profiles

-- 1. Create deal_agreements table
CREATE TABLE IF NOT EXISTS public.deal_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE UNIQUE,
  seller_signature TEXT,
  seller_signed_at TIMESTAMP WITH TIME ZONE,
  buyer_signature TEXT,
  buyer_signed_at TIMESTAMP WITH TIME ZONE,
  lawyer_signature TEXT,
  lawyer_signed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add saved_signature to public.profiles for lawyers
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_signature TEXT;

-- 3. Enable RLS on deal_agreements
ALTER TABLE public.deal_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view agreements" ON public.deal_agreements;
CREATE POLICY "Authenticated users can view agreements"
  ON public.deal_agreements FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert agreements" ON public.deal_agreements;
CREATE POLICY "Authenticated users can insert agreements"
  ON public.deal_agreements FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update agreements" ON public.deal_agreements;
CREATE POLICY "Authenticated users can update agreements"
  ON public.deal_agreements FOR UPDATE
  TO authenticated
  USING (true);

-- 4. Enable Supabase Realtime for deal_agreements
ALTER TABLE public.deal_agreements REPLICA IDENTITY FULL;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_agreements;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;
