import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

const db = supabase as any;
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCENT = "#FF6B35";
const FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=700&h=520&fit=crop";

function StarRatingInput({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <View style={styles.ratingBlock}>
            <Text style={styles.ratingLabel}>{label}</Text>
            <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        activeOpacity={0.8}
                        onPress={() => onChange(star)}
                        style={styles.starButton}
                    >
                        <Ionicons
                            name={star <= value ? "star" : "star-outline"}
                            size={28}
                            color={star <= value ? ACCENT : "#9CA3AF"}
                        />
                    </TouchableOpacity>
                ))}
            </View>
            <Text style={styles.ratingHint}>Tap to rate from 1 to 5 stars</Text>
        </View>
    );
}

export default function OrderRatingScreen() {
    const params = useLocalSearchParams<{ orderId: string }>();
    const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
    const router = useRouter();
    const { user } = useAuth();
    const [order, setOrder] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [restaurantRating, setRestaurantRating] = useState(0);
    const [foodRating, setFoodRating] = useState(0);
    const [deliveryRating, setDeliveryRating] = useState(0);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const loadOrder = useCallback(async () => {
        if (!orderId || !user?.id) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await db
                .from("orders")
                .select(
                    `
          id,
          order_number,
          restaurant_id,
          status,
          delivery_address,
          created_at,
          driver_id,
          restaurants!orders_restaurant_id_fkey(id,restaurant_name,image_url)
        `,
                )
                .eq("id", orderId)
                .eq("customer_id", user.id)
                .maybeSingle();

            if (error) throw error;
            const preparedOrder = data
                ? {
                    ...data,
                    restaurant_name: data.restaurants?.restaurant_name || data.restaurant_name,
                    restaurant_image: data.restaurants?.image_url || data.restaurant_image,
                }
                : null;
            setOrder(preparedOrder);

            const { data: orderItems, error: itemError } = await db
                .from("order_items")
                .select(
                    `
          id,
          quantity,
          item_name,
          item_image_url,
          posts:posts!order_items_post_id_fkey(title,image_url),
          menu_items:menu_items!order_items_menu_item_id_fkey(name,image_url)
        `,
                )
                .eq("order_id", orderId);

            if (itemError) throw itemError;
            setItems(orderItems || []);
        } catch (error) {
            console.error("Failed to load order for rating:", error);
            Alert.alert("Unable to load rating details", "Please try again later.");
        } finally {
            setLoading(false);
        }
    }, [orderId, user?.id]);

    useEffect(() => {
        setRestaurantRating(0);
        setFoodRating(0);
        setDeliveryRating(0);
        setComment("");
        setItems([]);
        setOrder(null);
        setSubmitting(false);
        setSubmitted(false);
        setLoading(true);
    }, [orderId]);

    useEffect(() => {
        loadOrder();
    }, [loadOrder]);

    const itemPreviewText = useMemo(() => {
        if (!items.length) return "No items available";
        const labels = items.slice(0, 3).map((item) => `${item.quantity}x ${item.item_name || item.posts?.title || item.menu_items?.name || "Item"}`);
        return items.length > 3 ? `${labels.join(", ")} and ${items.length - 3} more` : labels.join(", ");
    }, [items]);

    const handleGoBack = useCallback(() => {
        router.back();
    }, [router]);

    const handleSubmit = useCallback(async () => {
        if (!order || !user?.id || !orderId) return;
        if (restaurantRating === 0 || foodRating === 0 || deliveryRating === 0) {
            Alert.alert("Complete the rating", "Please choose 1 to 5 stars for all categories before submitting.");
            return;
        }

        Keyboard.dismiss();
        setSubmitting(true);

        try {
            const { error } = await db.from("ratings").insert([
                {
                    customer_id: user.id,
                    order_id: orderId,
                    restaurant_id: order.restaurant_id,
                    driver_id: order.driver_id,
                    restaurant_rating: restaurantRating,
                    food_quality_rating: foodRating,
                    delivery_experience_rating: deliveryRating,
                    comment: comment.trim() || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
            ]);

            if (error) throw error;
            setSubmitted(true);
            setSubmitting(false);
            // 4 seconds delay before navigating to orders
            setTimeout(() => {
                router.replace("/(tabs)/orders");
            }, 4000);
        } catch (error) {
            console.error("Rating submit failed:", error);
            Alert.alert("Submission failed", "We could not save your rating. Please try again.");
            setSubmitting(false);
        }
    }, [comment, deliveryRating, foodRating, order, orderId, restaurantRating, router, user?.id]);

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
                <ActivityIndicator size="large" color={ACCENT} />
                <Text style={styles.loadingText}>Loading rating screen</Text>
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
                <Text style={styles.emptyTitle}>Rating unavailable</Text>
                <Text style={styles.emptyText}>We couldn't find this order. Please return to your orders.</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace("/(tabs)/orders")}>
                    <Text style={styles.primaryButtonText}>Back to orders</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.iconButton} onPress={handleGoBack}>
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.pageTitle}>Rate your order</Text>
                <View style={styles.spacer} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Order summary</Text>
                        <Text style={styles.cardSubtitle}>#{order.order_number || String(order.id).slice(0, 8)}</Text>
                    </View>
                    <View style={styles.orderOverview}>
                        <Image source={{ uri: order.restaurant_image || FALLBACK_IMAGE }} style={styles.restaurantImage} />
                        <View style={styles.orderInfo}>
                            <Text style={styles.restaurantName}>{order.restaurant_name || "Restaurant"}</Text>
                            <Text style={styles.mutedText}>{itemPreviewText}</Text>
                            <Text style={styles.mutedText}>Ordered on {new Date(order.created_at || "").toLocaleDateString("en-UG", { month: "short", day: "numeric", year: "numeric" })}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.ratecard}>
                    <Text style={styles.sectionHeading}>How was your experience?</Text>
                    <StarRatingInput label="Restaurant" value={restaurantRating} onChange={setRestaurantRating} />
                    <StarRatingInput label="Food quality" value={foodRating} onChange={setFoodRating} />
                    <StarRatingInput label="Delivery experience" value={deliveryRating} onChange={setDeliveryRating} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionHeading}>Add a note (optional)</Text>
                    <TextInput
                        style={styles.commentInput}
                        placeholder="Tell us what you loved or what we can improve"
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={4}
                        value={comment}
                        onChangeText={setComment}
                        textAlignVertical="top"
                    />
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, (submitting || submitted) && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting || submitted}
                    activeOpacity={0.85}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit rating</Text>
                    )}
                </TouchableOpacity>

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* Green success modal with emoji */}
            <Modal visible={submitted} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => { }}>
                    <View style={styles.thankYouModalGreen}>
                        <Text style={styles.emojiIcon}>✅</Text>
                        <Text style={styles.thankYouTitleGreen}>Thank you!</Text>
                        <Text style={styles.thankYouTextGreen}>Your rating was submitted. Returning to orders...</Text>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    topBar: { minHeight: 72, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
    iconButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    pageTitle: { fontSize: 18, fontFamily: "Inter", fontWeight: "700", color: "#111827" },
    spacer: { width: 44 },
    content: { padding: 12, gap: 12 },
    card: { borderRadius: 6, backgroundColor: "#FFFFFF", padding: 12, borderWidth: 1, borderColor: "#00000007" },
    cardHeader: { marginBottom: 12 },
    cardTitle: { fontSize: 16, fontFamily: "Inter", fontWeight: "700", color: "#111827", letterSpacing: 0.3 },
    cardSubtitle: { marginTop: 3, fontSize: 13, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
    orderOverview: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
    restaurantImage: { width: 82, height: 82, borderRadius: 18, backgroundColor: "#F3F4F6" },
    orderInfo: { flex: 1, justifyContent: "center" },
    restaurantName: { fontSize: 16, fontFamily: "Inter", fontWeight: "700", color: "#111827" },
    mutedText: { marginTop: 4, fontSize: 13, fontFamily: "Inter", fontWeight: "500", color: "#6B7280", lineHeight: 18 },
    sectionHeading: { fontSize: 15.5, fontFamily: "Inter", fontWeight: "700", color: "#111827", marginBottom: 12, letterSpacing: 0.4 },
    ratingBlock: { marginBottom: 18 },
    ratingLabel: { fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: "#111827", marginBottom: 10 },
    starRow: { flexDirection: "row", gap: 8 },
    starButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" },
    ratingHint: { marginTop: 10, fontSize: 12, fontFamily: "Inter", fontWeight: "500", color: "#6B7280" },
    ratecard: { borderRadius: 12, backgroundColor: "#FFFFFF", padding: 12, borderWidth: 1, borderColor: "#e5e7eb8d" },
    commentInput: { minHeight: 110, borderRadius: 12, borderWidth: 0.8, borderColor: "#e5e7ebb7", backgroundColor: "#F8FAFC", color: "#111827", fontFamily: "Inter", fontSize: 14, padding: 14 },
    submitButton: { marginTop: 4, height: 54, borderRadius: 16, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" },
    submitButtonDisabled: { opacity: 0.7 },
    submitButtonText: { fontSize: 15, fontFamily: "Inter", fontWeight: "700", color: "#FFFFFF" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(17,24,39,0.45)", justifyContent: "center", alignItems: "center", padding: 24 },
    // Green success modal styles
    thankYouModalGreen: {
        width: "100%",
        maxWidth: 340,
        borderRadius: 24,
        backgroundColor: "#DCFCE7",   // light green
        padding: 24,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
        borderWidth: 1,
        borderColor: "#86EFAC",
    },
    emojiIcon: {
        fontSize: 48,
        marginBottom: 8,
    },
    thankYouTitleGreen: {
        fontSize: 17,
        fontFamily: "Inter",
        fontWeight: "700",
        color: "#166534",   // dark green
        marginTop: 8,
        letterSpacing: 0.3,
    },
    thankYouTextGreen: {
        marginTop: 8,
        fontSize: 13.8,
        fontFamily: "Inter",
        fontWeight: "600",
        color: "#14532D",
        textAlign: "center",
        lineHeight: 16,
        letterSpacing: 0.2,
    },
    loadingContainer: { flex: 1, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center", padding: 20 },
    loadingText: { marginTop: 14, fontSize: 14, fontFamily: "Inter", fontWeight: "600", color: "#6B7280" },
    emptyTitle: { fontSize: 17, fontFamily: "Inter", fontWeight: "700", color: "#111827", marginBottom: 8 },
    emptyText: { fontSize: 13.8, fontFamily: "Inter", fontWeight: "600", color: "#6B7280", marginBottom: 18, textAlign: "center" },
    primaryButton: { minWidth: 180, height: 48, borderRadius: 14, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" },
    primaryButtonText: { fontSize: 14, fontFamily: "Inter", fontWeight: "700", color: "#FFFFFF" },
});