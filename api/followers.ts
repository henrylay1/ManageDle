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
    const { userId, limit = '50', offset = '0' } = req.query;

    // Validate input
    if (!userId) {
      return res.status(400).json({ error: 'Missing required parameter: userId' });
    }

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    // Rate limit by IP (public endpoint, limit per IP)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `followers:${clientIp}`;
    if (!rateLimiter.isAllowed(rateLimitKey)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    // Get followers list
    const followers = await socialService.getFollowersList(userId, limitNum, offsetNum);

    return res.status(200).json({
      success: true,
      data: followers,
      count: followers.length,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error('Error in followers endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
