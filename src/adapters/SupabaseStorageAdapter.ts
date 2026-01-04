import { supabase } from '@/lib/supabase';
import type { IStorageAdapter } from '@/types/storage';
import type { Game, GameRecord } from '@/types/models';

/**
 * Supabase storage adapter for cloud data persistence
 */
export class SupabaseStorageAdapter implements IStorageAdapter {
    async deleteRecord(recordId: string): Promise<boolean> {
      const { error } = await supabase
        .from('game_records')
        .delete()
        .eq('record_id', recordId);
      if (error) {
        console.error('[SupabaseAdapter] Failed to delete record:', error);
        return false;
      }
      return true;
    }
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
          reset_time: game.resetTime || '00:00',
          is_asynchronous: game.isAsynchronous ?? false,
          score_types: game.scoreTypes,
          description: game.description || null,
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
      .order('created_at', { ascending: false });

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
        // Defensive: strip any legacy top-level `completed` flag that may exist
        // on incoming records (older versions persisted this). Supabase will
        // reject unknown top-level columns if they are not present in the
        // remote schema cache, so remove it before building the db payload.
        const incoming = { ...(record as any) };
        if ('completed' in incoming) delete incoming.completed;
        // Extract share texts as JSON object with puzzle names as keys (excluding SUMMARY)
        let shareTextJson: Record<string, string> | null = null;
        let cleanedMetadata = incoming.metadata ? { ...incoming.metadata } : null;
        if (cleanedMetadata && Array.isArray(cleanedMetadata.shareTexts) && cleanedMetadata.shareTexts.length > 0) {
          shareTextJson = {};
          cleanedMetadata.shareTexts.forEach((entry: any) => {
            // Include all share texts, including SUMMARY
            if (entry.shareText) {
              shareTextJson![entry.name] = entry.shareText;
            }
          });
          // If no share texts were added, set to null
          if (Object.keys(shareTextJson).length === 0) {
            shareTextJson = null;
          }
          // Remove shareText, internal `scores`, `maxAttempts`, and legacy `completed` from each entry in metadata
          cleanedMetadata.shareTexts = cleanedMetadata.shareTexts.map(({ shareText, scores, maxAttempts, ...rest }: any) => rest);
        }
        // Build dbRecord, omitting share_text if shareTextJson is null
        const dbRecord: any = {
          record_id: incoming.recordId,
          user_id: this.userId,
          game_id: incoming.gameId,
          created_at: incoming.createdAt,
          scores: incoming.scores ?? null,
          // NOTE: `completed` column removed - presence of a record indicates it was played
          failed: incoming.failed,
          metadata: cleanedMetadata && Object.keys(cleanedMetadata).length > 0 ? cleanedMetadata : null,
        };
        if (shareTextJson !== null) {
          dbRecord.share_text = shareTextJson;
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
      description: dbGame.description || undefined,
      customData: dbGame.custom_data || undefined,
      resetTime: dbGame.reset_time || '00:00',
      isAsynchronous: dbGame.is_asynchronous ?? false,
      scoreTypes: dbGame.score_types || {},
      scoreDistributionConfig: dbGame.score_distribution_config || undefined,
    };
  }

  private mapDbRecordToRecord(dbRecord: any): GameRecord {
    // Restore share_text from database back into metadata.shareTexts
    let metadata = dbRecord.metadata ? { ...dbRecord.metadata } : undefined;
    
    // If share_text exists in DB, restore it to the corresponding shareTexts entries
    if (dbRecord.share_text && metadata && Array.isArray(metadata.shareTexts) && metadata.shareTexts.length > 0) {
      // share_text is now a JSON object with puzzle names as keys
      const shareTextJson = typeof dbRecord.share_text === 'string' 
        ? { puzzle1: dbRecord.share_text } // Legacy: single string becomes puzzle1
        : dbRecord.share_text;
      
      metadata.shareTexts = metadata.shareTexts.map((entry: any) => {
        const shareText = shareTextJson[entry.name];
        if (shareText) {
          return { ...entry, shareText };
        }
        return entry;
      });
    }
    
    return {
      recordId: dbRecord.record_id,
      gameId: dbRecord.game_id,
      localId: this.userId,
      userId: this.userId,
      scores: dbRecord.scores ?? undefined,
      // completed removed from DB mapping
      failed: dbRecord.failed,
      metadata: metadata,
      createdAt: dbRecord.created_at,
      updatedAt: dbRecord.created_at,
    };
  }
}
