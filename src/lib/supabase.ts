import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE;

if (!supabaseUrl || !supabasePublishable) {
  console.warn('⚠️ Supabase credentials not configured. Running in offline mode.');
  console.warn('Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE to your .env file');
}

// Validate URL format to prevent misconfigurations
if (supabaseUrl && !supabaseUrl.match(/^https:\/\/.+\.supabase\.co$/)) {
  console.error('❌ Invalid Supabase URL format. Expected: https://[project-id].supabase.co');
}

// Use placeholder values if credentials are missing (for offline mode)
const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabasePublishable || 'placeholder-key';

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'managedle-auth',
    storage: window.localStorage,
    flowType: 'pkce', // Use PKCE flow for better security
  },
  global: {
    headers: {
      'X-Client-Info': 'managedle-web',
    },
  },
});
