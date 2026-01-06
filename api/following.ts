import { createClient } from '@supabase/supabase-js';
import { socialService } from '../src/services/socialService';
import { rateLimiter } from '../src/utils/rateLimiter';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get authorization token from headers
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - no token provided' });
    }

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized - invalid token' });
    }

    const currentUserId = data.user.id;

    // Rate limit by user
    const rateLimitKey = `following:${currentUserId}`;
    if (!rateLimiter.isAllowed(rateLimitKey)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    const { limit = '50', offset = '0' } = req.query;

    // Validate pagination params
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    // Get following list
    const following = await socialService.getFollowingList(currentUserId, limitNum, offsetNum);

    return res.status(200).json({
      success: true,
      data: following,
      count: following.length,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error('Error in following endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
