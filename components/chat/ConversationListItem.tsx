import { CHAT_THEME as T } from "@/components/chat/chatTheme";
import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ConversationListItemProps = {
  id: string;
  name: string;
  image?: string | null;
  kind: string;
  preview: string;
  time: string;
  unread: number;
  onPress: () => void;
  showChevron?: boolean;
};

export const ConversationListItem = memo(function ConversationListItem({
  name,
  image,
  kind,
  preview,
  time,
  unread,
  onPress,
  showChevron = false,
}: ConversationListItemProps) {
  return (
    <TouchableOpacity
      style={[styles.card, unread > 0 && styles.cardUnread]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.avatarWrap}>
        <Image source={{ uri: image || undefined }} style={styles.avatar} />
        <View style={styles.onlineDot} />
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <Text style={styles.kind}>{kind}</Text>
        <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      ) : showChevron ? (
        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
      ) : null}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: T.surface,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  cardUnread: { backgroundColor: T.accentSoft },
  avatarWrap: { position: "relative" },
  avatar: { width: 52, height: 52, borderRadius: 5, backgroundColor: T.border },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: T.surface,
  },
  body: { flex: 1, minWidth: 0 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 15.2, fontFamily: "Inter", fontWeight: "600", color: T.ink, letterSpacing: 0.4 },
  time: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: T.muted },
  kind: { marginTop: 2, fontSize: 11.8, fontFamily: "Inter", fontWeight: "500", color: T.muted, letterSpacing: 0.1 },
  preview: { marginTop: 2, fontSize: 13.3, fontFamily: "Inter", fontWeight: "500", color: T.muted, letterSpacing: 0.1 },
  previewUnread: { color: T.ink, fontWeight: "600" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 11, fontFamily: "Inter", fontWeight: "700", color: "#FFFFFF" },
});
