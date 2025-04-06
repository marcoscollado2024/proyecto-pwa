import { supabase } from './supabase';
import type { User } from '../types';

export async function initDB() {
  // No initialization needed for Supabase
  return;
}

export async function createUser(email: string, password: string): Promise<string> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) throw error;
  if (!data.user) throw new Error('No se pudo crear el usuario');

  return data.user.id;
}

export async function getUser(email: string, password: string): Promise<User | null> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  if (!data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email || ''
  };
}

export async function savePDF(name: string, content: string, userId: string, thumbnail?: string, summary?: string) {
  const { error } = await supabase
    .from('pdfs')
    .insert([{
      name,
      content,
      thumbnail,
      summary,
      user_id: userId
    }]);

  if (error) throw error;
}

export async function getPDFs(userId: string) {
  const { data, error } = await supabase
    .from('pdfs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deletePDF(id: string, userId: string) {
  const { error } = await supabase
    .from('pdfs')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function searchPDFs(query: string, userId: string) {
  const { data, error } = await supabase
    .from('pdfs')
    .select('*')
    .eq('user_id', userId)
    .or(`name.ilike.%${query}%,content.ilike.%${query}%,summary.ilike.%${query}%`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}