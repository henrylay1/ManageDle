import { Game } from '@/types/models';
import { IStorageAdapter } from '@/types/storage';
import { generateUUID, getTimestamp } from '@/utils/helpers';

const COLLECTION_NAME = 'games';

/**
 * Repository for managing games
 */
export class GameRepository {
  constructor(private storage: IStorageAdapter) {}

  async getAll(): Promise<Game[]> {
    const games = await this.storage.getAll<Game>(COLLECTION_NAME);
    
    // Migrate old categories to new ones
    const needsMigration = games.some(g => 
      !['academic', 'games', 'misc', 'custom'].includes(g.category)
    );
    
    if (needsMigration) {
      const migratedGames = games.map(game => {
        const oldCategory = game.category;
        let newCategory = 'academic';
        
        if (['word', 'number', 'geography', 'trivia', 'logic'].includes(oldCategory)) {
          newCategory = 'academic';
        } else if (oldCategory === 'other') {
          newCategory = 'custom';
        }
        
        return { ...game, category: newCategory };
      });
      
      await this.storage.setAll(COLLECTION_NAME, migratedGames);
      return migratedGames;
    }
    
    return games;
  }

  /**
   * Get a single game by ID
   */
  async getById(gameId: string): Promise<Game | null> {
    const games = await this.getAll();
    return games.find(g => g.gameId === gameId) || null;
  }

  /**
   * Add a new game
   */
  async add(game: Omit<Game, 'gameId' | 'addedAt'> | Game): Promise<Game> {
    const games = await this.getAll();
    
    const newGame: Game = {
      ...game,
      gameId: ('gameId' in game && game.gameId) ? game.gameId : generateUUID(),
      addedAt: getTimestamp(),
    };

    games.push(newGame);
    await this.storage.setAll(COLLECTION_NAME, games);
    
    return newGame;
  }

  /**
   * Update an existing game
   */
  async update(gameId: string, updates: Partial<Game>): Promise<Game | null> {
    const games = await this.getAll();
    const index = games.findIndex(g => g.gameId === gameId);
    
    if (index === -1) {
      return null;
    }

    games[index] = { ...games[index], ...updates };
    await this.storage.setAll(COLLECTION_NAME, games);
    
    return games[index];
  }

  /**
   * Delete a game
   */
  async delete(gameId: string): Promise<boolean> {
    const games = await this.getAll();
    const filtered = games.filter(g => g.gameId !== gameId);
    
    if (filtered.length === games.length) {
      return false; // Game not found
    }

    await this.storage.setAll(COLLECTION_NAME, filtered);
    return true;
  }

  /**
   * Toggle a game's active status
   */
  async toggleActive(gameId: string): Promise<Game | null> {
    const game = await this.getById(gameId);
    if (!game) {
      return null;
    }
    
    return this.update(gameId, { isActive: !game.isActive });
  }

  /**
   * Add default games (for first-time setup)
   * Fetches games from the database to ensure consistent game_ids everywhere
   */
  async addDefaultGames(): Promise<void> {
    const existingGames = await this.getAll();
    
    // Remove old individual LoLdle games if they exist
    const oldLoldleGames = existingGames.filter(g => 
      g.displayName.startsWith('LoLdle -')
    );
    for (const oldGame of oldLoldleGames) {
      await this.delete(oldGame.gameId);
    }

    // If using Supabase storage, games are already fetched from database via getAll()
    // For local storage, we need to fetch from database to get the correct game_ids
    if (existingGames.length === 0) {
      // Fetch games from database to get their game_ids
      const { supabase } = await import('@/lib/supabase');
      const { data: dbGames, error } = await supabase
        .from('games')
        .select('*');
      
      if (error) {
        console.error('Failed to fetch games from database:', error);
        return;
      }
      
      if (dbGames && dbGames.length > 0) {
        // Store games locally with the database game_ids
        const gamesToAdd: Game[] = dbGames.map(dbGame => ({
          gameId: dbGame.game_id,
          displayName: dbGame.name,
          url: dbGame.url,
          category: dbGame.category,
          trackingType: dbGame.tracking_type,
          isActive: false, // Default to inactive for new users
          isFailable: dbGame.is_failable,
          icon: dbGame.icon,
          customData: dbGame.custom_data || undefined,
          addedAt: new Date().toISOString(),
          resetTime: dbGame.reset_time || '00:00',
          isAsynchronous: dbGame.is_asynchronous ?? false,
          scoreTypes: dbGame.score_types || { puzzle1: { attempts: 6 } },
        }));
        
        await this.storage.setAll('games', gamesToAdd);
      }
    }
  }
}
