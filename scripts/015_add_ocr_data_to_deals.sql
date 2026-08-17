-- Add ocr_data jsonb column to public.deals
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS ocr_data jsonb DEFAULT '{}'::jsonb;

-- Create GIN index for efficient JSON queries on ocr_data
CREATE INDEX IF NOT EXISTS idx_deals_ocr_data ON public.deals USING gin (ocr_data);
