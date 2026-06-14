import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo, useCallback, useEffect, useRef } from "react";
import { CHAT_THEME as T } from "@/components/chat/chatTheme";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type MessageListProps = {
  messages: any[];
  currentUserId?: string;
  listRef?: React.RefObject<FlatList<any> | null>;
  onImagePress?: (url: string) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  // New props for scroll lock
  onScroll?: (event: any) => void;
  onContentSizeChange?: (width: number, height: number) => void;
  shouldAutoScroll?: boolean;          // true = near bottom, allow auto‑scroll
};

type ChatMessageRowProps = {
  item: any;
  isMe: boolean;
  onImagePress?: (url: string) => void;
};

const ChatMessageRow = memo(function ChatMessageRow({ item, isMe, onImagePress }: ChatMessageRowProps) {
  const delivered = Boolean(item.delivered_at || item.created_at);
  const read = Boolean(item.is_read || item.read_at);
  const isImage = item.message_type === "image" && item.image_url;

  return (
    <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.otherMessage, isImage && styles.imageBubble]}>
      {isImage ? (
        <View style={{ alignItems: isMe ? "flex-start" : "flex-end", gap: 3, maxWidth: "100%", }}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress?.(item.image_url)}>
            <Image source={{ uri: item.image_url }} style={styles.messageImage} cachePolicy="memory-disk" contentFit="cover" />
            {item.isUploading ? (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator color={T.bubbleMeText} />
                <Text style={styles.uploadText}>{item.uploadProgress || 0}%</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          {item.message && item.message !== "Image" ? (
            <Text style={styles.imageCaptionText}>{item.message}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>{item.message}</Text>
      )}
      <View style={styles.footer}>
        <Text style={[styles.messageTime, isMe ? styles.myMessageTime : styles.otherMessageTime]}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
        {isMe ? (
          <Ionicons
            name={read ? "checkmark-done" : delivered ? "checkmark-done-outline" : "checkmark-outline"}
            size={12}
            color={read ? T.bubbleMeRead : T.bubbleMeTime}
          />
        ) : null}
      </View>
    </View>
  );
});

function MessageListInner({
  messages,
  currentUserId,
  listRef,
  onImagePress,
  refreshing,
  onRefresh,
  onScroll,
  onContentSizeChange,
  shouldAutoScroll = true,               // default to true (legacy behaviour)
}: MessageListProps) {
  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <ChatMessageRow item={item} isMe={item.sender_id === currentUserId} onImagePress={onImagePress} />
    ),
    [currentUserId, onImagePress],
  );

  const keyExtractor = useCallback((item: any) => String(item.id), []);

  // Auto‑scroll only when shouldAutoScroll is true
  const lastCountRef = useRef(0);
  useEffect(() => {
    if (!shouldAutoScroll || !messages.length || messages.length === lastCountRef.current) return;
    lastCountRef.current = messages.length;
    const timer = setTimeout(() => listRef?.current?.scrollToEnd({ animated: messages.length < 40 }), 60);
    return () => clearTimeout(timer);
  }, [listRef, messages.length, shouldAutoScroll]);

  return (
    <FlatList
      ref={listRef as any}
      data={messages}
      style={styles.list}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      initialNumToRender={16}
      maxToRenderPerBatch={12}
      windowSize={9}
      removeClippedSubviews
      contentContainerStyle={styles.messagesContent}
      // Forward the parent's callbacks – they handle scroll lock
      onScroll={onScroll}
      onContentSizeChange={onContentSizeChange}
      scrollEventThrottle={16}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={T.accent} colors={[T.accent]} />
        ) : undefined
      }
    />
  );
}

export const MessageList = memo(MessageListInner);

// Styles unchanged
const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: T.background },
  messagesContent: { padding: 16, paddingBottom: 16, flexGrow: 1 },
  messageBubble: { maxWidth: "82%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10, alignSelf: "flex-start" },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: T.bubbleMe,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: T.bubbleOther,
    borderWidth: 0.8,
    borderColor: T.bubbleOtherBorder,
    borderBottomLeftRadius: 4,
  },
  imageBubble: { padding: 0, backgroundColor: T.bubbleOther, borderWidth: 0.8, borderColor: T.bubbleOtherBorder },
  messageText: { fontSize: 14, lineHeight: 20, fontFamily: "Inter", fontWeight: "500" },
  myMessageText: { color: T.bubbleMeText },
  otherMessageText: { color: T.bubbleOtherText },
  imageCaptionText: {
    marginTop: 7,
    paddingHorizontal: 6,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter",
    fontWeight: "500",
    color: T.bubbleOtherText,
  },
  messageImage: { width: 215, height: 164, borderRadius: 4, backgroundColor: T.border },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: "rgba(17,24,39,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  uploadText: { color: T.bubbleMeText, fontSize: 12, fontFamily: "Inter", fontWeight: "600" },
  footer: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", marginTop: 4 },
  messageTime: { fontSize: 10, fontFamily: "Inter", fontWeight: "600" },
  myMessageTime: { color: T.bubbleMeTime },
  otherMessageTime: { color: T.bubbleOtherTime },
});