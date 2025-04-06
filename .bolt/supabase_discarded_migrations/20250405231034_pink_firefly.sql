-- Drop order column and related index
DROP INDEX IF EXISTS idx_pdfs_order;
ALTER TABLE pdfs DROP COLUMN IF EXISTS "order";

-- Ensure created_at index exists for proper ordering
CREATE INDEX IF NOT EXISTS idx_pdfs_created_at ON pdfs(created_at DESC);