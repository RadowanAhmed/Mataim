import { supabase } from "@/backend/supabase";
import {
  calculateDeliveryDistanceKm,
  calculateDeliveryFee,
  type DeliveryPricingSettings,
} from "@/backend/utils/deliveryPricing";
import { formatUGX, toUGX } from "@/backend/utils/currency";

const db = supabase as any;

const FALLBACK_FOOD_IMAGE =
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=700&h=520&fit=crop";

export type CustomerAddress = {
  id?: string;
  label?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  is_default?: boolean | null;
};

export type CustomerCartItem = {
  id: string;
  cart_id: string;
  post_id?: string | null;
  menu_item_id?: string | null;
  restaurant_id?: string | null;
  name: string;
  restaurant: string;
  cuisine?: string | null;
  image: string;
  priceUgx: number;
  formattedPrice: string;
  quantity: number;
  totalPriceUgx: number;
  restaurant_rating: number;
  min_order: number;
  restaurant_location: {
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
};

export type CustomerCartPayload = {
  cart: any | null;
  items: CustomerCartItem[];
  addresses: CustomerAddress[];
  defaultAddress: CustomerAddress | null;
};

export type CartSummary = {
  subtotal: number;
  deliveryFee: number;
  distanceKm: number | null;
  tax: number;
  discount: number;
  tip: number;
  total: number;
};

export type PromoResult = {
  code: string;
  label: string;
  discount: number;
};

type RestaurantRecord = {
  id?: string;
  restaurant_name?: string | null;
  cuisine_type?: string | null;
  restaurant_rating?: number | string | null;
  min_order_amount?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function normalizeRating(value: unknown) {
  const rating = Number(value);
  return Number.isFinite(rating) && rating > 0 ? rating : 4.7;
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value || 1);
  return Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity) : 1;
}

function mapPostItem(row: any, post: any): CustomerCartItem {
  const restaurant = firstRelation<RestaurantRecord>(post?.restaurants) || {};
  const priceUgx = toUGX(row.unit_price ?? post?.discounted_price ?? post?.original_price ?? 0);
  const quantity = normalizeQuantity(row.quantity);

  return {
    id: row.id,
    cart_id: row.cart_id,
    post_id: row.post_id,
    menu_item_id: row.menu_item_id,
    restaurant_id: post?.restaurant_id || restaurant.id || null,
    name: post?.title || "Menu item",
    restaurant: restaurant.restaurant_name || "Restaurant",
    cuisine: restaurant.cuisine_type || "Food",
    image: post?.image_url || FALLBACK_FOOD_IMAGE,
    priceUgx,
    formattedPrice: formatUGX(priceUgx),
    quantity,
    totalPriceUgx: priceUgx * quantity,
    restaurant_rating: normalizeRating(restaurant.restaurant_rating),
    min_order: toUGX(restaurant.min_order_amount || 0),
    restaurant_location: {
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    },
  };
}

function mapMenuItem(row: any, menuItem: any): CustomerCartItem {
  const restaurant = firstRelation<RestaurantRecord>(menuItem?.restaurants) || {};
  const priceUgx = toUGX(row.unit_price ?? menuItem?.price ?? 0);
  const quantity = normalizeQuantity(row.quantity);

  return {
    id: row.id,
    cart_id: row.cart_id,
    post_id: row.post_id,
    menu_item_id: row.menu_item_id,
    restaurant_id: menuItem?.restaurant_id || restaurant.id || null,
    name: menuItem?.name || "Menu item",
    restaurant: restaurant.restaurant_name || "Restaurant",
    cuisine: restaurant.cuisine_type || menuItem?.category || "Food",
    image: menuItem?.image_url || FALLBACK_FOOD_IMAGE,
    priceUgx,
    formattedPrice: formatUGX(priceUgx),
    quantity,
    totalPriceUgx: priceUgx * quantity,
    restaurant_rating: normalizeRating(restaurant.restaurant_rating),
    min_order: toUGX(restaurant.min_order_amount || 0),
    restaurant_location: {
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    },
  };
}

const MAX_SAVED_ADDRESSES = 2;

async function getCustomerAddresses(userId: string) {
  const { data, error } = await db
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_SAVED_ADDRESSES);

  if (error) throw error;

  const addresses = (data || []) as CustomerAddress[];
  return {
    addresses,
    defaultAddress: addresses.find((address) => address.is_default) || addresses[0] || null,
  };
}

async function getActiveCart(userId: string, ensureCart: boolean) {
  const { data, error } = await db
    .from("carts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (data || !ensureCart) return data || null;

  const { data: createdCart, error: createError } = await db
    .from("carts")
    .insert({ user_id: userId, status: "active" })
    .select("*")
    .maybeSingle();

  if (createError) throw createError;
  return createdCart || null;
}

async function getCartItems(cartId: string) {
  const { data, error } = await db
    .from("cart_items")
    .select(
      `
      id,
      cart_id,
      post_id,
      menu_item_id,
      quantity,
      unit_price,
      total_price,
      special_instructions,
      created_at
    `,
    )
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getPostsById(ids: string[]) {
  if (!ids.length) return new Map<string, any>();

  const { data, error } = await db
    .from("posts")
    .select(
      `
      id,
      title,
      image_url,
      discounted_price,
      original_price,
      restaurant_id,
      restaurants (
        id,
        restaurant_name,
        cuisine_type,
        restaurant_rating,
        min_order_amount,
        latitude,
        longitude
      )
    `,
    )
    .in("id", ids);

  if (error) throw error;
  return new Map((data || []).map((post: any) => [post.id, post]));
}

async function getMenuItemsById(ids: string[]) {
  if (!ids.length) return new Map<string, any>();

  const { data, error } = await db
    .from("menu_items")
    .select(
      `
      id,
      name,
      category,
      image_url,
      price,
      restaurant_id,
      restaurants (
        id,
        restaurant_name,
        cuisine_type,
        restaurant_rating,
        min_order_amount,
        latitude,
        longitude
      )
    `,
    )
    .in("id", ids);

  if (error) throw error;
  return new Map((data || []).map((item: any) => [item.id, item]));
}

export async function getCustomerCart(
  userId: string,
  options: { ensureCart?: boolean } = {},
): Promise<CustomerCartPayload> {
  const [{ addresses, defaultAddress }, cart] = await Promise.all([
    getCustomerAddresses(userId),
    getActiveCart(userId, Boolean(options.ensureCart)),
  ]);

  if (!cart?.id) {
    return { cart: null, items: [], addresses, defaultAddress };
  }

  const rows = await getCartItems(cart.id);
  const postIds = rows.map((item: any) => item.post_id).filter(Boolean);
  const menuItemIds = rows.map((item: any) => item.menu_item_id).filter(Boolean);
  const [posts, menuItems] = await Promise.all([
    getPostsById(Array.from(new Set(postIds))),
    getMenuItemsById(Array.from(new Set(menuItemIds))),
  ]);

  const items = rows
    .map((row: any) => {
      if (row.post_id && posts.has(row.post_id)) {
        return mapPostItem(row, posts.get(row.post_id));
      }

      if (row.menu_item_id && menuItems.has(row.menu_item_id)) {
        return mapMenuItem(row, menuItems.get(row.menu_item_id));
      }

      return null;
    })
    .filter(Boolean) as CustomerCartItem[];

  return { cart, items, addresses, defaultAddress };
}

export async function updateCartItemQuantity(item: CustomerCartItem, quantity: number) {
  const nextQuantity = Math.max(1, Math.round(quantity));

  const { error } = await db
    .from("cart_items")
    .update({
      quantity: nextQuantity,
      total_price: item.priceUgx * nextQuantity,
    })
    .eq("id", item.id);

  if (error) throw error;
}

export async function deleteCartItem(itemId: string) {
  const { error } = await db.from("cart_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function clearCustomerCart(cartId: string) {
  const { error } = await db.from("cart_items").delete().eq("cart_id", cartId);
  if (error) throw error;
}

export function getPromoDiscount(code: string, subtotal: number): PromoResult | null {
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode) return null;

  if (normalizedCode === "SOFRA10" || normalizedCode === "WELCOME10") {
    return {
      code: normalizedCode,
      label: "10% off food",
      discount: Math.round(subtotal * 0.1),
    };
  }

  if (normalizedCode === "UGX5000" || normalizedCode === "SAVE5000") {
    return {
      code: normalizedCode,
      label: "UGX 5,000 off",
      discount: Math.min(5000, subtotal),
    };
  }

  return null;
}

export function summarizeCustomerCart(params: {
  items: CustomerCartItem[];
  address?: CustomerAddress | null;
  orderType?: "delivery" | "pickup";
  promoCode?: string;
  tip?: number;
  deliverySettings?: DeliveryPricingSettings | null;
}): CartSummary {
  const subtotal = params.items.reduce((sum, item) => sum + item.totalPriceUgx, 0);
  const discount = params.promoCode ? getPromoDiscount(params.promoCode, subtotal)?.discount || 0 : 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const deliveryFee =
    params.orderType === "pickup" || params.items.length === 0
      ? 0
      : calculateDeliveryFee({
          restaurant: params.items[0]?.restaurant_location,
          address: params.address || null,
          settings: params.deliverySettings,
        });
  const distanceKm =
    params.orderType === "pickup" || params.items.length === 0
      ? null
      : calculateDeliveryDistanceKm({
          restaurant: params.items[0]?.restaurant_location,
          address: params.address || null,
        });
  const tax = 0;
  const tip = Math.max(0, Number(params.tip || 0));
  const total = Math.max(0, taxableAmount + deliveryFee + tax + tip);

  return {
    subtotal,
    deliveryFee,
    distanceKm,
    tax,
    discount,
    tip,
    total,
  };
}
