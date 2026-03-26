import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTRPC } from "@/trpc/client";

export default function HomeScreen() {
  const trpc = useTRPC();
  const { data: summary, isLoading } = useQuery(trpc.portfolio.summary.queryOptions());
  const { data: holdings = [] } = useQuery(trpc.portfolio.holdings.queryOptions());

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading portfolio…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Summary */}
      {summary && (
        <View style={styles.summaryGrid}>
          <SummaryCard label="Total Value" value={fmtUSD(summary.totalValue)} />
          <SummaryCard
            label="Today"
            value={`${summary.dailyPnl >= 0 ? "+" : ""}${fmtUSD(summary.dailyPnl)}`}
            positive={summary.dailyPnl >= 0}
          />
          <SummaryCard
            label="Total Return"
            value={fmtPct(summary.totalPnlPct)}
            positive={summary.totalPnl >= 0}
          />
          <SummaryCard label="Positions" value={String(summary.positionCount)} />
        </View>
      )}

      {/* Holdings */}
      <Text style={styles.sectionTitle}>Holdings</Text>
      {holdings
        .sort((a, b) => b.marketValue - a.marketValue)
        .map((h) => (
          <View key={h.id} style={styles.holdingRow}>
            <View style={styles.holdingLeft}>
              <Text style={styles.ticker}>{h.ticker}</Text>
              <Text style={styles.holdingName}>{h.name}</Text>
            </View>
            <View style={styles.holdingRight}>
              <Text style={styles.marketValue}>{fmtUSD(h.marketValue, 0)}</Text>
              <Text style={[styles.pnl, h.unrealizedPnl >= 0 ? styles.positive : styles.negative]}>
                {h.unrealizedPnl >= 0 ? "+" : ""}{fmtPct(h.unrealizedPnlPct)}
              </Text>
            </View>
          </View>
        ))}
    </ScrollView>
  );
}

function SummaryCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, positive !== undefined && (positive ? styles.positive : styles.negative)]}>
        {value}
      </Text>
    </View>
  );
}

function fmtUSD(n: number, decimals = 2) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  content: { padding: 16, gap: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#6b7280", fontSize: 14 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  summaryCard: { flex: 1, minWidth: "45%", backgroundColor: "#111827", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#1f2937" },
  summaryLabel: { color: "#6b7280", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  summaryValue: { color: "#f9fafb", fontSize: 18, fontWeight: "700", marginTop: 4 },
  sectionTitle: { color: "#9ca3af", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8, marginBottom: 4 },
  holdingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#111827", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#1f2937" },
  holdingLeft: { flex: 1 },
  holdingRight: { alignItems: "flex-end" },
  ticker: { color: "#f9fafb", fontSize: 15, fontWeight: "600" },
  holdingName: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  marketValue: { color: "#f9fafb", fontSize: 15, fontWeight: "600" },
  pnl: { fontSize: 12, marginTop: 2 },
  positive: { color: "#34d399" },
  negative: { color: "#f87171" },
});
