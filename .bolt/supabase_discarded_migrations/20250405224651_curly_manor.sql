/*
  # Optimize Database Performance
  
  1. Changes
    - Add optimized indexes for common queries
    - Set storage parameters for large columns
    - Configure table statistics
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Optimize table storage
ALTER TABLE pdfs SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 50,
  autovacuum_vacuum_cost_delay = 10,
  autovacuum_vacuum_cost_limit = 1000
);

-- Optimize large text columns
ALTER TABLE pdfs
ALTER COLUMN content SET STORAGE EXTERNAL,
ALTER COLUMN extracted_text SET STORAGE EXTERNAL,
ALTER COLUMN thumbnail SET STORAGE EXTERNAL;

-- Create optimized indexes
DROP INDEX IF EXISTS idx_pdfs_user_created;
CREATE INDEX idx_pdfs_user_created 
ON pdfs (user_id, created_at DESC)
INCLUDE (name, thumbnail)
WHERE user_id IS NOT NULL;

DROP INDEX IF EXISTS idx_pdfs_name_search;
CREATE INDEX idx_pdfs_name_search 
ON pdfs USING gin (to_tsvector('spanish', name))
WHERE name IS NOT NULL;

DROP INDEX IF EXISTS idx_pdfs_extracted_text_search;
CREATE INDEX idx_pdfs_extracted_text_search 
ON pdfs USING gin (to_tsvector('spanish', COALESCE(extracted_text, '')))
WHERE extracted_text IS NOT NULL;

-- Set statistics target for better query planning
ALTER TABLE pdfs ALTER COLUMN user_id SET STATISTICS 1000;
ALTER TABLE pdfs ALTER COLUMN created_at SET STATISTICS 1000;

-- Update table statistics
ANALYZE pdfs;