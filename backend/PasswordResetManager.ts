import { logger } from "@/backend/utils/logger";
// backend/PasswordResetManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

class PasswordResetManager {
  private static instance: PasswordResetManager;
  private isResetSession: boolean = false;
  private isUpdatingPassword: boolean = false;
  private resetStartTime: number = 0;
  private readonly RESET_SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

  // Make constructor private to prevent direct construction
  private constructor() {}

  static getInstance(): PasswordResetManager {
    if (!PasswordResetManager.instance) {
      PasswordResetManager.instance = new PasswordResetManager();
    }
    return PasswordResetManager.instance;
  }

  async initialize() {
    try {
      const resetSession = await AsyncStorage.getItem('is_password_reset_session');
      const resetStartTime = await AsyncStorage.getItem('reset_start_time');
      const updatingPassword = await AsyncStorage.getItem('is_updating_password');
      const resetInProgress = await AsyncStorage.getItem('reset_in_progress');
      
      this.isResetSession = resetSession === 'true';
      this.isUpdatingPassword = updatingPassword === 'true';
      this.resetStartTime = resetStartTime ? parseInt(resetStartTime) : 0;
      
      if (this.isResetSession && this.resetStartTime) {
        const now = Date.now();
        const elapsed = now - this.resetStartTime;
        
        if (elapsed > this.RESET_SESSION_TIMEOUT) {
          logger.debug('Password reset session expired, clearing...');
          await this.endResetSession();
        }
      }
      
      logger.debug('PasswordResetManager initialized - Reset session:', this.isResetSession, 'Updating password:', this.isUpdatingPassword, 'Reset in progress:', resetInProgress);
    } catch (error) {
      console.error('Error initializing PasswordResetManager:', error);
    }
  }

  async startResetSession() {
    try {
      this.isResetSession = true;
      this.resetStartTime = Date.now();
      
      await AsyncStorage.multiSet([
        ['is_password_reset_session', 'true'],
        ['reset_start_time', this.resetStartTime.toString()],
        ['prevent_home_redirect', 'true'],
        ['reset_in_progress', 'true'] // NEW: Track that reset is in progress
      ]);
      
      logger.debug('Password reset session started at:', new Date(this.resetStartTime).toISOString());
    } catch (error) {
      console.error('Error starting reset session:', error);
    }
  }

  async startPasswordUpdate() {
    try {
      this.isUpdatingPassword = true;
      await AsyncStorage.setItem('is_updating_password', 'true');
      logger.debug('Password update started');
    } catch (error) {
      console.error('Error starting password update:', error);
    }
  }

  async endPasswordUpdate() {
    try {
      this.isUpdatingPassword = false;
      await AsyncStorage.removeItem('is_updating_password');
      logger.debug('Password update ended');
    } catch (error) {
      console.error('Error ending password update:', error);
    }
  }

  async completeResetProcess() {
    try {
      logger.debug('Password reset process completed successfully');
      await this.endResetSession();
      // Also clear any stored email/session data
      await AsyncStorage.multiRemove([
        'reset_email',
        'has_valid_reset_session',
        'reset_session_timestamp',
        'reset_in_progress'
      ]);
    } catch (error) {
      console.error('Error completing reset process:', error);
    }
  }

  async endResetSession() {
    try {
      this.isResetSession = false;
      this.isUpdatingPassword = false;
      this.resetStartTime = 0;
      
      await AsyncStorage.multiRemove([
        'is_password_reset_session',
        'reset_start_time', 
        'prevent_home_redirect',
        'is_updating_password',
        'reset_in_progress'
      ]);
      
      logger.debug('Password reset session ended');
    } catch (error) {
      console.error('Error ending reset session:', error);
    }
  }

  // CRITICAL: Add this method to check if we should preserve the auth session
  async shouldPreserveAuthSession(): Promise<boolean> {
    try {
      // If we're in the middle of password reset flow, preserve the session
      const resetInProgress = await AsyncStorage.getItem('reset_in_progress');
      const hasValidSession = await AsyncStorage.getItem('has_valid_reset_session');
      
      return resetInProgress === 'true' && hasValidSession === 'true';
    } catch (error) {
      console.error('Error checking preserve auth session:', error);
      return false;
    }
  }

  async isRecoverySessionActive(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      
      // Check if this looks like a recovery session
      const isRecovery = 
        session.user?.recovery_type === 'recovery' ||
        session.user?.aud === 'authenticated'; // Recovery sessions are still authenticated
      
      logger.debug('Recovery session check:', { 
        hasSession: !!session, 
        recoveryType: session.user?.recovery_type,
        isRecovery 
      });
      
      return isRecovery;
    } catch (error) {
      console.error('Error checking recovery session:', error);
      return false;
    }
  }

  // Add this method to force sign out recovery sessions
  async forceSignOutRecoverySession(): Promise<void> {
    try {
      logger.debug('Force signing out recovery session');
      
      // Sign out from Supabase
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        console.error('Error signing out recovery session:', error);
      }
      
      // Clear all reset-related data
      await this.clearSession();
      await AsyncStorage.multiRemove([
        'has_valid_reset_session',
        'reset_session_timestamp',
        'reset_email'
      ]);
      
      logger.debug('Recovery session force signed out');
    } catch (error) {
      console.error('Error in forceSignOutRecoverySession:', error);
    }
  }

  isResetSessionActive(): boolean {
    return this.isResetSession;
  }

  isUpdatingPasswordActive(): boolean {
    return this.isUpdatingPassword;
  }

  async isResetInProgress(): Promise<boolean> {
    try {
      const resetInProgress = await AsyncStorage.getItem('reset_in_progress');
      return resetInProgress === 'true';
    } catch (error) {
      console.error('Error checking reset in progress:', error);
      return false;
    }
  }

  async clearSession() {
    try {
      this.isResetSession = false;
      this.isUpdatingPassword = false;
      this.resetStartTime = 0;
      await AsyncStorage.multiRemove([
        'is_password_reset_session',
        'reset_start_time',
        'prevent_home_redirect',
        'is_updating_password',
        'reset_in_progress',
        'reset_email',
        'has_valid_reset_session',
        'reset_session_timestamp'
      ]);
      logger.debug('Password reset session cleared');
    } catch (error) {
      console.error('Error clearing reset session:', error);
    }
  }

  async shouldPreventHomeRedirect(): Promise<boolean> {
    try {
      const preventRedirect = await AsyncStorage.getItem('prevent_home_redirect');
      const resetInProgress = await AsyncStorage.getItem('reset_in_progress');
      return preventRedirect === 'true' || resetInProgress === 'true';
    } catch (error) {
      console.error('Error checking prevent redirect:', error);
      return false;
    }
  }

  // Enhanced method to detect recovery sessions
  async isRecoverySession(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      
      // Check various indicators of recovery session
      const isRecovery = 
        session.user?.recovery_type === 'recovery' ||
        session.access_token?.includes('recovery') ||
        session.user?.aud === 'authenticated';
      
      return isRecovery;
    } catch (error) {
      console.error('Error checking recovery session:', error);
      return false;
    }
  }

  // Add this getter for supabase to avoid the error
  get supabase() {
    return supabase;
  }
}

// Export the instance directly, not the class
export const passwordResetManager = PasswordResetManager.getInstance();