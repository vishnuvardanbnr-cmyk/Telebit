import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/auth";
import { api, Package, UserPackage } from "@/lib/api";

function fmt(v?: string | null) {
  const n = parseFloat(v ?? "0");
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

function StatusDot({ status }: { status: string }) {
  const c = status === "active" ? "#26A17B" : status === "completed" ? "#3B82F6" : "#8B8D98";
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />;
}

export default function InvestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const { data: packages, isLoading: pkgLoading, refetch: refetchPkgs } = useQuery({
    queryKey: ["packages"],
    queryFn: () => api.packages.list(),
  });

  const { data: myPackages, isLoading: myLoading, refetch: refetchMy } = useQuery({
    queryKey: ["packages", "my"],
    queryFn: () => api.packages.my(),
  });

  const onRefresh = () => { refetchPkgs(); refetchMy(); };

  const handlePurchase = (pkg: Package) => {
    const balance = parseFloat(user?.walletBalance ?? "0");
    const price = parseFloat(pkg.price);
    if (balance < price) {
      Alert.alert("Insufficient Balance", `You need ${fmt(pkg.price)} USDT but have ${fmt(user?.walletBalance)}.`);
      return;
    }
    Alert.alert(
      "Confirm Purchase",
      `Buy ${pkg.name} for ${fmt(pkg.price)} USDT?\nDaily ROI: ${pkg.roiPercent}% for ${pkg.durationDays} days`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setPurchasing(pkg.id);
            try {
              await api.packages.purchase(pkg.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await refreshUser();
              qc.invalidateQueries({ queryKey: ["packages"] });
              qc.invalidateQueries({ queryKey: ["dashboard"] });
              Alert.alert("Success!", `${pkg.name} activated. You'll earn ${pkg.roiPercent}% daily.`);
            } catch (err: any) {
              Alert.alert("Purchase Failed", err?.message ?? "Something went wrong.");
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const activeCount = myPackages?.filter((p) => p.status === "active").length ?? 0;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topPad + 12, paddingHorizontal: 20, paddingBottom: 8 },
    title: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    subtitle: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, paddingHorizontal: 20, marginBottom: 10, marginTop: 16 },
    pkgCard: {
      marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.card,
      borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border,
    },
    pkgName: { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground },
    pkgDesc: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 4 },
    statsRow: { flexDirection: "row", marginTop: 14, gap: 8 },
    stat: { flex: 1, backgroundColor: colors.secondary, borderRadius: 10, padding: 10, alignItems: "center" },
    statLabel: { fontSize: 10, color: colors.mutedForeground, fontFamily: "Inter_500Medium", textTransform: "uppercase" },
    statValue: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 2 },
    buyBtn: {
      marginTop: 14, backgroundColor: colors.primary,
      borderRadius: 12, height: 46, alignItems: "center", justifyContent: "center",
    },
    buyBtnText: { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 15 },
    myCard: {
      marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.card,
      borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border,
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    },
    emptyText: { color: colors.mutedForeground, fontSize: 13, textAlign: "center", paddingVertical: 12, fontFamily: "Inter_400Regular" },
    bottomPad: { height: Platform.OS === "web" ? 34 : insets.bottom + 80 },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Invest</Text>
        <Text style={s.subtitle}>{activeCount} active investment{activeCount !== 1 ? "s" : ""}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={pkgLoading || myLoading} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Available packages */}
        <Text style={s.sectionTitle}>Available Packages</Text>
        {pkgLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : !packages || packages.length === 0 ? (
          <Text style={[s.emptyText, { paddingHorizontal: 20 }]}>No packages available</Text>
        ) : (
          packages.map((pkg) => (
            <View key={pkg.id} style={s.pkgCard}>
              <Text style={s.pkgName}>{pkg.name}</Text>
              {pkg.description ? <Text style={s.pkgDesc}>{pkg.description}</Text> : null}
              <View style={s.statsRow}>
                <View style={s.stat}>
                  <Text style={s.statLabel}>Price</Text>
                  <Text style={[s.statValue, { color: colors.primary }]}>${fmt(pkg.price)}</Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statLabel}>Daily ROI</Text>
                  <Text style={[s.statValue, { color: colors.success }]}>{pkg.roiPercent}%</Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statLabel}>Duration</Text>
                  <Text style={[s.statValue, { color: colors.foreground }]}>{pkg.durationDays}d</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[s.buyBtn, purchasing === pkg.id && { opacity: 0.7 }]}
                onPress={() => handlePurchase(pkg)}
                disabled={purchasing !== null}
              >
                {purchasing === pkg.id ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={s.buyBtnText}>Purchase — {fmt(pkg.price)} USDT</Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* My investments */}
        <Text style={s.sectionTitle}>My Investments</Text>
        {myLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />
        ) : !myPackages || myPackages.length === 0 ? (
          <Text style={[s.emptyText, { paddingHorizontal: 20 }]}>No investments yet</Text>
        ) : (
          myPackages.map((p) => (
            <View key={p.id} style={s.myCard}>
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <StatusDot status={p.status} />
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                    {p.packageName ?? "Package"}
                  </Text>
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                  {p.expiresAt ? `Expires ${new Date(p.expiresAt).toLocaleDateString()}` : p.status}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.success, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                  +{fmt(p.dailyRoiAmount)}/day
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                  Invested: {fmt(p.purchasePrice)}
                </Text>
              </View>
            </View>
          ))
        )}

        <View style={s.bottomPad} />
      </ScrollView>
    </View>
  );
}
