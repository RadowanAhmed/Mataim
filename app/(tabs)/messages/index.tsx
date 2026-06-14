import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConversationListItem } from "@/components/chat/ConversationListItem";
import { CHAT_THEME as T } from "@/components/chat/chatTheme";

const db = supabase as any;
const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&h=300&fit=crop";

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString("en-UG", { month: "short", day: "numeric" });
}

function getConversationName(conversation: any, userType?: string) {
  if (userType === "customer") {
    if (conversation.restaurant_id) return conversation.restaurant?.restaurant_name || "Restaurant";
    if (conversation.driver_id) return conversation.driver?.users?.full_name || "Driver";
  }

  return conversation.customer?.full_name || "Customer";
}

function getConversationImage(conversation: any, userType?: string) {
  if (userType === "customer") {
    if (conversation.restaurant_id) return conversation.restaurant?.image_url;
    if (conversation.driver_id) return conversation.driver?.users?.profile_image_url;
  }

  return conversation.customer?.profile_image_url;
}

function getConversationKind(conversation: any, userType?: string) {
  if (userType === "customer") {
    if (conversation.restaurant_id) return "Restaurant";
    if (conversation.driver_id) return "Driver";
  }
  return "Customer";
}

function unreadCount(conversation: any, userType?: string) {
  if (userType === "customer") return Number(conversation.unread_count_customer || 0);
  if (userType === "driver") return Number(conversation.unread_count_driver || 0);
  return Number(conversation.unread_count_restaurant || 0);
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const entrance = useRef(new Animated.Value(0)).current;

  const fetchConversations = useCallback(async () => {
    if (!user?.id) {
      setConversations([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      let query = db
        .from("conversations")
        .select(
          `
          *,
          customer:users!conversations_customer_id_fkey(id,full_name,profile_image_url,user_type),
          restaurant:restaurants!conversations_restaurant_id_fkey(id,restaurant_name,image_url),
          driver:delivery_users!conversations_driver_id_fkey(
            id,
            users!inner(id,full_name,profile_image_url),
            vehicle_type
          )
        `,
        )
        .eq("is_active", true)
        .order("last_message_at", { ascending: false });

      if (user.user_type === "customer") query = query.eq("customer_id", user.id);
      else if (user.user_type === "driver") query = query.eq("driver_id", user.id);
      else query = query.eq("restaurant_id", user.id);

      const { data, error } = await query;
      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Conversation list load failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.user_type]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!user?.id) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchConversations(), 400);
    };

    const filter =
      user.user_type === "customer"
        ? `customer_id=eq.${user.id}`
        : user.user_type === "driver"
          ? `driver_id=eq.${user.id}`
          : `restaurant_id=eq.${user.id}`;

    const channel = supabase
      .channel(`customer-conversations-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchConversations, user?.id, user?.user_type]);

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.last_message_at || b.created_at || 0).getTime() - new Date(a.last_message_at || a.created_at || 0).getTime()),
    [conversations],
  );

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedConversations;

    return sortedConversations.filter((conversation) => {
      const name = getConversationName(conversation, user?.user_type).toLowerCase();
      const kind = getConversationKind(conversation, user?.user_type).toLowerCase();
      const preview = String(conversation.last_message || "").toLowerCase();
      return name.includes(query) || kind.includes(query) || preview.includes(query);
    });
  }, [searchQuery, sortedConversations, user?.user_type]);

  useEffect(() => {
    if (loading) return;
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [conversations.length, entrance, loading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
  }, [fetchConversations]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <ActivityIndicator size="large" color={T.accent} />
        <Text style={styles.loadingText}>Loading messages</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Chats for your active and past orders</Text>
        </View>
      </View>

      <Animated.View
        style={[
          styles.searchShell,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="search-outline" size={18} color="#6B7280" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search conversations"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClear}>
            <Ionicons name="close" size={16} color="#6B7280" />
          </TouchableOpacity>
        ) : null}
      </Animated.View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} colors={[T.accent]} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={42} color={T.accent} />
            </View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? "No chats match your search." : "Restaurant and driver chats will appear here once an order is active."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ConversationListItem
            id={item.id}
            name={getConversationName(item, user?.user_type)}
            image={getConversationImage(item, user?.user_type) || FALLBACK_AVATAR}
            kind={getConversationKind(item, user?.user_type)}
            preview={item.last_message || "No messages yet"}
            time={formatTime(item.last_message_at || item.updated_at)}
            unread={unreadCount(item, user?.user_type)}
            onPress={() => router.push(`/(tabs)/messages/${item.id}` as any)}
            showChevron
          />
        )}
      />
      <View style={{ height: 0 }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background, paddingBottom: -50 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.background },
  loadingText: { marginTop: 10, fontSize: 14, fontFamily: "Inter", fontWeight: "500", color: T.muted },
  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: T.surface,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter", fontWeight: "600", color: T.ink },
  headerSubtitle: { marginTop: 2, fontSize: 13, fontFamily: "Inter", fontWeight: "500", color: T.muted },
  searchShell: {
    height: 54,
    marginHorizontal: 12,
    marginBottom: 22,
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: "#10101046",
    backgroundColor: T.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    top: 12
  },
  searchInput: { flex: 1, height: 52, fontSize: 14.5, fontFamily: "Inter", fontWeight: "600", color: T.ink, paddingVertical: 0 },
  searchClear: { width: 28, height: 28, borderRadius: 14, backgroundColor: T.inputBg, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 12, paddingBottom: 150, gap: 10 },
  conversationCard: {
    minHeight: 86,
    borderRadius: 8,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  conversationCardUnread: { borderColor: T.unreadBorder, backgroundColor: T.unreadBg },
  avatarWrap: { position: "relative" },
  avatar: { width: 58, height: 58, borderRadius: 8, backgroundColor: T.border },
  onlineDot: { position: "absolute", right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: T.online, borderWidth: 2, borderColor: T.surface },
  conversationBody: { flex: 1, minWidth: 0 },
  conversationTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  conversationName: { flex: 1, fontSize: 15, fontFamily: "Inter", fontWeight: "500", color: T.ink },
  timeText: { fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: T.subtle },
  conversationKind: { marginTop: 2, fontSize: 11, fontFamily: "Inter", fontWeight: "500", color: T.accent, textTransform: "uppercase" },
  lastMessage: { marginTop: 7, fontSize: 13, fontFamily: "Inter", fontWeight: "500", color: T.muted },
  lastMessageUnread: { color: T.ink, fontWeight: "500" },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadBadgeText: { color: T.bubbleMeText, fontSize: 11, fontFamily: "Inter", fontWeight: "500" },
  emptyState: { minHeight: 500, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  emptyIcon: { width: 94, height: 94, borderRadius: 32, backgroundColor: T.accentSoft, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 18, fontSize: 18, fontFamily: "Inter", fontWeight: "500", color: T.ink },
  emptyText: { marginTop: 7, fontSize: 14, lineHeight: 20, fontFamily: "Inter", fontWeight: "500", color: T.muted, textAlign: "center" },
});
