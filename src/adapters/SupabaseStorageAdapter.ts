import { supabase } from '@/lib/supabase';
import type { IStorageAdapter } from '@/types/storage';
import type { Game, GameRecord } from '@/types/models';

/**
 * Supabase storage adapter for cloud data persistence
 */
export class SupabaseStorageAdapter implements IStorageAdapter {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // ========== REQUIRED BASE METHODS ==========

  async get<T>(_key: string): Promise<T | null> {
    // Not implemented for Supabase - use getGames/getRecords instead
    throw new Error('Method not implemented - use getGames() or getRecords()');
  }

  async set<T>(_key: string, _value: T): Promise<void> {
    // Not implemented for Supabase - use saveGames/saveRecords instead
    throw new Error('Method not implemented - use saveGames() or saveRecords()');
  }

  async remove(_key: string): Promise<void> {
    // Not implemented for Supabase
    throw new Error('Method not implemented');
  }

  async query<T>(_collection: string, _filter?: any): Promise<T[]> {
    // Not implemented for Supabase
    throw new Error('Method not implemented');
  }

  async getAll<T>(collection: string): Promise<T[]> {
    if (collection === 'games') {
      return (await this.getGames()) as unknown as T[];
    }
    if (collection === 'game_records' || collection === 'records') {
      const records = await this.getRecords();
      return records as unknown as T[];
    }
    return [];
  }

  async setAll<T>(collection: string, items: T[]): Promise<void> {
    if (collection === 'games') {
      await this.saveGames(items as unknown as Game[]);
    } else if (collection === 'game_records' || collection === 'records') {
      await this.saveRecords(items as unknown as GameRecord[]);
    }
  }

  async clear(): Promise<void> {
    // Clear all user data from Supabase
    await supabase.from('games').delete().eq('user_id', this.userId);
    await supabase.from('game_records').delete().eq('user_id', this.userId);
  }

  // ========== GAMES ==========

  async getGames(): Promise<Game[]> {
    // Fetch all games (global table, no user_id filter)
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: true });

    if (gamesError) {
      console.error('Failed to fetch games:', gamesError);
      return [];
    }

    let activeGames: string[] = [];
    if (this.userId !== 'guest') {
      // Fetch user's active games configuration
      const { data: configData, error: configError } = await supabase
        .from('user_profile_config')
        .select('active_games')
        .eq('user_id', this.userId)
        .single();

      if (configError) {
        console.error('Failed to fetch user profile config:', configError);
      }

      // Ensure activeGames is always an array (handles {} from SQL or null values)
      activeGames = configData?.active_games;
      if (!Array.isArray(activeGames)) {
        console.warn('[SupabaseAdapter] active_games is not an array, defaulting to []');
        activeGames = [];
      }
    }
    return (gamesData || []).map(game => this.mapDbGameToGame(game, activeGames));
  }

  async saveGames(games: Game[]): Promise<void> {
    try {
      // Upsert games (insert or update by primary key)
      const gamesToUpsert = games.map(game => {
        return {
          game_id: game.gameId,
          name: game.displayName,
          icon: game.icon,
          url: game.url,
          category: game.category,
          tracking_type: game.trackingType,
          is_failable: game.isFailable,
        };
      });

      const { error: upsertError } = await supabase
        .from('games')
        .upsert(gamesToUpsert, { onConflict: 'game_id' });

      if (upsertError) throw upsertError;
    } catch (error) {
      console.error('[SupabaseAdapter] Error saving games:', error);
      throw new Error(`Failed to save games: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ========== RECORDS ==========

  async getRecords(): Promise<GameRecord[]> {
    const { data, error } = await supabase
      .from('game_records')
      .select('*')
      .eq('user_id', this.userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Failed to fetch records:', error);
      return [];
    }
    
    const mappedRecords = (data || []).map(record => this.mapDbRecordToRecord(record));


    return mappedRecords;
  }

  async saveRecords(records: GameRecord[]): Promise<void> {
    // Upsert only the provided records (single or multiple), do not touch others
    if (records.length > 0) {
      for (const record of records) {
        // Extract main share text if available
        let mainShareText = null;
        let cleanedMetadata = record.metadata ? { ...record.metadata } : null;
        if (cleanedMetadata && Array.isArray(cleanedMetadata.shareTexts) && cleanedMetadata.shareTexts.length > 0) {
          mainShareText = cleanedMetadata.shareTexts[0].shareText || null;
          // Remove shareText from each entry
          cleanedMetadata.shareTexts = cleanedMetadata.shareTexts.map(({ shareText, ...rest }) => rest);
        }
        // Build dbRecord, omitting share_text if mainShareText is null or undefined
        const dbRecord: any = {
          record_id: record.recordId,
          user_id: this.userId,
          game_id: record.gameId,
          date: record.date,
          score: record.score ?? null,
          completed: record.completed,
          failed: record.failed,
          metadata: cleanedMetadata && Object.keys(cleanedMetadata).length > 0 ? cleanedMetadata : null,
        };
        if (mainShareText !== null && mainShareText !== undefined) {
          dbRecord.share_text = mainShareText;
        }
        const { error } = await supabase
          .from('game_records')
          .upsert([dbRecord], { onConflict: 'record_id' });
        if (error) {
          console.error('[SupabaseAdapter] Failed to upsert record:', error);
          throw new Error(`Failed to save record: ${error.message}`);
        }
      }
    }
  }

  // ========== MAPPING HELPERS ==========

  private mapDbGameToGame(dbGame: any, activeGames?: string[]): Game {
    // Determine isActive: if game_id is in the activeGames array, it's active
    const isActive = activeGames 
      ? activeGames.includes(dbGame.game_id)
      : false;
    
    return {
      gameId: dbGame.game_id,
      displayName: dbGame.name,
      url: dbGame.url || '',
      category: dbGame.category || 'custom',
      trackingType: dbGame.tracking_type || 'manual',
      isActive,
      isFailable: dbGame.is_failable !== undefined ? dbGame.is_failable : true,
      addedAt: dbGame.created_at,
      icon: dbGame.icon || '',
      customData: dbGame.custom_data || undefined,
    };
  }

  private mapDbRecordToRecord(dbRecord: any): GameRecord {
    return {
      recordId: dbRecord.record_id,
      gameId: dbRecord.game_id,
      localId: this.userId,
      userId: this.userId,
      date: dbRecord.date,
      score: dbRecord.score,
      completed: dbRecord.completed,
      failed: dbRecord.failed,
      metadata: dbRecord.metadata || undefined,
      createdAt: dbRecord.created_at,
      updatedAt: dbRecord.created_at,
    };
  }
}
