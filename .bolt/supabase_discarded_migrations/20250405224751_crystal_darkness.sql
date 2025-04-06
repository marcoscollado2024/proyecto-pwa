/*
  # Fix Database Structure
  
  1. New Tables
    - `pdfs`: Store PDF documents and metadata
      - `id` (uuid, primary key)
      - `name` (text)
      - `content` (text) - Original PDF content in base64 format
      - `created_at` (timestamptz)
      - `user_id` (uuid, foreign key)
      - `thumbnail` (text)
      - `summary` (text)
      - `extracted_text` (text) - Extracted text content for search and AI analysis
    
    - `pdf_highlights`
      - `id` (uuid, primary key)
      - `pdf_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `page_number` (integer)
      - `text` (text)
      - `color` (text)
      - `position` (jsonb)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for anonymous access
    - Set up appropriate indexes
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.pdf_highlights CASCADE;
DROP TABLE IF EXISTS public.pdfs CASCADE;

-- Create pdfs table
CREATE TABLE public.pdfs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id),
    thumbnail text,
    summary text,
    extracted_text text
);

-- Add comments
COMMENT ON TABLE public.pdfs IS 'Table for storing PDF documents';
COMMENT ON COLUMN public.pdfs.content IS 'Original PDF content in base64 format';
COMMENT ON COLUMN public.pdfs.extracted_text IS 'Extracted text content for search and AI analysis';

-- Create pdf_highlights table
CREATE TABLE public.pdf_highlights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pdf_id uuid REFERENCES public.pdfs(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),
    page_number integer NOT NULL,
    text text NOT NULL,
    color text NOT NULL DEFAULT '#ffeb3b',
    position jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_highlights ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access
CREATE POLICY "allow_anonymous_select" ON public.pdfs
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "allow_anonymous_insert" ON public.pdfs
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "allow_anonymous_delete" ON public.pdfs
    FOR DELETE TO anon
    USING (true);

CREATE POLICY "allow_anonymous_update" ON public.pdfs
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "allow_anonymous_select_highlights" ON public.pdf_highlights
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "allow_anonymous_insert_highlights" ON public.pdf_highlights
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "allow_anonymous_delete_highlights" ON public.pdf_highlights
    FOR DELETE TO anon
    USING (true);

-- Create optimized indexes
CREATE INDEX idx_pdfs_user_id ON public.pdfs(user_id);
CREATE INDEX idx_pdfs_created_at ON public.pdfs(created_at DESC);
CREATE INDEX idx_pdfs_name_search ON public.pdfs USING gin(to_tsvector('spanish', name)) 
WHERE (name IS NOT NULL);
CREATE INDEX idx_pdfs_extracted_text_search ON public.pdfs 
USING gin(to_tsvector('spanish', COALESCE(extracted_text, ''))) 
WHERE (extracted_text IS NOT NULL);
CREATE INDEX idx_pdf_highlights_pdf_id ON public.pdf_highlights(pdf_id);
CREATE INDEX idx_pdf_highlights_user_id ON public.pdf_highlights(user_id);

-- Set storage parameters for large text columns
ALTER TABLE pdfs ALTER COLUMN content SET STORAGE EXTERNAL;
ALTER TABLE pdfs ALTER COLUMN extracted_text SET STORAGE EXTERNAL;
ALTER TABLE pdfs ALTER COLUMN thumbnail SET STORAGE EXTERNAL;

-- Update table statistics
ANALYZE pdfs;
ANALYZE pdf_highlights;