// Utility functions for working with dates and data

/**
 * Get today's date in YYYY-MM-DD format
 */
export const getTodayDate = (): string => {
  const now = new Date();
  // Get local date in YYYY-MM-DD format
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format a date string for display
 */
export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

/**
 * Generate a UUID v4
 */
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Get current ISO 8601 timestamp
 */
export const getTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Extract date part (YYYY-MM-DD) from ISO 8601 timestamp
 * @param isoString - ISO 8601 timestamp (e.g., "2024-01-15T12:30:00.000Z")
 * @returns Date part in YYYY-MM-DD format
 */
export const getDatePart = (isoString: string): string => {
  return isoString.slice(0, 10);
};

/**
 * Check if a date is today
 */
export const isToday = (dateStr: string): boolean => {
  return dateStr === getTodayDate();
};

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
export const getYesterdayDate = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDatePart(yesterday.toISOString());
};
