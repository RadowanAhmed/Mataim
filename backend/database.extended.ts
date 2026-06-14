/**
 * Tables added after the last full Supabase typegen.
 * Merge into Database via `FullDatabase` in supabase.ts.
 */
import type { Json } from "./database.types";

type RowInsertUpdate<T extends Record<string, unknown>> = {
  Row: T;
  Insert: Partial<T> & Record<string, unknown>;
  Update: Partial<T>;
};

export type ExtendedDatabaseTables = {
  user_wallets: RowInsertUpdate<{
    id: string;
    user_id: string;
    user_type: "restaurant" | "driver" | "customer" | "admin";
    balance: number;
    pending_balance: number;
    total_earned: number;
    total_withdrawn: number;
    currency: string;
    created_at: string;
    updated_at: string;
  }>;
  withdrawals: RowInsertUpdate<{
    id: string;
    user_id: string;
    user_type: "restaurant" | "driver";
    amount: number;
    currency: string;
    bank_account_id: string | null;
    status: "pending" | "processing" | "approved" | "completed" | "rejected";
    fee_amount: number;
    rejected_reason: string | null;
    estimated_arrival_at: string | null;
    processed_at: string | null;
    transaction_id: string | null;
    stripe_payout_id: string | null;
    metadata: Json;
    created_at: string;
    updated_at: string;
  }>;
  bank_accounts: RowInsertUpdate<{
    id: string;
    user_id: string;
    user_type: "restaurant" | "driver";
    bank_name: string;
    account_holder_name: string;
    account_number_masked: string;
    routing_number_masked: string | null;
    verification_status: string | null;
    is_default: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  transactions: RowInsertUpdate<{
    id: string;
    user_id: string;
    user_type: string;
    amount: number;
    type: string;
    status: string;
    created_at: string;
  }>;
  conversations: RowInsertUpdate<{
    id: string;
    order_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
  messages: RowInsertUpdate<{
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    created_at: string;
  }>;
  user_push_tokens: RowInsertUpdate<{
    id: string;
    user_id: string;
    user_type: string;
    expo_push_token: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  order_issues: RowInsertUpdate<{
    id: string;
    order_id: string;
    customer_id: string;
    issue_type: string;
    description: string;
    status: string;
    created_at: string;
  }>;
  hotspots: RowInsertUpdate<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    demand_level: number;
    is_active: boolean;
  }>;
  driver_achievements: RowInsertUpdate<{
    id: number;
    driver_id: string;
    achievement_type: string;
    achievement_name: string;
    earned_at: string;
  }>;
  driver_daily_stats: RowInsertUpdate<{
    id: number;
    driver_id: string;
    stat_date: string;
    deliveries_completed: number;
    earnings: number;
  }>;
};
