import { supabase } from "@/backend/supabase";
import Constants from "expo-constants";

export type CreatePaymentIntentParams = {
  amountUGX: number;
  customerEmail?: string | null;
  metadata?: Record<string, string>;
};

export type CreatePaymentIntentResult = {
  clientSecret: string;
  paymentIntentId: string;
  currency: string;
};

/**
 * Creates a Stripe PaymentIntent via the payments API (requires logged-in user).
 */
function getDevServerPaymentApiBase() {
  const constants = Constants as any;
  const hostUri =
    constants.expoConfig?.hostUri ||
    constants.manifest2?.extra?.expoClient?.hostUri ||
    constants.manifest?.debuggerHost;

  const host = typeof hostUri === "string" ? hostUri.split(":")[0] : "";
  if (!host || host === "localhost" || host === "127.0.0.1") return null;

  return `http://${host}:4000`;
}

function getPaymentApiBases() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  const candidates = [
    configured,
    __DEV__ ? getDevServerPaymentApiBase() : null,
    __DEV__ ? "http://10.0.2.2:4000" : null,
  ].filter(Boolean) as string[];

  return [...new Set(candidates)];
}

async function readPaymentResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

/**
 * Payment intent status type for verification
 */
export type PaymentIntentStatus = "requires_payment_method" | "requires_confirmation" | "requires_action" | "processing" | "succeeded" | "canceled";

export type VerifyPaymentIntentResult = {
  id: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
  created: number;
  charges: any[];
  client_secret: string;
};

/**
 * Verifies a Stripe PaymentIntent status with the backend.
 * Must be called after presentPaymentSheet() completes to confirm payment succeeded.
 */
export async function verifyPaymentIntent(
  paymentIntentId: string,
): Promise<VerifyPaymentIntentResult> {
  const apiBases = getPaymentApiBases();
  if (apiBases.length === 0) {
    throw new Error("Payments API URL is not configured (EXPO_PUBLIC_API_URL).");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Please sign in to verify payment.");
  }

  let lastNetworkError: unknown = null;

  for (const apiBase of apiBases) {
    try {
      const response = await fetch(`${apiBase}/api/payments/verify-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          paymentIntentId,
        }),
      });

      const data = await readPaymentResponse(response);

      if (!response.ok) {
        throw new Error(data?.error || "Could not verify payment");
      }

      return {
        id: data.id,
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        created: data.created,
        charges: data.charges || [],
        client_secret: data.client_secret,
      };
    } catch (error: any) {
      if (error?.message && !String(error.message).includes("Network request failed")) {
        throw error;
      }

      lastNetworkError = error;
    }
  }

  throw new Error(
    `Payments API is unreachable. Could not verify payment. Tried: ${apiBases.join(", ")}. ${lastNetworkError instanceof Error ? lastNetworkError.message : ""}`,
  );
}

export async function createPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<CreatePaymentIntentResult> {
  const apiBases = getPaymentApiBases();
  if (apiBases.length === 0) {
    throw new Error("Payments API URL is not configured (EXPO_PUBLIC_API_URL).");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Please sign in to pay by card.");
  }

  let lastNetworkError: unknown = null;

  for (const apiBase of apiBases) {
    try {
      const response = await fetch(`${apiBase}/api/payments/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amountUGX: params.amountUGX,
          customerEmail: params.customerEmail ?? undefined,
          metadata: params.metadata ?? {},
        }),
      });

      const data = await readPaymentResponse(response);

      if (!response.ok || !data?.clientSecret) {
        throw new Error(data?.error || "Could not start card payment");
      }

      return {
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
        currency: data.currency || "ugx",
      };
    } catch (error: any) {
      if (error?.message && !String(error.message).includes("Network request failed")) {
        throw error;
      }

      lastNetworkError = error;
    }
  }

  throw new Error(
    `Payments API is unreachable. Start the payments server with "npm run payments:start" and make sure EXPO_PUBLIC_API_URL is reachable from this device. Tried: ${apiBases.join(", ")}. ${lastNetworkError instanceof Error ? lastNetworkError.message : ""}`,
  );
}
