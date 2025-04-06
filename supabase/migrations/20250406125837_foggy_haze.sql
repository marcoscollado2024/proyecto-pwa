/*
  # Configuración inicial de la base de datos
  
  1. Nuevas Tablas
    - `pdfs`: Almacena documentos PDF y metadatos
    - `pdf_highlights`: Almacena resaltados de PDF
  
  2. Seguridad
    - RLS habilitado
    - Políticas para acceso anónimo
    - Índices optimizados
*/

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS vector;

-- Eliminar tablas existentes si existen
DROP TABLE IF EXISTS public.pdf_highlights CASCADE;
DROP TABLE IF EXISTS public.pdfs CASCADE;

-- Crear tabla pdfs
CREATE TABLE public.pdfs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id),
    thumbnail text,
    summary text,
    extracted_text text,
    embedding vector(384)
);

-- Agregar comentarios
COMMENT ON TABLE public.pdfs IS 'Tabla para almacenar documentos PDF';
COMMENT ON COLUMN public.pdfs.content IS 'Contenido del PDF en formato base64';
COMMENT ON COLUMN public.pdfs.extracted_text IS 'Texto extraído para búsqueda y análisis con IA';
COMMENT ON COLUMN public.pdfs.embedding IS 'Vector de embedding para búsqueda semántica';

-- Crear tabla pdf_highlights
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

-- Habilitar RLS
ALTER TABLE public.pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_highlights ENABLE ROW LEVEL SECURITY;

-- Crear políticas para acceso anónimo
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

-- Crear índices optimizados
CREATE INDEX idx_pdfs_user_id ON public.pdfs(user_id);
CREATE INDEX idx_pdfs_created_at ON public.pdfs(created_at DESC);
CREATE INDEX idx_pdfs_name_search ON public.pdfs USING gin(to_tsvector('spanish', name)) 
WHERE (name IS NOT NULL);
CREATE INDEX idx_pdfs_extracted_text_search ON public.pdfs 
USING gin(to_tsvector('spanish', COALESCE(extracted_text, ''))) 
WHERE (extracted_text IS NOT NULL);
CREATE INDEX idx_pdfs_embedding ON public.pdfs USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
CREATE INDEX idx_pdf_highlights_pdf_id ON public.pdf_highlights(pdf_id);
CREATE INDEX idx_pdf_highlights_user_id ON public.pdf_highlights(user_id);

-- Configurar almacenamiento para columnas grandes
ALTER TABLE pdfs ALTER COLUMN content SET STORAGE EXTERNAL;
ALTER TABLE pdfs ALTER COLUMN extracted_text SET STORAGE EXTERNAL;
ALTER TABLE pdfs ALTER COLUMN thumbnail SET STORAGE EXTERNAL;

-- Actualizar estadísticas de tablas
ANALYZE pdfs;
ANALYZE pdf_highlights;