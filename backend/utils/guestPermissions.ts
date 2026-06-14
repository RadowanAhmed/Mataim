export const guestPermissions = {
  // Notifications
  canViewNotifications: false,

  // Orders
  canViewOrders: false,
  canViewOrderDetails: false,
  canTrackOrder: false,
  canReorder: false,

  // Profiles
  canViewProfiles: true,
  canMessage: false,
  canCall: false,
  canEmail: false,
  canReview: false,

  // Restaurants
  canViewRestaurants: true,
  canViewRestaurantDetails: true,
  canViewMenu: true,
  canViewPosts: true,

  // Cart
  canAddToCart: true,
  canViewCart: true,
  canCheckout: false,
};

export const isGuestActionAllowed = (
  action: keyof typeof guestPermissions,
  isGuest: boolean,
): boolean => {
  if (!isGuest) return true;
  return guestPermissions[action] || false;
};
