import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not configured. Running in offline mode.');
  console.warn('Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file');
}

// Use placeholder values if credentials are missing (for offline mode)
const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Database types (will be auto-generated after creating tables)
export interface DbUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbGameRecord {
  record_id: string;
  user_id: string;
  game_id: string;
  date: string;
  score: number | null;
  completed: boolean;
  failed: boolean;
  hard_mode: boolean;
  share_text: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface DbGame {
  game_id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}
