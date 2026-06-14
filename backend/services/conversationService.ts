import { logger } from "@/backend/utils/logger";
// backend /services/conversationService.ts
import { supabase } from "../supabase";

const db = supabase as any;

export class ConversationService {
  // Add this method to your existing ConversationService class
  static async getOrCreateCustomerRestaurantConversation(
    customerId: string,
    restaurantId: string,
    orderId?: string,
  ) {
    try {
      logger.debug("Creating/getting customer-restaurant conversation:", {
        customerId,
        restaurantId,
        orderId,
      });

      // Check if conversation already exists
      let existingQuery = db
        .from("conversations")
        .select("id")
        .eq("customer_id", customerId)
        .eq("restaurant_id", restaurantId);

      if (orderId) existingQuery = existingQuery.eq("order_id", orderId);

      const { data: existing, error: checkError } = await existingQuery.maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        logger.debug("Existing conversation found:", existing.id);
        return existing.id;
      }

      // Create new conversation
      const { data: newConversation, error: createError } = await db
        .from("conversations")
        .insert({
          order_id: orderId || null,
          customer_id: customerId,
          restaurant_id: restaurantId,
          conversation_type: "customer_restaurant",
          is_active: true,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (createError) throw createError;

      logger.debug("Created new conversation:", newConversation.id);

      return newConversation.id;
    } catch (error) {
      console.error("Error in customer-restaurant conversation:", error);
      return null;
    }
  }

  // Create or get conversation between customer and driver
  static async getOrCreateCustomerDriverConversation(
    customerId: string,
    driverId: string,
    orderId: string,
  ) {
    try {
      logger.debug("Creating/getting customer-driver conversation:", {
        customerId,
        driverId,
        orderId,
      });

      // Check if conversation already exists
      let existingQuery = db
        .from("conversations")
        .select("id")
        .eq("customer_id", customerId)
        .eq("driver_id", driverId);

      if (orderId) existingQuery = existingQuery.eq("order_id", orderId);

      const { data: existing, error: checkError } = await existingQuery.maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        logger.debug("Existing conversation found:", existing.id);
        return existing.id;
      }

      // Create new conversation
      const { data: newConversation, error: createError } = await db
        .from("conversations")
        .insert({
          order_id: orderId,
          customer_id: customerId,
          driver_id: driverId,
          conversation_type: "customer_driver",
          is_active: true,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      logger.debug("Created new conversation:", newConversation.id);

      return newConversation.id;
    } catch (error) {
      console.error("Error in customer-driver conversation:", error);
      return null;
    }
  }

  // Create or get conversation between restaurant and driver
  static async getOrCreateRestaurantDriverConversation(
    restaurantId: string,
    driverId: string,
    orderId: string,
  ) {
    try {
      logger.debug("Creating/getting restaurant-driver conversation:", {
        restaurantId,
        driverId,
        orderId,
      });

      // Check if conversation already exists
      let existingQuery = db
        .from("conversations")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("driver_id", driverId);

      if (orderId) existingQuery = existingQuery.eq("order_id", orderId);

      const { data: existing, error: checkError } = await existingQuery.maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        logger.debug("Existing conversation found:", existing.id);
        return existing.id;
      }

      // Create new conversation
      const { data: newConversation, error: createError } = await db
        .from("conversations")
        .insert({
          order_id: orderId,
          restaurant_id: restaurantId,
          driver_id: driverId,
          conversation_type: "restaurant_driver",
          is_active: true,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      logger.debug("Created new conversation:", newConversation.id);

      return newConversation.id;
    } catch (error) {
      console.error("Error in restaurant-driver conversation:", error);
      return null;
    }
  }

  // Get driver details including phone number from users table
  static async getDriverDetails(driverId: string) {
    try {
      const { data, error } = await supabase
        .from("delivery_users")
        .select(
          `
          id,
          vehicle_type,
          rating,
          total_deliveries,
          users!inner(
            id,
            full_name,
            phone,
            profile_image_url
          )
        `,
        )
        .eq("id", driverId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching driver details:", error);
      return null;
    }
  }

  // Get restaurant owner phone
  static async getRestaurantOwnerPhone(restaurantId: string) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("phone, full_name")
        .eq("id", restaurantId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching restaurant owner:", error);
      return null;
    }
  }
}
