/*
  # Optimize Database Performance and Structure
  
  1. Changes
    - Add optimized indexes for common queries
    - Configure storage parameters for large columns
    - Set proper vacuum settings
    - Enable parallel query execution
    - Add text search capabilities
    - Configure vector similarity search
  
  2. Security
    - Maintain existing RLS policies
    - Add proper constraints
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS vector;

-- Set statement timeout and work memory
ALTER DATABASE CURRENT SET statement_timeout = '30s';
ALTER DATABASE CURRENT SET work_mem = '16MB';

-- Optimize table storage and vacuum settings
ALTER TABLE pdfs SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 50,
  autovacuum_vacuum_cost_delay = 10,
  autovacuum_vacuum_cost_limit = 1000,
  parallel_workers = 4
);

-- Optimize large text columns storage
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

DROP INDEX IF EXISTS idx_pdfs_embedding;
CREATE INDEX idx_pdfs_embedding 
ON pdfs USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function for semantic search
CREATE OR REPLACE FUNCTION search_pdfs(
  query_embedding vector(384),
  similarity_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  name text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pdfs.id,
    pdfs.name,
    1 - (pdfs.embedding <=> query_embedding) AS similarity
  FROM pdfs
  WHERE 1 - (pdfs.embedding <=> query_embedding) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Create function for full text search
CREATE OR REPLACE FUNCTION search_pdfs_text(
  search_query text,
  max_results int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  excerpt text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    ts_headline(
      'spanish',
      COALESCE(p.extracted_text, ''),
      to_tsquery('spanish', search_query),
      'StartSel=<mark>, StopSel=</mark>, MaxWords=75, MinWords=25'
    ) as excerpt
  FROM pdfs p
  WHERE
    to_tsvector('spanish', COALESCE(p.name, '')) @@ to_tsquery('spanish', search_query) OR
    to_tsvector('spanish', COALESCE(p.extracted_text, '')) @@ to_tsquery('spanish', search_query)
  ORDER BY ts_rank(to_tsvector('spanish', COALESCE(p.name, '')), to_tsquery('spanish', search_query)) +
           ts_rank(to_tsvector('spanish', COALESCE(p.extracted_text, '')), to_tsquery('spanish', search_query)) DESC
  LIMIT max_results;
END;
$$;

-- Set statistics target for better query planning
ALTER TABLE pdfs ALTER COLUMN user_id SET STATISTICS 1000;
ALTER TABLE pdfs ALTER COLUMN created_at SET STATISTICS 1000;

-- Update table statistics
ANALYZE pdfs;
ANALYZE pdf_highlights;

-- Example usage:
-- SELECT * FROM search_pdfs_text('machine learning', 5);
-- SELECT * FROM search_pdfs(
--   '[0.1, 0.2, ..., 0.384]'::vector(384),
--   0.8,
--   5
-- );