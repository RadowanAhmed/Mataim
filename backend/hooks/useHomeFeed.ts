/**
 * Home feed query limits — centralizes pagination for the customer home screen.
 */
export const HOME_FEED_LIMITS = {
  restaurants: 24,
  featuredPosts: 8,
  menuItemsForTags: 80,
  savedAddresses: 1,
} as const;
