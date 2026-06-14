import { supabase } from "@/backend/supabase";

export function normalizeRating(value: unknown, fallback = 0) {
    const rating = Number(value);
    return Number.isFinite(rating) && rating > 0 ? rating : fallback;
}

export async function getRestaurantAverageRatings(restaurantIds: string[]) {
    const ids = restaurantIds.filter(Boolean);
    if (!ids.length) return {} as Record<string, number>;

    const { data, error } = await supabase
        .from("reviews")
        .select("restaurant_id, rating")
        .in("restaurant_id", ids)
        .eq("type", "restaurant");

    if (error) {
        console.error("Error fetching restaurant review averages:", error);
        return {} as Record<string, number>;
    }

    const totals: Record<string, { sum: number; count: number }> = {};
    (data || []).forEach((review: any) => {
        if (!review?.restaurant_id) return;
        const id = review.restaurant_id;
        const rating = Number(review.rating);
        if (!Number.isFinite(rating)) return;

        totals[id] = totals[id] || { sum: 0, count: 0 };
        totals[id].sum += rating;
        totals[id].count += 1;
    });

    const averages: Record<string, number> = {};
    Object.entries(totals).forEach(([id, summary]) => {
        averages[id] = summary.count ? Math.round((summary.sum / summary.count) * 10) / 10 : 0;
    });

    return averages;
}
