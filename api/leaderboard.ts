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
    // Get authorization token from headers (optional for public data, required for filtering)
    const authHeader = req.headers.authorization;
    let currentUserId: string | undefined;

    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const { data } = await supabase.auth.getUser(token);
        currentUserId = data.user?.id;
      }
    }

    const { limit = '100', offset = '0', filter } = req.query;

    // Validate pagination params
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    // Rate limit by IP
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `leaderboard:${clientIp}`;
    if (!rateLimiter.isAllowed(rateLimitKey)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    // Validate filter parameter
    if (filter && filter !== 'following') {
      return res.status(400).json({ error: 'Invalid filter. Allowed values: "following"' });
    }

    // If filtering by following, need authentication
    if (filter === 'following' && !currentUserId) {
      return res.status(401).json({ error: 'Authentication required for "following" filter' });
    }

    // Get leaderboard
    const leaderboard = await socialService.getLeaderboardByFollowers(
      limitNum,
      offsetNum,
      filter === 'following' ? currentUserId : undefined
    );

    return res.status(200).json({
      success: true,
      data: leaderboard,
      count: leaderboard.length,
      limit: limitNum,
      offset: offsetNum,
      filter: filter || 'all',
    });
  } catch (error) {
    console.error('Error in leaderboard endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
