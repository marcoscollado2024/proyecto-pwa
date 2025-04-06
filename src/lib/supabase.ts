import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'x-application-name': 'pdf-library'
    }
  }
});

const PAGE_SIZE = 6;

export async function getPDFs(page = 0) {
  try {
    const from = page * PAGE_SIZE;
    
    const { data: pdfs, error, count } = await supabase
      .from('pdfs')
      .select('id, name, content, thumbnail, summary, extracted_text', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const hasMore = count ? from + PAGE_SIZE < count : false;

    return {
      pdfs: pdfs || [],
      hasMore,
      error: null
    };
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    return {
      pdfs: [],
      hasMore: false,
      error
    };
  }
}

export async function savePDF({ name, content, thumbnail }: { 
  name: string; 
  content: string; 
  thumbnail?: string; 
}) {
  try {
    const { data, error } = await supabase
      .from('pdfs')
      .insert([{ name, content, thumbnail }])
      .select('id')
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error saving PDF:', error);
    return { data: null, error };
  }
}

export async function deletePDF(id: string) {
  try {
    const { error } = await supabase
      .from('pdfs')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting PDF:', error);
    return { error };
  }
}