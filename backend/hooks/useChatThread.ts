import { uploadChatImage } from "@/backend/services/chatMediaService";
import {
  ChatService,
  ChatUserType,
  resolveChatReceiver,
} from "@/backend/services/chatService";
import { supabase } from "@/backend/supabase";
import { useCallback, useEffect, useRef, useState } from "react";

type UseChatThreadOptions = {
  conversationId?: string;
  senderId?: string;
  senderType: ChatUserType;
  enabled?: boolean;
};

export function useChatThread({
  conversationId,
  senderId,
  senderType,
  enabled = true,
}: UseChatThreadOptions) {
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingText, setTypingText] = useState("");
  const lastProgressRef = useRef(0);

  const loadConversation = useCallback(async () => {
    if (!conversationId) return null;

    const { data } = await supabase
      .from("conversations")
      .select("id, order_id, customer_id, restaurant_id, driver_id, last_message, last_message_at")
      .eq("id", conversationId)
      .maybeSingle();

    setConversation(data || null);
    return data;
  }, [conversationId]);

  const loadMessages = useCallback(
    async (showSpinner = true) => {
      if (!conversationId || !senderId || !enabled) {
        setMessages([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (showSpinner) setLoading(true);
        const { data, error } = await ChatService.fetchMessages(conversationId);
        if (error) throw error;
        setMessages(data || []);
        await ChatService.markRead(conversationId, senderId);
      } catch (error) {
        console.error("Chat load failed:", error);
        setMessages([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [conversationId, enabled, senderId],
  );

  useEffect(() => {
    loadConversation();
    loadMessages();
  }, [loadConversation, loadMessages]);

  useEffect(() => {
    if (!conversationId || !senderId || !enabled) return;

    const channel = supabase
      .channel(`chat-thread-${conversationId}-${senderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;

          if (row.sender_id !== senderId) {
            const { data } = await supabase
              .from("messages")
              .select("*, sender:users!messages_sender_id_fkey(id,full_name,profile_image_url)")
              .eq("id", row.id)
              .maybeSingle();

            setMessages((current) => ChatService.mergeMessageById(current, data || row));
            await ChatService.markRead(conversationId, senderId);
            return;
          }

          const { data } = await supabase
            .from("messages")
            .select("*, sender:users!messages_sender_id_fkey(id,full_name,profile_image_url)")
            .eq("id", row.id)
            .maybeSingle();

          setMessages((current) => ChatService.mergeMessageById(current, data || row));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_typing_indicators",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (!row || row.user_id === senderId) {
            if (row?.user_id === senderId) setTypingText("");
            return;
          }
          setTypingText(row.is_typing ? "Typing..." : "");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, enabled, senderId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadConversation(), loadMessages(false)]);
  }, [loadConversation, loadMessages]);

  const sendText = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || !conversationId || !senderId || sending) {
        return { success: false, error: "Message cannot be empty" };
      }

      const tempId = `temp-${Date.now()}`;
      const receiver = resolveChatReceiver(conversation, senderId);
      const optimistic = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: senderId,
        sender_type: senderType,
        receiver_id: receiver?.id ?? null,
        receiver_type: receiver?.type ?? null,
        message: clean,
        message_type: "text",
        created_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        isOptimistic: true,
      };

      setSending(true);
      setMessages((current) => [...current, optimistic]);

      try {
        let activeConversation = conversation;
        if (!activeConversation) {
          activeConversation = await loadConversation();
        }

        await ChatService.setTyping(conversationId, false, senderType);
        const result = await ChatService.sendMessage({
          conversationId,
          conversation: activeConversation,
          senderId,
          senderType,
          message: clean,
        });

        if (!result.success || !result.data) {
          throw new Error(result.error || "Send failed");
        }

        setMessages((current) =>
          current.map((row) => (row.id === tempId ? result.data : row)).filter(Boolean),
        );
        return result;
      } catch (error: any) {
        setMessages((current) => current.filter((row) => row.id !== tempId));
        return { success: false, error: error?.message || "Send failed" };
      } finally {
        setSending(false);
      }
    },
    [conversation, conversationId, loadConversation, senderId, senderType, sending],
  );

  const sendImage = useCallback(
    async (uri: string, mimeType: string | null | undefined, caption = "") => {
      if (!conversationId || !senderId || sending) {
        return { success: false, error: "Cannot send image" };
      }

      const tempId = `upload-${Date.now()}`;
      const receiver = resolveChatReceiver(conversation, senderId);
      const optimistic = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: senderId,
        sender_type: senderType,
        receiver_id: receiver?.id ?? null,
        receiver_type: receiver?.type ?? null,
        message: caption.trim() || "Image",
        message_type: "image",
        image_url: uri,
        created_at: new Date().toISOString(),
        isUploading: true,
        uploadProgress: 0,
      };

      setSending(true);
      setMessages((current) => [...current, optimistic]);

      try {
        let activeConversation = conversation;
        if (!activeConversation) {
          activeConversation = await loadConversation();
        }

        const publicUrl = await uploadChatImage({
          conversationId,
          senderId,
          uri,
          mimeType,
          onProgress: (progress) => {
            if (progress - lastProgressRef.current < 8 && progress < 100) return;
            lastProgressRef.current = progress;
            setMessages((current) =>
              current.map((row) => (row.id === tempId ? { ...row, uploadProgress: progress } : row)),
            );
          },
        });

        const result = await ChatService.sendMessage({
          conversationId,
          conversation: activeConversation,
          senderId,
          senderType,
          message: caption.trim() || "Image",
          imageUrl: publicUrl,
        });

        if (!result.success || !result.data) {
          throw new Error(result.error || "Could not save image message");
        }

        setMessages((current) => current.filter((row) => row.id !== tempId));
        setMessages((current) => ChatService.mergeMessageById(current, result.data));
        return result;
      } catch (error: any) {
        setMessages((current) => current.filter((row) => row.id !== tempId));
        return { success: false, error: error?.message || "Photo send failed" };
      } finally {
        setSending(false);
      }
    },
    [conversation, conversationId, loadConversation, senderId, senderType, sending],
  );

  const updateTyping = useCallback(
    async (value: string) => {
      if (!conversationId) return;
      await ChatService.setTyping(conversationId, Boolean(value.trim()), senderType);
    },
    [conversationId, senderType],
  );

  return {
    conversation,
    messages,
    loading,
    refreshing,
    sending,
    typingText,
    refresh,
    sendText,
    sendImage,
    updateTyping,
    setMessages,
  };
}
