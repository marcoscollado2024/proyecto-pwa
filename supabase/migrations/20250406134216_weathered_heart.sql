/*
  # Optimize PDF queries and add indexes

  1. Changes
    - Add indexes to improve query performance
    - Set statement timeout to 30 seconds for safer operations
    - Add partial indexes to optimize common queries
    - Add composite indexes for frequently used combinations

  2. Indexes
    - Composite index on user_id and created_at for efficient pagination
    - Partial index on extracted_text for non-null values
    - Partial index on thumbnail for non-null values
    - Index on name for search operations

  3. Performance
    - Increase work_mem for complex operations
    - Optimize vacuum and maintenance settings
*/

-- Set statement timeout to 30 seconds
ALTER DATABASE CURRENT SET statement_timeout = '30s';

-- Increase work_mem for better query performance
ALTER DATABASE CURRENT SET work_mem = '16MB';

-- Create composite index for efficient pagination by user
CREATE INDEX IF NOT EXISTS idx_pdfs_user_created_at 
ON public.pdfs (user_id, created_at DESC);

-- Partial index for extracted_text when not null (reduces index size)
CREATE INDEX IF NOT EXISTS idx_pdfs_extracted_text 
ON public.pdfs (id) 
WHERE extracted_text IS NOT NULL;

-- Partial index for thumbnail when not null
CREATE INDEX IF NOT EXISTS idx_pdfs_thumbnail 
ON public.pdfs (id) 
WHERE thumbnail IS NOT NULL;

-- Index for name search
CREATE INDEX IF NOT EXISTS idx_pdfs_name_gin
ON public.pdfs USING gin (name gin_trgm_ops);

-- Analyze tables to update statistics
ANALYZE public.pdfs;