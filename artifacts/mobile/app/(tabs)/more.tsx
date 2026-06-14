import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";

function fmt(v?: string | null) {
  const n = parseFloat(v ?? "0");
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const { data: summary } = useQuery({
    queryKey: ["income", "summary"],
    queryFn: () => api.income.summary(),
  });

  const { data: myPackages } = useQuery({
    queryKey: ["packages", "my"],
    queryFn: () => api.packages.my(),
  });

  const activePackages = myPackages?.filter((p) => p.status === "active").length ?? 0;
  const refLink = `https://televerse-1.replit.app?ref=${user?.referralCode ?? ""}`;

  const handleCopyRef = async () => {
    if (!user?.referralCode) return;
    await Clipboard.setStringAsync(refLink);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied!", "Referral link copied to clipboard.");
  };

  const handleShareRef = async () => {
    try {
      await Share.share({
        message: `Join Televerse and earn crypto! Use my referral link: ${refLink}`,
        url: refLink,
      });
    } catch {}
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)");
        },
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const totalIncome = [summary?.roi, summary?.referral, summary?.royalty]
    .reduce((a, v) => a + parseFloat(v ?? "0"), 0)
    .toFixed(2);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topPad + 12, paddingHorizontal: 20, paddingBottom: 8 },
    title: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    profileCard: {
      marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.card,
      borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border,
      flexDirection: "row", alignItems: "center", gap: 16,
    },
    avatar: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: colors.primary + "22",
      alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: colors.primary + "44",
    },
    avatarText: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.primary },
    userName: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    userEmail: { fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    statsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 16 },
    statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    statValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground },
    statLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginTop: 2 },
    refCard: {
      marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.card,
      borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border,
    },
    refLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.8 },
    refCode: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.primary, letterSpacing: 4, marginTop: 6, marginBottom: 14 },
    refActions: { flexDirection: "row", gap: 10 },
    refBtn: {
      flex: 1, height: 42, borderRadius: 10, flexDirection: "row",
      alignItems: "center", justifyContent: "center", gap: 6,
    },
    menuCard: {
      marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.card,
      borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    menuItem: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 15,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    menuItemLast: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 15,
    },
    menuText: { fontSize: 15, fontFamily: "Inter_500Medium", color: colors.foreground, flex: 1, marginLeft: 12 },
    bottomPad: { height: Platform.OS === "web" ? 34 : insets.bottom + 80 },
  });

  const initials = user?.fullName
    ? user.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : (user?.email?.[0] ?? "T").toUpperCase();

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>More</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.userName}>{user?.fullName ?? "User"}</Text>
            <Text style={s.userEmail}>{user?.email ?? ""}</Text>
          </View>
          {user?.isAdmin && (
            <View style={{ backgroundColor: colors.primary + "22", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>ADMIN</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: colors.success }]}>{fmt(totalIncome)}</Text>
            <Text style={s.statLabel}>Total Earned</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: colors.primary }]}>{activePackages}</Text>
            <Text style={s.statLabel}>Active Pkgs</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: colors.foreground }]}>{fmt(user?.walletBalance)}</Text>
            <Text style={s.statLabel}>Wallet USDT</Text>
          </View>
        </View>

        {/* Referral */}
        <View style={s.refCard}>
          <Text style={s.refLabel}>🎁 Your Referral Code</Text>
          <Text style={s.refCode}>{user?.referralCode ?? "—"}</Text>
          <View style={s.refActions}>
            <TouchableOpacity
              style={[s.refBtn, { backgroundColor: colors.primary + "22", borderWidth: 1, borderColor: colors.primary + "44" }]}
              onPress={handleCopyRef}
            >
              <Feather name="copy" size={15} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.refBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
              onPress={handleShareRef}
            >
              <Feather name="share-2" size={15} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu items */}
        <View style={s.menuCard}>
          <TouchableOpacity style={s.menuItem} onPress={() => Alert.alert("Support", "Email: support@televerse.app")}>
            <Feather name="help-circle" size={18} color={colors.mutedForeground} />
            <Text style={s.menuText}>Support</Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={s.menuItemLast} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[s.menuText, { color: colors.destructive }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={s.bottomPad} />
      </ScrollView>
    </View>
  );
}
