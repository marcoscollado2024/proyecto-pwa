import { supabase } from './supabase';
import type { User } from '../types';

// Función para verificar el estado de autenticación
export async function checkAuth(): Promise<User | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    if (!session?.user) return null;
    
    return {
      id: session.user.id,
      email: session.user.email || ''
    };
  } catch (error) {
    console.error('Error al verificar autenticación:', error);
    return null;
  }
}

// Función para manejar el inicio de sesión
export async function handleSignIn(email: string, password: string): Promise<User> {
  try {
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (error.message.includes('Invalid login')) {
        throw new Error('Email o contraseña incorrectos');
      }
      throw error;
    }

    if (!user) {
      throw new Error('No se pudo iniciar sesión');
    }

    return {
      id: user.id,
      email: user.email || ''
    };
  } catch (error: any) {
    console.error('Error de autenticación:', error);
    throw new Error(error.message || 'Error al iniciar sesión');
  }
}

// Función para manejar el registro
export async function handleSignUp(email: string, password: string): Promise<User> {
  try {
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error('Este email ya está registrado');
      }
      throw error;
    }

    if (!user) {
      throw new Error('No se pudo crear la cuenta');
    }

    return {
      id: user.id,
      email: user.email || ''
    };
  } catch (error: any) {
    console.error('Error al registrar:', error);
    throw new Error(error.message || 'Error al crear la cuenta');
  }
}

// Función para cerrar sesión
export async function handleSignOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // Limpiar cualquier dato local si es necesario
    localStorage.removeItem('supabase.auth.token');
  } catch (error: any) {
    console.error('Error al cerrar sesión:', error);
    throw new Error(error.message || 'Error al cerrar sesión');
  }
}

// Función para recuperar contraseña
export async function handlePasswordReset(email: string): Promise<void> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    });

    if (error) throw error;
  } catch (error: any) {
    console.error('Error al solicitar recuperación de contraseña:', error);
    throw new Error(error.message || 'Error al enviar el email de recuperación');
  }
}

// Función para actualizar contraseña
export async function handlePasswordUpdate(newPassword: string): Promise<void> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
  } catch (error: any) {
    console.error('Error al actualizar contraseña:', error);
    throw new Error(error.message || 'Error al actualizar la contraseña');
  }
}