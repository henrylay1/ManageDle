import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabasePublishableKey = process.env.VITE_SUPABASE_PUBLISHABLE || '';

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate environment variables first
  if (!supabaseUrl || !supabaseServiceKey || !supabasePublishableKey) {
    console.error('Missing environment variables:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasPublishableKey: !!supabasePublishableKey,
    });
    return res.status(500).json({ 
      error: 'Server configuration error - missing environment variables. Please ensure SUPABASE_SERVICE_KEY is set.' 
    });
  }

  // Create clients inside handler to ensure env vars are loaded
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const supabasePublic = createClient(supabaseUrl, supabasePublishableKey);

  try {
    // Get authorization token from headers
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - no token provided' });
    }

    // Verify token with Supabase (using public client)
    const { data, error } = await supabasePublic.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized - invalid token' });
    }

    const userId = data.user.id;

    // Delete user-related data from tables (cascading deletes should handle most)
    // Note: Supabase triggers/RLS policies may handle cascade automatically, but we ensure cleanup
    const deletePromises = [
      supabaseAdmin.from('follows').delete().eq('follower_id', userId),
      supabaseAdmin.from('follows').delete().eq('following_id', userId),
      supabaseAdmin.from('game_records').delete().eq('user_id', userId),
      supabaseAdmin.from('user_profile_config').delete().eq('user_id', userId),
      supabaseAdmin.from('groups').delete().eq('created_by', userId),
      supabaseAdmin.from('users').delete().eq('id', userId),
    ];

    await Promise.all(deletePromises);

    // Delete user from Supabase Auth (using admin client with service role)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('Failed to delete user from auth:', deleteError);
      return res.status(500).json({ error: 'Failed to delete account from authentication system' });
    }

    return res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    console.error('deleteAccount error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
