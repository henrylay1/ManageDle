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
    // Clear all user data
    await supabase.from('games').delete().eq('user_id', this.userId);
    await supabase.from('game_records').delete().eq('user_id', this.userId);
  }

  // ========== GAMES ==========

  async getGames(): Promise<Game[]> {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch games:', error);
      return [];
    }

    return (data || []).map(game => this.mapDbGameToGame(game));
  }

  async saveGames(games: Game[]): Promise<void> {
    if (!this.userId) {
      throw new Error('User must be authenticated to save games');
    }

    try {
      // Delete all existing games for this user
      const { error: deleteError } = await supabase
        .from('games')
        .delete()
        .eq('user_id', this.userId);

      if (deleteError) throw deleteError;

      // Insert all games
      const gamesToInsert = games.map(game => {
        // Extract category, url, etc. from the game object, NOT from customData
        const fullCustomData = {
          ...game.customData,
          url: game.url,
          category: game.category, // Use game.category directly
          trackingType: game.trackingType,
          isActive: game.isActive,
          isFailable: game.isFailable,
        };

        return {
          game_id: game.gameId,
          user_id: this.userId!,
          name: game.displayName,
          icon: game.icon,
          color: game.customData?.color || '#3B82F6',
          url: game.url, // Save to column
          category: game.category, // Save to column - use game.category directly!
          tracking_type: game.trackingType, // Save to column
          is_active: game.isActive, // Save to column
          is_failable: game.isFailable, // Save to column
          custom_data: fullCustomData,
        };
      });

      const { error: insertError } = await supabase
        .from('games')
        .insert(gamesToInsert);

      if (insertError) throw insertError;
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

    return (data || []).map(record => this.mapDbRecordToRecord(record));
  }

  async saveRecords(records: GameRecord[]): Promise<void> {
    // Delete existing records for this user
    const { error: deleteError } = await supabase
      .from('game_records')
      .delete()
      .eq('user_id', this.userId);
      
    if (deleteError) {
      console.error('[SupabaseAdapter] Failed to delete old records:', deleteError);
    }

    // Insert new records
    if (records.length > 0) {
      const dbRecords = records.map(record => ({
        record_id: record.recordId,
        user_id: this.userId,
        game_id: record.gameId,
        date: record.date,
        score: record.score ?? null,
        completed: record.completed,
        failed: record.failed,
        hard_mode: record.metadata?.hardMode || false,
        share_text: record.metadata?.shareText || null,
        metadata: record.metadata || null,
      }));

      const { error } = await supabase
        .from('game_records')
        .insert(dbRecords);

      if (error) {
        console.error('[SupabaseAdapter] Failed to insert records:', error);
        throw new Error(`Failed to save records: ${error.message}`);
      }
    }
  }

  // ========== MAPPING HELPERS ==========

  private mapDbGameToGame(dbGame: any): Game {
    // Try new schema first, fall back to custom_data if columns don't exist
    const storedCustomData = dbGame.custom_data || {};
    
    // Extract the actual customData (without our internal storage fields)
    const { url: _, category: __, trackingType: ___, isActive: ____, isFailable: _____, ...actualCustomData } = storedCustomData;
    
    return {
      gameId: dbGame.game_id,
      displayName: dbGame.name,
      url: dbGame.url || storedCustomData.url || '',
      category: dbGame.category || storedCustomData.category || 'custom',
      trackingType: dbGame.tracking_type || storedCustomData.trackingType || 'manual',
      isActive: dbGame.is_active !== undefined ? dbGame.is_active : (storedCustomData.isActive || false),
      isFailable: dbGame.is_failable !== undefined ? dbGame.is_failable : (storedCustomData.isFailable !== undefined ? storedCustomData.isFailable : true),
      addedAt: dbGame.created_at,
      icon: dbGame.icon || '',
      customData: Object.keys(actualCustomData).length > 0 ? actualCustomData : undefined,
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
      metadata: {
        hardMode: dbRecord.hard_mode,
        shareText: dbRecord.share_text,
        ...dbRecord.metadata,
      },
      createdAt: dbRecord.created_at,
      updatedAt: dbRecord.created_at,
    };
  }
}
