// app/(customer)/chat/[id].tsx
import { useAuth } from "@/backend/AuthContext";
import { useChatThread } from "@/backend/hooks/useChatThread";
import { supabase } from "@/backend/supabase";
import { MessageList } from "@/components/chat/MessageList";
import { Ionicons } from "@expo/vector-icons";
import { Image as CachedImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CHAT_THEME as T } from "@/components/chat/chatTheme";

const db = supabase as any;
const QUICK_REPLIES = ["Where is my order?", "Thank you", "Please hurry", "Gate code?", "I am outside"];
const IMAGE_MEDIA_TYPES: ImagePicker.MediaType[] = ["images"];

type Participant = {
  id: string;
  type: "restaurant" | "driver";
  name: string;
  image?: string | null;
  phone?: string | null;
};

export default function ChatScreen() {
  const { id, restaurantId, driverId } = useLocalSearchParams<{
    id: string;
    restaurantId?: string;
    driverId?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<any>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [messageText, setMessageText] = useState("");
  const [connected, setConnected] = useState(false);
  const [mediaSheetVisible, setMediaSheetVisible] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ uri: string; mimeType?: string | null } | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    messages,
    loading,
    refreshing,
    sending,
    typingText: threadTyping,
    refresh,
    sendText,
    sendImage,
    updateTyping,
  } = useChatThread({
    conversationId: id,
    senderId: user?.id,
    senderType: "customer",
    enabled: Boolean(id && user?.id),
  });

  const typingText = threadTyping
    ? threadTyping === "Typing..."
      ? `${participant?.name || "They"} is typing...`
      : threadTyping
    : "";

  const resolveParticipant = useCallback(
    async (row: any, threadMessages: any[] = []): Promise<Participant | null> => {
      if (!row) return null;

      const myId = user?.id;
      const wantsDriver = Boolean(driverId);
      const wantsRestaurant = Boolean(restaurantId);

      const buildDriver = async () => {
        const uid = row.driver_id || driverId;
        if (!uid) return null;
        const { data: profile } = await db
          .from("users")
          .select("full_name, profile_image_url, phone")
          .eq("id", uid)
          .maybeSingle();
        return {
          id: uid,
          type: "driver",
          name: profile?.full_name || "Driver",
          image: profile?.profile_image_url,
          phone: profile?.phone,
        };
      };

      const buildRestaurant = async () => {
        const { data: owner } = await db.from("users").select("phone").eq("id", row.restaurant_id || restaurantId).maybeSingle();
        return {
          id: row.restaurant_id || restaurantId!,
          type: "restaurant" as const,
          name: row.restaurant?.restaurant_name || "Restaurant",
          image: row.restaurant?.image_url,
          phone: owner?.phone || null,
        };
      };

      if (wantsDriver && (row.driver_id || driverId)) return await buildDriver();
      if (wantsRestaurant && (row.restaurant_id || restaurantId)) return await buildRestaurant();

      const lastOther = [...threadMessages].reverse().find((msg) => msg.sender_id && msg.sender_id !== myId);
      if (lastOther?.sender_type === "driver" && row.driver_id) return await buildDriver();
      if (lastOther?.sender_type === "restaurant" && row.restaurant_id) return await buildRestaurant();

      const hasDriver = Boolean(row.driver_id && row.driver_id !== myId);
      const hasRestaurant = Boolean(row.restaurant_id && row.restaurant_id !== myId);
      if (hasDriver && !hasRestaurant) return await buildDriver();
      if (hasRestaurant && !hasDriver) return await buildRestaurant();
      if (hasDriver) return await buildDriver();
      if (hasRestaurant) return await buildRestaurant();

      if (driverId) return { id: driverId, type: "driver", name: "Driver" };
      if (restaurantId) return { id: restaurantId, type: "restaurant", name: "Restaurant" };
      return null;
    },
    [driverId, restaurantId, user?.id],
  );

  const loadConversationMeta = useCallback(async () => {
    if (!id || !user?.id) return;

    try {
      const { data: conversationData, error: conversationError } = await db
        .from("conversations")
        .select(
          `
          *,
          restaurant:restaurants!conversations_restaurant_id_fkey(id,restaurant_name,image_url,address),
          driver:delivery_users!conversations_driver_id_fkey(
            id,
            vehicle_type,
            rating,
            users!inner(id,full_name,profile_image_url,phone)
          )
        `,
        )
        .eq("id", id)
        .maybeSingle();

      if (conversationError) throw conversationError;

      setConversation(conversationData);
      setParticipant(await resolveParticipant(conversationData, messages));
    } catch (error) {
      console.error("Chat meta load failed:", error);
      Alert.alert("Chat unavailable", "We could not load this conversation.");
    }
  }, [id, messages, resolveParticipant, user?.id]);

  useEffect(() => {
    loadConversationMeta();
  }, [loadConversationMeta]);

  useEffect(() => {
    if (!conversation) return;
    resolveParticipant(conversation, messages).then(setParticipant);
  }, [conversation, messages, resolveParticipant]);

  useEffect(() => {
    if (!id || !user?.id) return;

    const channel = supabase
      .channel(`customer-chat-status-${id}-${user.id}`)
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [id, user?.id]);

  const onRefresh = useCallback(async () => {
    await Promise.all([refresh(), loadConversationMeta()]);
  }, [loadConversationMeta, refresh]);

  const handleTyping = useCallback(
    async (value: string) => {
      setMessageText(value);
      await updateTyping(value);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => updateTyping(""), 1200);
    },
    [updateTyping],
  );

  const sendMessage = useCallback(async () => {
    const text = messageText.trim();
    if (!text || !user?.id || !id || sending) return;

    const result = await sendText(text);
    if (!result.success) {
      Alert.alert("Send failed", result.error || "Please try again.");
      return;
    }

    setMessageText("");
  }, [id, messageText, sendText, sending]);

  const selectPhoto = useCallback(async (source: "camera" | "library") => {
    setMediaSheetVisible(false);

    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        source === "camera" ? "Allow camera access to take a photo." : "Allow photo access to choose an image.",
      );
      return;
    }

    const picker = source === "camera" ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await picker({
      mediaTypes: IMAGE_MEDIA_TYPES,
      quality: 0.72,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setPendingImage({
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType,
      });
      setImageCaption("");
    }
  }, []);

  const sendPhoto = useCallback(async () => {
    if (!pendingImage || !id || !user?.id || sending) return;

    const uri = pendingImage.uri;
    const mimeType = pendingImage.mimeType;
    const caption = imageCaption.trim();
    setPendingImage(null);
    setImageCaption("");

    const result = await sendImage(uri, mimeType, caption);
    if (!result.success) {
      Alert.alert("Photo failed", result.error || "Could not upload the image.");
      return;
    }

  }, [id, imageCaption, pendingImage, sendImage, sending]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <ActivityIndicator size="large" color={T.accent} />
        <Text style={styles.loadingText}>Loading chat</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={T.surface} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "padding"} style={styles.keyboard}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <CachedImage source={{ uri: participant?.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200" }} style={styles.headerAvatar} />
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>{participant?.name || "Chat"}</Text>
            <Text style={styles.headerStatus}>{typingText || (connected ? "Online" : "Connecting...")}</Text>
          </View>
          {participant?.phone ? (
            <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL(`tel:${participant.phone}`)}>
              <Ionicons name="call-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <View style={styles.messagesWrap}>
          <MessageList
            messages={messages}
            currentUserId={user?.id}
            listRef={listRef}
            onImagePress={setFullscreenImage}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
          {typingText ? (
            <View style={styles.typingPill}>
              <View style={styles.typingDots}>
                <View style={styles.typingDot} />
                <View style={styles.typingDot} />
                <View style={styles.typingDot} />
              </View>
              <Text style={styles.typingPillText}>{typingText}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.quickRail}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickContent}>
            {QUICK_REPLIES.map((item) => (
              <TouchableOpacity key={item} style={styles.quickChip} onPress={() => setMessageText(item)}>
                <Text style={styles.quickText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.attachButton} onPress={() => setMediaSheetVisible(true)}>
            <Ionicons name="image-outline" size={21} color={T.muted} />
          </TouchableOpacity>
          <TextInput
            value={messageText}
            onChangeText={handleTyping}
            placeholder={`Message ${participant?.type || "support"}...`}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            style={styles.input}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal transparent visible={mediaSheetVisible} animationType="fade" onRequestClose={() => setMediaSheetVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMediaSheetVisible(false)}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity style={styles.sheetAction} onPress={() => selectPhoto("camera")}>
              <Ionicons name="camera-outline" size={22} color="#111827" />
              <Text style={styles.sheetActionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetAction} onPress={() => selectPhoto("library")}>
              <Ionicons name="images-outline" size={22} color="#111827" />
              <Text style={styles.sheetActionText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={Boolean(pendingImage)} animationType="slide" onRequestClose={() => setPendingImage(null)}>
        <SafeAreaView style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setPendingImage(null)}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Send photo</Text>
            <TouchableOpacity style={styles.previewSendButton} onPress={sendPhoto} disabled={sending}>
              {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
          {pendingImage ? <CachedImage source={{ uri: pendingImage.uri }} style={styles.previewImage} contentFit="contain" cachePolicy="memory-disk" /> : null}
          <View style={styles.captionBar}>
            <TextInput
              value={imageCaption}
              onChangeText={setImageCaption}
              placeholder="Add a caption..."
              placeholderTextColor="#9CA3AF"
              style={styles.captionInput}
            />
            {sending ? <ActivityIndicator size="small" color={T.accent} /> : null}
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={Boolean(fullscreenImage)} animationType="fade" onRequestClose={() => setFullscreenImage(null)}>
        <View style={styles.fullscreen}>
          <TouchableOpacity style={styles.fullscreenClose} onPress={() => setFullscreenImage(null)}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {fullscreenImage ? <CachedImage source={{ uri: fullscreenImage }} style={styles.fullscreenImage} contentFit="contain" cachePolicy="memory-disk" /> : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background, marginBottom: -20 },
  keyboard: { flex: 1, marginBottom: 70 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.background },
  loadingText: { marginTop: 10, fontSize: 12, color: T.muted, fontWeight: "500", fontFamily: "Inter" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingBottom: 10,
    paddingLeft: 10,
    backgroundColor: T.surface,
    borderBottomWidth: 0.8,
    borderBottomColor: T.border,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 43,
    height: 43,
    borderRadius: 24,
    backgroundColor: T.border,
    marginLeft: 9,
  },
  headerText: { flex: 1, alignItems: "center", marginHorizontal: 0, marginRight: 198, gap: 2, },
  headerName: { fontSize: 16, color: T.ink, fontWeight: "700", fontFamily: "Inter" },
  headerStatus: { fontSize: 12, color: T.muted, marginTop: 2, fontWeight: "500", fontFamily: "Inter" },
  callButton: {
    width: 42,
    height: 42,
    borderRadius: 24,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.8,
    borderColor: T.accentBorder,
  },
  headerSpacer: { width: 42 },
  messagesWrap: { flex: 1, backgroundColor: T.background },
  typingPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  typingDots: { flexDirection: "row", alignItems: "center", gap: 3 },
  typingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.accent },
  typingPillText: { color: T.muted, fontSize: 12, fontWeight: "500", fontFamily: "Inter" },
  quickRail: { minHeight: 54, backgroundColor: T.surface, borderTopWidth: 0.8, borderTopColor: T.border },
  quickContent: { paddingHorizontal: 14, paddingVertical: 6, gap: 8, marginTop: 4 },
  quickChip: {
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: T.accentSoft,
    borderWidth: 1,
    borderColor: T.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: T.accentChipText },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, backgroundColor: T.surface, borderTopWidth: 0.8, borderTopColor: T.border, paddingBottom: 32 + (Platform.OS === "ios" ? 20 : 0) },

  attachButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: T.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: T.background,
    borderWidth: 0.8,
    borderColor: T.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 13.5,
    fontSize: 14.2,
    color: T.ink,
    fontFamily: "Inter",
    fontWeight: "600",
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { opacity: 0.7 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.35)" },
  bottomSheet: { backgroundColor: T.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 8 },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: T.border, marginBottom: 6 },
  sheetAction: { height: 54, borderRadius: 10, backgroundColor: T.background, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 12 },
  sheetActionText: { fontSize: 15, fontFamily: "Inter", fontWeight: "700", color: T.ink },
  previewContainer: { flex: 1, backgroundColor: T.background },
  previewHeader: { height: 64, paddingHorizontal: 13.5, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previewTitle: { fontSize: 16, fontFamily: "Inter", fontWeight: "600", color: T.ink },
  previewSendButton: { width: 50, height: 50, borderRadius: 12, backgroundColor: T.accent, alignItems: "center", justifyContent: "center" },
  previewImage: { flex: 1, marginHorizontal: 12, borderRadius: 8, backgroundColor: T.ink },
  captionBar: { padding: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.surface, borderTopWidth: 0.8, borderTopColor: T.border },
  captionInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: T.background,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 12,
    fontFamily: "Inter",
    fontWeight: "500",
    color: T.ink,
  },
  fullscreen: { flex: 1, backgroundColor: "#000000" },
  fullscreenClose: { position: "absolute", top: 48, right: 18, zIndex: 2, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  fullscreenImage: { flex: 1 },
});