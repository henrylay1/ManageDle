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
   * Get all active games (in user's roster)
   */
  async getActiveGames(): Promise<Game[]> {
    const games = await this.getAll();
    return games.filter(g => g.isActive);
  }

  /**
   * Add a new game
   */
  async add(game: Omit<Game, 'gameId' | 'addedAt'>): Promise<Game> {
    const games = await this.getAll();
    
    const newGame: Game = {
      ...game,
      gameId: generateUUID(),
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

    const defaultGames = [
      // Academic
      {
        displayName: 'Wordle',
        url: 'https://www.nytimes.com/games/wordle/index.html',
        category: 'academic',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '📝',
      },
      {
        displayName: 'Connections',
        url: 'https://www.nytimes.com/games/connections',
        category: 'academic',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '🔗',
      },
      {
        displayName: 'Quordle',
        url: 'https://www.quordle.com/',
        category: 'academic',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '4️⃣',
      },
      {
        displayName: 'Worldle',
        url: 'https://worldle.teuteuf.fr/',
        category: 'academic',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '🌍',
      },
      {
        displayName: 'Nerdle',
        url: 'https://nerdlegame.com/',
        category: 'academic',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '🔢',
      },
      // Games
      {
        displayName: 'LoLdle',
        url: 'https://loldle.net/',
        category: 'games',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: false,
        icon: '😂',
        customData: { 
          hasMultipleShareTexts: true,
          defaultShareTexts: ['Classic', 'Quote', 'Ability', 'Emoji', 'Splash']
        },
      },
      {
        displayName: 'Pokedle',
        url: 'https://pokedle.net/',
        category: 'games',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '⚡',
        customData: {
          hasMultipleShareTexts: true,
          defaultShareTexts: ['Classic', 'Card', 'Description', 'Silhouette']
        },
      },
      {
        displayName: 'Pokedoku',
        url: 'https://pokedoku.com/',
        category: 'games',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: false,
        icon: '🔴',
      },
      // Misc
      {
        displayName: 'Colorfle',
        url: 'https://colorfle.com/',
        category: 'misc',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '🎨',
      },
      {
        displayName: 'Hexcodle',
        url: 'https://hexcodle.com/',
        category: 'misc',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '🔵',
      },
      {
        displayName: 'Colorguesser',
        url: 'https://colorguesser.com/',
        category: 'misc',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '🌈',
      },
      {
        displayName: 'Timingle',
        url: 'https://timingle.com/',
        category: 'misc',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '⏰',
      },
      {
        displayName: 'Spellcheck',
        url: 'https://spellcheckgame.com/',
        category: 'misc',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '✨',
      },
      {
        displayName: 'Scrandle',
        url: 'https://scrandle.com/',
        category: 'misc',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '🍔',
      },
      {
            displayName: 'r34dle',
            url: 'https://www.rule34dle.org/en/daily',
            category: 'misc',
            trackingType: 'manual' as const,
            isActive: false,
            isFailable: true,
            icon: '🦄',
          },
      {
        displayName: 'Angle',
        url: 'https://www.angle.wtf',
        category: 'misc',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '📐',
          },
      {
        displayName: 'Wantedle',
        url: 'https://www.wantedle.com',
        category: 'misc',
        trackingType: 'manual' as const,
        isActive: false,
        isFailable: true,
        icon: '🐡',
          },
      {
            displayName: 'Gamedle',
            url: 'https://gamedle.wtf',
            category: 'games',
            trackingType: 'manual' as const,
            isActive: false,
            isFailable: true,
            icon: '🕹️',
          },
      {
            displayName: 'Genshindle',
            url: 'https://genshindle.com',
            category: 'games',
            trackingType: 'manual' as const,
            isActive: false,
            isFailable: true,
            icon: '🎮',
          },
    ];

    // Only add games that don't already exist
    for (const game of defaultGames) {
      const exists = existingGames.some(g => g.displayName === game.displayName);
      if (!exists) {
        await this.add(game);
      }
    }
  }
}
