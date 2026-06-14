import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { api, IncomeEntry } from "@/lib/api";

function fmt(v?: string | null) {
  const n = parseFloat(v ?? "0");
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

const FILTERS = [
  { key: "", label: "All" },
  { key: "roi", label: "ROI" },
  { key: "referral", label: "Referral" },
  { key: "royalty", label: "Royalty" },
  { key: "rank_reward", label: "Rank" },
] as const;

const TYPE_COLORS: Record<string, string> = {
  roi: "#26A17B",
  referral: "#3B82F6",
  royalty: "#A855F7",
  rank_reward: "#F0B90B",
};

const TYPE_ICONS: Record<string, string> = {
  roi: "📈",
  referral: "👥",
  royalty: "👑",
  rank_reward: "🏆",
};

export default function IncomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("");

  const { data: summary, isLoading: sumLoading, refetch: refetchSum } = useQuery({
    queryKey: ["income", "summary"],
    queryFn: () => api.income.summary(),
  });

  const { data: entries, isLoading: listLoading, refetch: refetchList } = useQuery({
    queryKey: ["income", filter],
    queryFn: () => api.income.list(filter || undefined),
  });

  const onRefresh = () => { refetchSum(); refetchList(); };

  const totalIncome = [summary?.roi, summary?.referral, summary?.royalty, summary?.rankReward]
    .reduce((a, v) => a + parseFloat(v ?? "0"), 0)
    .toFixed(2);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: topPad + 12, paddingHorizontal: 20, paddingBottom: 8 },
    title: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
    totalCard: {
      marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.card,
      borderRadius: 16, padding: 20, alignItems: "center",
      borderWidth: 1, borderColor: colors.primary + "44",
    },
    totalLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 1 },
    totalValue: { fontSize: 32, fontFamily: "Inter_700Bold", color: colors.primary, marginTop: 4 },
    summaryRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 16, flexWrap: "wrap" },
    sumCard: { flex: 1, minWidth: "45%", backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
    sumLabel: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
    sumValue: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 4 },
    filters: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 12 },
    filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
    filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    filterTextActive: { color: colors.primaryForeground },
    entryRow: {
      marginHorizontal: 20, marginBottom: 6, backgroundColor: colors.card,
      borderRadius: 10, padding: 14, flexDirection: "row", justifyContent: "space-between",
      alignItems: "center", borderWidth: 1, borderColor: colors.border,
    },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    typeBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    entryAmt: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.success },
    entryDate: { fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    emptyText: { color: colors.mutedForeground, fontSize: 13, textAlign: "center", paddingVertical: 20, fontFamily: "Inter_400Regular" },
    bottomPad: { height: Platform.OS === "web" ? 34 : insets.bottom + 80 },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Income</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={sumLoading || listLoading} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Total */}
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>Total Income Earned</Text>
          {sumLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
          ) : (
            <Text style={s.totalValue}>{totalIncome} <Text style={{ fontSize: 16, color: colors.mutedForeground }}>USDT</Text></Text>
          )}
        </View>

        {/* Summary cards */}
        {!sumLoading && summary && (
          <View style={s.summaryRow}>
            {[
              { key: "roi", label: "ROI Income", value: summary.roi },
              { key: "referral", label: "Referral", value: summary.referral },
              { key: "royalty", label: "Royalty", value: summary.royalty },
              { key: "rank_reward", label: "Rank Reward", value: summary.rankReward },
            ].map(({ key, label, value }) => (
              <View key={key} style={s.sumCard}>
                <Text style={s.sumLabel}>{TYPE_ICONS[key]} {label}</Text>
                <Text style={[s.sumValue, { color: TYPE_COLORS[key] }]}>{fmt(value)} <Text style={{ fontSize: 11, color: colors.mutedForeground }}>USDT</Text></Text>
              </View>
            ))}
          </View>
        )}

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterBtn, filter === f.key && s.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Income list */}
        {listLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : !entries || entries.length === 0 ? (
          <Text style={s.emptyText}>No income entries yet</Text>
        ) : (
          entries.map((entry) => (
            <View key={entry.id} style={s.entryRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[s.typeBadge, { backgroundColor: TYPE_COLORS[entry.type] + "22" }]}>
                  <Text style={[s.typeBadgeText, { color: TYPE_COLORS[entry.type] }]}>
                    {TYPE_ICONS[entry.type]} {entry.type.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
                <Text style={s.entryDate}>{new Date(entry.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={s.entryAmt}>+{fmt(entry.amount)} USDT</Text>
            </View>
          ))
        )}

        <View style={s.bottomPad} />
      </ScrollView>
    </View>
  );
}
