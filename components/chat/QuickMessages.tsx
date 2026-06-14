import { CHAT_THEME as T } from "@/components/chat/chatTheme";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type QuickMessagesProps = {
  messages: string[];
  onSelect: (message: string) => void;
};

export function QuickMessages({ messages, onSelect }: QuickMessagesProps) {
  if (!messages.length) return null;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {messages.map((message) => (
          <TouchableOpacity key={message} style={styles.chip} onPress={() => onSelect(message)} activeOpacity={0.85}>
            <Text style={styles.chipText}>{message}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.border },
  content: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    borderRadius: 999,
    backgroundColor: T.accentSoft,
    borderWidth: 1,
    borderColor: T.accentBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: T.accentChipText, fontSize: 12, fontWeight: "600", fontFamily: "Inter" },
});
