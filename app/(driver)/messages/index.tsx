// app/(driver)/messages/index.tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import {
  useAuth
} from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConversationListItem } from "@/components/chat/ConversationListItem";
import { CHAT_THEME as T } from "@/components/chat/chatTheme";

const db = supabase as any;
const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=300&h=300&fit=crop";

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

function getConversationName(conversation: any) {
  return conversation.customer?.full_name || conversation.restaurant?.restaurant_name || "Conversation";
}

function getConversationImage(conversation: any) {
  return conversation.customer?.profile_image_url || conversation.restaurant?.image_url || FALLBACK_AVATAR;
}

function getConversationKind(conversation: any) {
  if (conversation.customer_id) return "Customer";
  if (conversation.restaurant_id) return "Restaurant";
  return "Delivery";
}

function getDriverUnreadCount(conversation: any) {
  return Number(conversation.unread_count_driver || 0);
}

export default function DriverMessagesScreen() {
  const router = useRouter();

  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<any[]>([]);
  const entrance = useRef(new Animated.Value(0)).current;

  const fetchConversations = useCallback(async () => {
    if (!user?.id) {
      setConversations([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error } = await db
        .from("conversations")
        .select(
          `
          *,
          customer:users!conversations_customer_id_fkey(id,full_name,profile_image_url,phone),
          restaurant:restaurants!conversations_restaurant_id_fkey(id,restaurant_name,image_url,address)
        `,
        )
        .eq("driver_id", user.id)
        .eq("is_active", true)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error loading driver messages:", error);
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

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

    const channel = supabase
      .channel(`driver-conversations-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `driver_id=eq.${user.id}` },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchConversations, user?.id]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sorted = [...conversations].sort(
      (a, b) =>
        new Date(b.last_message_at || b.updated_at || 0).getTime() -
        new Date(a.last_message_at || a.updated_at || 0).getTime(),
    );

    if (!query) return sorted;

    return sorted.filter((conversation) => {
      const name = getConversationName(conversation).toLowerCase();
      const kind = getConversationKind(conversation).toLowerCase();
      const preview = String(conversation.last_message || "").toLowerCase();
      return name.includes(query) || kind.includes(query) || preview.includes(query);
    });
  }, [conversations, searchQuery]);

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
        <ActivityIndicator color={T.accent} size="large" />
        <Text style={styles.loadingText}>Loading messages</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrDriverFallback(router, "/(driver)/dashboard", navigation)}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Customers and restaurant teams</Text>
        </View>
        <View style={styles.headerSpacer} />
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
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClear} activeOpacity={0.8}>
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
              {searchQuery ? "No chats match your search." : "Delivery chats appear here when an order needs coordination."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ConversationListItem
            id={item.id}
            name={getConversationName(item)}
            image={getConversationImage(item)}
            kind={getConversationKind(item)}
            preview={item.last_message || "No messages yet"}
            time={formatTime(item.last_message_at || item.updated_at)}
            unread={getDriverUnreadCount(item)}
            onPress={() => router.push(`/(driver)/messages/${item.id}` as any)}
            showChevron
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.background },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.background },
  loadingText: { marginTop: 10, fontSize: 16, color: T.muted, fontWeight: "500", fontFamily: "Inter" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: T.surface,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", },
  headerText: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 19, color: T.ink, fontWeight: "700", fontFamily: "Inter" },
  headerSubtitle: { fontSize: 12, color: T.muted, marginTop: 2, fontWeight: "500", fontFamily: "Inter" },
  headerSpacer: { width: 38 },
  searchShell: { height: 54, marginHorizontal: 12, marginBottom: 12, borderRadius: 8, borderWidth: 0.3, borderColor: "#101010", backgroundColor: T.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8, marginTop: 12 },
  searchInput: { flex: 1, height: 52, fontSize: 14, color: T.ink, paddingVertical: 0, fontWeight: "500", fontFamily: "Inter" },
  searchClear: { width: 28, height: 28, borderRadius: 14, backgroundColor: T.inputBg, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 12, paddingBottom: 120, gap: 10 },
  conversationCard: { minHeight: 86, borderRadius: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  conversationCardUnread: { borderColor: T.unreadBorder, backgroundColor: T.unreadBg },
  avatarWrap: { position: "relative" },
  avatar: { width: 58, height: 58, borderRadius: 8, backgroundColor: T.border },
  onlineDot: { position: "absolute", right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: T.online, borderWidth: 2, borderColor: T.surface },
  conversationBody: { flex: 1, minWidth: 0 },
  conversationTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  conversationName: { flex: 1, fontSize: 15, color: T.ink, fontWeight: "700", fontFamily: "Inter" },
  timeText: { fontSize: 11, color: T.subtle, fontWeight: "500", fontFamily: "Inter" },
  conversationKind: { marginTop: 2, fontSize: 11, color: T.accent, textTransform: "uppercase", fontWeight: "600", fontFamily: "Inter" },
  lastMessage: { marginTop: 7, fontSize: 13, color: T.muted, fontWeight: "500", fontFamily: "Inter" },
  lastMessageUnread: { color: T.ink },
  unreadBadge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: T.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  unreadBadgeText: { color: T.bubbleMeText, fontSize: 11, fontWeight: "700", fontFamily: "Inter" },
  emptyState: { minHeight: 500, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  emptyIcon: { width: 94, height: 94, borderRadius: 32, backgroundColor: T.accentSoft, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 18, fontSize: 21, color: T.ink, fontWeight: "700", fontFamily: "Inter" },
  emptyText: { marginTop: 7, fontSize: 14, lineHeight: 20, color: T.muted, textAlign: "center", fontWeight: "500", fontFamily: "Inter" },
});
