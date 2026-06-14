// components/OrderActions.tsx
import { useAuth } from "@/backend/AuthContext";
import { NotificationService } from "@/backend/services/notificationService";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface OrderActionsProps {
  orderId: string;
  currentStatus: string;
  orderNumber: string;
  restaurantId?: string;
  driverId?: string;
  onStatusChange: () => void;
}

const OrderActions: React.FC<OrderActionsProps> = ({
  orderId,
  currentStatus,
  orderNumber,
  restaurantId,
  driverId,
  onStatusChange,
}) => {
  const { user } = useAuth();

  const handleAcceptOrder = async () => {
    Alert.alert("Accept Order", `Accept order #${orderNumber}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Accept",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("orders")
              .update({
                status: "preparing",
                updated_at: new Date().toISOString(),
              })
              .eq("id", orderId);

            if (error) throw error;

            await NotificationService.sendOrderNotification(
              orderId,
              "preparing",
            );
            Alert.alert("Success", "Order accepted successfully!");
            onStatusChange();
          } catch (error) {
            Alert.alert("Error", "Failed to accept order");
          }
        },
      },
    ]);
  };

  const handleMarkAsReady = async () => {
    Alert.alert("Mark as Ready", `Mark order #${orderNumber} as ready?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark Ready",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("orders")
              .update({
                status: "ready",
                updated_at: new Date().toISOString(),
              })
              .eq("id", orderId);

            if (error) throw error;

            await NotificationService.sendOrderNotification(orderId, "ready");

            // Try to auto-assign driver
            setTimeout(async () => {
              await NotificationService.assignNearestDriver(orderId);
            }, 2000);

            Alert.alert("Success", "Order marked as ready!");
            onStatusChange();
          } catch (error) {
            Alert.alert("Error", "Failed to update order");
          }
        },
      },
    ]);
  };

  const handlePickupOrder = async () => {
    if (!driverId) return;

    Alert.alert("Pickup Order", `Pick up order #${orderNumber}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Pick Up",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("orders")
              .update({
                status: "out_for_delivery",
                updated_at: new Date().toISOString(),
              })
              .eq("id", orderId);

            if (error) throw error;

            await NotificationService.sendOrderNotification(
              orderId,
              "out_for_delivery",
            );
            Alert.alert("Success", "Order picked up successfully!");
            onStatusChange();
          } catch (error) {
            Alert.alert("Error", "Failed to update order");
          }
        },
      },
    ]);
  };

  const handleMarkDelivered = async () => {
    Alert.alert("Mark Delivered", `Mark order #${orderNumber} as delivered?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delivered",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("orders")
              .update({
                status: "delivered",
                actual_delivery_time: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", orderId);

            if (error) throw error;

            await NotificationService.sendOrderNotification(
              orderId,
              "delivered",
            );
            Alert.alert("Success", "Order marked as delivered!");
            onStatusChange();
          } catch (error) {
            Alert.alert("Error", "Failed to update order");
          }
        },
      },
    ]);
  };

  const handleCancelOrder = async () => {
    Alert.alert("Cancel Order", `Cancel order #${orderNumber}?`, [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("orders")
              .update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
              })
              .eq("id", orderId);

            if (error) throw error;

            await NotificationService.sendOrderNotification(
              orderId,
              "cancelled",
            );
            Alert.alert("Success", "Order cancelled successfully");
            onStatusChange();
          } catch (error) {
            Alert.alert("Error", "Failed to cancel order");
          }
        },
      },
    ]);
  };

  const renderActions = () => {
    if (user?.user_type === "restaurant") {
      switch (currentStatus) {
        case "pending":
          return (
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={handleAcceptOrder}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.acceptButtonText}>Accept Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancelOrder}
              >
                <Ionicons name="close" size={16} color="#EF4444" />
                <Text style={styles.cancelButtonText}>Decline</Text>
              </TouchableOpacity>
            </View>
          );

        case "confirmed":
          return (
            <TouchableOpacity
              style={[styles.singleButton, styles.preparingButton]}
              onPress={() => {
                supabase
                  .from("orders")
                  .update({ status: "preparing" })
                  .eq("id", orderId)
                  .then(() => {
                    NotificationService.sendOrderNotification(
                      orderId,
                      "preparing",
                    );
                    onStatusChange();
                  });
              }}
            >
              <Ionicons name="restaurant" size={16} color="#fff" />
              <Text style={styles.singleButtonText}>Start Preparing</Text>
            </TouchableOpacity>
          );

        case "preparing":
          return (
            <TouchableOpacity
              style={[styles.singleButton, styles.readyButton]}
              onPress={handleMarkAsReady}
            >
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={styles.singleButtonText}>Mark as Ready</Text>
            </TouchableOpacity>
          );

        case "ready":
          return (
            <View style={styles.statusContainer}>
              <Ionicons name="time" size={16} color="#FF6B35" />
              <Text style={styles.statusText}>Waiting for driver pickup</Text>
            </View>
          );

        default:
          return null;
      }
    }

    if (user?.user_type === "driver") {
      switch (currentStatus) {
        case "ready":
          return (
            <TouchableOpacity
              style={[styles.singleButton, styles.pickupButton]}
              onPress={handlePickupOrder}
            >
              <Ionicons name="bicycle" size={16} color="#fff" />
              <Text style={styles.singleButtonText}>Pick Up Order</Text>
            </TouchableOpacity>
          );

        case "out_for_delivery":
          return (
            <TouchableOpacity
              style={[styles.singleButton, styles.deliverButton]}
              onPress={handleMarkDelivered}
            >
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.singleButtonText}>Mark as Delivered</Text>
            </TouchableOpacity>
          );

        default:
          return null;
      }
    }

    return null;
  };

  return <View style={styles.container}>{renderActions()}</View>;
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    gap: 8,
  },
  singleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  acceptButton: {
    backgroundColor: "#10B981",
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
        fontFamily: "Inter",

  },
  cancelButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  cancelButtonText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
        fontFamily: "Inter",

  },
  preparingButton: {
    backgroundColor: "#8B5CF6",
  },
  readyButton: {
    backgroundColor: "#FF6B35",
  },
  pickupButton: {
    backgroundColor: "#3B82F6",
  },
  deliverButton: {
    backgroundColor: "#10B981",
  },
  singleButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
        fontFamily: "Inter",

  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF6B35",
    justifyContent: "center",
  },
  statusText: {
    color: "#FF6B35",
    fontSize: 14,
    fontWeight: "600",
        fontFamily: "Inter",

  },
});

export default OrderActions;
