// backend/hooks/useDriverOrderChannel.ts
import { useAuth } from "@/backend/AuthContext";
import { DriverAppService } from "@/backend/services/driverAppService";
import { RealTimeLocationService } from "@/backend/services/RealTimeLocationService";
import { supabase } from "@/backend/supabase";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

const db = supabase as any;

export function useDriverOrderChannel() {
  const { user } = useAuth();
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [latestOrder, setLatestOrder] = useState<any>(null);
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);
  const mounted = useRef(true);

  const loadAvailableOrders = useCallback(async () => {
    if (!user?.id || user.user_type !== "driver") return;

    try {
      const location = await RealTimeLocationService.getCurrentLocation();
      const result = await DriverAppService.fetchOrders(user.id, "available", location || undefined);
      if (mounted.current) setAvailableOrders(result.data || []);
    } catch (error) {
      console.warn("Could not load available driver orders:", error);
      if (mounted.current) setAvailableOrders([]);
    }
  }, [user?.id, user?.user_type]);

  useEffect(() => {
    mounted.current = true;
    loadAvailableOrders();

    return () => {
      mounted.current = false;
    };
  }, [loadAvailableOrders]);

  useEffect(() => {
    if (!user?.id || user.user_type !== "driver") return;

    const channel = db
      .channel(`driver-ready-orders-${user.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        async (payload: any) => {
          if (payload.new?.status === "ready" && !payload.new?.driver_id) {
            await loadAvailableOrders();
            if (!mounted.current) return;
            setLatestOrder(payload.new);
            setShowNewOrderAlert(true);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        async (payload: any) => {
          const row = payload.new;
          if (row?.status === "ready" && !row?.driver_id) {
            await loadAvailableOrders();
            if (!mounted.current) return;
            setLatestOrder(row);
            setShowNewOrderAlert(true);
          } else {
            await loadAvailableOrders();
          }
        },
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [user?.id, user?.user_type, loadAvailableOrders]);

  const dismissAlert = () => setShowNewOrderAlert(false);

  const acceptOrder = async (orderId: string) => {
    if (!user?.id) return { success: false, message: "Driver not signed in" };
    const result = await DriverAppService.acceptOrder(orderId, user.id);
    if (!result.success) {
      Alert.alert("Could not accept order", result.message || "Order may already be taken.");
    } else {
      setShowNewOrderAlert(false);
      await loadAvailableOrders();
    }
    return result;
  };

  return {
    availableOrders,
    latestOrder,
    showNewOrderAlert,
    dismissAlert,
    acceptOrder,
    refreshAvailableOrders: loadAvailableOrders,
  };
}
