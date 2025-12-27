import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { sanitizeDisplayName, sanitizeInput, isValidEmail, isStrongPassword, isValidUrl } from '@/utils/sanitization';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export class AuthService {
  /**
   * Register a new user with email and password
   */
  async register(email: string, password: string, displayName?: string): Promise<AuthUser> {
    // Validate and sanitize inputs
    const sanitizedEmail = sanitizeInput(email.toLowerCase());
    
    if (!isValidEmail(sanitizedEmail)) {
      throw new Error('Invalid email format');
    }
    
    const passwordValidation = isStrongPassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message || 'Password does not meet requirements');
    }
    
    const sanitizedDisplayName = displayName 
      ? sanitizeDisplayName(displayName)
      : sanitizedEmail.split('@')[0];
    
    if (!sanitizedDisplayName) {
      throw new Error('Display name cannot be empty');
    }
    
    // Default avatar for new users
    let supabaseUrl = '';
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) {
      supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    }
    // Extract the project ref from the Supabase URL (e.g. https://<ref>.supabase.co)
    let projectRef = '';
    try {
      const match = supabaseUrl.match(/^https:\/\/(.+?)\.supabase\.co/);
      if (match) projectRef = match[1];
    } catch {}
    const defaultAvatarUrl =
      'https://' +
      projectRef +
      '.supabase.co/storage/v1/object/public/profile-pictures/def_pfp_cat_1.jpg';

    const { data, error } = await supabase.auth.signUp({
      email: sanitizedEmail,
      password,
      options: {
        data: {
          display_name: sanitizedDisplayName,
          avatar_url: defaultAvatarUrl,
        },
      },
    });

    if (error) {
      // Check if user already exists in auth but not in public.users
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        // Try to get the existing user's ID from auth
        const { data: signInData } = await supabase.auth.signInWithPassword({ 
          email: sanitizedEmail, 
          password 
        });
        
        if (signInData?.user) {
          // User exists in auth, check if they exist in public.users
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('id', signInData.user.id)
            .single();
          
          if (userError || !userData) {
            // User in auth but not in public.users - create the profile
            const { error: insertError } = await supabase
              .from('users')
              .insert({
                id: signInData.user.id,
                email: signInData.user.email!,
                display_name: sanitizedDisplayName,
                avatar_url: defaultAvatarUrl,
              });
            
            if (insertError) {
              throw new Error(`Failed to create user profile: ${insertError.message}`);
            }

            // Create default user_profile_config
            const { error: configError } = await supabase
              .from('user_profile_config')
              .insert({
                user_id: signInData.user.id,
                display_name: sanitizedDisplayName,
                theme: 'light',
                notifications_enabled: true,
                active_games: [],
              });

            if (configError) {
              console.error('Failed to create user profile config:', configError);
              // Don't throw - profile config is not critical for auth
            }
            
            return {
              id: signInData.user.id,
              email: signInData.user.email!,
              displayName: sanitizedDisplayName,
              avatarUrl: defaultAvatarUrl,
            };
          }
        }
      }
      
      throw new Error(`Registration failed: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('Registration failed: No user returned');
    }

    // Note: data.session may be null if email confirmation is required
    // The trigger will still create the user profile

    // Create default user_profile_config
    const { error: configError } = await supabase
      .from('user_profile_config')
      .insert({
        user_id: data.user.id,
        display_name: sanitizedDisplayName,
        theme: 'light',
        notifications_enabled: true,
        active_games: [],
      });

    if (configError) {
      console.error('Failed to create user profile config:', configError);
      // Don't throw - profile config is not critical for auth
    }

    return this.mapUser(data.user);
  }

  /**
   * Sign in with email and password
   */
  async login(email: string, password: string): Promise<AuthUser> {
    const sanitizedEmail = sanitizeInput(email.toLowerCase());
    
    if (!isValidEmail(sanitizedEmail)) {
      throw new Error('Invalid email format');
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password,
    });

    if (error) {
      throw new Error(`Login failed: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('Login failed: No user returned');
    }

    return this.mapUser(data.user);
  }

  /**
   * Sign out the current user
   */
  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Get the current session
   */
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Failed to get session:', error);
      return null;
    }
    return data.session;
  }

  /**
   * Get the current user
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    // Fetch profile from users table
    let avatarUrl = null;
    try {
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', data.user.id)
        .single();
      if (!profileError && profile && profile.avatar_url) {
        avatarUrl = profile.avatar_url;
      }
    } catch (e) {
      console.warn('[authService.getUser] Failed to fetch profile avatar_url:', e);
    }
    const mapped = this.mapUser(data.user);
    return { ...mapped, avatarUrl: avatarUrl ?? mapped.avatarUrl };
  }

  /**
   * Update user profile
   */
  async updateProfile(displayName: string, avatarUrl?: string): Promise<void> {
    const sanitizedDisplayName = sanitizeDisplayName(displayName);
    
    if (!sanitizedDisplayName) {
      throw new Error('Display name cannot be empty');
    }
    
    // Validate avatar URL if provided
    if (avatarUrl && !isValidUrl(avatarUrl)) {
      throw new Error('Invalid avatar URL');
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No user logged in');
    }

    const { error } = await supabase
      .from('users')
      .update({
        display_name: sanitizedDisplayName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        callback(this.mapUser(session.user));
      } else {
        callback(null);
      }
    });
  }

  /**
   * Map Supabase User to AuthUser
   */
  private mapUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email!,
      displayName: user.user_metadata?.display_name || user.email!.split('@')[0],
      avatarUrl: user.user_metadata?.avatar_url || null,
    };
  }

  /**
   * Check if Supabase is configured
   */
  isConfigured(): boolean {
    return !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE;
  }
}

export const authService = new AuthService();
