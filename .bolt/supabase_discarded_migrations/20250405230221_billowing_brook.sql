-- Add order column to pdfs table
ALTER TABLE pdfs ADD COLUMN IF NOT EXISTS "order" bigint DEFAULT extract(epoch from now());

-- Create index for order column
CREATE INDEX IF NOT EXISTS idx_pdfs_order ON pdfs ("order");

-- Update existing records with timestamp-based order
UPDATE pdfs 
SET "order" = extract(epoch from created_at)
WHERE "order" IS NULL;

-- Add comment explaining the order column
COMMENT ON COLUMN pdfs.order IS 'Order for displaying PDFs, can be modified by user';