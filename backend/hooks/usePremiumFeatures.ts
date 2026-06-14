import { useEffect, useState } from 'react';
import { supabase } from '@/backend/supabase';

export interface Hotspot {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  demand_level: number;
  description?: string;
}

/**
 * Hook for fetching hotspots data in real-time
 */
export const useHotspots = () => {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let subscription: any;

    const fetchHotspots = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('hotspots')
          .select('id, name, latitude, longitude, radius_meters, demand_level, description')
          .eq('is_active', true)
          .order('demand_level', { ascending: false });

        if (fetchError) throw fetchError;

        setHotspots(data || []);
        setError(null);

        // Subscribe to real-time changes
        subscription = supabase
          .channel('hotspots_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'hotspots',
            },
            (payload) => {
              if (payload.eventType === 'DELETE') {
                setHotspots(prev => prev.filter(h => h.id !== (payload.old as any).id));
              } else {
                const updated = payload.new as Hotspot;
                setHotspots(prev => {
                  const existing = prev.findIndex(h => h.id === updated.id);
                  if (existing >= 0) {
                    const newList = [...prev];
                    newList[existing] = updated;
                    return newList;
                  }
                  return [...prev, updated];
                });
              }
            }
          )
          .subscribe();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch hotspots');
        console.error('Error fetching hotspots:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHotspots();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  return { hotspots, loading, error };
};

/**
 * Hook for fetching driver achievements
 */
export const useDriverAchievements = (driverId: string) => {
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription: any;

    const fetchAchievements = async () => {
      try {
        const { data, error } = await supabase
          .from('driver_achievements')
          .select('*')
          .eq('driver_id', driverId)
          .order('earned_at', { ascending: false });

        if (!error) {
          setAchievements(data || []);
        }

        subscription = supabase
          .channel('achievements_' + driverId)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'driver_achievements',
              filter: `driver_id=eq.${driverId}`,
            },
            (payload) => {
              setAchievements(prev => [payload.new as any, ...prev]);
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Error fetching achievements:', err);
      } finally {
        setLoading(false);
      }
    };

    if (driverId) {
      fetchAchievements();
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [driverId]);

  return { achievements, loading };
};

/**
 * Hook for fetching driver daily stats
 */
export const useDriverDailyStats = (driverId: string) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('driver_daily_stats')
          .select('*')
          .eq('driver_id', driverId)
          .eq('stats_date', today)
          .maybeSingle();

        if (!error && data) {
          setStats(data);
        } else {
          setStats(null);
        }
      } catch (err) {
        console.error('Error fetching daily stats:', err);
      } finally {
        setLoading(false);
      }
    };

    if (driverId) {
      fetchStats();
    }
  }, [driverId]);

  return { stats, loading };
};
