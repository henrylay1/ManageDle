/**
 * Simple client-side rate limiter to prevent abuse
 */
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  /**
   * Check if action is allowed
   * @param key - Unique key for the action (e.g., 'login', 'register')
   * @param maxAttempts - Maximum attempts allowed
   * @param windowMs - Time window in milliseconds
   */
  isAllowed(key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove attempts outside the time window
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
      return false;
    }
    
    // Add current attempt
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    
    return true;
  }
  
  /**
   * Reset attempts for a key
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }
  
  /**
   * Get remaining attempts for a key
   */
  getRemainingAttempts(key: string, maxAttempts: number = 5, windowMs: number = 60000): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    return Math.max(0, maxAttempts - recentAttempts.length);
  }
  
  /**
   * Get time until next attempt is allowed (in milliseconds)
   */
  getTimeUntilNextAttempt(key: string, maxAttempts: number = 5, windowMs: number = 60000): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length < maxAttempts) {
      return 0; // Can attempt now
    }
    
    // Find the oldest attempt in the window
    const oldestAttempt = Math.min(...recentAttempts);
    return Math.max(0, windowMs - (now - oldestAttempt));
  }
}

export const rateLimiter = new RateLimiter();
