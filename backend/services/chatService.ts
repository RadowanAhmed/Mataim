import { supabase } from "../supabase";

const db = supabase as any;

export type ChatUserType = "customer" | "restaurant" | "driver" | "admin" | "system";

export type ChatConversation = {
  id: string;
  order_id?: string | null;
  customer_id?: string | null;
  restaurant_id?: string | null;
  driver_id?: string | null;
};

export type SendChatMessageInput = {
  conversationId: string;
  conversation?: ChatConversation | null;
  senderId: string;
  senderType: ChatUserType;
  message: string;
  imageUrl?: string | null;
};

export type SendChatMessageResult = {
  success: boolean;
  data?: any;
  error?: string;
};

export const QUICK_MESSAGES: Record<Exclude<ChatUserType, "admin" | "system">, string[]> = {
  driver: [
    "I've arrived at the restaurant",
    "Order picked up, on my way",
    "I'm 5 minutes away",
    "I'm 10 minutes away",
    "I'm here at your location",
    "Please provide gate code or building number",
    "I'm having trouble finding the address",
    "Traffic delay, sorry",
  ],
  restaurant: [
    "Your order is being prepared",
    "Your order is ready for pickup",
    "Sorry for the delay",
    "We are out of an item, please call us",
  ],
  customer: [
    "Where is my order?",
    "Thank you!",
    "Please hurry",
    "Change my address",
  ],
};

const MESSAGE_SELECT = `
  *,
  sender:users!messages_sender_id_fkey(id,full_name,profile_image_url)
`;

export function resolveChatReceiver(
  conversation: ChatConversation | null | undefined,
  senderId: string,
): { id: string; type: ChatUserType } | null {
  if (!conversation) return null;

  if (conversation.customer_id && conversation.customer_id !== senderId) {
    return { id: conversation.customer_id, type: "customer" };
  }
  if (conversation.driver_id && conversation.driver_id !== senderId) {
    return { id: conversation.driver_id, type: "driver" };
  }
  if (conversation.restaurant_id && conversation.restaurant_id !== senderId) {
    return { id: conversation.restaurant_id, type: "restaurant" };
  }
  return null;
}

function mergeMessageById(messages: any[], incoming: any) {
  if (!incoming?.id) return messages;
  const index = messages.findIndex((row) => row.id === incoming.id);
  if (index >= 0) {
    const next = [...messages];
    next[index] = { ...next[index], ...incoming };
    return next;
  }
  return [...messages, incoming].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );
}

export class ChatService {
  static async fetchMessages(conversationId: string, limit = 120) {
    const { data, error } = await db
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: null, error };

    return {
      data: (data || []).slice().reverse(),
      error: null,
    };
  }

  static async sendMessage(input: SendChatMessageInput): Promise<SendChatMessageResult> {
    const text = String(input.message || "").trim();
    const hasImage = Boolean(input.imageUrl);
    if (!text && !hasImage) {
      return { success: false, error: "Message cannot be empty" };
    }

    const conversation =
      input.conversation ||
      (
        await db
          .from("conversations")
          .select("id, order_id, customer_id, restaurant_id, driver_id")
          .eq("id", input.conversationId)
          .maybeSingle()
      ).data;

    if (!conversation) {
      return { success: false, error: "Conversation not found" };
    }

    const receiver = resolveChatReceiver(conversation, input.senderId);
    const messageType = hasImage ? "image" : "text";
    const body = text || (hasImage ? "Image" : "");

    if (!hasImage) {
      const rpcResult = await db.rpc("send_order_message", {
        p_conversation_id: input.conversationId,
        p_message: body,
        p_sender_type: input.senderType,
        p_receiver_id: receiver?.id ?? null,
        p_receiver_type: receiver?.type ?? null,
      });

      if (!rpcResult.error && rpcResult.data) {
        const enriched = await db
          .from("messages")
          .select(MESSAGE_SELECT)
          .eq("id", rpcResult.data.id)
          .maybeSingle();
        return { success: true, data: enriched.data || rpcResult.data };
      }
    }

    const insertResult = await db
      .from("messages")
      .insert({
        conversation_id: input.conversationId,
        order_id: conversation.order_id ?? null,
        sender_id: input.senderId,
        sender_type: input.senderType,
        receiver_id: receiver?.id ?? null,
        receiver_type: receiver?.type ?? null,
        message: body,
        message_type: messageType,
        image_url: input.imageUrl ?? null,
        delivered_at: new Date().toISOString(),
      })
      .select(MESSAGE_SELECT)
      .single();

    if (insertResult.error) {
      return { success: false, error: insertResult.error.message || "Could not send message" };
    }

    return { success: true, data: insertResult.data };
  }

  static async touchConversation(conversationId: string, lastMessage: string) {
    return db
      .from("conversations")
      .update({
        last_message: lastMessage,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
  }

  static async markRead(conversationId: string, userId: string) {
    return db.rpc("mark_conversation_messages_as_read", {
      p_conversation_id: conversationId,
      p_user_id: userId,
    });
  }

  static async setTyping(conversationId: string, isTyping: boolean, userType: ChatUserType) {
    return db.rpc("set_conversation_typing", {
      p_conversation_id: conversationId,
      p_is_typing: isTyping,
      p_user_type: userType,
    });
  }

  static mergeMessageById = mergeMessageById;
}
