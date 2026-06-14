import { calculateDeliveryFee, calculateDriverPayout } from "./deliveryPricing";

/**
 * Driver-facing delivery pay (distance-based). Never use restaurant fixed fees.
 */
export function resolveDriverDeliveryPay(order: Record<string, any> | null | undefined): number {
  if (!order) return 0;

  const restaurant = order.restaurants || order.restaurant;
  const address = order.delivery_address;

  if (restaurant && address) {
    const calculatedFee = calculateDeliveryFee({ restaurant, address });
    if (calculatedFee > 0) return calculateDriverPayout(calculatedFee);
  }

  const fee = Number(order.delivery_fee ?? 0);
  return calculateDriverPayout(fee);
}

export function withDriverPay<T extends Record<string, any>>(order: T): T & { driverPay: number; earnings: number } {
  const driverPay = resolveDriverDeliveryPay(order);
  return {
    ...order,
    driverPay,
    earnings: driverPay,
  };
}
