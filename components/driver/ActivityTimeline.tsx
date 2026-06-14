import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY } from './theme';

interface DeliveryItem {
  id: string;
  orderNumber: string;
  distance: number;
  fee: number;
  completedAt: Date;
  status: 'completed' | 'delivered';
}

interface ActivityTimelineProps {
  deliveries: DeliveryItem[];
  currency?: string;
}

/**
 * Activity timeline showing completed deliveries
 * Displays order history with timestamps, distances, and earnings
 */
export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  deliveries,
  currency = '₭',
}) => {
  if (deliveries.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: SPACING.xxl }}>
        <Text
          style={[TYPOGRAPHY.body_base, { color: COLORS.text_tertiary }]}
        >
          No completed deliveries yet today
        </Text>
      </View>
    );
  }

  const renderDeliveryItem = ({
    item,
    index,
  }: {
    item: DeliveryItem;
    index: number;
  }) => {
    const time = formatTime(item.completedAt);

    return (
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: SPACING.lg,
          borderBottomWidth: index < deliveries.length - 1 ? 1 : 0,
          borderBottomColor: COLORS.dark_tertiary,
        }}
      >
        {/* Timeline dot and line */}
        <View
          style={{
            width: 24,
            alignItems: 'center',
            marginRight: SPACING.lg,
            position: 'relative',
          }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: COLORS.accent_primary,
              zIndex: 2,
            }}
          />
          {index < deliveries.length - 1 && (
            <View
              style={{
                position: 'absolute',
                top: 12,
                width: 2,
                height: 60,
                backgroundColor: COLORS.dark_tertiary,
                zIndex: 1,
              }}
            />
          )}
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: SPACING.sm,
            }}
          >
            <Text style={[TYPOGRAPHY.label_base, { color: COLORS.text_primary }]}>
              Order #{item.orderNumber}
            </Text>
            <Text
              style={[
                TYPOGRAPHY.label_base,
                { color: COLORS.accent_primary, fontWeight: '700' },
              ]}
            >
              +{currency}
              {item.fee.toFixed(2)}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: SPACING.md,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: SPACING.sm,
              }}
            >
              <MaterialCommunityIcons
                name="map-marker-distance"
                size={14}
                color={COLORS.text_secondary}
              />
              <Text
                style={[TYPOGRAPHY.body_sm, { color: COLORS.text_secondary }]}
              >
                {item.distance.toFixed(1)} km
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: SPACING.sm,
              }}
            >
              <MaterialCommunityIcons
                name="clock-outline"
                size={14}
                color={COLORS.text_secondary}
              />
              <Text
                style={[TYPOGRAPHY.body_sm, { color: COLORS.text_secondary }]}
              >
                {time}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: SPACING.sm,
                marginLeft: 'auto',
              }}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color={COLORS.status_success}
              />
              <Text
                style={[
                  TYPOGRAPHY.body_sm,
                  { color: COLORS.status_success, fontWeight: '600' },
                ]}
              >
                Delivered
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={deliveries}
      renderItem={renderDeliveryItem}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
    />
  );
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
