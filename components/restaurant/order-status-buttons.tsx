"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  orderId: string;
  status: string;
};

const transitions: Record<string, { label: string; status: string; className: string }[]> = {
  pending: [
    { label: "Confirm", status: "confirmed", className: "bg-blue-600 hover:bg-blue-700" },
    { label: "Preparing", status: "preparing", className: "bg-orange-500 hover:bg-orange-600" },
    { label: "Cancel", status: "cancelled", className: "bg-red-600 hover:bg-red-700" },
  ],
  confirmed: [
    { label: "Preparing", status: "preparing", className: "bg-orange-500 hover:bg-orange-600" },
    { label: "Cancel", status: "cancelled", className: "bg-red-600 hover:bg-red-700" },
  ],
  preparing: [
    { label: "Ready for delivery", status: "ready", className: "bg-emerald-600 hover:bg-emerald-700" },
    { label: "Cancel", status: "cancelled", className: "bg-red-600 hover:bg-red-700" },
  ],
  ready: [{ label: "Ready for delivery", status: "ready", className: "bg-emerald-600" }],
};

export function OrderStatusButtons({ orderId, status }: Props) {
  const router = useRouter();
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const actions = transitions[status] || [];

  const updateStatus = async (nextStatus: string) => {
    if (nextStatus === status && nextStatus === "ready") return;

    try {
      setLoadingStatus(nextStatus);
      const response = await fetch(`/api/restaurant/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || "Could not update order status");
      }

      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update order status");
    } finally {
      setLoadingStatus(null);
    }
  };

  if (!actions.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.status}
          type="button"
          disabled={loadingStatus !== null || (action.status === status && action.status === "ready")}
          onClick={() => updateStatus(action.status)}
          className={`rounded-xl px-4 py-2 text-sm font-black text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${action.className}`}
        >
          {loadingStatus === action.status ? "Updating..." : action.label}
        </button>
      ))}
    </div>
  );
}
