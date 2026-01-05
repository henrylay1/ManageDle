/**
 * Secure wrapper around localStorage with basic obfuscation
 * Note: This provides basic obfuscation, not true encryption
 * For production with highly sensitive data, consider using a proper encryption library
 */
class SecureStorage {
  private prefix = 'managedle:secure:';
  
  /**
   * Simple obfuscation using Base64
   * This prevents casual inspection but is not cryptographically secure
   */
  private encode(value: string): string {
    try {
      return btoa(encodeURIComponent(value));
    } catch (error) {
      console.error('Failed to encode value:', error);
      return value;
    }
  }
  
  private decode(value: string): string {
    try {
      return decodeURIComponent(atob(value));
    } catch (error) {
      console.error('Failed to decode value:', error);
      return value;
    }
  }
  
  /**
   * Store an item in secure storage
   */
  setItem(key: string, value: string): void {
    try {
      const encoded = this.encode(value);
      window.localStorage.setItem(this.prefix + key, encoded);
    } catch (error) {
      console.error('Failed to save to secure storage:', error);
    }
  }
  
  /**
   * Retrieve an item from secure storage
   */
  getItem(key: string): string | null {
    try {
      const encoded = window.localStorage.getItem(this.prefix + key);
      if (!encoded) return null;
      return this.decode(encoded);
    } catch (error) {
      console.error('Failed to read from secure storage:', error);
      return null;
    }
  }
  
  /**
   * Remove an item from secure storage
   */
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error('Failed to remove from secure storage:', error);
    }
  }
  
  /**
   * Clear all secure storage items
   */
  clear(): void {
    try {
      const keys = Object.keys(window.localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          window.localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
    }
  }
  
  /**
   * Check if secure storage is available
   */
  isAvailable(): boolean {
    try {
      const testKey = this.prefix + '__test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
}

export const secureStorage = new SecureStorage();
