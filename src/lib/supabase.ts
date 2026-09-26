import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Checks whether Supabase environment variables are provided and not placeholders.
 */
export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseAnonKey.includes('your-anon-key')
  );
};

/**
 * Safe Supabase client instance.
 * Uses publishable anon key only. Service role keys must NEVER be used on client.
 */
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

/**
 * Diagnostic helper to test the frontend Supabase connection.
 */
export const testSupabaseConnection = async (): Promise<{
  configured: boolean;
  connected: boolean;
  message: string;
}> => {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      message: 'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are using placeholders.',
    };
  }

  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      // If error is table not found or permission, it still reached the server
      return {
        configured: true,
        connected: true,
        message: `Connected to Supabase server: ${error.message}`,
      };
    }
    return {
      configured: true,
      connected: true,
      message: 'Connected to Supabase successfully.',
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      configured: true,
      connected: false,
      message: `Failed to connect to Supabase: ${errorMessage}`,
    };
  }
};
