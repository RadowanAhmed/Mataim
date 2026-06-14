/**
 * supabaseLoader.ts - Lazy Load Supabase with Guaranteed Polyfills
 * 
 * This module defers Supabase import until runtime, ensuring polyfills
 * from app/_layout.tsx are already registered before iceberg-js loads.
 */

let supabaseClient: any = null;
let loadingPromise: Promise<any> | null = null;

/**
 * Get Supabase client with guaranteed polyfills already in place
 * Safe to call multiple times - returns cached instance after first call
 */
export async function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  // If already loading, wait for that promise
  if (loadingPromise) {
    return await loadingPromise;
  }

  // Start loading
  loadingPromise = (async () => {
    try {
      console.log('[SUPABASE] Loading Supabase client...');
      const { supabase } = await import("./supabase");
      supabaseClient = supabase;
      console.log('[SUPABASE] ✓ Supabase client loaded successfully');
      return supabase;
    } catch (error) {
      console.error('[SUPABASE] ✗ Failed to load Supabase:', error);
      loadingPromise = null; // Reset so we can retry
      throw error;
    }
  })();

  return await loadingPromise;
}

/**
 * Synchronous access - only use after app has initialized
 * Throws if Supabase not yet loaded
 */
export function getSupabaseClientSync() {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized yet. Call getSupabaseClient() first.');
  }
  return supabaseClient;
}

/**
 * Check if Supabase is loaded
 */
export function isSupabaseLoaded() {
  return supabaseClient !== null;
}
