import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/auth";
import { api, IncomeEntry, UserPackage } from "@/lib/api";

function fmt(val?: string | null) {
  const n = parseFloat(val ?? "0");
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

const TYPE_COLORS: Record<string, string> = {
  roi: "#26A17B",
  referral: "#3B82F6",
  royalty: "#A855F7",
  rank_reward: "#F0B90B",
};

const TYPE_LABELS: Record<string, string> = {
  roi: "ROI",
  referral: "Referral",
  royalty: "Royalty",
  rank_reward: "Rank",
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.me.dashboard(),
  });

  const { data: recentIncome } = useQuery({
    queryKey: ["income", "recent"],
    queryFn: () => api.income.list(),
    select: (rows: IncomeEntry[]) => rows.slice(0, 5),
  });

  const { data: myPackages } = useQuery({
    queryKey: ["packages", "my"],
    queryFn: () => api.packages.my(),
    select: (rows: UserPackage[]) => rows.filter((p) => p.status === "active").slice(0, 3),
  });

  const onRefresh = () => {
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["income"] });
    qc.invalidateQueries({ queryKey: ["packages"] });
  };

  const walletBal = parseFloat(dashboard?.walletBalance ?? user?.walletBalance ?? "0");
  const earnBal = parseFloat(dashboard?.earningsBalance ?? user?.earningsBalance ?? "0");
  const totalBal = (walletBal + earnBal).toFixed(2);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: topPad + 12,
      paddingHorizontal: 20,
      paddingBottom: 8,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.primary, letterSpacing: 2 },
    headerSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    balanceCard: {
      margin: 20,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    balanceLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 1 },
    balanceValue: { fontSize: 38, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 4 },
    balanceUnit: { fontSize: 18, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    balanceRow: { flexDirection: "row", marginTop: 16, gap: 12 },
    miniCard: { flex: 1, backgroundColor: colors.secondary, borderRadius: 12, padding: 12 },
    miniLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    miniValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginTop: 2 },
    actionsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 20 },
    actionBtn: {
      flex: 1,
      backgroundColor: colors.secondary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground },
    sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground, paddingHorizontal: 20, marginBottom: 10 },
    packageCard: {
      marginHorizontal: 20,
      marginBottom: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    packageName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    packageSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    packageRoi: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.success },
    incomeRow: {
      marginHorizontal: 20,
      marginBottom: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
    incomeAmount: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.success },
    emptyText: { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 12 },
    viewAll: { alignItems: "center", paddingVertical: 12 },
    viewAllText: { color: colors.primary, fontSize: 13, fontFamily: "Inter_500Medium" },
    bottomPad: { height: Platform.OS === "web" ? 34 : insets.bottom + 80 },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>TELEBIT</Text>
          <Text style={s.headerSub}>Welcome back{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(tabs)/more")}>
          <Feather name="user" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={dashLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Balance card */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Total Balance</Text>
          {dashLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : (
            <>
              <Text style={s.balanceValue}>
                {totalBal} <Text style={s.balanceUnit}>USDT</Text>
              </Text>
              <View style={s.balanceRow}>
                <View style={s.miniCard}>
                  <Text style={s.miniLabel}>💼 Wallet</Text>
                  <Text style={s.miniValue}>{fmt(dashboard?.walletBalance ?? user?.walletBalance)} USDT</Text>
                </View>
                <View style={s.miniCard}>
                  <Text style={s.miniLabel}>💰 Earnings</Text>
                  <Text style={s.miniValue}>{fmt(dashboard?.earningsBalance ?? user?.earningsBalance)} USDT</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Quick actions */}
        <View style={s.actionsRow}>
          <TouchableOpacity style={s.actionBtn} onPress={() => { Haptics.impactAsync(); router.push("/(tabs)/wallet"); }}>
            <Feather name="arrow-down-circle" size={22} color={colors.success} />
            <Text style={s.actionText}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => { Haptics.impactAsync(); router.push("/(tabs)/wallet"); }}>
            <Feather name="arrow-up-circle" size={22} color={colors.primary} />
            <Text style={s.actionText}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => { Haptics.impactAsync(); router.push("/(tabs)/invest"); }}>
            <Feather name="trending-up" size={22} color="#3B82F6" />
            <Text style={s.actionText}>Invest</Text>
          </TouchableOpacity>
        </View>

        {/* Active Packages */}
        <Text style={s.sectionTitle}>Active Investments</Text>
        {!myPackages || myPackages.length === 0 ? (
          <Text style={[s.emptyText, { paddingHorizontal: 20 }]}>No active packages — start investing!</Text>
        ) : (
          <>
            {myPackages.map((pkg) => (
              <View key={pkg.id} style={s.packageCard}>
                <View>
                  <Text style={s.packageName}>{pkg.packageName ?? "Package"}</Text>
                  <Text style={s.packageSub}>
                    {pkg.expiresAt
                      ? `Expires ${new Date(pkg.expiresAt).toLocaleDateString()}`
                      : pkg.status}
                  </Text>
                </View>
                <Text style={s.packageRoi}>+{fmt(pkg.dailyRoiAmount)}/day</Text>
              </View>
            ))}
            <TouchableOpacity style={s.viewAll} onPress={() => router.push("/(tabs)/invest")}>
              <Text style={s.viewAllText}>View all investments →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Recent Income */}
        <Text style={[s.sectionTitle, { marginTop: 16 }]}>Recent Income</Text>
        {!recentIncome || recentIncome.length === 0 ? (
          <Text style={[s.emptyText, { paddingHorizontal: 20 }]}>No income yet</Text>
        ) : (
          <>
            {recentIncome.map((entry) => (
              <View key={entry.id} style={s.incomeRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[s.badge, { backgroundColor: TYPE_COLORS[entry.type] + "22" }]}>
                    <Text style={[s.badgeText, { color: TYPE_COLORS[entry.type] }]}>
                      {TYPE_LABELS[entry.type] ?? entry.type}
                    </Text>
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={s.incomeAmount}>+{fmt(entry.amount)} USDT</Text>
              </View>
            ))}
            <TouchableOpacity style={s.viewAll} onPress={() => router.push("/(tabs)/income")}>
              <Text style={s.viewAllText}>View all income →</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={s.bottomPad} />
      </ScrollView>
    </View>
  );
}
