import { logger } from "@/backend/utils/logger";
// constants/animations.ts
import { Asset } from "expo-asset";

export const animations = {
  delivery_guy: require("../assets/animations/Delivery guy.json"),
  restaurant_cafe: require("../assets/animations/cafe restaurant.json"),
  discover_anmazing_food: require("../assets/animations/Discover Amazing Food animation.json"),
  fast_delivery: require("../assets/animations/Delivery guy fast.json"),
  ready_to_order: require("../assets/animations/driver animations/Order Placed ready.json"),
  emailAnimation: require("../assets/animations/email message success.json"),
  codeVerificationAnimation: require("../assets/animations/phone code verification.json"),
  passwordResetAnimation: require("../assets/animations/password reset successful.json"),

  cancelled_animation: require("../assets/animations/orders/order Cancel reservation.json"),
  out_for_delivery_animation: require("../assets/animations/orders/Delivery guy out  for delivery.json"),
  delivered_animation: require("../assets/animations/orders/order delivered Approved animation.json"),
  restaurant_cafe_cup: require("../assets/animations/orders/restaurant cafe tea cup.json"),
  pending_animation: require("../assets/animations/orders/pending Clock_loop Animation.json"),
  preparing_animation: require("../assets/animations/orders/Food Prepared - Food app preparing_animation.json"),
  ready_animation: require("../assets/animations/orders/Pickup food order ready Animation.json"),
  confirmed_animation: require("../assets/animations/orders/confirmed successfull animation.json"),
  loading: require("../assets/animations/Blue Loading Animation.json"),

  // Driver-specific animations
  driver_online: require("../assets/animations/driver animations/online animation.json"),
  driver_offline: require("../assets/animations/driver animations/driver offline.json"),
  driver_searching: require("../assets/animations/driver animations/Delivery searching.json"),
  //driver_earnings: require("../assets/animations/driver/earnings-animation.json"),
  //driver_rating: require("../assets/animations/driver/rating-animation.json"),
  driver_delivery_complete: require("../assets/animations/orders/confirmed successfull animation.json"),
  //driver_navigation: require("../assets/animations/driver/navigation-pulse.json"),
  //driver_eta: require("../assets/animations/driver/eta-timer.json"),
  //driver_waiting: require("../assets/animations/driver/waiting-animation.json"),
  //driver_success_check: require("../assets/animations/driver/success-check.json"),
  driver_empty_state: require("../assets/animations/driver animations/driver search imm driver_empty_state.json"),
  //driver_congratulations: require("../assets/animations/driver/congratulations.json"),
  //driver_loading_small: require("../assets/animations/driver/loading-small.json"),

  // Order status animations specific for driver
  driver_order_accepted: require("../assets/animations/driver animations/Accept Order Green Man.json"),
  //driver_pickup_reminder: require("../assets/animations/driver/pickup-reminder.json"),
  //driver_customer_waiting: require("../assets/animations/driver/customer-waiting.json"),
  //driver_almost_there: require("../assets/animations/driver/almost-there.json"),
  driver_route_calculating: require("../assets/animations/driver animations/gps-navigation driver_route_calculating.json"),

  // Map and location animations
  //driver_location_pulse: require("../assets/animations/driver/location-pulse.json"),
  //driver_destination_reached: require("../assets/animations/driver/destination-reached.json"),

  // Stats and earnings animations
  //driver_today_earnings: require("../assets/animations/driver/today-earnings.json"),
  //driver_weekly_stats: require("../assets/animations/driver/weekly-stats.json"),
  //driver_delivery_stats: require("../assets/animations/driver/delivery-stats.json"),

  //email_message_success: require('../assets/animations/email message success.json'),
  //payment_success_animation: require('../assets/animations/payment-success-animation.json'),
  //payment_failed_animation: require('../assets/animations/payment-failed-animation.json'),
  //success: require("../assets/animations/success.json"),
  //empty_box: require("../assets/animations/empty_box.json"),
  //forgot_password: require("../assets/animations/forgot-password.json"),


  locationpulse: require("../assets/animations/driver animations/Location Pin.json"),

  location: require("../assets/animations/map animation/Location.json"),

  cardanimation: require("../assets/animations/driver animations/Dashboard/cardanimation.json"),
  cartsuccessanimation: require("../assets/animations/customer animation/cart success animation.json"),

  successanimation: require("../assets/animations/driver animations/successfull animation.json"),

};

// Preload all animations
export const preloadAnimations = async () => {
  try {
    const animationValues = Object.values(animations);
    await Promise.all(
      animationValues.map((animation) =>
        Asset.fromModule(animation).downloadAsync(),
      ),
    );
    logger.debug("All animations preloaded successfully");
  } catch (error) {
    console.error("Error preloading animations:", error);
  }
};

// Type for animation keys
export type AnimationKey = keyof typeof animations;

export default animations;
