import { supabase } from './client';

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  age: number;
  gender: string;
  phone: string;
}

/**
 * Sign up a new user with email + password and full profile metadata.
 * Profile fields (age, gender, phone, full_name) auto-save via Supabase
 * database trigger that reads raw_user_meta_data.
 */
export async function signUp(data: SignUpData) {
  const { data: result, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.fullName,
        display_name: data.fullName.split(' ')[0] || data.email.split('@')[0],
        age: data.age.toString(),
        gender: data.gender,
        phone: data.phone,
      },
    },
  });
  return { data: result, error };
}

/**
 * Sign in with email and password. Wrong password returns an error.
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Request password reset email
 */
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  return { data, error };
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
