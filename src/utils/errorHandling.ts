/**
 * Centralized error handling utilities
 */

export type ErrorContext = 
  | 'Storage'
  | 'Auth'
  | 'Repository'
  | 'Service'
  | 'API'
  | 'UI';

interface ErrorLogOptions {
  showToUser?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Log an error with consistent formatting and context
 */
export function logError(
  error: unknown,
  context: ErrorContext,
  operation: string,
  options: ErrorLogOptions = {}
): void {
  const { metadata } = options;
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  console.error(
    `[${context}] Error in ${operation}:`,
    errorMessage,
    metadata ? `\nMetadata:` : '',
    metadata || '',
    errorStack ? `\nStack:` : '',
    errorStack || ''
  );
  
  // Future enhancement: Send to error tracking service (Sentry, etc.)
  // if (options.showToUser) {
  //   showUserNotification('error', errorMessage);
  // }
}

/**
 * Handle storage-related errors
 */
export function handleStorageError(
  error: unknown,
  operation: string,
  options?: ErrorLogOptions
): void {
  logError(error, 'Storage', operation, options);
}

/**
 * Handle authentication-related errors
 */
export function handleAuthError(
  error: unknown,
  operation: string,
  options?: ErrorLogOptions
): void {
  logError(error, 'Auth', operation, options);
}

/**
 * Handle repository-related errors
 */
export function handleRepositoryError(
  error: unknown,
  operation: string,
  options?: ErrorLogOptions
): void {
  logError(error, 'Repository', operation, options);
}

/**
 * Handle service-related errors
 */
export function handleServiceError(
  error: unknown,
  operation: string,
  options?: ErrorLogOptions
): void {
  logError(error, 'Service', operation, options);
}

/**
 * Handle API-related errors
 */
export function handleAPIError(
  error: unknown,
  operation: string,
  options?: ErrorLogOptions
): void {
  logError(error, 'API', operation, options);
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Check if error is a specific type
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('auth') || 
           error.message.includes('unauthorized') ||
           error.message.includes('not authenticated');
  }
  return false;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('network') ||
           error.message.includes('fetch') ||
           error.message.includes('connection');
  }
  return false;
}
