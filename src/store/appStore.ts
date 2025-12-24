import { create } from 'zustand';
import { Game, GameRecord, UserIdentity, GameStats } from '@/types/models';
import { LocalStorageAdapter } from '@/storage/LocalStorageAdapter';
import { SupabaseStorageAdapter } from '@/adapters/SupabaseStorageAdapter';
import { GameRepository } from '@/repositories/GameRepository';
import { RecordRepository } from '@/repositories/RecordRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { StatsService } from '@/services/StatsService';
import { authService, type AuthUser } from '@/services/authService';
import { supabase } from '@/lib/supabase';
import type { IStorageAdapter } from '@/types/storage';

// Initialize local storage (only for user and records, NOT games)
const localStorage = new LocalStorageAdapter('managedle');
const userRepo = new UserRepository(localStorage);

// Game repository always uses database
let gameRepo = new GameRepository(new SupabaseStorageAdapter('guest'));

/**
 * Merge locally cached game records into user's Supabase records
 */
async function mergeLocalRecordsIntoUserAccount(userId: string): Promise<void> {
  try {
    // Get locally cached records
    const localRecordsData = window.localStorage.getItem('managedle:records');
    const localRecords: GameRecord[] = localRecordsData ? JSON.parse(localRecordsData) : [];
    
    if (localRecords.length === 0) return; // Nothing to merge
    
    // Get user's current records from Supabase
    const { data: existingRecords, error: fetchError } = await supabase
      .from('game_records')
      .select('*')
      .eq('user_id', userId);
    
    if (fetchError) {
      console.error('Failed to fetch existing records:', fetchError);
      return;
    }
    
    // Create a map of existing records by (game_id, date) for deduplication
    const existingRecordsMap = new Map<string, any>();
    (existingRecords || []).forEach(record => {
      const key = `${record.game_id}:${record.date}`;
      existingRecordsMap.set(key, record);
    });
    
    // Filter out records that already exist
    const newRecords = localRecords.filter(record => {
      const key = `${record.gameId}:${record.date}`;
      return !existingRecordsMap.has(key);
    });
    
    if (newRecords.length === 0) {
      return;
    }
    
    // Get active game IDs from local records to merge into user_profile_config
    const localActiveGameIds = Array.from(new Set(localRecords.map(r => r.gameId)));
    
    if (localActiveGameIds.length > 0) {
      const { data: configData } = await supabase
        .from('user_profile_config')
        .select('active_games')
        .eq('user_id', userId)
        .single();
      
      const currentActiveGames = (configData?.active_games as string[]) || [];
      const mergedActiveGames = Array.from(new Set([...currentActiveGames, ...localActiveGameIds]));
      
      await supabase
        .from('user_profile_config')
        .update({ active_games: mergedActiveGames })
        .eq('user_id', userId);
    }
    
    // Transform and insert new records
    const dbRecords = newRecords.map(record => ({
      record_id: record.recordId,
      user_id: userId,
      game_id: record.gameId,
      date: record.date,
      scores: record.scores ?? null,
      completed: record.completed,
      failed: record.failed,
      share_text: (() => {
        if (record.metadata && Array.isArray(record.metadata.shareTexts) && record.metadata.shareTexts.length > 0) {
          return record.metadata.shareTexts[0].shareText || null;
        }
        return null;
      })(),
      metadata: (() => {
        if (!record.metadata) return null;
        const cleaned = { ...record.metadata };
        if (Array.isArray(cleaned.shareTexts)) {
          cleaned.shareTexts = cleaned.shareTexts.map(({ shareText, ...rest }) => rest);
        }
        return Object.keys(cleaned).length > 0 ? cleaned : null;
      })(),
    }));
    
    const { error: insertError } = await supabase
      .from('game_records')
      .insert(dbRecords);
    
    if (insertError) {
      console.error('Failed to merge local records:', insertError);
    } else {
      // Successfully merged - clear the local record cache
      window.localStorage.removeItem('managedle:records');
    }
  } catch (error) {
    console.error('Error merging local records into user account:', error);
  }
}

// Current storage adapter for records (switches between localStorage and Supabase)
let currentStorage: IStorageAdapter = localStorage;

interface AppState {
  // User & Auth
  user: UserIdentity | null;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  
  // Games (always from database)
  games: Game[];
  activeGames: Game[];
  
  // Records
  todayRecords: GameRecord[];
  
  // Stats
  statsCache: Map<string, GameStats>;
  
  // Loading states
  isLoading: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  
  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string, avatarUrl?: string) => Promise<void>;
  
  // Game actions
  addGame: (game: Omit<Game, 'gameId' | 'addedAt'>) => Promise<void>;
  updateGame: (gameId: string, updates: Partial<Game>) => Promise<void>;
  deleteGame: (gameId: string) => Promise<void>;
  toggleGameActive: (gameId: string) => Promise<void>;
  
  // Record actions
  addRecord: (record: Omit<GameRecord, 'recordId' | 'localId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateRecord: (recordId: string, updates: Partial<GameRecord>) => Promise<void>;
  deleteRecord: (recordId: string) => Promise<void>;
  loadTodayRecords: () => Promise<void>;
  
  // Stats actions
  getStats: (gameId: string) => Promise<GameStats>;
  refreshStats: (gameId: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authUser: null,
  isAuthenticated: false,
  games: [],
  activeGames: [],
  todayRecords: [],
  statsCache: new Map(),
  isLoading: true,

  initialize: async () => {
    set({ isLoading: true });
    
    try {
      // Check if user is already authenticated with Supabase
      if (authService.isConfigured()) {
        const authUser = await authService.getCurrentUser();
        
        if (authUser) {
          // User is logged in - use Supabase storage for records
          currentStorage = new SupabaseStorageAdapter(authUser.id);
          
          // Initialize repositories
          gameRepo = new GameRepository(new SupabaseStorageAdapter(authUser.id));
          const recordRepo = new RecordRepository(currentStorage, authUser.id);
          
          // Load games from database (global)
          const games = await gameRepo.getAll();
          const activeGames = games.filter(g => g.isActive);
          const todayRecords = await recordRepo.getTodayRecords(games);
          
          set({
            authUser,
            isAuthenticated: true,
            user: { localId: authUser.id, createdAt: new Date().toISOString() },
            games,
            activeGames,
            todayRecords,
            isLoading: false,
          });
          return;
        }
      }
      
      // No authenticated user - guest mode (local records, global games)
      currentStorage = localStorage;
      const user = await userRepo.getOrCreate();
      
      // Initialize repositories (games still from database)
      gameRepo = new GameRepository(new SupabaseStorageAdapter('guest'));
      const recordRepo = new RecordRepository(localStorage, user.localId);
      
      // Load games from database (global)
      let games = await gameRepo.getAll();
      
      // Try to load active game IDs from localStorage
      const storedActiveGames = window.localStorage.getItem('managedle:active_games');
      let activeGameIds: string[] = [];
      
      if (storedActiveGames) {
        activeGameIds = JSON.parse(storedActiveGames);
      } else {
        // For first-time guest users, no games are active yet
        activeGameIds = [];
        window.localStorage.setItem('managedle:active_games', JSON.stringify(activeGameIds));
      }
      
      // Update games with correct isActive based on stored IDs
      games = games.map(g => ({
        ...g,
        isActive: activeGameIds.includes(g.gameId)
      }));
      
      const activeGames = games.filter(g => g.isActive);

      // Load today's records from localStorage
      const todayRecords = await recordRepo.getTodayRecords(games);

      set({
        user,
        authUser: null,
        isAuthenticated: false,
        games,
        activeGames,
        todayRecords,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error initializing app:', error);
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    try {
      const authUser = await authService.login(email, password);
      
      // Merge locally cached records into user's account (includes active games)
      await mergeLocalRecordsIntoUserAccount(authUser.id);
      
      // Switch to Supabase storage for records
      currentStorage = new SupabaseStorageAdapter(authUser.id);
      gameRepo = new GameRepository(new SupabaseStorageAdapter(authUser.id));
      const recordRepo = new RecordRepository(currentStorage, authUser.id);
      
      // Load games from database (global)
      const games = await gameRepo.getAll();
      const activeGames = games.filter(g => g.isActive);
      const todayRecords = await recordRepo.getTodayRecords(games);
      
      set({
        authUser,
        isAuthenticated: true,
        user: { localId: authUser.id, createdAt: new Date().toISOString() },
        games,
        activeGames,
        todayRecords,
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  register: async (email, password, displayName) => {
    try {
      const authUser = await authService.register(email, password, displayName);
      
      // Check if we have an active session (email confirmation might be required)
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Email confirmation required - show message and don't migrate data yet
        set({
          authUser: null,
          isAuthenticated: false,
          user: null,
        });
        throw new Error('Please check your email to confirm your account before logging in.');
      }
      
      // Set authUser in state
      set({
        authUser,
        isAuthenticated: true,
        user: { localId: authUser.id, createdAt: new Date().toISOString() },
      });
      
      // Ensure user profile exists in public.users table
      // Set default avatar_url in users table
      let supabaseUrl = '';
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) {
        supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      }
      let projectRef = '';
      try {
        const match = supabaseUrl.match(/^https:\/\/(.+?)\.supabase\.co/);
        if (match) projectRef = match[1];
      } catch {}
      const defaultAvatarUrl =
        'https://' +
        projectRef +
        '.supabase.co/storage/v1/object/public/profile-pictures/def_pfp_cat_1.jpg';

      const { error: profileCheckError } = await supabase
        .from('users')
        .upsert({
          id: authUser.id,
          email: authUser.email,
          display_name: authUser.displayName || email.split('@')[0],
          avatar_url: defaultAvatarUrl,
        }, {
          onConflict: 'id'
        });
      
      if (profileCheckError) {
        console.error('Failed to ensure user profile exists:', profileCheckError);
      }

      // Ensure user_profile_config exists for new user
      const { error: configCheckError } = await supabase
        .from('user_profile_config')
        .upsert({
          user_id: authUser.id,
          display_name: authUser.displayName || email.split('@')[0],
          theme: 'light',
          notifications_enabled: true,
          active_games: [],
        }, {
          onConflict: 'user_id'
        });
      if (configCheckError) {
        console.error('Failed to ensure user_profile_config exists:', configCheckError);
      }
      
      // Merge locally cached records into user's account (includes active games)
      await mergeLocalRecordsIntoUserAccount(authUser.id);
      
      // Switch to Supabase storage for records
      currentStorage = new SupabaseStorageAdapter(authUser.id);
      gameRepo = new GameRepository(new SupabaseStorageAdapter(authUser.id));
      const recordRepo = new RecordRepository(currentStorage, authUser.id);
      
      // Load games from database and today's records
      const games = await gameRepo.getAll();
      const activeGames = games.filter(g => g.isActive);
      const todayRecords = await recordRepo.getTodayRecords(games);
      
      set({ games, activeGames, todayRecords });
    } catch (error) {
      console.error('Failed to register:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await authService.logout();

      // Clear only records from localStorage (NOT games - they're in database)
      window.localStorage.removeItem('managedle:records');
      window.localStorage.removeItem('managedle:user');
      window.localStorage.removeItem('managedle:active_games');

      // Reset in-memory cache/state
      set({
        user: null,
        authUser: null,
        isAuthenticated: false,
        games: [],
        activeGames: [],
        todayRecords: [],
        statsCache: new Map(),
        isLoading: false,
      });

      // Switch back to local storage for records
      currentStorage = localStorage;
      gameRepo = new GameRepository(new SupabaseStorageAdapter('guest'));

      // Re-initialize with guest mode

      // Re-initialize with local storage (will repopulate guest view)
      await get().initialize();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  },

  updateProfile: async (displayName: string, avatarUrl?: string) => {
    try {
      const { authUser } = get();
      if (!authUser) {
        throw new Error('No authenticated user');
      }
      
      await authService.updateProfile(displayName, avatarUrl);
      
      // Update the authUser in state
      set({
        authUser: {
          ...authUser,
          displayName,
          avatarUrl: avatarUrl || authUser.avatarUrl,
        },
      });
      
    } catch (error) {
      console.error('Failed to migrate data:', error);
      throw error;
    }
  },

  addGame: async (game) => {
    // Optimistic update
    const { games } = get();
    const newGames = [...games, game];
    const activeGames = newGames.filter(g => g.isActive);
    set({ games: newGames as Game[], activeGames: activeGames as Game[] });

    // Save to database in background
    try {
      await gameRepo.add(game);
    } catch (error) {
      // Revert on error
      const refreshedGames = await gameRepo.getAll();
      set({ games: refreshedGames, activeGames: refreshedGames.filter(g => g.isActive) });
      throw error;
    }
  },

  updateGame: async (gameId, updates) => {
    // Optimistic update
    const { games } = get();
    const newGames = games.map(g => g.gameId === gameId ? { ...g, ...updates } : g);
    const activeGames = newGames.filter(g => g.isActive);
    set({ games: newGames, activeGames });

    // Save to database in background
    try {
      await gameRepo.update(gameId, updates);
    } catch (error) {
      // Revert on error
      const refreshedGames = await gameRepo.getAll();
      set({ games: refreshedGames, activeGames: refreshedGames.filter(g => g.isActive) });
      throw error;
    }
  },

  deleteGame: async (gameId) => {
    // Optimistic update
    const { games } = get();
    const newGames = games.filter(g => g.gameId !== gameId);
    const activeGames = newGames.filter(g => g.isActive);
    set({ games: newGames, activeGames });

    // Save to database in background
    try {
      await gameRepo.delete(gameId);
    } catch (error) {
      // Revert on error
      const refreshedGames = await gameRepo.getAll();
      set({ games: refreshedGames, activeGames: refreshedGames.filter(g => g.isActive) });
      throw error;
    }
  },

  toggleGameActive: async (gameId) => {
    // Optimistic update
    const { games, authUser, isAuthenticated } = get();
    const newGames = games.map(g => 
      g.gameId === gameId ? { ...g, isActive: !g.isActive } : g
    );
    const activeGames = newGames.filter(g => g.isActive);
    set({ games: newGames, activeGames });

    // Save to database in background
    try {
      // If user is logged in, update user_profile_config.active_games
      if (isAuthenticated && authUser) {
        const gameToToggle = newGames.find(g => g.gameId === gameId);
        const isNowActive = gameToToggle?.isActive ?? false;

        // Get current active_games from user_profile_config
        const { data: configData } = await supabase
          .from('user_profile_config')
          .select('active_games')
          .eq('user_id', authUser.id)
          .single();

        const currentActiveGames = (configData?.active_games as string[]) || [];
        
        // Update the active_games set
        let updatedActiveGames: string[];
        if (isNowActive) {
          // Add to set if not already present
          updatedActiveGames = Array.from(new Set([...currentActiveGames, gameId]));
        } else {
          // Remove from set
          updatedActiveGames = currentActiveGames.filter(id => id !== gameId);
        }

        // Update user_profile_config
        await supabase
          .from('user_profile_config')
          .update({ active_games: updatedActiveGames })
          .eq('user_id', authUser.id);
      } else {
        // Guest user: update localStorage directly
        const activeGameIds = activeGames.map(g => g.gameId);
        window.localStorage.setItem('managedle:active_games', JSON.stringify(activeGameIds));
      }
    } catch (error) {
      // Revert on error
      const refreshedGames = await gameRepo.getAll();
      set({ games: refreshedGames, activeGames: refreshedGames.filter(g => g.isActive) });
      throw error;
    }
  },

  addRecord: async (record) => {
    const { user, isAuthenticated, authUser } = get();
    if (!user) return;
    
    const userId = isAuthenticated && authUser ? authUser.id : user.localId;
    const recordRepo = new RecordRepository(currentStorage, userId);
    await recordRepo.add(record);
    
    // Reload today's records
    const games = get().games;
    const todayRecords = await recordRepo.getTodayRecords(games);
    set({ todayRecords });
    
    // Invalidate stats cache for this game
    const statsCache = new Map(get().statsCache);
    statsCache.delete(record.gameId);
    set({ statsCache });
  },

  updateRecord: async (recordId, updates) => {
    const { user, isAuthenticated, authUser } = get();
    if (!user) return;
    
    const userId = isAuthenticated && authUser ? authUser.id : user.localId;
    const recordRepo = new RecordRepository(currentStorage, userId);
    const updatedRecord = await recordRepo.update(recordId, updates);
    
    if (updatedRecord) {
      // Reload today's records
      const games = get().games;
      const todayRecords = await recordRepo.getTodayRecords(games);
      set({ todayRecords });
      
      // Invalidate stats cache for this game
      const statsCache = new Map(get().statsCache);
      statsCache.delete(updatedRecord.gameId);
      set({ statsCache });
    }
  },

  deleteRecord: async (recordId) => {
    const { user, isAuthenticated, authUser } = get();
    if (!user) return;

    const userId = isAuthenticated && authUser ? authUser.id : user.localId;
    const recordRepo = new RecordRepository(currentStorage, userId);

    // Get the record before deleting to know which game's stats to invalidate
    const allRecords = await recordRepo.getAll();
    const recordToDelete = allRecords.find(r => r.recordId === recordId);

    // Delete from current storage adapter (handles both local and Supabase)
    const success = await recordRepo.delete(recordId);

    if (success) {
      // Reload today's records
      const games = get().games;
      const todayRecords = await recordRepo.getTodayRecords(games);
      set({ todayRecords });

      // Invalidate stats cache for this game
      if (recordToDelete) {
        const statsCache = new Map(get().statsCache);
        statsCache.delete(recordToDelete.gameId);
        set({ statsCache });
      }
    }
  },

  loadTodayRecords: async () => {
    const { user, isAuthenticated, authUser } = get();
    if (!user) return;
    
    const userId = isAuthenticated && authUser ? authUser.id : user.localId;
    const recordRepo = new RecordRepository(currentStorage, userId);
    const games = get().games;
    const todayRecords = await recordRepo.getTodayRecords(games);
    set({ todayRecords });
  },

  getStats: async (gameId) => {
    const { user, isAuthenticated, authUser, statsCache } = get();
    if (!user) {
      throw new Error('User not initialized');
    }
    
    // Check cache first
    if (statsCache.has(gameId)) {
      return statsCache.get(gameId)!;
    }
    
    // Compute stats
    const userId = isAuthenticated && authUser ? authUser.id : user.localId;
    const recordRepo = new RecordRepository(currentStorage, userId);
    const statsService = new StatsService(recordRepo, userId);
    const stats = await statsService.computeStats(gameId);
    
    // Cache the result
    const newCache = new Map(statsCache);
    newCache.set(gameId, stats);
    set({ statsCache: newCache });
    
    return stats;
  },

  refreshStats: async (gameId) => {
    const { user, isAuthenticated, authUser } = get();
    if (!user) return;
    
    const userId = isAuthenticated && authUser ? authUser.id : user.localId;
    const recordRepo = new RecordRepository(currentStorage, userId);
    const statsService = new StatsService(recordRepo, userId);
    const stats = await statsService.computeStats(gameId);
    
    const statsCache = new Map(get().statsCache);
    statsCache.set(gameId, stats);
    set({ statsCache });
  },
}));
