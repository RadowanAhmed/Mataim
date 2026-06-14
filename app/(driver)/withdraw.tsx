// app/(driver)/withdraw.tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import {
  useAuth
} from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import {
  formatMoney,
  toUGX
} from "@/backend/utils/currency";
import { calculateDriverPayout } from "@/backend/utils/deliveryPricing";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import { Ionicons } from "@expo/vector-icons";
import {
  useRouter
} from "expo-router";
import React,
{
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AppText from "../components/common/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import animations from "@/constent/animations";

const MIN_WITHDRAWAL_UGX = 5000;
const PERCENT_OPTIONS = [25, 50, 75, 100];
const WITHDRAWAL_FEE_UGX = 0;
const ESTIMATED_ARRIVAL_LABEL = "1-2 business days";
const CONFETTI = [
  { left: -56, top: -10, color: "#10B981", rotate: "18deg" },
  { left: -34, top: -42, color: "#22C55E", rotate: "-22deg" },
  { left: -6, top: -58, color: "#FACC15", rotate: "34deg" },
  { left: 26, top: -44, color: "#38BDF8", rotate: "-16deg" },
  { left: 54, top: -12, color: "#10B981", rotate: "28deg" },
  { left: 42, top: 24, color: "#A7F3D0", rotate: "-36deg" },
  { left: -46, top: 26, color: "#86EFAC", rotate: "42deg" },
];
const db = supabase as any;

type RecentRequest = {
  id: string;
  amount: number;
  status: string;
  created_at?: string | null;
  estimated_arrival_at?: string | null;
  transaction_id?: string | null;
  rejected_reason?: string | null;
  source?: "wallet" | "legacy";
};

type BankAccount = {
  id: string;
  bank_name?: string | null;
  account_holder_name?: string | null;
  account_number_masked?: string | null;
  routing_number_masked?: string | null;
};

type Receipt = {
  id: string;
  amount: number;
  date: string;
  status: string;
  mode?: "requested" | "approved";
};

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sumMoney = (rows: any[] = [], pick: (row: any) => any) =>
  rows.reduce((sum, row) => sum + toUGX(pick(row)), 0);

const formatDateTime = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "Today";
  return date.toLocaleString("en-UG", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const shortId = (value?: string | null) => {
  if (!value) return "Pending";
  return value.length > 10 ? value.slice(0, 8).toUpperCase() : value.toUpperCase();
};

const formatBankLabel = (bank?: BankAccount | null) => {
  if (!bank) return "No bank account saved";
  const masked = bank.account_number_masked || "Account saved";
  return `${bank.bank_name || "Bank"} ${masked}`;
};

const isApprovedStatus = (status?: string | null) =>
  ["approved", "completed", "paid"].includes(String(status || "").toLowerCase());

const statusTone = (status?: string | null) => {
  const value = String(status || "").toLowerCase();
  if (isApprovedStatus(value)) return { color: "#047857", backgroundColor: "#ECFDF5" };
  if (value === "rejected") return { color: "#B91C1C", backgroundColor: "#FEF2F2" };
  if (value === "processing") return { color: "#1D4ED8", backgroundColor: "#EFF6FF" };
  return { color: "#B45309", backgroundColor: "#FFFBEB" };
};

export default function DriverWithdrawScreen() {
  const router = useRouter();
  const { user } = useAuth() as any;
  const checkScale = useRef(new Animated.Value(0)).current;
  const confettiProgress = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [available, setAvailable] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [defaultBank, setDefaultBank] = useState<BankAccount | null>(null);
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const requestAmount = useMemo(() => toUGX(amount), [amount]);
  const selectedBank = useMemo(
    () => bankAccounts.find((account) => account.id === selectedBankId) || defaultBank,
    [bankAccounts, defaultBank, selectedBankId],
  );
  const withdrawalFee = requestAmount > 0 ? WITHDRAWAL_FEE_UGX : 0;
  const netPayout = Math.max(requestAmount - withdrawalFee, 0);
  const remainingBalance = Math.max(available - requestAmount, 0);
  const canSubmit = Boolean(selectedBank) && requestAmount >= MIN_WITHDRAWAL_UGX && requestAmount <= available;

  const fetchWithdrawData = useCallback(async (showSpinner = true) => {
    if (!user?.id) return;

    try {
      if (showSpinner) setLoading(true);

      const [
        wallet,
        driver,
        transactions,
        deliveredOrders,
        withdrawals,
        legacyRequests,
        bankAccountsResult,
      ] = await Promise.all([
        db
          .from("user_wallets")
          .select("*")
          .eq("user_id", user.id)
          .eq("user_type", "driver")
          .maybeSingle(),
        db
          .from("delivery_users")
          .select("wallet_balance, pending_balance, total_earnings, earnings_today, full_name")
          .eq("id", user.id)
          .maybeSingle(),
        db
          .from("transactions")
          .select("amount, type, status, created_at")
          .eq("user_id", user.id)
          .eq("user_type", "driver")
          .in("type", ["driver_payout", "tip"])
          .eq("status", "completed"),
        db
          .from("orders")
          .select("delivery_fee, driver_payout_amount, tip_amount, status")
          .eq("driver_id", user.id)
          .eq("status", "delivered"),
        db
          .from("withdrawals")
          .select("id, amount, status, created_at, estimated_arrival_at, transaction_id, rejected_reason")
          .eq("user_id", user.id)
          .eq("user_type", "driver")
          .order("created_at", { ascending: false })
          .limit(2),
        db
          .from("driver_withdrawal_requests")
          .select("id, amount, status, created_at, transaction_id, rejected_reason")
          .eq("driver_id", user.id)
          .order("created_at", { ascending: false })
          .limit(2),
        db
          .from("bank_accounts")
          .select("id, bank_name, account_holder_name, account_number_masked, routing_number_masked")
          .eq("user_id", user.id)
          .eq("user_type", "driver")
          .eq("is_active", true)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(2),
      ]);

      const walletRecord = wallet?.data as any;
      const driverRecord = driver?.data as any;
      const transactionRows = Array.isArray(transactions?.data) ? transactions.data : [];
      const orderRows = Array.isArray(deliveredOrders?.data) ? deliveredOrders.data : [];
      const withdrawalRows = Array.isArray(withdrawals?.data) ? withdrawals.data : [];
      const legacyRows = Array.isArray(legacyRequests?.data) ? legacyRequests.data : [];
      const completedWithdrawals = [...withdrawalRows, ...legacyRows].filter((item: any) =>
        ["pending", "processing", "approved", "completed", "paid"].includes(String(item.status || "").toLowerCase()),
      );
      const withdrawnOrReserved = sumMoney(completedWithdrawals, (item) => item.amount);
      const transactionTotal = sumMoney(transactionRows, (item) => item.amount);
      const orderTotal = sumMoney(orderRows, (item) =>
        toNumber(item.driver_payout_amount) > 0
          ? item.driver_payout_amount
          : calculateDriverPayout(item.delivery_fee) + toNumber(item.tip_amount),
      );
      const walletBalance = toUGX(walletRecord?.balance);
      const walletEarned = toUGX(walletRecord?.total_earned);
      const legacyWallet = toUGX(driverRecord?.wallet_balance);
      const legacyLifetime = toUGX(driverRecord?.total_earnings);
      const calculatedLifetime = Math.max(walletEarned, legacyLifetime, transactionTotal, orderTotal);
      const calculatedAvailable =
        walletBalance > 0
          ? walletBalance
          : Math.max(legacyWallet, legacyLifetime, transactionTotal, orderTotal) - withdrawnOrReserved;

      setAvailable(Math.max(0, calculatedAvailable));
      setPendingBalance(toUGX(walletRecord?.pending_balance ?? driverRecord?.pending_balance));
      setLifetimeEarnings(calculatedLifetime);
      const accounts = ((bankAccountsResult?.data || []) as BankAccount[]);
      setBankAccounts(accounts);
      setDefaultBank(accounts[0] || null);
      setSelectedBankId((current) =>
        accounts.some((account) => account.id === current) ? current : accounts[0]?.id || null,
      );
      setRecentRequests(
        [
          ...withdrawalRows.map((item: any) => ({ ...item, source: "wallet" as const })),
          ...legacyRows.map((item: any) => ({ ...item, source: "legacy" as const })),
        ]
          .sort(
            (a: any, b: any) =>
              new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
          )
          .slice(0, 6),
      );
    } catch (error) {
      console.error("Failed to load withdraw data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchWithdrawData();
  }, [fetchWithdrawData]);

  useEffect(() => {
    if (!receipt) return;
    checkScale.setValue(0);
    confettiProgress.setValue(0);

    Animated.parallel([
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 5,
        tension: 95,
        useNativeDriver: true,
      }),
      Animated.timing(confettiProgress, {
        toValue: 1,
        duration: 720,
        useNativeDriver: true,
      }),
    ]).start();
  }, [checkScale, confettiProgress, receipt]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = db
      .channel(`driver-withdrawals-${user.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "withdrawals",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const row = payload.new || {};
          if (row.user_type !== "driver" || !isApprovedStatus(row.status)) return;

          setReceipt({
            id: row.id,
            amount: toUGX(row.amount),
            date: row.processed_at || row.updated_at || new Date().toISOString(),
            status: row.status,
            mode: "approved",
          });
          await fetchWithdrawData(false);
        },
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [fetchWithdrawData, user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWithdrawData(false);
  }, [fetchWithdrawData]);

  const showBalanceScreen = useCallback(async () => {
    setReceipt(null);
    setAmount("");
    await fetchWithdrawData(false);
  }, [fetchWithdrawData]);

  const setPercentageAmount = (percent: number) => {
    if (available <= 0) return;
    setAmount(String(Math.floor((available * percent) / 100)));
  };

  const submitWithdrawal = async () => {
    if (!user?.id || submitting) return;

    if (!selectedBank) {
      Alert.alert("Add bank account", "Save a bank account before requesting a withdrawal.", [
        { text: "Cancel", style: "cancel" },
        { text: "Add account", onPress: () => router.push("/(driver)/bank-account" as any) },
      ]);
      return;
    }

    if (requestAmount < MIN_WITHDRAWAL_UGX) {
      Alert.alert("Minimum amount", `Withdraw at least ${formatMoney(MIN_WITHDRAWAL_UGX)}.`);
      return;
    }

    if (requestAmount > available) {
      Alert.alert("Amount too high", "You cannot withdraw more than your available wallet balance.");
      return;
    }

    try {
      setSubmitting(true);

      if (selectedBank?.id) {
        const { error: clearDefaultError } = await db
          .from("bank_accounts")
          .update({ is_default: false })
          .eq("user_id", user.id)
          .eq("user_type", "driver");
        if (clearDefaultError) throw clearDefaultError;

        const { error: setDefaultError } = await db
          .from("bank_accounts")
          .update({ is_default: true })
          .eq("id", selectedBank.id)
          .eq("user_id", user.id);
        if (setDefaultError) throw setDefaultError;
      }

      const { data, error } = await db.rpc("create_withdrawal_request", {
        p_user_id: user.id,
        p_amount: requestAmount,
        p_user_type: "driver",
      });

      if (error) throw error;

      const withdrawal = data || {};
      const successReceipt = {
        id: withdrawal.id || `WD-${Date.now()}`,
        amount: toUGX(withdrawal.amount || requestAmount),
        date: withdrawal.created_at || new Date().toISOString(),
        status: withdrawal.status || "pending",
        mode: "requested" as const,
      };

      await db.from("driver_notifications").insert({
        driver_id: user.id,
        title: "Withdrawal request sent",
        body: `Your bank withdrawal for ${formatMoney(requestAmount)} is waiting for review.`,
        type: "earning",
        data: { withdrawal_id: successReceipt.id, screen: "/(driver)/withdraw" },
      });

      setReceipt(successReceipt);
      setAmount("");
      await fetchWithdrawData(false);
    } catch (error: any) {
      Alert.alert("Could not submit", error?.message || "Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#111827" />
        <AppText style={styles.loadingText} weight="regular">Loading payout details...</AppText>
      </SafeAreaView>
    );
  }

  if (receipt) {
    const approvedReceipt = receipt.mode === "approved" || isApprovedStatus(receipt.status);
    const tone = statusTone(receipt.status);

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <ScrollView contentContainerStyle={styles.successContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.topBackButton} onPress={showBalanceScreen}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>

          {/* <Animated.View
            style={[
              styles.successIcon,
              {
                transform: [
                  {
                    scale: checkScale.interpolate({
                      inputRange: [0, 0.7, 1],
                      outputRange: [0.4, 1.08, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="checkmark" size={48} color="#fff" />
          </Animated.View> */}
          <View>
            <LottieView source={animations.successanimation} autoPlay loop style={styles.successIcon} />
          </View>

          {approvedReceipt && (
            <View pointerEvents="none" style={styles.confettiLayer}>
              {CONFETTI.map((piece, index) => (
                <Animated.View
                  key={`${piece.left}-${index}`}
                  style={[
                    styles.confettiPiece,
                    {
                      backgroundColor: piece.color,
                      left: 76 + piece.left,
                      top: 52 + piece.top,
                      opacity: confettiProgress.interpolate({
                        inputRange: [0, 0.18, 1],
                        outputRange: [0, 1, 0],
                      }),
                      transform: [
                        { rotate: piece.rotate },
                        {
                          translateY: confettiProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [12, 42],
                          }),
                        },
                        {
                          scale: confettiProgress.interpolate({
                            inputRange: [0, 0.2, 1],
                            outputRange: [0.4, 1, 0.7],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          )}

          <AppText style={styles.successTitle} weight="bold">{approvedReceipt ? "Withdrawal sent" : "Withdrawal requested"}</AppText>
          <AppText style={styles.successSubtitle} weight="medium">
            {approvedReceipt
              ? "Your payout was approved and sent to your bank."
              : "Your bank payout is now with the finance team for approval."}
          </AppText>

          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <View>
                <AppText style={styles.receiptLabel} weight="regular">Receipt</AppText>
                <AppText style={styles.receiptId} weight="medium">#{shortId(receipt.id)}</AppText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: tone.backgroundColor }]}>
                <AppText style={[styles.statusBadgeText, { color: tone.color }]} weight="medium">{receipt.status}</AppText>
              </View>
            </View>

            <View style={styles.receiptLine} />

            <View style={styles.receiptRow}>
              <AppText style={styles.receiptMeta} weight="regular">Amount</AppText>
              <AppText style={styles.receiptValue} weight="heavy">{formatMoney(receipt.amount)}</AppText>
            </View>
            <View style={styles.receiptRow}>
              <AppText style={styles.receiptMeta} weight="regular">Bank</AppText>
              <AppText style={styles.receiptValue} weight="medium">{formatBankLabel(selectedBank)}</AppText>
            </View>
            <View style={styles.receiptRow}>
              <AppText style={styles.receiptMeta} weight="regular">Date</AppText>
              <AppText style={styles.receiptValue} weight="medium">{formatDateTime(receipt.date)}</AppText>
            </View>
          </View>

          <TouchableOpacity style={styles.helpButton} onPress={() => router.push("/(driver)/support" as any)}>
            <Ionicons name="help-circle-outline" size={18} color="#111827" />
            <AppText style={styles.helpButtonText} weight="medium">Need help with this transaction?</AppText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneButton} onPress={showBalanceScreen}>
            <AppText style={styles.doneButtonText} weight="medium">Done</AppText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => goBackOrDriverFallback(router, "/(driver)/dashboard", navigation)}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <AppText style={styles.headerEyebrow} weight="medium">Payout</AppText>
          <AppText style={styles.headerTitle} weight="medium">Withdraw</AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111827" />
        }
      >
        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View>
              <AppText style={styles.balanceLabel} weight="medium">Available wallet</AppText>
              <AppText style={styles.balanceAmount} weight="heavy" numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(available)}
              </AppText>
            </View>

            <View style={styles.balanceIcon}>
              <Ionicons name="wallet-outline" size={22} color="#111827" />
            </View>
          </View>

          <View style={styles.balanceMetaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Pending</Text>
              <Text style={styles.metaValue}>{formatMoney(pendingBalance)}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Lifetime</Text>
              <Text style={styles.metaValue}>{formatMoney(lifetimeEarnings)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <AppText style={styles.sectionTitle} weight="medium">Amount</AppText>
              <AppText style={styles.sectionSubtitle} weight="regular">Minimum {formatMoney(MIN_WITHDRAWAL_UGX)}</AppText>
            </View>
            <TouchableOpacity onPress={() => setAmount(String(Math.floor(available)))} disabled={available <= 0}>
              <Text style={[styles.selectAllText, available <= 0 && styles.disabledText]}>Select all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputPrefix}>UGX</Text>
            <TextInput
              value={amount}
              onChangeText={(value) => setAmount(value.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              style={styles.amountInput}
            />
          </View>

          <View style={styles.percentRow}>
            {PERCENT_OPTIONS.map((percent) => (
              <TouchableOpacity
                key={percent}
                style={styles.percentChip}
                onPress={() => setPercentageAmount(percent)}
                disabled={available <= 0}
              >
                <Text style={styles.percentText}>{percent}%</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.amountSummary}>
            <Ionicons name="calculator-outline" size={15} color="#6B7280" />
            <Text style={styles.amountSummaryText}>
              Balance after request: {formatMoney(remainingBalance)}
            </Text>
          </View>

          <View style={styles.transactionDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Processing fee</Text>
              <Text style={styles.detailValue}>{formatMoney(withdrawalFee)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estimated arrival</Text>
              <Text style={styles.detailValue}>{ESTIMATED_ARRIVAL_LABEL}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabelStrong}>You receive</Text>
              <Text style={styles.detailValueStrong}>{formatMoney(netPayout)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.bankCardHeader}>
            <View style={styles.bankIcon}>
              <Ionicons name="business-outline" size={18} color="#111827" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.sectionTitle} weight="medium">Bank account</AppText>
              <AppText style={styles.sectionSubtitle} weight="regular">Withdrawals are sent to your saved default bank.</AppText>
            </View>
          </View>

          {selectedBank ? (
            <>
              <TouchableOpacity
                style={styles.savedBankBox}
                onPress={() => setBankDropdownOpen((value) => !value)}
                activeOpacity={0.86}
              >
                <View style={styles.savedBankText}>
                  <Text style={styles.savedBankName}>{selectedBank.bank_name || "Bank account"}</Text>
                  <Text style={styles.savedBankMeta} numberOfLines={1}>
                    {selectedBank.account_holder_name || "Account holder"} - {selectedBank.account_number_masked || "Saved"}
                  </Text>
                </View>
                <Ionicons name={bankDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color="#111827" />
              </TouchableOpacity>

              {bankDropdownOpen ? (
                <View style={styles.bankDropdown}>
                  {bankAccounts.map((account) => {
                    const active = account.id === selectedBank?.id;
                    return (
                      <TouchableOpacity
                        key={account.id}
                        style={[styles.bankOption, active && styles.bankOptionActive]}
                        onPress={() => {
                          setSelectedBankId(account.id);
                          setBankDropdownOpen(false);
                        }}
                        activeOpacity={0.86}
                      >
                        <View style={styles.bankOptionIcon}>
                          <Ionicons name="business-outline" size={16} color={active ? "#047857" : "#6B7280"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bankOptionName}>{account.bank_name || "Bank account"}</Text>
                          <Text style={styles.bankOptionMeta} numberOfLines={1}>
                            {account.account_holder_name || "Account holder"} - {account.account_number_masked || "Saved"}
                          </Text>
                        </View>
                        {active ? <Ionicons name="checkmark-circle" size={19} color="#10B981" /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              <TouchableOpacity style={styles.addBankInlineButton} onPress={() => router.push("/(driver)/bank-account" as any)}>
                <Ionicons name="add" size={17} color="#111827" />
                <Text style={styles.addBankInlineText}>Add new bank account</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.addBankButton} onPress={() => router.push("/(driver)/bank-account" as any)}>
              <Ionicons name="add-circle-outline" size={19} color="#111827" />
              <Text style={styles.addBankText}>Add bank account</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (!canSubmit || submitting || available <= 0) && styles.submitButtonDisabled]}
          onPress={submitWithdrawal}
          disabled={!canSubmit || submitting || available <= 0}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.submitContent}>
              <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
              <AppText style={styles.submitText} weight="medium">
                {selectedBank ? "Confirm withdrawal" : "Add bank account first"}
              </AppText>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.helpFooterButton} onPress={() => router.push("/(driver)/support" as any)}>
          <Ionicons name="help-circle-outline" size={18} color="#111827" />
          <AppText style={styles.helpFooterText} weight="medium">Need help</AppText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    marginBottom: -50
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "#F8FAFC",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.7,
    borderColor: "#e5e7eb63",
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    color: "#FF6B35",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: "700",
    color: "#111827",
    fontFamily: "Inter",
    marginTop: 2,
  },
  content: {
    padding: 15,
    paddingBottom: 120,
    gap: 14,
  },
  balanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: 16,
    borderWidth: 0.6,
    borderColor: "#0b803221",
  },
  balanceTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  balanceIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  balanceAmount: {
    color: "#047857",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 6,
    fontFamily: "Inter",
  },
  balanceMetaRow: {
    marginTop: 18,
    borderTopWidth: 0.8,
    borderTopColor: "#ecfdf5e8",
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  metaItem: {
    flex: 1,
  },
  metaDivider: {
    width: 0.6,
    height: 28,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 14,
  },
  metaLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  metaValue: {
    marginTop: 4,
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    borderWidth: 0.8,
    borderColor: "#e5e7eb6e",
    gap: 11,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16.2,
    fontWeight: "800",
    fontFamily: "Inter",
  },
  sectionSubtitle: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 11.8,
    lineHeight: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  selectAllText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  disabledText: {
    opacity: 0.35,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 0.4,
    borderColor: "#000000d0",
    paddingHorizontal: 12,
  },
  inputPrefix: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F97316",
    marginRight: 8,
    fontFamily: "Inter",
  },
  amountInput: {
    flex: 1,
    height: 54,
    fontSize: 22,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "Inter",
  },
  percentRow: {
    flexDirection: "row",
    gap: 8,
  },
  percentChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#f3f4f6da",
    alignItems: "center",
    justifyContent: "center",
  },
  percentText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  amountSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 4,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  amountSummaryText: {
    color: "#6B7280",
    fontSize: 11.2,
    fontWeight: "500",
    fontFamily: "Inter",
  },
  transactionDetails: {
    borderRadius: 4,
    backgroundColor: "#f8fafcdb",
    borderWidth: 0.7,
    borderColor: "#e5e7eb61",
    padding: 12,
    gap: 9,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  detailValue: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
    textAlign: "right",
  },
  detailDivider: {
    height: 0.5,
    backgroundColor: "#e5e7ebc0",
  },
  detailLabelStrong: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  detailValueStrong: {
    color: "#047857",
    fontSize: 14.2,
    fontWeight: "600",
    fontFamily: "Inter",
    textAlign: "right",
  },
  bankCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bankIcon: {
    width: 40,
    height: 40,
    borderRadius: 55,
    backgroundColor: "#f3f4f6e4",
    alignItems: "center",
    justifyContent: "center",
  },
  savedBankBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 0.8,
    borderColor: "#e5e7eb82",
    padding: 12,
  },
  savedBankText: {
    flex: 1,
  },
  savedBankName: {
    color: "#111827",
    fontSize: 14.2,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  savedBankMeta: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 12.2,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  changeBankButton: {
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  changeBankText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  addBankButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 0.8,
    borderColor: "#cbd5e197",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addBankText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  bankDropdown: {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  bankOption: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  bankOptionActive: {
    backgroundColor: "#ECFDF5",
  },
  bankOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  bankOptionName: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  bankOptionMeta: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  addBankInlineButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 0.8,
    borderColor: "#e0e0e072",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addBankInlineText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 10,
  },
  requestIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  requestInfo: {
    flex: 1,
  },
  requestAmount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "Inter",
  },
  requestMeta: {
    marginTop: 2,
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
    fontFamily: "Inter",
  },
  requestStatus: {
    maxWidth: 90,
    textTransform: "capitalize",
    fontSize: 10,
    fontWeight: "600",
    color: "#F97316",
    fontFamily: "Inter",
  },
  historyStatusBadge: {
    maxWidth: 104,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  historyStatusText: {
    textTransform: "capitalize",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  emptyHistory: {
    minHeight: 74,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 0.8,
    borderColor: "#e5e7eba6",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyHistoryText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  submitButton: {
    height: 54,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  helpFooterButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.6,
    borderColor: "#e5e7ebf3",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  helpFooterText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  successContent: {
    flexGrow: 1,
    padding: 18,
    paddingBottom: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  topBackButton: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  confettiLayer: {
    position: "absolute",
    top: "50%",
    width: 160,
    height: 120,
    marginTop: -118,
    alignSelf: "center",
  },
  confettiPiece: {
    position: "absolute",
    width: 8,
    height: 14,
    borderRadius: 3,
  },
  successTitle: {
    marginTop: 24,
    color: "#111827",
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    fontFamily: "Inter",
  },
  successSubtitle: {
    marginTop: 8,
    maxWidth: 290,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    fontFamily: "Inter",
  },
  receiptCard: {
    alignSelf: "stretch",
    marginTop: 24,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  receiptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  receiptLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  receiptId: {
    marginTop: 4,
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  statusBadge: {
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    color: "#047857",
    textTransform: "capitalize",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  receiptLine: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 14,
  },
  receiptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 7,
  },
  receiptMeta: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  receiptValue: {
    flex: 1,
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    fontFamily: "Inter",
  },
  helpButton: {
    alignSelf: "stretch",
    marginTop: 16,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  helpButtonText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  doneButton: {
    alignSelf: "stretch",
    marginTop: 10,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter",
  },
});
