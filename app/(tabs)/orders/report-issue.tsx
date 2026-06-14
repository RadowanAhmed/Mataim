import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { formatUGX } from "@/backend/utils/currency";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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

const ACCENT = "#FF6B35";
const db = supabase as any;
const ISSUE_TYPES = [
  { id: "payment", label: "Payment", icon: "card-outline", color: "#2563EB" },
  { id: "delivery", label: "Delivery", icon: "bicycle-outline", color: ACCENT },
  { id: "food_quality", label: "Food Quality", icon: "restaurant-outline", color: "#EF4444" },
  { id: "app_bug", label: "App Bug", icon: "bug-outline", color: "#8B5CF6" },
  { id: "other", label: "Other", icon: "help-circle-outline", color: "#6B7280" },
];

type PastOrder = {
  id: string;
  order_number: string;
  restaurant_name: string;
  status: string;
  final_amount: number;
  created_at: string;
};

function normalizeParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value?: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-UG", { month: "short", day: "numeric" });
}

function orderLabel(order: PastOrder) {
  return `${order.restaurant_name} - #${order.order_number}`;
}

export default function ReportIssueScreen() {
  const params = useLocalSearchParams<{ orderId?: string; orderNumber?: string }>();
  const routeOrderId = normalizeParam(params.orderId);
  const routeOrderNumber = normalizeParam(params.orderNumber);
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orders, setOrders] = useState<PastOrder[]>([]);
  const [selectedIssueType, setSelectedIssueType] = useState("delivery");
  const [selectedOrderId, setSelectedOrderId] = useState(routeOrderId || "");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const selectedType = useMemo(
    () => ISSUE_TYPES.find((issue) => issue.id === selectedIssueType) || ISSUE_TYPES[0],
    [selectedIssueType],
  );

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  const fetchOrders = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await db
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          final_amount,
          created_at,
          restaurants (
            restaurant_name
          )
        `,
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      const mapped = (data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number || String(order.id).slice(0, 8),
        restaurant_name: order.restaurants?.restaurant_name || "Restaurant",
        status: order.status || "order",
        final_amount: Number(order.final_amount || 0),
        created_at: order.created_at,
      }));

      const nextOrders =
        routeOrderId && !mapped.some((order: PastOrder) => order.id === routeOrderId)
          ? [
            {
              id: routeOrderId,
              order_number: routeOrderNumber || String(routeOrderId).slice(0, 8),
              restaurant_name: "Selected order",
              status: "order",
              final_amount: 0,
              created_at: new Date().toISOString(),
            },
            ...mapped,
          ]
          : mapped;

      setOrders(nextOrders);
      setSelectedOrderId((current) => current || routeOrderId || nextOrders[0]?.id || "");
    } catch (error) {
      console.error("Issue order selector load failed:", error);
      Alert.alert("Orders unavailable", "We could not load your past orders.");
    } finally {
      setLoading(false);
    }
  }, [routeOrderId, routeOrderNumber, user?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const addPhoto = useCallback(
    async (source: "camera" | "library") => {
      if (photos.length >= 3) {
        Alert.alert("Photo limit reached", "You can attach up to 3 photos.");
        return;
      }

      try {
        const permission =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert("Permission needed", "Allow photo access to attach evidence.");
          return;
        }

        const picker = source === "camera" ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
        const result = await picker({
          mediaTypes: ["images"] as any,
          allowsEditing: true,
          quality: 0.78,
          base64: true,
        });

        const asset = !result.canceled ? result.assets?.[0] : null;
        if (!asset) return;

        const nextPhoto = asset.base64
          ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
          : asset.uri;
        setPhotos((current) => [...current, nextPhoto].slice(0, 3));
      } catch (error) {
        console.error("Issue photo attach failed:", error);
        Alert.alert("Photo not attached", "Please try again.");
      }
    },
    [photos.length],
  );

  const removePhoto = useCallback((index: number) => {
    setPhotos((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const submitIssue = useCallback(async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in before reporting an issue.");
      return;
    }

    if (!selectedOrderId) {
      Alert.alert("Select an order", "Choose the order this issue is related to.");
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      Alert.alert("Add details", "Please describe the issue in at least 10 characters.");
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await db.from("order_issues").insert({
        order_id: selectedOrderId,
        user_id: user.id,
        issue_type: selectedIssueType,
        description: description.trim(),
        images: photos,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (error) {
      console.error("Issue submit failed:", error);
      Alert.alert("Could not submit", "Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }, [description, photos, selectedIssueType, selectedOrderId, user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading issue form</Text>
      </SafeAreaView>
    );
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={70} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Issue submitted</Text>
          <Text style={styles.successText}>
            Our support team will review your report and respond as soon as possible.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()} activeOpacity={0.88}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace("/(tabs)/orders" as any)}>
            <Text style={styles.secondaryButtonText}>View orders</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={21} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Report an Issue</Text>
          <Text style={styles.headerSubtitle}>Tell support what happened</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: `${selectedType.color}14` }]}>
                <Ionicons name={selectedType.icon as any} size={18} color={selectedType.color} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Issue type</Text>
                <Text style={styles.sectionHint}>Choose the closest category</Text>
              </View>
            </View>
            <View style={styles.pickerShell}>
              <Picker
                selectedValue={selectedIssueType}
                onValueChange={(value) => setSelectedIssueType(String(value))}
                dropdownIconColor="#111827"
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {ISSUE_TYPES.map((issue) => (
                  <Picker.Item key={issue.id} label={issue.label} value={issue.id} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="receipt-outline" size={18} color={ACCENT} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Order</Text>
                <Text style={styles.sectionHint}>Select from your past orders</Text>
              </View>
            </View>
            <View style={styles.pickerShell}>
              <Picker
                selectedValue={selectedOrderId}
                onValueChange={(value) => setSelectedOrderId(String(value))}
                dropdownIconColor="#111827"
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                <Picker.Item label="Select order" value="" />
                {orders.map((order) => (
                  <Picker.Item key={order.id} label={orderLabel(order)} value={order.id} />
                ))}
              </Picker>
            </View>
            {selectedOrder ? (
              <View style={styles.orderPreview}>
                <Text style={styles.orderPreviewTitle} numberOfLines={1}>
                  {selectedOrder.restaurant_name}
                </Text>
                <Text style={styles.orderPreviewMeta}>
                  #{selectedOrder.order_number} | {formatDate(selectedOrder.created_at)} | {formatUGX(selectedOrder.final_amount)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what went wrong..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={1000}
              style={styles.descriptionInput}
              textAlignVertical="top"
            />
            <Text style={styles.countText}>{description.length}/1000</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="images-outline" size={18} color={ACCENT} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Photos</Text>
                <Text style={styles.sectionHint}>Attach up to 3 photos</Text>
              </View>
            </View>
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoButton} onPress={() => addPhoto("camera")}>
                <Ionicons name="camera-outline" size={20} color="#111827" />
                <Text style={styles.photoButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={() => addPhoto("library")}>
                <Ionicons name="image-outline" size={20} color="#111827" />
                <Text style={styles.photoButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {photos.length ? (
              <View style={styles.photoGrid}>
                {photos.map((photo, index) => (
                  <View key={`${photo}-${index}`} style={styles.photoPreviewWrap}>
                    <Image source={{ uri: photo }} style={styles.photoPreview} />
                    <TouchableOpacity style={styles.removePhotoButton} onPress={() => removePhoto(index)}>
                      <Ionicons name="close" size={15} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={19} color="#6B7280" />
            <Text style={styles.infoText}>
              Support will use your order details, message, and photos to investigate the issue.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()} disabled={submitting}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.disabledButton]}
            onPress={submitIssue}
            disabled={submitting}
            activeOpacity={0.88}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={17} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submit</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  keyboard: { flex: 1 },
  centerScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC", padding: 24 },
  loadingText: { marginTop: 10, fontSize: 14, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  header: { minHeight: 70, paddingHorizontal: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  iconButton: { width: 42, height: 42, borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#e5e7ebb6", alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17.6, fontFamily: "Inter", fontWeight: "600", color: "#111827", letterSpacing: 0.4 },
  headerSubtitle: { marginTop: 2, fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  headerSpacer: { width: 42 },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 12, paddingBottom: 190, gap: 13 },
  card: { borderRadius: 8, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#e5e7ebc5", padding: 12, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#FFF1ED", alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 14.8, fontFamily: "Inter", fontWeight: "600", color: "#111827", letterSpacing: 0.2 },
  sectionHint: { marginTop: 2, fontSize: 12.4, fontFamily: "Inter", fontWeight: "500", color: "#6B7280", letterSpacing: 0.2 },
  pickerShell: { height: 46, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7ebbb", backgroundColor: "#F9FAFB", overflow: "hidden", justifyContent: "center" },
  picker: { color: "#111827", fontFamily: "Inter", fontWeight: "500" },
  pickerItem: { fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  orderPreview: { borderRadius: 8, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E5E7EB", padding: 11 },
  orderPreviewTitle: { fontSize: 14, fontFamily: "Inter", fontWeight: "500", color: "#111827", letterSpacing: 0.2 },
  orderPreviewMeta: { marginTop: 3, fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280", letterSpacing: 0.2 },
  descriptionInput: { minHeight: 132, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7ebb8", backgroundColor: "#F9FAFB", padding: 12, fontSize: 14, lineHeight: 20, fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  countText: { alignSelf: "flex-end", fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#9CA3AF" },
  photoActions: { flexDirection: "row", gap: 10 },
  photoButton: { flex: 1, minHeight: 46, borderRadius: 8, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  photoButtonText: { fontSize: 13, fontFamily: "Inter", fontWeight: "500", color: "#111827" },
  photoGrid: { flexDirection: "row", gap: 10 },
  photoPreviewWrap: { position: "relative" },
  photoPreview: { width: 76, height: 76, borderRadius: 8, backgroundColor: "#E5E7EB" },
  removePhotoButton: { position: "absolute", top: -7, right: -7, width: 24, height: 24, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  infoCard: { borderRadius: 8, backgroundColor: "#F3F4F6", padding: 13, flexDirection: "row", gap: 9 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, paddingBottom: Platform.OS === "ios" ? 28 : 74, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#e5e7ebb9", flexDirection: "row", gap: 10 },
  cancelButton: { flex: 0.9, height: 48, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  cancelButtonText: { fontSize: 14, fontFamily: "Inter", fontWeight: "500", color: "#111827", letterSpacing: 0.2 },
  submitButton: { flex: 1.2, height: 48, borderRadius: 8, backgroundColor: ACCENT, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitButtonText: { fontSize: 14, fontFamily: "Inter", fontWeight: "500", color: "#FFFFFF", letterSpacing: 0.2 },
  disabledButton: { opacity: 0.65 },
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  successIcon: { width: 84, height: 84, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: "#ECFDF5" },
  successTitle: { marginTop: 12, fontSize: 18, fontFamily: "Inter", fontWeight: "600", color: "#111827", textAlign: "center", letterSpacing: 0.2 },
  successText: { marginTop: 8, fontSize: 14, lineHeight: 20, fontFamily: "Inter", fontWeight: "500", color: "#6B7280", textAlign: "center", letterSpacing: 0.2 },
  primaryButton: { marginTop: 12, height: 48, alignSelf: "stretch", borderRadius: 8, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 14, fontFamily: "Inter", fontWeight: "500", color: "#FFFFFF", letterSpacing: 0.2 },
  secondaryButton: { marginTop: 2, height: 48, alignSelf: "stretch", borderRadius: 8, borderWidth: 1, borderColor: "#e5e7ebc0", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 14, fontFamily: "Inter", fontWeight: "500", color: "#111827", letterSpacing: 0.3 },
});
