import { logger } from "@/backend/utils/logger";
import { supabase } from '@/backend/supabase';

/**
 * Service for managing driver achievements and milestones
 */
export class DriverAchievementService {
  /**
   * Check and award achievement based on driver stats
   */
  static async checkAndAwardAchievements(
    driverId: string,
    deliveriesCount: number,
    hoursOnline: number,
    totalEarnings: number
  ) {
    try {
      const achievements = [];

      // Delivery milestones
      if (deliveriesCount === 10) {
        achievements.push({
          achievement_type: 'delivery_10',
          achievement_name: '10 Deliveries 🚀',
          description: 'Completed 10 deliveries',
          reward_amount: 5000,
        });
      }
      if (deliveriesCount === 50) {
        achievements.push({
          achievement_type: 'delivery_50',
          achievement_name: '50 Deliveries 💪',
          description: 'Completed 50 deliveries',
          reward_amount: 10000,
        });
      }
      if (deliveriesCount === 100) {
        achievements.push({
          achievement_type: 'delivery_100',
          achievement_name: '100 Deliveries 🏆',
          description: 'Completed 100 deliveries - Elite Driver',
          reward_amount: 25000,
        });
      }

      // Hours online milestones
      if (Math.floor(hoursOnline) === 50) {
        achievements.push({
          achievement_type: 'hours_50',
          achievement_name: '50 Hours Online 📍',
          description: 'Spent 50 hours online',
          reward_amount: 5000,
        });
      }

      // Earnings milestones
      if (totalEarnings >= 500000 && totalEarnings < 600000) {
        achievements.push({
          achievement_type: 'earnings_500k',
          achievement_name: 'Half Million Earner 💰',
          description: 'Earned 500,000 or more',
          reward_amount: 15000,
        });
      }

      // Insert achievements
      for (const achievement of achievements) {
        const { error } = await supabase
          .from('driver_achievements')
          .insert([
            {
              driver_id: driverId,
              ...achievement,
              icon_emoji: achievement.achievement_name.split(' ').pop() || '🎉',
            },
          ]);

        if (!error) {
          logger.debug(`✅ Achievement awarded: ${achievement.achievement_name}`);
        }
      }

      return achievements;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }

  /**
   * Get all driver achievements
   */
  static async getAchievements(driverId: string) {
    try {
      const { data, error } = await supabase
        .from('driver_achievements')
        .select('*')
        .eq('driver_id', driverId)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching achievements:', error);
      return [];
    }
  }

  /**
   * Update or create daily stats for driver
   */
  static async updateDailyStats(
    driverId: string,
    stats: {
      deliveries_count?: number;
      earnings_amount?: number;
      hours_online?: number;
      average_rating?: number;
      orders_accepted?: number;
      orders_declined?: number;
    }
  ) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: existing } = await supabase
        .from('driver_daily_stats')
        .select('id')
        .eq('driver_id', driverId)
        .eq('stats_date', today)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('driver_daily_stats')
          .update({
            ...stats,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('driver_daily_stats')
          .insert([
            {
              driver_id: driverId,
              stats_date: today,
              ...stats,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error updating daily stats:', error);
      return false;
    }
  }
}

/**
 * Service for managing peak hours and suggestions
 */
export class PeakHoursService {
  /**
   * Get peak hour config for current day/hour
   */
  static async getPeakHoursForNow() {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const currentHour = now.getHours();

      const { data, error } = await supabase
        .from('peak_hours_config')
        .select(`
          *,
          service_zones (
            zone_name,
            city_code
          )
        `)
        .eq('day_of_week', dayOfWeek)
        .lte('start_hour', currentHour)
        .gte('end_hour', currentHour)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching peak hours:', error);
      return [];
    }
  }

  /**
   * Get upcoming peak hours (next 2 hours)
   */
  static async getUpcomingPeakHours() {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const currentHour = now.getHours();

      const { data, error } = await supabase
        .from('peak_hours_config')
        .select(`
          *,
          service_zones (
            zone_name,
            city_code
          )
        `)
        .eq('day_of_week', dayOfWeek)
        .lt('start_hour', currentHour + 2)
        .gt('end_hour', currentHour)
        .eq('is_active', true)
        .order('start_hour', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching upcoming peak hours:', error);
      return [];
    }
  }
}
