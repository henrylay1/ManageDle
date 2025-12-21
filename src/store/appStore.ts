import { create } from 'zustand';
import { Game, GameRecord, UserIdentity, GameStats } from '@/types/models';
import { LocalStorageAdapter } from '@/storage/LocalStorageAdapter';
import { SupabaseStorageAdapter } from '@/adapters/SupabaseStorageAdapter';
import { GameRepository } from '@/repositories/GameRepository';
import { RecordRepository } from '@/repositories/RecordRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { StatsService } from '@/services/StatsService';
import { authService, type AuthUser } from '@/services/authService';
import type { IStorageAdapter } from '@/types/storage';

// Initialize local storage (always available)
const localStorage = new LocalStorageAdapter('managedle');
const userRepo = new UserRepository(localStorage);
let gameRepo = new GameRepository(localStorage);

// Current storage adapter (starts as localStorage, switches to Supabase when user logs in)
let currentStorage: IStorageAdapter = localStorage;

interface AppState {
  // User & Auth
  user: UserIdentity | null;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  
  // Games
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
  migrateLocalDataToCloud: () => Promise<void>;
  
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
          // User is logged in - use Supabase storage
          currentStorage = new SupabaseStorageAdapter(authUser.id);
          
          // Initialize repositories with Supabase storage
          gameRepo = new GameRepository(currentStorage);
          const recordRepo = new RecordRepository(currentStorage, authUser.id);
          
          // Load data from Supabase
          // Add default games if user has none
          await gameRepo.addDefaultGames();
          const games = await gameRepo.getAll();
          const activeGames = games.filter(g => g.isActive);
          const todayRecords = await recordRepo.getTodayRecords();
          
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
      
      // No authenticated user - use local storage (guest mode)
      currentStorage = localStorage;
      const user = await userRepo.getOrCreate();
      
      // Initialize repositories with local storage
      gameRepo = new GameRepository(localStorage);
      const recordRepo = new RecordRepository(localStorage, user.localId);
      
      // Add default games if none exist
      await gameRepo.addDefaultGames();
      
      // Load games
      const games = await gameRepo.getAll();
      const activeGames = games.filter(g => g.isActive);
      
      // Load today's records
      const todayRecords = await recordRepo.getTodayRecords();
      
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
      
      // Switch to Supabase storage
      currentStorage = new SupabaseStorageAdapter(authUser.id);
      gameRepo = new GameRepository(currentStorage);
      const recordRepo = new RecordRepository(currentStorage, authUser.id);
      
      // Load user's data from Supabase
      // Add default games if user has none
      await gameRepo.addDefaultGames();
      const games = await gameRepo.getAll();
      const activeGames = games.filter(g => g.isActive);
      const todayRecords = await recordRepo.getTodayRecords();
      
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
        console.log('Email confirmation required. Please check your email.');
        set({
          authUser: null,
          isAuthenticated: false,
          user: null,
        });
        throw new Error('Please check your email to confirm your account before logging in.');
      }
      
      // Set authUser first so migrateLocalDataToCloud can access it
      set({
        authUser,
        isAuthenticated: true,
        user: { localId: authUser.id, createdAt: new Date().toISOString() },
      });
      
      // Ensure user profile exists in public.users table
      const { error: profileCheckError } = await supabase
        .from('users')
        .upsert({
          id: authUser.id,
          email: authUser.email,
          display_name: authUser.displayName || email.split('@')[0],
        }, {
          onConflict: 'id'
        });
      
      if (profileCheckError) {
        console.error('Failed to ensure user profile exists:', profileCheckError);
      }
      
      // Switch to Supabase storage
      currentStorage = new SupabaseStorageAdapter(authUser.id);
      gameRepo = new GameRepository(currentStorage);
      
      // Migrate local data to cloud (authUser is now set in state)
      await get().migrateLocalDataToCloud();
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
      
      // Switch back to local storage
      currentStorage = localStorage;
      gameRepo = new GameRepository(localStorage);
      
      // Re-initialize with local storage
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
      
      console.log('✅ Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  },

  migrateLocalDataToCloud: async () => {
    try {
      const { authUser } = get();
      if (!authUser) {
        throw new Error('No authenticated user');
      }
      
      // Get all data from localStorage
      const localGames = await localStorage.getAll<Game>('games');
      const localRecords = await localStorage.getAll<GameRecord>('game_records');
      
      // Save to Supabase
      const supabaseStorage = new SupabaseStorageAdapter(authUser.id);
      await supabaseStorage.saveGames(localGames);
      await supabaseStorage.saveRecords(localRecords);
      
      // Reload data from Supabase
      currentStorage = supabaseStorage;
      gameRepo = new GameRepository(currentStorage);
      const recordRepo = new RecordRepository(currentStorage, authUser.id);
      
      const games = await gameRepo.getAll();
      const activeGames = games.filter(g => g.isActive);
      const todayRecords = await recordRepo.getTodayRecords();
      
      set({ games, activeGames, todayRecords });
      
      console.log('✅ Successfully migrated local data to cloud');
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
    set({ games: newGames, activeGames });

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
    const { games } = get();
    const newGames = games.map(g => 
      g.gameId === gameId ? { ...g, isActive: !g.isActive } : g
    );
    const activeGames = newGames.filter(g => g.isActive);
    set({ games: newGames, activeGames });

    // Save to database in background
    try {
      await gameRepo.toggleActive(gameId);
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
    const todayRecords = await recordRepo.getTodayRecords();
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
      const todayRecords = await recordRepo.getTodayRecords();
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
    
    const success = await recordRepo.delete(recordId);
    
    if (success) {
      // Reload today's records
      const todayRecords = await recordRepo.getTodayRecords();
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
    const todayRecords = await recordRepo.getTodayRecords();
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
