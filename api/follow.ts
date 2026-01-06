import { createClient } from '@supabase/supabase-js';
import { socialService } from '../src/services/socialService';
import { rateLimiter } from '../src/utils/rateLimiter';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
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

    // Check rate limit
    const rateLimitKey = `follow:${currentUserId}`;
    if (!rateLimiter.isAllowed(rateLimitKey)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    const { userId } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({ error: 'Missing required field: userId' });
    }

    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Follow user
    const result = await socialService.followUser(currentUserId, userId);

    if (!result.success) {
      return res.status(400).json({
        error: result.message,
        errorCode: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Error in follow endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
