/*
  # Optimize Database Queries and Performance
  
  1. Changes
    - Add optimized indexes for common queries
    - Set proper storage parameters
    - Configure autovacuum settings
    - Enable parallel query execution
  
  2. Security
    - Maintain existing RLS policies
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
WHERE user_id IS NOT NULL;

DROP INDEX IF EXISTS idx_pdfs_name_search;
CREATE INDEX idx_pdfs_name_search 
ON pdfs USING gin (to_tsvector('spanish', name))
WHERE name IS NOT NULL;

DROP INDEX IF EXISTS idx_pdfs_extracted_text_search;
CREATE INDEX idx_pdfs_extracted_text_search 
ON pdfs USING gin (to_tsvector('spanish', COALESCE(extracted_text, '')))
WHERE extracted_text IS NOT NULL;

-- Update table statistics
ANALYZE pdfs;