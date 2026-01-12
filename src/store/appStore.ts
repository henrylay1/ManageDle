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
import { invalidateGameStats, invalidateAllStats } from '@/lib/queryClient';
import type { IStorageAdapter } from '@/types/storage';
import { rateLimiter } from '@/utils/rateLimiter';
import { handleStorageError, handleAuthError } from '@/utils/errorHandling';
import { getDatePart } from '@/utils/helpers';

// Initialize local storage (only for user and records, NOT games)
const localStorage = new LocalStorageAdapter('managedle');
const userRepo = new UserRepository(localStorage);

// Game repository always uses database
let gameRepo = new GameRepository(new SupabaseStorageAdapter('guest'));

/**
 * Persist active game IDs to the correct backing store.
 * - If `userId` is provided, persist to Supabase `user_profile_config` (upsert).
 * - Otherwise persist to localStorage key `managedle:active_games`.
 */
async function persistActiveGames(activeIds: string[], userId?: string): Promise<void> {
  try {
    if (userId) {
      // Use upsert to ensure row exists and active_games is set
      await supabase
        .from('user_profile_config')
        .upsert({ user_id: userId, active_games: activeIds }, { onConflict: 'user_id' });
    } else {
      window.localStorage.setItem('managedle:active_games', JSON.stringify(activeIds));
    }
  } catch (err) {
    handleStorageError(err, 'persistActiveGames');
  }
}

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
      handleStorageError(fetchError, 'mergeLocalRecordsIntoUserAccount.fetchExistingRecords');
      return;
    }
    
    // Create a map of existing records by (game_id, createdAt date part) for deduplication
    const existingRecordsMap = new Map<string, any>();
    (existingRecords || []).forEach(record => {
      const dateKey = getDatePart(record.created_at);
      const key = `${record.game_id}:${dateKey}`;
      existingRecordsMap.set(key, record);
    });
    
    // Filter out records that already exist
    const newRecords = localRecords.filter(record => {
      const dateKey = getDatePart(record.createdAt);
      const key = `${record.gameId}:${dateKey}`;
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

      await persistActiveGames(mergedActiveGames, userId);
    }
    
    // Transform and insert new records
    const dbRecords = newRecords.map(record => ({
      record_id: record.recordId,
      user_id: userId,
      game_id: record.gameId,
      created_at: record.createdAt,
      scores: record.scores ?? null,
      // `completed` removed from DB - presence of record indicates it was played
      failed: record.failed,
      share_text: (() => {
        if (record.metadata && Array.isArray(record.metadata.shareTexts) && record.metadata.shareTexts.length > 0) {
          const shareTextJson: Record<string, string> = {};
          record.metadata.shareTexts.forEach(entry => {
            // Include all share texts, including SUMMARY
            if (entry.shareText) {
              shareTextJson[entry.name] = entry.shareText;
            }
          });
          return Object.keys(shareTextJson).length > 0 ? shareTextJson : null;
        }
        return null;
      })(),
      metadata: (() => {
        if (!record.metadata) return null;
        const cleaned = { ...record.metadata };
        if (Array.isArray(cleaned.shareTexts)) {
          // Remove any parsed `shareText` blobs, `scores`, `maxAttempts` carried in metadata entries
          cleaned.shareTexts = cleaned.shareTexts.map(({ shareText, scores, maxAttempts, ...rest }: any) => rest);
        }
        return Object.keys(cleaned).length > 0 ? cleaned : null;
      })(),
    }));
    
    const { error: insertError } = await supabase
      .from('game_records')
      .insert(dbRecords);
    
    if (insertError) {
      handleStorageError(insertError, 'mergeLocalRecordsIntoUserAccount.insertRecords');
    } else {
      // Successfully merged - clear the local record cache
      window.localStorage.removeItem('managedle:records');
    }
  } catch (error) {
    handleStorageError(error, 'mergeLocalRecordsIntoUserAccount');
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
  newGameIds: Set<string>;
  
  // Records
  todayRecords: GameRecord[];
  
  // Loading states
  isLoading: boolean;
  savingGames: Set<string>; // Track which games are currently being saved
  organizeMode: boolean; // Whether user can drag-and-drop to reorder games
  
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
  reorderActiveGames: (orderedGameIds: string[]) => Promise<void>;
  toggleOrganizeMode: () => void;
  markGameNew: (gameId: string) => void;
  clearNewGame: (gameId: string) => void;
  
  // Record actions
  addRecord: (record: Omit<GameRecord, 'recordId' | 'localId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateRecord: (recordId: string, updates: Partial<GameRecord>) => Promise<void>;
  deleteRecord: (recordId: string) => Promise<void>;
  loadTodayRecords: () => Promise<void>;
  
  // Stats actions
  getStats: (gameId: string) => Promise<GameStats>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authUser: null,
  isAuthenticated: false,
  savingGames: new Set(),
  organizeMode: false,
  games: [],
  activeGames: [],
  todayRecords: [],
  isLoading: true,
  newGameIds: new Set(),

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
          
          // Get active_games order from user_profile_config
          const { data: configData } = await supabase
            .from('user_profile_config')
            .select('active_games')
            .eq('user_id', authUser.id)
            .single();
          
          const activeGameIds = Array.isArray(configData?.active_games) ? configData.active_games : [];
          
          // Sort active games by the stored order
          const activeGames = activeGameIds
            .map((id: string) => games.find(g => g.gameId === id))
            .filter((g): g is Game => g !== undefined && g.isActive);
          
          // Add any active games not in the order list at the end
          const activeGamesInOrder = new Set(activeGameIds);
          const additionalActiveGames = games.filter(g => g.isActive && !activeGamesInOrder.has(g.gameId));
          activeGames.push(...additionalActiveGames);
          
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
      
      // Try to load active game IDs from localStorage (preserves order)
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
      
      // Sort active games by the stored order
      const activeGames = activeGameIds
        .map(id => games.find(g => g.gameId === id))
        .filter((g): g is Game => g !== undefined && g.isActive);
      
      // Add any active games not in the order list at the end
      const activeGamesInOrder = new Set(activeGameIds);
      const additionalActiveGames = games.filter(g => g.isActive && !activeGamesInOrder.has(g.gameId));
      activeGames.push(...additionalActiveGames);

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
      handleStorageError(error, 'initialize');
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    // Rate limit login attempts
    if (!rateLimiter.isAllowed('login', 5, 60000)) {
      const timeUntilNext = rateLimiter.getTimeUntilNextAttempt('login', 5, 60000);
      const minutesRemaining = Math.ceil(timeUntilNext / 60000);
      throw new Error(`Too many login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`);
    }
    
    try {
      const authUser = await authService.login(email, password);
      
      // Reset rate limiter on successful login
      rateLimiter.reset('login');
      
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
      handleAuthError(error, 'login');
      throw error;
    }
  },

  register: async (email, password, displayName) => {
    // Rate limit registration attempts
    if (!rateLimiter.isAllowed('register', 3, 300000)) {
      const timeUntilNext = rateLimiter.getTimeUntilNextAttempt('register', 3, 300000);
      const minutesRemaining = Math.ceil(timeUntilNext / 60000);
      throw new Error(`Too many registration attempts. Please try again in ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`);
    }
    
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
        handleStorageError(profileCheckError, 'register.ensureUserProfile');
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
        handleStorageError(configCheckError, 'register.ensureUserProfileConfig');
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
      handleAuthError(error, 'register');
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

      // Invalidate all TanStack Query caches
      invalidateAllStats();

      // Reset in-memory state
      set({
        user: null,
        authUser: null,
        isAuthenticated: false,
        games: [],
        activeGames: [],
        todayRecords: [],
        isLoading: false,
      });

      // Switch back to local storage for records
      currentStorage = localStorage;
      gameRepo = new GameRepository(new SupabaseStorageAdapter('guest'));

      // Re-initialize with local storage (will repopulate guest view)
      await get().initialize();
    } catch (error) {
      handleAuthError(error, 'logout');
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
      handleAuthError(error, 'updateProfile');
      throw error;
    }
  },

  addGame: async (game) => {
    // Always get fresh state for reliable prepend
    const { games: currentGames, activeGames: currentActiveGames } = get();
    
    // Prepend new game so it appears first in UI immediately
    const newGames = [game as Game, ...currentGames] as Game[];
    
    // Build activeGames with new game prepended when active
    let activeGames: Game[] = [];
    if (game.isActive) {
      activeGames = [game as Game, ...currentActiveGames.filter(g => g.gameId !== (game as any).gameId)];
    } else {
      activeGames = newGames.filter(g => g.isActive) as Game[];
    }
    set({ games: newGames, activeGames });

    // Mark as new (for shimmer)
    const newSet = new Set(get().newGameIds);
    newSet.add((game as any).gameId);
    set({ newGameIds: newSet });

    // Save to database in background
    try {
      const savedGame = await gameRepo.add(game);

      // Update with canonical savedGame from DB
      const { games: latestGames, activeGames: latestActiveGames } = get();
      const canonicalGames = [savedGame, ...latestGames.filter(g => g.gameId !== savedGame.gameId)];
      
      let canonicalActive: Game[];
      if (savedGame.isActive) {
        canonicalActive = [savedGame, ...latestActiveGames.filter(g => g.gameId !== savedGame.gameId)];
      } else {
        canonicalActive = latestActiveGames.filter(g => g.gameId !== savedGame.gameId);
      }
      
      set({ games: canonicalGames, activeGames: canonicalActive });

      // Persist active games order
      const { isAuthenticated, authUser } = get();
      if (isAuthenticated && authUser) {
        const activeIds = get().activeGames.map(g => g.gameId);
        await persistActiveGames(activeIds, authUser.id);
      } else {
        const activeIds = get().activeGames.map(g => g.gameId);
        await persistActiveGames(activeIds);
      }
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

      // If `isActive` changed, persist user's active_games accordingly
      if (updates.hasOwnProperty('isActive')) {
        const { isAuthenticated, authUser } = get();
        try {
          if (isAuthenticated && authUser) {
            const { data: configData } = await supabase
              .from('user_profile_config')
              .select('active_games')
              .eq('user_id', authUser.id)
              .single();

            const currentActiveGames: string[] = Array.isArray(configData?.active_games) ? configData!.active_games : [];
            let updatedActiveGames: string[];
            if ((updates as any).isActive) {
              // Prepend and remove duplicates
              updatedActiveGames = [gameId, ...currentActiveGames.filter(id => id !== gameId)];
            } else {
              // Remove
              updatedActiveGames = currentActiveGames.filter(id => id !== gameId);
            }

            await supabase
              .from('user_profile_config')
              .update({ active_games: updatedActiveGames })
              .eq('user_id', authUser.id);

            // Refresh games & activeGames from server to ensure canonical order
            const refreshedGames = await gameRepo.getAll();
            const { data: cfg } = await supabase
              .from('user_profile_config')
              .select('active_games')
              .eq('user_id', authUser.id)
              .single();
            const activeIds = Array.isArray(cfg?.active_games) ? cfg.active_games : [];
            const refreshedActiveGames = activeIds.map((id: string) => refreshedGames.find(g => g.gameId === id)).filter((g): g is Game => !!g && g.isActive);
            const remaining = refreshedGames.filter(g => g.isActive && !refreshedActiveGames.find(r => r.gameId === g.gameId));
            refreshedActiveGames.push(...remaining);
            set({ games: refreshedGames, activeGames: refreshedActiveGames });
          } else {
            // Guest: persist active order to localStorage
            const activeIds = get().activeGames.map(g => g.gameId);
            window.localStorage.setItem('managedle:active_games', JSON.stringify(activeIds));
          }
        } catch (err) {
          handleStorageError(err, 'updateGame.persistActiveGames');
        }
      }
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

      // If authenticated, remove from user's active_games config
      const { isAuthenticated, authUser } = get();
      if (isAuthenticated && authUser) {
        try {
          const { data: configData } = await supabase
            .from('user_profile_config')
            .select('active_games')
            .eq('user_id', authUser.id)
            .single();

          const currentActiveGames: string[] = Array.isArray(configData?.active_games) ? configData!.active_games : [];
          const updatedActiveGames = currentActiveGames.filter(id => id !== gameId);

          await supabase
            .from('user_profile_config')
            .update({ active_games: updatedActiveGames })
            .eq('user_id', authUser.id);
        } catch (err) {
          handleStorageError(err, 'deleteGame.persistActiveGames');
        }
      } else {
        // Guest: persist active order to localStorage
        const activeIds = activeGames.map(g => g.gameId);
        window.localStorage.setItem('managedle:active_games', JSON.stringify(activeIds));
      }
    } catch (error) {
      // Revert on error
      const refreshedGames = await gameRepo.getAll();
      set({ games: refreshedGames, activeGames: refreshedGames.filter(g => g.isActive) });
      throw error;
    }
  },

  toggleGameActive: async (gameId) => {
    // Always get fresh state
    const { games: currentGames, activeGames: currentActiveGames, authUser, isAuthenticated } = get();
    
    const newGames = currentGames.map(g => 
      g.gameId === gameId ? { ...g, isActive: !g.isActive } : g
    );
    
    const toggled = newGames.find(g => g.gameId === gameId);
    
    // When activating, prepend to active list; when deactivating, remove
    let activeGames: Game[];
    if (toggled?.isActive) {
      activeGames = [toggled, ...currentActiveGames.filter(g => g.gameId !== gameId)];
    } else {
      activeGames = currentActiveGames.filter(g => g.gameId !== gameId);
    }
    
    set({ games: newGames, activeGames });

    // Mark as new if activating
    if (toggled?.isActive) {
      const newSet = new Set(get().newGameIds);
      newSet.add(gameId);
      set({ newGameIds: newSet });
    }

    // Save to database in background
    try {
      const activeIds = get().activeGames.map(g => g.gameId);
      if (isAuthenticated && authUser) {
        await persistActiveGames(activeIds, authUser.id);
      } else {
        await persistActiveGames(activeIds);
      }
    } catch (error) {
      // Revert on error
      const refreshedGames = await gameRepo.getAll();
      set({ games: refreshedGames, activeGames: refreshedGames.filter(g => g.isActive) });
      throw error;
    }
  },

  toggleOrganizeMode: () => {
    set({ organizeMode: !get().organizeMode });
  },

  markGameNew: (gameId: string) => {
    const s = new Set(get().newGameIds);
    s.add(gameId);
    set({ newGameIds: s });
  },

  clearNewGame: (gameId: string) => {
    const s = new Set(get().newGameIds);
    if (s.has(gameId)) {
      s.delete(gameId);
      set({ newGameIds: s });
    }
  },

  reorderActiveGames: async (orderedGameIds: string[]) => {
    const { games, authUser, isAuthenticated } = get();
    
    // Reorder activeGames based on orderedGameIds
    const reorderedActiveGames = orderedGameIds
      .map(id => games.find(g => g.gameId === id))
      .filter((g): g is Game => g !== undefined && g.isActive);
    
    // Optimistic update
    set({ activeGames: reorderedActiveGames });
    
    try {
      if (isAuthenticated && authUser) {
        // Update user_profile_config with new order
        await supabase
          .from('user_profile_config')
          .update({ active_games: orderedGameIds })
          .eq('user_id', authUser.id);
      } else {
        // Guest user: update localStorage
        window.localStorage.setItem('managedle:active_games', JSON.stringify(orderedGameIds));
      }
    } catch (error) {
      handleStorageError(error, 'reorderActiveGames');
      const refreshedGames = await gameRepo.getAll();
      set({ activeGames: refreshedGames.filter(g => g.isActive) });
    }
  },

  addRecord: async (record) => {
    const { user, isAuthenticated, authUser, games, savingGames } = get();
    if (!user) return;
    
    // Mark game as saving
    const newSavingGames = new Set(savingGames);
    newSavingGames.add(record.gameId);
    set({ savingGames: newSavingGames });
    
    try {
      const userId = isAuthenticated && authUser ? authUser.id : user.localId;
      const recordRepo = new RecordRepository(currentStorage, userId);
      
      // Find the game for this record to enable timezone-aware streak calculation
      const game = games.find(g => g.gameId === record.gameId);
      await recordRepo.add(record, game);
      
      // No need to reload here - caller will do it if needed
      // This eliminates the double-fetch issue
      
      // Invalidate stats cache for this game via TanStack Query
      invalidateGameStats(record.gameId);
    } finally {
      // Remove game from saving set
      const updatedSavingGames = new Set(get().savingGames);
      updatedSavingGames.delete(record.gameId);
      set({ savingGames: updatedSavingGames });
    }
  },

  updateRecord: async (recordId, updates) => {
    const { user, isAuthenticated, authUser, savingGames } = get();
    if (!user) return;
    
    const userId = isAuthenticated && authUser ? authUser.id : user.localId;
    const recordRepo = new RecordRepository(currentStorage, userId);
    
    // Get the record to know which game we're updating
    const allRecords = await recordRepo.getAll();
    const existingRecord = allRecords.find(r => r.recordId === recordId);
    const gameId = updates.gameId || existingRecord?.gameId;
    
    // Mark game as saving
    if (gameId) {
      const newSavingGames = new Set(savingGames);
      newSavingGames.add(gameId);
      set({ savingGames: newSavingGames });
    }
    
    try {
      const updatedRecord = await recordRepo.update(recordId, updates);
      
      if (updatedRecord) {
        // Reload today's records
        const games = get().games;
        const todayRecords = await recordRepo.getTodayRecords(games);
        set({ todayRecords });
        
        // Invalidate stats cache for this game via TanStack Query
        invalidateGameStats(updatedRecord.gameId);
      }
    } finally {
      // Remove game from saving set
      if (gameId) {
        const updatedSavingGames = new Set(get().savingGames);
        updatedSavingGames.delete(gameId);
        set({ savingGames: updatedSavingGames });
      }
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

      // Invalidate stats cache for this game via TanStack Query
      if (recordToDelete) {
        invalidateGameStats(recordToDelete.gameId);
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
    const { user, isAuthenticated, authUser } = get();
    if (!user) {
      throw new Error('User not initialized');
    }
    
    // Compute stats directly - TanStack Query handles caching
    const userId = isAuthenticated && authUser ? authUser.id : user.localId;
    const recordRepo = new RecordRepository(currentStorage, userId);
    const statsService = new StatsService(recordRepo, userId);
    const game = get().games.find(g => g.gameId === gameId);
    const stats = await statsService.computeStats(gameId, game);
    
    return stats;
  },
}));
