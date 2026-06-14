import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";

function fmt(v?: string | null) {
  const n = parseFloat(v ?? "0");
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    confirmed: { bg: "#26A17B22", fg: "#26A17B" },
    pending: { bg: "#F59E0B22", fg: "#F59E0B" },
    approved: { bg: "#26A17B22", fg: "#26A17B" },
    rejected: { bg: "#EF444422", fg: "#EF4444" },
    processing: { bg: "#3B82F622", fg: "#3B82F6" },
  };
  const c = map[status] ?? { bg: "#8B8D9822", fg: "#8B8D98" };
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
      <Text style={{ color: c.fg, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" }}>
        {status}
      </Text>
    </View>
  );
}

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [checkingDeposit, setCheckingDeposit] = useState(false);

  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.me.dashboard(),
  });

  const { data: deposits, refetch: refetchDeposits } = useQuery({
    queryKey: ["deposits"],
    queryFn: () => api.deposits.list(),
  });

  const { data: withdrawals, refetch: refetchWithdrawals } = useQuery({
    queryKey: ["withdrawals"],
    queryFn: () => api.withdrawals.list(),
  });

  const onRefresh = () => {
    refetchDash(); refetchDeposits(); refetchWithdrawals();
  };

  const handleCopyAddress = async () => {
    const addr = dashboard?.depositAddress ?? user?.depositAddress ?? "";
    if (!addr) return;
    await Clipboard.setStringAsync(addr);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", "Deposit address copied to clipboard.");
  };

  const handleCheckDeposit = async () => {
    setCheckingDeposit(true);
    try {
      const res = await api.deposits.check();
      if (res.found) {
        Alert.alert("Deposit Found!", `Amount: ${res.amount ?? "—"} USDT`);
        await refreshUser();
        refetchDash(); refetchDeposits();
      } else {
        Alert.alert("No New Deposit", "No new on-chain deposit was found for your address.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Check failed.");
    } finally {
      setCheckingDeposit(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = withdrawAmount.trim();
    const addr = withdrawAddress.trim();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }
    if (!addr) { Alert.alert("Required", "Please enter the withdrawal address."); return; }

    setWithdrawLoading(true);
    try {
      await api.withdrawals.create({ amount, toAddress: addr });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setWithdrawAddress("");
      Alert.alert("Submitted", "Your withdrawal request has been submitted.");
      refetchWithdrawals(); refetchDash();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Withdrawal failed.");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topPad + 12, paddingHorizontal: 20, paddingBottom: 16 },
    title: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    card: {
      marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.card,
      borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border,
    },
    cardLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 1 },
    cardValue: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 4 },
    cardUnit: { fontSize: 14, color: colors.mutedForeground },
    balanceRow: { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 16 },
    miniCard: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
    actionsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 20 },
    btn: {
      flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center",
      flexDirection: "row", gap: 8,
    },
    addressCard: {
      marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.card,
      borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border,
    },
    addressLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium", textTransform: "uppercase", marginBottom: 8 },
    addressText: { fontSize: 13, color: colors.foreground, fontFamily: "Inter_400Regular", letterSpacing: 0.3 },
    sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, paddingHorizontal: 20, marginBottom: 8 },
    txRow: {
      marginHorizontal: 20, marginBottom: 6, backgroundColor: colors.card,
      borderRadius: 10, padding: 14, flexDirection: "row", justifyContent: "space-between",
      alignItems: "center", borderWidth: 1, borderColor: colors.border,
    },
    txAmt: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.success },
    txDate: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    emptyText: { color: colors.mutedForeground, fontSize: 13, textAlign: "center", paddingVertical: 8, fontFamily: "Inter_400Regular" },
    modal: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
    modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 20 },
    inputLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 14 },
    inputRow: {
      backgroundColor: colors.input, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, height: 50, justifyContent: "center",
    },
    input: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_400Regular" },
    submitBtn: {
      backgroundColor: colors.primary, borderRadius: 14, height: 52,
      alignItems: "center", justifyContent: "center", marginTop: 24,
    },
    cancelBtn: { alignItems: "center", paddingVertical: 14 },
    bottomPad: { height: Platform.OS === "web" ? 34 : insets.bottom + 80 },
  });

  const addr = dashboard?.depositAddress ?? user?.depositAddress ?? "";
  const shortAddr = addr.length > 20 ? `${addr.slice(0, 10)}...${addr.slice(-8)}` : addr;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Wallet</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={dashLoading} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Balance mini cards */}
        <View style={s.balanceRow}>
          <View style={s.miniCard}>
            <Text style={s.cardLabel}>💼 Wallet</Text>
            <Text style={[s.cardValue, { fontSize: 22 }]}>{fmt(dashboard?.walletBalance ?? user?.walletBalance)}</Text>
            <Text style={s.cardUnit}>USDT</Text>
          </View>
          <View style={s.miniCard}>
            <Text style={s.cardLabel}>💰 Earnings</Text>
            <Text style={[s.cardValue, { fontSize: 22 }]}>{fmt(dashboard?.earningsBalance ?? user?.earningsBalance)}</Text>
            <Text style={s.cardUnit}>USDT</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={s.actionsRow}>
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.success + "22", borderWidth: 1, borderColor: colors.success + "44" }]} onPress={handleCheckDeposit} disabled={checkingDeposit}>
            {checkingDeposit ? (
              <ActivityIndicator color={colors.success} size="small" />
            ) : (
              <>
                <Feather name="arrow-down-circle" size={18} color={colors.success} />
                <Text style={{ color: colors.success, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Check Deposit</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary + "22", borderWidth: 1, borderColor: colors.primary + "44" }]} onPress={() => setShowWithdrawModal(true)}>
            <Feather name="arrow-up-circle" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        {/* Deposit address */}
        <View style={s.addressCard}>
          <Text style={s.addressLabel}>🔗 BEP20 Deposit Address</Text>
          <Text style={s.addressText}>{shortAddr || "Loading..."}</Text>
          <TouchableOpacity
            onPress={handleCopyAddress}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }}
          >
            <Feather name="copy" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Inter_500Medium" }}>Copy Full Address</Text>
          </TouchableOpacity>
        </View>

        {/* Recent deposits */}
        <Text style={s.sectionTitle}>Deposits</Text>
        {!deposits || deposits.length === 0 ? (
          <Text style={[s.emptyText, { paddingHorizontal: 20 }]}>No deposits yet</Text>
        ) : (
          deposits.slice(0, 8).map((d) => (
            <View key={d.id} style={s.txRow}>
              <View>
                <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_500Medium" }}>Deposit</Text>
                <Text style={s.txDate}>{new Date(d.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={s.txAmt}>+{fmt(d.amount)} USDT</Text>
                <StatusBadge status={d.status} />
              </View>
            </View>
          ))
        )}

        {/* Recent withdrawals */}
        <Text style={[s.sectionTitle, { marginTop: 16 }]}>Withdrawals</Text>
        {!withdrawals || withdrawals.length === 0 ? (
          <Text style={[s.emptyText, { paddingHorizontal: 20 }]}>No withdrawals yet</Text>
        ) : (
          withdrawals.slice(0, 8).map((w) => (
            <View key={w.id} style={s.txRow}>
              <View>
                <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_500Medium" }}>Withdrawal</Text>
                <Text style={s.txDate}>{new Date(w.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={[s.txAmt, { color: colors.primary }]}>−{fmt(w.amount)} USDT</Text>
                <StatusBadge status={w.status} />
              </View>
            </View>
          ))
        )}

        <View style={s.bottomPad} />
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal visible={showWithdrawModal} animationType="slide" transparent>
        <View style={s.modal}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Withdraw USDT</Text>
            <Text style={s.inputLabel}>Amount (USDT)</Text>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={s.inputLabel}>BEP20 Address</Text>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={withdrawAddress}
                onChangeText={setWithdrawAddress}
                placeholder="0x..."
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity style={s.submitBtn} onPress={handleWithdraw} disabled={withdrawLoading}>
              {withdrawLoading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Submit Request</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowWithdrawModal(false)}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
