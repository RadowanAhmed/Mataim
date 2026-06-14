/**
 * INTEGRATION GUIDE: Premium Driver Dashboard
 * 
 * This file provides a guide for integrating all premium features into the existing dashboard
 * Follow the code snippets below to update your dashboard.tsx file
 */

// ============================================================================
// STEP 1: UPDATE IMPORTS
// ============================================================================
// Add these imports at the top of dashboard.tsx:

import {
  // Theme
  COLORS,
  SPACING,
  TYPOGRAPHY,
  // Components
  PremiumCard,
  OnlinePulse,
  AnimatedEarningsCounter,
  OrderRequestAlert,
  CircularProgress,
  AlertBanner,
  EarningsCard,
  AnimatedOnlineToggle,
  DashboardGreeting,
  SmartSuggestions,
  ActivityTimeline,
  AchievementCelebration,
  WeeklyRecap,
} from '@/components/driver';

import { useHotspots, useDriverAchievements, useDriverDailyStats } from '@/backend/hooks/usePremiumFeatures';
import { DriverAchievementService, PeakHoursService } from '@/backend/services/driverPremiumService';

// ============================================================================
// STEP 2: ADD STATE FOR PREMIUM FEATURES
// ============================================================================
// Add these state variables to the component:

const [showAchievementModal, setShowAchievementModal] = useState(false);
const [achievementData, setAchievementData] = useState<any>(null);
const [alerts, setAlerts] = useState<any[]>([]);
const [suggestions, setSuggestions] = useState<any[]>([]);
const [showOrderAlert, setShowOrderAlert] = useState(false);
const [pendingOrderAlert, setPendingOrderAlert] = useState<any>(null);

// Premium features hooks
const { hotspots } = useHotspots();
const { achievements } = useDriverAchievements(user?.id);
const { stats: dailyStats } = useDriverDailyStats(user?.id);

// ============================================================================
// STEP 3: ADD EFFECT FOR PEAK HOURS AND SUGGESTIONS
// ============================================================================
// Add this effect to fetch peak hours and suggestions:

useFocusEffect(
  useCallback(() => {
    const loadPeakHoursAndSuggestions = async () => {
      try {
        // Get current peak hours
        const peakHours = await PeakHoursService.getPeakHoursForNow();
        
        if (peakHours.length > 0) {
          const peakAlert = peakHours[0];
          const zone = peakHours[0].service_zones;
          
          setAlerts([
            {
              id: 'peak_' + peakHours[0].id,
              visible: true,
              title: '🔥 Peak Hour',
              message: `${peakHours[0].boost_percentage}% bonus active in ${zone?.zone_name}`,
              type: 'peak',
              duration: 0,
            },
          ]);
        }

        // Get suggestions based on location and performance
        const smartSuggestions = generateSmartSuggestions(dailyStats, driverLocation);
        setSuggestions(smartSuggestions);

        // Check for achievements
        if (stats.deliveriesToday > 0 && currentOrder) {
          await DriverAchievementService.checkAndAwardAchievements(
            user.id,
            stats.totalDeliveries,
            0, // Calculate hours online from session
            stats.totalPay
          );
        }
      } catch (error) {
        console.error('Error loading premium features:', error);
      }
    };

    if (user?.id) {
      loadPeakHoursAndSuggestions();
    }
  }, [user?.id, dailyStats])
);

// ============================================================================
// STEP 4: UPDATE DASHBOARD LAYOUT
// ============================================================================
// Replace the ScrollView content in your dashboard with this structure:

return (
  <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.dark_primary }}>
    <StatusBar barStyle="light-content" backgroundColor={COLORS.dark_primary} />

    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={{ padding: SPACING.lg }}>
        {/* 1. Greeting with Active Orders Count */}
        <DashboardGreeting
          driverName={user?.display_name || 'Driver'}
          activeOrderCount={liveReadyCount}
          motivationalMessage={
            stats.deliveriesToday >= 5 ? '🔥 Great start today!' : undefined
          }
        />

        {/* 2. Alerts Stack (Peak Hours, Bonuses, etc) */}
        {alerts.length > 0 && (
          <View style={{ marginBottom: SPACING.lg }}>
            {alerts.map((alert, idx) => (
              <AlertBanner
                key={alert.id}
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                type={alert.type}
                icon={alert.icon}
                duration={alert.duration}
                onDismiss={() => {
                  setAlerts(alerts.filter((_, i) => i !== idx));
                }}
              />
            ))}
          </View>
        )}

        {/* 3. Online Status Toggle with Pulse */}
        <AnimatedOnlineToggle
          isOnline={isOnline}
          onToggle={toggleOnlineStatus}
          loading={false}
        />

        {/* 4. Earnings Card with Sparkline */}
        <View style={{ marginVertical: SPACING.lg }}>
          <EarningsCard
            todayEarnings={stats.todayPay}
            weekEarnings={stats.totalPay * 0.3} // Estimate
            monthEarnings={stats.totalPay}
            sparklineData={[
              stats.todayPay * 0.2,
              stats.todayPay * 0.4,
              stats.todayPay * 0.5,
              stats.todayPay * 0.7,
              stats.todayPay * 0.8,
              stats.todayPay * 0.9,
              stats.todayPay,
            ]}
          />
        </View>

        {/* 5. Daily Goal Progress Ring */}
        {liveReadyCount > 0 && (
          <PremiumCard style={{ alignItems: 'center', padding: SPACING.xl }}>
            <CircularProgress
              progress={(stats.deliveriesToday / 10) * 100}
              size={120}
              label={`${stats.deliveriesToday}/${10}`}
              sublabel="deliveries today"
            />
          </PremiumCard>
        )}

        {/* 6. Smart Suggestions */}
        {suggestions.length > 0 && (
          <View style={{ marginVertical: SPACING.lg }}>
            <SmartSuggestions suggestions={suggestions} />
          </View>
        )}

        {/* 7. Activity Timeline */}
        <View style={{ marginVertical: SPACING.lg }}>
          <Text style={[TYPOGRAPHY.h3, { color: COLORS.text_primary, marginBottom: SPACING.md }]}>
            📋 Today's Activity
          </Text>
          {/* Add timeline here with sample data */}
        </View>

        {/* 8. Weekly Recap */}
        <View style={{ marginVertical: SPACING.lg }}>
          <WeeklyRecap
            stats={{
              totalEarnings: stats.totalPay,
              deliveriesCount: stats.totalDeliveries,
              hoursOnline: 0,
              averageRating: stats.rating,
              acceptanceRate: 0.95,
              currency: '₭',
            }}
          />
        </View>
      </View>
    </ScrollView>

    {/* Order Request Alert - shown when new order arrives */}
    <OrderRequestAlert
      visible={showOrderAlert}
      orderId={pendingOrderAlert?.id}
      distance={pendingOrderAlert?.distance}
      itemCount={pendingOrderAlert?.items}
      pickup={pendingOrderAlert?.restaurantName}
      delivery={pendingOrderAlert?.deliveryAddress}
      reward={pendingOrderAlert?.reward}
      onDismiss={() => setShowOrderAlert(false)}
      onAccept={() => {
        setShowOrderAlert(false);
        // Accept order logic
      }}
    />

    {/* Achievement Celebration Modal */}
    <AchievementCelebration
      visible={showAchievementModal}
      title={achievementData?.achievement_name || 'Achievement!'}
      subtitle={achievementData?.description || 'Great work!'}
      onDismiss={() => setShowAchievementModal(false)}
      autoClose
      autoCloseDuration={3000}
    />
  </SafeAreaView>
);

// ============================================================================
// STEP 5: HELPER FUNCTIONS
// ============================================================================

/**
 * Generate smart suggestions based on driver stats and location
 */
function generateSmartSuggestions(
  stats: any,
  location: any
): Array<{ id: string; icon: string; title: string; description: string }> {
  const suggestions = [];

  // Lunch rush suggestion
  const hour = new Date().getHours();
  if (hour >= 11 && hour < 14) {
    suggestions.push({
      id: 'lunch_rush',
      icon: '🍽️',
      title: 'Lunch Rush',
      description: 'Peak time - more orders arriving',
    });
  }

  // Performance bonus
  if (stats?.deliveries_count > 0 && stats?.deliveries_count % 5 === 0) {
    suggestions.push({
      id: 'bonus_opportunity',
      icon: '🎁',
      title: 'Bonus Available',
      description: `Complete 1 more order for bonus`,
    });
  }

  // Zone recommendation
  if (location) {
    suggestions.push({
      id: 'hotspot_zone',
      icon: '📍',
      title: 'Move to Acacia',
      description: 'More orders in this area',
    });
  }

  return suggestions.slice(0, 3);
}

// ============================================================================
// STEP 6: STYLES UPDATE
// ============================================================================
// Update your StyleSheet with the new color scheme:

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark_primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.dark_primary,
  },
  loadingText: {
    color: COLORS.text_primary,
    marginTop: SPACING.lg,
  },
  // ... rest of your styles
});

// ============================================================================
// NOTES FOR IMPLEMENTATION
// ============================================================================
/*
1. Replace color references (#fff, #000, etc) with COLORS constants
2. Use SPACING for all margins/paddings
3. Update all card shadows with SHADOWS object
4. Test on both iOS and Android devices
5. Verify animations run at 60 FPS using Flipper Performance Monitor
6. Ensure dark theme works with system dark mode
7. Test hotspots display correctly on map with different demand levels
8. Verify real-time achievements trigger correctly
9. Test all haptic feedback on physical devices
10. Confirm RLS policies work for data access
*/
