import { UserIdentity } from '@/types/models';
import { IStorageAdapter } from '@/types/storage';
import { generateUUID, getTimestamp } from '@/utils/helpers';

const USER_KEY = 'user:identity';

/**
 * Repository for managing user identity
 */
export class UserRepository {
  constructor(private storage: IStorageAdapter) {}

  /**
   * Get or create user identity
   */
  async getOrCreate(): Promise<UserIdentity> {
    let user = await this.storage.get<UserIdentity>(USER_KEY);
    
    if (!user) {
      user = {
        localId: generateUUID(),
        createdAt: getTimestamp(),
      };
      await this.storage.set(USER_KEY, user);
    }
    
    return user;
  }

  /**
   * Get user identity
   */
  async get(): Promise<UserIdentity | null> {
    return this.storage.get<UserIdentity>(USER_KEY);
  }

  /**
   * Update user identity
   */
  async update(updates: Partial<UserIdentity>): Promise<UserIdentity> {
    const user = await this.getOrCreate();
    const updated = { ...user, ...updates };
    await this.storage.set(USER_KEY, updated);
    return updated;
  }
}
