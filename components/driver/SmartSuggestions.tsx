import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from './theme';
import { PremiumCard } from './PremiumCard';

interface Suggestion {
  id: string;
  icon: string;
  title: string;
  description: string;
}

interface SmartSuggestionsProps {
  suggestions: Suggestion[];
  maxVisible?: number;
}

/**
 * Smart suggestions card showing contextual suggestions to drivers
 * Examples: "Move toward Acacia Mall for more orders", "Lunch rush starts in 18 mins"
 */
export const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({
  suggestions,
  maxVisible = 3,
}) => {
  if (suggestions.length === 0) return null;

  const visibleSuggestions = suggestions.slice(0, maxVisible);

  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <Text
        style={[
          TYPOGRAPHY.h4,
          { color: COLORS.text_primary, marginBottom: SPACING.md },
        ]}
      >
        💡 Smart Tips
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ gap: SPACING.md, paddingRight: SPACING.lg }}
      >
        {visibleSuggestions.map((suggestion, index) => (
          <Animated.View
            key={suggestion.id}
            entering={FadeInRight.delay(index * 100)}
          >
            <PremiumCard
              style={{
                width: 160,
                minHeight: 120,
                justifyContent: 'space-between',
              }}
              accentBorder="secondary"
            >
              <View>
                <Text style={{ fontSize: 24, marginBottom: SPACING.sm }}>
                  {suggestion.icon}
                </Text>
                <Text
                  style={[
                    TYPOGRAPHY.label_sm,
                    { color: COLORS.text_primary, marginBottom: SPACING.xs },
                  ]}
                  numberOfLines={2}
                >
                  {suggestion.title}
                </Text>
              </View>
              <Text
                style={[TYPOGRAPHY.caption, { color: COLORS.text_secondary }]}
                numberOfLines={2}
              >
                {suggestion.description}
              </Text>
            </PremiumCard>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
};
