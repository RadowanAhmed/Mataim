// app/(driver)/messages/[id].tsx
import { useAuth } from "@/backend/AuthContext";
import { useChatThread } from "@/backend/hooks/useChatThread";
import { QUICK_MESSAGES } from "@/backend/services/chatService";
import { DriverModalPanel, DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import { MessageList } from "@/components/chat/MessageList";
import { QuickMessages } from "@/components/chat/QuickMessages";
import { CHAT_THEME as T } from "@/components/chat/chatTheme";
import { Ionicons } from "@expo/vector-icons";
import { Image as CachedImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/backend/supabase";

const db = supabase as any;
const IMAGE_MEDIA_TYPES: ImagePicker.MediaType[] = ["images"];

export default function DriverChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth() as any;
  const [conversation, setConversation] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [mediaSheetVisible, setMediaSheetVisible] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ uri: string; mimeType?: string | null } | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Near other useState declarations
  const [isNearBottom, setIsNearBottom] = useState(true);




  // ---------- Scroll‑lock mechanism ----------
  const previousScrollOffset = useRef(0);
  const previousContentHeight = useRef(0);
  const lockScroll = useRef(false);

  const {
    messages,
    loading,
    sending,
    typingText,
    sendText,
    sendImage,
    updateTyping,
  } = useChatThread({
    conversationId: id,
    senderId: user?.id,
    senderType: "driver",
    enabled: Boolean(id && user?.id),
  });

  const fetchConversation = useCallback(async () => {
    if (!id || !user?.id) return;
    const { data } = await db
      .from("conversations")
      .select(`
        *,
        customer:users!conversations_customer_id_fkey(id, full_name, phone, profile_image_url),
        restaurant:restaurants!conversations_restaurant_id_fkey(id, restaurant_name, image_url)
      `)
      .eq("id", id)
      .eq("driver_id", user.id)
      .maybeSingle();
    setConversation(data || null);
  }, [id, user?.id]);

  useEffect(() => {
    fetchConversation();
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [fetchConversation]);

  const handleTyping = async (value: string) => {
    setMessage(value);
    await updateTyping(value);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => updateTyping(""), 1200);
  };

  const handleSend = async (preset?: string) => {
    const text = (preset || message).trim();
    if (!text || sending) return;

    const result = await sendText(text);
    if (result.success) {
      setMessage("");
      return;
    }
    Alert.alert("Send failed", result.error || "Could not send your message.");
  };

  const selectPhoto = async (source: "camera" | "library") => {
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
      setPendingImage({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
      setImageCaption("");
    }
  };

  const sendPhoto = async () => {
    if (!pendingImage || sending) return;

    const uri = pendingImage.uri;
    const mimeType = pendingImage.mimeType;
    const caption = imageCaption.trim();
    setPendingImage(null);
    setImageCaption("");

    const result = await sendImage(uri, mimeType, caption);
    if (!result.success) {
      Alert.alert("Photo failed", result.error || "Could not upload the image.");
    }
  };


  // Update handleScroll to set isNearBottom
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const offset = contentOffset.y;
    const contentHeight = contentSize.height;
    const viewHeight = layoutMeasurement.height;

    previousScrollOffset.current = offset;
    previousContentHeight.current = contentHeight;

    const threshold = 50;
    const distanceFromBottom = contentHeight - viewHeight - offset;
    const nearBottom = distanceFromBottom <= threshold;
    setIsNearBottom(nearBottom);
    lockScroll.current = !nearBottom;
  }, []);


  // ---------- Restore scroll position after new messages ----------
  const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    if (lockScroll.current && listRef.current) {
      const diff = contentHeight - previousContentHeight.current;
      const newOffset = Math.max(0, previousScrollOffset.current + diff);
      // Use scrollToOffset to maintain exact position
      listRef.current?.scrollToOffset({ offset: newOffset, animated: false });
    }
    previousContentHeight.current = contentHeight;
  }, []);

  const title = conversation?.customer?.full_name || conversation?.restaurant?.restaurant_name || "Delivery Chat";
  const subtitle = conversation?.restaurant_id && conversation?.customer_id ? "Customer and restaurant" : "Order messages";

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color={T.accent} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={T.surface} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrDriverFallback(router, "/(driver)/messages", navigation)}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{typingText || subtitle}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : "padding"}>
        {/* Pass the new callbacks to MessageList */}
        <MessageList
          messages={messages}
          currentUserId={user?.id}
          listRef={listRef}
          onImagePress={setFullscreenImage}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          shouldAutoScroll={isNearBottom}          // only auto‑scroll when near bottom
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
        <QuickMessages
          messages={QUICK_MESSAGES.driver}
          onSelect={(text) => {
            setMessage(text);
            inputRef.current?.focus();
          }}
        />
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.attachButton} onPress={() => setMediaSheetVisible(true)}>
            <Ionicons name="image-outline" size={21} color={T.muted} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={message}
            onChangeText={handleTyping}
            placeholder="Type delivery update..."
            placeholderTextColor="#9CA3AF"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (sending || !message.trim()) && styles.sendButtonDisabled]}
            onPress={() => handleSend()}
            disabled={sending || !message.trim()}
          >
            {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Bottom sheet for media picker – unchanged */}
      <Modal transparent visible={mediaSheetVisible} animationType="fade" onRequestClose={() => setMediaSheetVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMediaSheetVisible(false)}>
          <DriverModalPanel style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity style={styles.sheetAction} onPress={() => selectPhoto("camera")}>
              <Ionicons name="camera-outline" size={22} color="#111827" />
              <Text style={styles.sheetActionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetAction} onPress={() => selectPhoto("library")}>
              <Ionicons name="images-outline" size={22} color="#111827" />
              <Text style={styles.sheetActionText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </DriverModalPanel>
        </TouchableOpacity>
      </Modal>

      {/* Image preview modal – unchanged */}
      <Modal visible={Boolean(pendingImage)} animationType="slide" onRequestClose={() => setPendingImage(null)}>
        <SafeAreaView style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setPendingImage(null)}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Send photo</Text>
            <TouchableOpacity style={styles.previewSendButton} onPress={sendPhoto} disabled={sending}>
              {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={20} color="#FFFFFF" />}
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
          </View>
        </SafeAreaView>
      </Modal>

      {/* Fullscreen image modal – unchanged */}
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

// ---------- Styles (unchanged, Inter already applied) ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background, marginBottom: -20 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.background },
  loadingText: { marginTop: 10, fontSize: 12, color: T.muted, fontWeight: "500", fontFamily: "Inter" },
  header: { flexDirection: "row", alignItems: "center", padding: 15, backgroundColor: T.surface, borderBottomWidth: 0.8, borderBottomColor: T.border },
  backButton: { width: 38, height: 38, borderRadius: 8, backgroundColor: T.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: T.border },
  headerText: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, color: T.ink, fontWeight: "700", fontFamily: "Inter" },
  headerSubtitle: { fontSize: 12, color: T.muted, marginTop: 2, fontWeight: "500", fontFamily: "Inter" },
  headerSpacer: { width: 38 },
  keyboardView: { flex: 1, backgroundColor: T.background },
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
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, backgroundColor: T.surface, borderTopWidth: 0.8, borderTopColor: T.border, paddingBottom: 32 + (Platform.OS === "ios" ? 20 : 0) },
  attachButton: { width: 50, height: 50, borderRadius: 12, backgroundColor: T.inputBg, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: T.background,
    borderWidth: 0.8,
    borderColor: T.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 13.5,
    fontSize: 14.2,
    color: T.ink,
    fontFamily: "Inter",
    fontWeight: "600",
  },
  sendButton: { width: 50, height: 50, borderRadius: 12, backgroundColor: T.accent, alignItems: "center", justifyContent: "center" },
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